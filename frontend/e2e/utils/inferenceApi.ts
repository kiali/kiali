import { execSync } from 'child_process';

const INFERENCE_CRD_REF = 'v1.5.0';
const INFERENCE_POOL_CRD = 'inferencepools.inference.networking.k8s.io';

export function isInferenceApiCrdInstalled(): boolean {
  try {
    execSync(`kubectl get crd ${INFERENCE_POOL_CRD}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** Mirrors Cypress `@gateway-api-ie` hook — KinD CI usually has CRDs from Sail install. */
export function ensureInferenceApiCrds(): void {
  if (isInferenceApiCrdInstalled()) {
    return;
  }

  execSync(
    `kubectl kustomize "github.com/kubernetes-sigs/gateway-api-inference-extension/config/crd?ref=${INFERENCE_CRD_REF}" | kubectl apply -f -`,
    { shell: true, stdio: 'inherit' }
  );
}

export function deleteK8sInferencePool(name: string, namespace: string): void {
  execSync(`kubectl delete ${INFERENCE_POOL_CRD} ${name} -n ${namespace} --ignore-not-found`, { stdio: 'ignore' });
}

export function applyMinimalK8sInferencePool(name: string, namespace: string, selector: string): void {
  const manifest = {
    apiVersion: 'inference.networking.k8s.io/v1',
    kind: 'InferencePool',
    metadata: { name, namespace },
    spec: {
      endpointPickerRef: {
        failureMode: 'FailClose',
        group: '',
        kind: 'Service',
        name: `${selector}-epp`,
        port: { number: 9002 }
      },
      selector: { matchLabels: { app: selector } },
      targetPorts: [{ number: 8000 }]
    }
  };

  execSync('kubectl apply -f -', { input: JSON.stringify(manifest), encoding: 'utf-8' });
}
