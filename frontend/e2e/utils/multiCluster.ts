import { execSync } from 'child_process';
import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { findMiniGraphNode, nodeInfo, readMiniGraphTopology } from './graphTopology';
import { kialiUrl } from './kialiUrl';
import { kubectlExec } from './kubectl';

export const EAST = 'east';
export const WEST = 'west';

export const cluster1Context = (): string => process.env.PLAYWRIGHT_CLUSTER1_CONTEXT ?? 'kind-east';

export const cluster2Context = (): string => process.env.PLAYWRIGHT_CLUSTER2_CONTEXT ?? 'kind-west';

const TRAFFIC_POLICY_APS = [
  'deny-all-bookinfo',
  'details-v1',
  'productpage-v1',
  'ratings-v1',
  'reviews-v1',
  'reviews-v2',
  'reviews-v3'
];
const TRAFFIC_POLICY_SIDECARS = [
  'details-v1',
  'productpage-v1',
  'ratings-v1',
  'reviews-v1',
  'reviews-v2',
  'reviews-v3'
];

export const deleteIstioOnClusters = async (
  request: APIRequestContext,
  path: string,
  clusters: string[] = [EAST, WEST]
): Promise<void> => {
  for (const cluster of clusters) {
    await request.delete(kialiUrl(`${path}?clusterName=${cluster}`), { failOnStatusCode: false });
  }
};

export const deleteGeneratedTrafficPolicies = async (request: APIRequestContext): Promise<void> => {
  for (const policy of TRAFFIC_POLICY_APS) {
    await deleteIstioOnClusters(
      request,
      `/api/namespaces/bookinfo/istio/security.istio.io/v1/AuthorizationPolicy/${policy}`
    );
  }
  for (const sidecar of TRAFFIC_POLICY_SIDECARS) {
    await deleteIstioOnClusters(request, `/api/namespaces/bookinfo/istio/networking.istio.io/v1/Sidecar/${sidecar}`);
  }
};

export const expectGeneratedTrafficPoliciesOnCluster = async (
  page: Page,
  cluster: string,
  visible: boolean
): Promise<void> => {
  for (const policy of TRAFFIC_POLICY_APS) {
    const row = page.getByTestId(`VirtualItem_Cluster${cluster}_Nsbookinfo_AuthorizationPolicy_${policy}`);
    if (visible) {
      await expect(row).toBeVisible();
    } else {
      await expect(row).toHaveCount(0);
    }
  }
  for (const sidecar of TRAFFIC_POLICY_SIDECARS) {
    const row = page.getByTestId(`VirtualItem_Cluster${cluster}_Nsbookinfo_Sidecar_${sidecar}`);
    if (visible) {
      await expect(row).toBeVisible();
    } else {
      await expect(row).toHaveCount(0);
    }
  }
};

export const deleteRequestRoutingOnClusters = async (request: APIRequestContext, service: string): Promise<void> => {
  await deleteIstioOnClusters(
    request,
    `/api/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService/${service}`
  );
  await deleteIstioOnClusters(
    request,
    `/api/namespaces/bookinfo/istio/networking.istio.io/v1/DestinationRule/${service}`
  );
};

export const deleteGatewayOnClusters = async (request: APIRequestContext, name: string): Promise<void> => {
  await deleteIstioOnClusters(request, `/api/namespaces/bookinfo/istio/networking.istio.io/v1/Gateway/${name}`);
};

export const applyAuthorizationPolicyOnCluster = (name: string, namespace: string, clusterContext: string): void => {
  const yaml = `apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: ${name}
  namespace: ${namespace}
spec: {}
`;
  execSync(`kubectl --context ${clusterContext} apply -n ${namespace} -f -`, {
    encoding: 'utf8',
    input: yaml
  });
};

export const scaleDeploymentOnContext = (
  context: string,
  namespace: string,
  deployment: string,
  replicas: number
): void => {
  kubectlExec(
    `kubectl --context ${context} scale -n ${namespace} --replicas=${replicas} deployment/${deployment}`,
    true
  );
  kubectlExec(
    `kubectl --context ${context} rollout status deployment ${deployment} -n ${namespace} --timeout=120s`,
    false
  );
};

export const expectNoDuplicateNamespaceValues = async (page: Page): Promise<void> => {
  await page.getByTestId('namespace-dropdown').click();
  const checkboxes = page.getByTestId('namespace-dropdown-list').locator('input[type="checkbox"][value]');
  const count = await checkboxes.count();
  const values: string[] = [];
  for (let i = 0; i < count; i++) {
    values.push((await checkboxes.nth(i).getAttribute('value')) ?? '');
  }
  await page.getByTestId('namespace-dropdown').click();
  expect(values.length).toBe(new Set(values).size);
};

export const ensureTrafficRoutingOnCluster = async (
  request: APIRequestContext,
  service: string,
  namespace: string,
  cluster: string
): Promise<void> => {
  const getResponse = await request.get(
    kialiUrl(
      `/api/namespaces/${namespace}/istio/networking.istio.io/v1/VirtualService/${service}?clusterName=${cluster}`
    ),
    { failOnStatusCode: false }
  );
  if (getResponse.status() !== 404) {
    return;
  }
  const body = {
    apiVersion: 'networking.istio.io/v1',
    kind: 'VirtualService',
    metadata: {
      labels: { kiali_wizard: 'request_routing' },
      name: service,
      namespace
    },
    spec: {
      gateways: null,
      hosts: [`${service}.${namespace}.svc.cluster.local`],
      http: [
        {
          route: [
            {
              destination: {
                host: `${service}.${namespace}.svc.cluster.local`,
                subset: 'v1'
              },
              weight: 33
            }
          ]
        }
      ]
    }
  };
  const createResponse = await request.post(
    kialiUrl(`/api/namespaces/${namespace}/istio/networking.istio.io/v1/VirtualService?clusterName=${cluster}`),
    { data: body }
  );
  expect(createResponse.ok()).toBeTruthy();
};

export const expectMiniGraphHasClusterNode = async (page: Page, type: string, cluster: string): Promise<void> => {
  await expect(async () => {
    const topology = await readMiniGraphTopology(page);
    const graphType = topology.graphType ?? 'versionedApp';
    const { isBox, nodeType } = nodeInfo(type, graphType);
    const matched = topology.nodes.filter(n => {
      const data = n.data as { cluster?: string; isBox?: string; nodeType?: string };
      return data.cluster === cluster && data.nodeType === nodeType && data.isBox === isBox;
    });
    expect(matched.length).toBeGreaterThan(0);
  }).toPass({ intervals: [3_000], timeout: 60_000 });
};

export const clickMiniGraphNode = async (
  page: Page,
  name: string,
  type: 'app' | 'service' | 'workload',
  cluster: string
): Promise<void> => {
  let nodeId = '';
  await expect(async () => {
    const topology = await readMiniGraphTopology(page);
    const node = findMiniGraphNode(topology, name, type, cluster);
    expect(node).toBeTruthy();
    nodeId = node!.id;
  }).toPass({ intervals: [3_000], timeout: 60_000 });
  if (type === 'app') {
    await page.locator(`[data-layer-id="groups"] [data-id="${nodeId}"]`).click();
  } else {
    await page.locator(`[data-id="${nodeId}"]`).click();
  }
};
