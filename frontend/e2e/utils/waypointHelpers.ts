import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';

import { discoverKialiRuntimeInfo } from './kialiCaching';
import { kubectlExec } from './kubectl';
import { kialiUrl } from './kialiUrl';

type ProxyStatus = {
  CDS?: string;
  EDS?: string;
  LDS?: string;
  RDS?: string;
};

type WorkloadPod = {
  name?: string;
  proxyStatus?: ProxyStatus;
};

const isSyncedOrIgnored = (status: string | undefined): boolean => {
  const s = status?.toLowerCase();
  return s === 'synced' || s === 'ignored';
};

/** CDS may be Stale on ambient/multi-cluster while the waypoint remains usable. */
const isSyncedOrIgnoredOrStale = (status: string | undefined): boolean => {
  const s = status?.toLowerCase();
  return s === 'synced' || s === 'ignored' || s === 'stale';
};

const proxyStatusHealthy = (pod: WorkloadPod): boolean => {
  const ps = pod.proxyStatus;
  return (
    isSyncedOrIgnoredOrStale(ps?.CDS) &&
    isSyncedOrIgnored(ps?.EDS) &&
    isSyncedOrIgnored(ps?.LDS) &&
    isSyncedOrIgnored(ps?.RDS)
  );
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

type GraphEdge = {
  data?: { traffic?: { protocol?: string } };
};

/**
 * Wait until every mesh-controller Gateway deployment reports healthy proxy status via Kiali API.
 */
export async function waitForAllWaypointsHealthy(request: APIRequestContext, timeoutMs = 600_000): Promise<void> {
  const listed = kubectlExec(
    `kubectl get deployments -A -l gateway.istio.io/managed=istio.io-mesh-controller -o jsonpath='{range .items[*]}{.metadata.name}/{.metadata.namespace} {end}'`
  );
  const waypoints = listed.stdout
    .split(/\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  for (const waypoint of waypoints) {
    const [name, namespace] = waypoint.split('/');
    if (!name || !namespace) {
      continue;
    }
    await waitForHealthyWaypoint(request, namespace, name, timeoutMs);
  }
}

export async function waitForHealthyWaypoint(
  request: APIRequestContext,
  namespace: string,
  name: string,
  timeoutMs = 600_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastSummary = '';

  while (Date.now() < deadline) {
    let response;
    try {
      response = await request.get(
        kialiUrl(`/api/namespaces/${namespace}/workloads/${name}?validate=true&rateInterval=60s&health=true`)
      );
    } catch (err) {
      lastSummary = `request-error=${err instanceof Error ? err.message : String(err)}`;
      await sleep(5_000);
      continue;
    }
    const body = (await response.json().catch(() => ({}))) as { pods?: WorkloadPod[] };
    const pods = Array.isArray(body.pods) ? body.pods : [];
    const proxySummary =
      pods.length > 0
        ? pods
            .slice(0, 3)
            .map(p => {
              const ps = p.proxyStatus ?? {};
              return `${p.name ?? 'pod'}(CDS=${ps.CDS ?? ''},EDS=${ps.EDS ?? ''},LDS=${ps.LDS ?? ''},RDS=${ps.RDS ?? ''})`;
            })
            .join(',')
        : 'no-pods';
    lastSummary = `status=${response.status()} pods=${pods.length} proxy=${proxySummary}`;

    if (response.ok() && pods.length > 0 && pods.every(proxyStatusHealthy)) {
      return;
    }

    await sleep(response.ok() ? 10_000 : 30_000);
  }

  throw new Error(
    `Waypoint not healthy within ${timeoutMs}ms (namespace=${namespace}, name=${name}, last=${lastSummary})`
  );
}

/** Poll gateway/workload traces until the API returns at least one trace. */
export async function waitForWorkloadTraces(
  request: APIRequestContext,
  namespace: string,
  workload: string,
  timeoutMs = 180_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastCount = -1;

  while (Date.now() < deadline) {
    const nowMicros = Date.now() * 1000;
    const qs = new URLSearchParams({
      startMicros: String(nowMicros - 10 * 60 * 1000 * 1000),
      endMicros: String(nowMicros),
      tags: '{}',
      limit: '100'
    });
    let response;
    try {
      response = await request.get(
        kialiUrl(`/api/namespaces/${namespace}/workloads/${workload}/traces?${qs.toString()}`)
      );
    } catch {
      await sleep(5_000);
      continue;
    }
    const body = (await response.json().catch(() => ({}))) as { data?: unknown[] };
    const traces = Array.isArray(body.data) ? body.data : [];
    lastCount = traces.length;
    if (response.ok() && traces.length > 0) {
      return;
    }
    await sleep(10_000);
  }

  throw new Error(`No traces for ${namespace}/${workload} within ${timeoutMs}ms (lastCount=${lastCount})`);
}

/**
 * Label the namespace with istio.io/use-waypoint and wait until Kiali namespaces API reflects it.
 * Install only applies the Gateway CR; enrollment is test-time.
 */
export async function labelNamespaceWithWaypoint(
  request: APIRequestContext,
  namespace: string,
  waypointName = 'waypoint',
  timeoutMs = 300_000
): Promise<void> {
  kubectlExec(`kubectl label namespace ${namespace} istio.io/use-waypoint=${waypointName} --overwrite`, false);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let response;
    try {
      response = await request.get(kialiUrl('/api/namespaces'));
    } catch {
      await sleep(5_000);
      continue;
    }
    expect(response.ok()).toBeTruthy();
    const namespaces = (await response.json()) as Array<{ name?: string; labels?: Record<string, string> }>;
    const ns = namespaces.find(n => n.name === namespace);
    const labels = ns?.labels ?? {};
    if (Object.values(labels).includes(waypointName) || labels['istio.io/use-waypoint'] === waypointName) {
      return;
    }
    await sleep(10_000);
  }

  throw new Error(`Namespace ${namespace} not enrolled with waypoint=${waypointName} within ${timeoutMs}ms`);
}

/**
 * Wait until the bookinfo graph API reports enough edges (and HTTP edges) for ambient traffic mode.
 * ambientTraffic: `ztunnel` (L4 readiness) or `waypoint` (L7 readiness).
 */
export async function waitForBookinfoWaypointGraphTraffic(
  request: APIRequestContext,
  ambientTraffic: 'ztunnel' | 'waypoint',
  namespace = 'bookinfo',
  timeoutMs = 600_000
): Promise<void> {
  const minTotalEdges = ambientTraffic === 'waypoint' ? 8 : 9;
  const minHttpEdges = 2;
  const deadline = Date.now() + timeoutMs;
  let lastEdgeCount = -1;
  let lastHttpEdgeCount = -1;

  while (Date.now() < deadline) {
    const qs = new URLSearchParams({
      duration: '300s',
      graphType: 'versionedApp',
      includeIdleEdges: 'false',
      injectServiceNodes: 'true',
      boxBy: 'cluster,namespace,app',
      waypoints: 'false',
      ambientTraffic,
      appenders: 'deadNode,istio,serviceEntry,meshCheck,workloadEntry,health,ambient',
      rateGrpc: 'requests',
      rateHttp: 'requests',
      rateTcp: 'sent',
      namespaces: namespace
    });
    let response;
    try {
      response = await request.get(kialiUrl(`/api/namespaces/graph?${qs.toString()}`));
    } catch {
      await sleep(5_000);
      continue;
    }
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { elements?: { edges?: GraphEdge[] } };
    const edges = body.elements?.edges ?? [];
    lastEdgeCount = edges.length;
    lastHttpEdgeCount = edges.filter(e => e.data?.traffic?.protocol === 'http').length;

    if (lastEdgeCount >= minTotalEdges && lastHttpEdgeCount >= minHttpEdges) {
      return;
    }
    await sleep(10_000);
  }

  throw new Error(
    `Graph traffic not ready within ${timeoutMs}ms (ambientTraffic=${ambientTraffic}, namespace=${namespace}, edges=${lastEdgeCount}, httpEdges=${lastHttpEdgeCount}, expected>=${minTotalEdges}, expectedHttp>=${minHttpEdges})`
  );
}

/** Background readiness used by bookinfo waypoint scenarios. */
export async function prepareBookinfoWaypoint(request: APIRequestContext): Promise<void> {
  await waitForAllWaypointsHealthy(request);
  await waitForWorkloadTraces(request, 'bookinfo', 'bookinfo-gateway-istio');
  await labelNamespaceWithWaypoint(request, 'bookinfo');
  await waitForBookinfoWaypointGraphTraffic(request, 'ztunnel', 'bookinfo');
}

/**
 * Wait until test-ambient + test-sidecar graph has enough HTTP and total edges
 * (sidecar↔ambient traffic scenarios).
 */
export async function waitForSidecarAmbientGraphTraffic(
  request: APIRequestContext,
  timeoutMs = 900_000
): Promise<void> {
  const targetNamespace = 'test-ambient,test-sidecar';
  const minHttpEdges = 4;
  const minTotalEdges = 8;
  const deadline = Date.now() + timeoutMs;
  let lastEdgeCount = -1;
  let lastHttpEdgeCount = -1;

  while (Date.now() < deadline) {
    const qs = new URLSearchParams({
      duration: '600s',
      graphType: 'versionedApp',
      includeIdleEdges: 'false',
      injectServiceNodes: 'true',
      boxBy: 'cluster,namespace,app',
      waypoints: 'false',
      ambientTraffic: 'total',
      appenders: 'deadNode,istio,serviceEntry,meshCheck,workloadEntry,health,ambient',
      rateGrpc: 'requests',
      rateHttp: 'requests',
      rateTcp: 'sent',
      namespaces: targetNamespace
    });
    let response;
    try {
      response = await request.get(kialiUrl(`/api/namespaces/graph?${qs.toString()}`));
    } catch {
      await sleep(5_000);
      continue;
    }
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { elements?: { edges?: GraphEdge[] } };
    const edges = body.elements?.edges ?? [];
    lastEdgeCount = edges.length;
    lastHttpEdgeCount = edges.filter(e => e.data?.traffic?.protocol === 'http').length;
    if (lastHttpEdgeCount >= minHttpEdges && lastEdgeCount >= minTotalEdges) {
      return;
    }
    await sleep(10_000);
  }

  throw new Error(
    `Sidecar ambient graph not ready within ${timeoutMs}ms (edges=${lastEdgeCount}, httpEdges=${lastHttpEdgeCount})`
  );
}

type TraceProcess = { serviceName?: string };
type TraceItem = { processes?: Record<string, TraceProcess>; traceID?: string };

/**
 * If gateway traces include a waypoint.* process name, enable tracing.use_waypoint_name
 * and restart Kiali (same conditional as the Setup scenario).
 */
export async function enableUseWaypointNameIfNeeded(request: APIRequestContext, namespace = 'bookinfo'): Promise<void> {
  const nowMicros = Date.now() * 1000;
  const qs = new URLSearchParams({
    startMicros: String(nowMicros - 10 * 60 * 1000 * 1000),
    endMicros: String(nowMicros),
    tags: '{}',
    limit: '20'
  });
  let response;
  try {
    response = await request.get(
      kialiUrl(`/api/namespaces/${namespace}/workloads/bookinfo-gateway-istio/traces?${qs.toString()}`)
    );
  } catch {
    return;
  }
  if (!response.ok()) {
    return;
  }
  const body = (await response.json()) as { data?: TraceItem[] };
  const traces = body.data ?? [];
  const serviceNames = new Set<string>();
  for (const trace of traces) {
    for (const proc of Object.values(trace.processes ?? {})) {
      if (proc.serviceName) {
        serviceNames.add(proc.serviceName);
      }
    }
  }
  if (![...serviceNames].some(name => name.startsWith('waypoint.'))) {
    return;
  }

  const info = discoverKialiRuntimeInfo();
  const primaryResource = kubectlExec(
    `kubectl get deployment/${info.deploymentName} -n ${info.namespace} -o jsonpath="{.metadata.annotations.operator-sdk\\/primary-resource}"`
  ).stdout.trim();

  if (primaryResource) {
    const [crNamespace, crName] = primaryResource.split('/');
    const patchJson = JSON.stringify({
      spec: { external_services: { tracing: { use_waypoint_name: true } } }
    });
    kubectlExec(`kubectl patch kiali ${crName} -n ${crNamespace} --type merge -p '${patchJson}'`, true);
  } else {
    const tmp = '/tmp/kiali-config-waypoint.yaml';
    kubectlExec(
      `kubectl get configmap ${info.configMapName} -n ${info.namespace} -o jsonpath="{.data.config\\\\.yaml}" > ${tmp}`,
      true
    );
    kubectlExec(`yq -i '.external_services.tracing.use_waypoint_name = true' ${tmp}`, true);
    kubectlExec(
      `kubectl create configmap ${info.configMapName} -n ${info.namespace} --from-file=config.yaml=${tmp} -o yaml --dry-run=client | kubectl apply -f -`,
      true
    );
  }

  kubectlExec(
    `kubectl rollout restart deployment/${info.deploymentName} -n ${info.namespace} && kubectl rollout status deployment/${info.deploymentName} -n ${info.namespace} --timeout=240s`,
    true
  );

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    try {
      const ready = await request.get(kialiUrl('/api'));
      if (ready.ok()) {
        return;
      }
    } catch {
      // Rollout can leave MetalLB ingress unreachable for a few seconds.
    }
    await sleep(5_000);
  }
}

/** First trace id from the workload traces API, if any. */
export async function getFirstWorkloadTraceId(
  request: APIRequestContext,
  namespace: string,
  workload: string
): Promise<string | undefined> {
  const nowMicros = Date.now() * 1000;
  const qs = new URLSearchParams({
    startMicros: String(nowMicros - 10 * 60 * 1000 * 1000),
    endMicros: String(nowMicros),
    tags: '{}',
    limit: '100'
  });
  const response = await request.get(
    kialiUrl(`/api/namespaces/${namespace}/workloads/${workload}/traces?${qs.toString()}`)
  );
  if (!response.ok()) {
    return undefined;
  }
  const body = (await response.json()) as { data?: TraceItem[] };
  return body.data?.[0]?.traceID;
}
