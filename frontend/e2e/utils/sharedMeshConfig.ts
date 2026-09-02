import type { APIRequestContext } from '@playwright/test';
import { kubectlExec } from './kubectl';
import { hasSailIstioCr } from './kialiConfig';

const istioSharedMeshConfigMap = `
apiVersion: v1
data:
  mesh: |-
    outboundTrafficPolicy:
      mode: REGISTRY_ONLY
kind: ConfigMap
metadata:
  name: istio-user
  namespace: istio-system
`;

const restorePatch = '{"spec": {"values": {"pilot": {"env": {"SHARED_MESH_CONFIG": null}}}}}';
const applyPatch = '{"spec": {"values": {"pilot": {"env": {"SHARED_MESH_CONFIG": "istio-user"}}}}}';

function restoreSharedMeshConfigResources(): void {
  kubectlExec(`echo "${istioSharedMeshConfigMap}" | kubectl delete -f -`, false);
  kubectlExec(`kubectl patch istio default --type='merge' -p '${restorePatch}'`, false);
}

async function waitForSharedMeshConfig(request: APIRequestContext): Promise<void> {
  const maxTries = 20;
  for (let tries = 1; tries <= maxTries; tries++) {
    const response = await request.get('/api/mesh/graph');
    if (!response.ok()) {
      restoreSharedMeshConfigResources();
      throw new Error(`Expected 200 from /api/mesh/graph, got ${response.status()}`);
    }
    const body = await response.json();
    const istiodNode = body.elements?.nodes?.find(
      (node: { data?: { infraType?: string; infraData?: { config?: { sharedConfig?: unknown } } } }) =>
        node.data?.infraType === 'istiod'
    );
    if (istiodNode?.data?.infraData?.config?.sharedConfig !== undefined) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  restoreSharedMeshConfigResources();
  throw new Error('Timed out waiting for Kiali to see the Shared Mesh Config');
}

export async function applySharedMeshConfig(request: APIRequestContext): Promise<void> {
  if (!hasSailIstioCr()) {
    throw new Error('Sail Istio CR (istio default) is not installed — shared mesh config test requires Sail operator');
  }

  const podResult = kubectlExec(
    `kubectl get pods -l app=istiod -n istio-system -o jsonpath="{.items[0].metadata.name}"`,
    true
  );
  const podName = podResult.stdout;

  kubectlExec(`echo "${istioSharedMeshConfigMap}" | kubectl apply -f -`, true);
  kubectlExec(`kubectl patch istio default --type='merge' -p '${applyPatch}'`, true);
  await waitForSharedMeshConfig(request);
  kubectlExec(`kubectl wait --for=delete pod/${podName} -n istio-system --timeout=180s`, true);
}

export function restoreSharedMeshConfig(): void {
  restoreSharedMeshConfigResources();
}
