import { expect, type Page } from '@playwright/test';

type IstioConfigGvk = {
  group: string;
  kind: string;
  version: string;
};

const ISTIO_CONFIG_GVK: Record<string, IstioConfigGvk> = {
  AuthorizationPolicy: { group: 'security.istio.io', kind: 'AuthorizationPolicy', version: 'v1' },
  DestinationRule: { group: 'networking.istio.io', kind: 'DestinationRule', version: 'v1' },
  EnvoyFilter: { group: 'networking.istio.io', kind: 'EnvoyFilter', version: 'v1alpha3' },
  Gateway: { group: 'networking.istio.io', kind: 'Gateway', version: 'v1' },
  PeerAuthentication: { group: 'security.istio.io', kind: 'PeerAuthentication', version: 'v1' },
  RequestAuthentication: { group: 'security.istio.io', kind: 'RequestAuthentication', version: 'v1' },
  ServiceEntry: { group: 'networking.istio.io', kind: 'ServiceEntry', version: 'v1' },
  Sidecar: { group: 'networking.istio.io', kind: 'Sidecar', version: 'v1' },
  Telemetry: { group: 'telemetry.istio.io', kind: 'Telemetry', version: 'v1' },
  TrafficExtension: { group: 'extensions.istio.io', kind: 'TrafficExtension', version: 'v1alpha1' },
  VirtualService: { group: 'networking.istio.io', kind: 'VirtualService', version: 'v1' },
  WasmPlugin: { group: 'extensions.istio.io', kind: 'WasmPlugin', version: 'v1alpha1' },
  WorkloadEntry: { group: 'networking.istio.io', kind: 'WorkloadEntry', version: 'v1' },
  WorkloadGroup: { group: 'networking.istio.io', kind: 'WorkloadGroup', version: 'v1' }
};

export function istioConfigDetailsApiPath(namespace: string, typeName: string, name: string): string {
  const gvk = ISTIO_CONFIG_GVK[typeName];
  if (!gvk) {
    throw new Error(`Unknown Istio config type for details API: ${typeName}`);
  }
  return `/api/namespaces/${namespace}/istio/${gvk.group}/${gvk.version}/${gvk.kind}/${name}`;
}

/** Console route for Istio config details (no `/api` prefix). */
export function istioConfigDetailsConsolePath(namespace: string, typeName: string, name: string): string {
  return istioConfigDetailsApiPath(namespace, typeName, name).replace(/^\/api\//, '');
}

async function bustIstioConfigCache(page: Page): Promise<void> {
  await page.request.get(`/api/istio/config?_=${Date.now()}`);
}

/**
 * Poll the istio config details API until the object exists (HTTP 200). Non-200 responses
 * (e.g. 404 while the object is still propagating) are retried instead of failing immediately.
 */
export async function waitForIstioObjectDetails(
  page: Page,
  namespace: string,
  typeName: string,
  name: string
): Promise<void> {
  const path = istioConfigDetailsApiPath(namespace, typeName, name);

  await expect(async () => {
    await bustIstioConfigCache(page);
    // Details API allows only cluster, help, and validate query params (no `_` cache-bust).
    const response = await page.request.get(`${path}?validate=true`);
    if (response.status() === 404) {
      throw new Error('istio object not available yet (HTTP 404)');
    }
    if (!response.ok()) {
      throw new Error(`unexpected istio details response (HTTP ${response.status()})`);
    }
  }).toPass({ intervals: [3_000], timeout: 120_000 });
}
