import { execSync } from 'child_process';

import { kubectlExec } from './kubectl';

const GATEWAY_API_CRD = 'gateways.gateway.networking.k8s.io';
const GATEWAY_API_CRD_REF = 'v1.6.0';

export function isGatewayApiCrdInstalled(): boolean {
  return kubectlExec(`kubectl get crd ${GATEWAY_API_CRD}`).exitCode === 0;
}

/** Mirrors Cypress `@gateway-api` hook — KinD CI usually has CRDs from Sail install. */
export function ensureGatewayApiCrds(): void {
  if (isGatewayApiCrdInstalled()) {
    return;
  }

  execSync(
    `kubectl kustomize "github.com/kubernetes-sigs/gateway-api/config/crd?ref=${GATEWAY_API_CRD_REF}" | kubectl apply -f -`,
    { shell: true, stdio: 'inherit' }
  );
  kubectlExec('kubectl rollout restart deployment/kiali -n istio-system', true);
  kubectlExec('kubectl rollout status deployment/kiali -n istio-system --timeout=120s', true);
}
