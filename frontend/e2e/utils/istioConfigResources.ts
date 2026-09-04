import { kubectlDelete, kubectlExec } from './kubectl';

function waitForResourceDeleted(getCommand: string, timeoutMs = 30_000): void {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (kubectlExec(getCommand).exitCode !== 0) {
      return;
    }
    kubectlExec('sleep 0.5');
  }
  throw new Error(`Timed out waiting for resource deletion: ${getCommand}`);
}

export function deleteK8sGateway(name: string, namespace = 'bookinfo'): void {
  kubectlDelete(`gateways.gateway.networking.k8s.io ${name} -n ${namespace}`);
  waitForResourceDeleted(`kubectl get gateways.gateway.networking.k8s.io ${name} -n ${namespace}`);
}

export function waitForK8sGateway(name: string, namespace = 'bookinfo', timeoutMs = 60_000): void {
  const getCommand = `kubectl get gateways.gateway.networking.k8s.io ${name} -n ${namespace}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (kubectlExec(getCommand).exitCode === 0) {
      return;
    }
    kubectlExec('sleep 1');
  }
  throw new Error(`Timed out waiting for gateway ${namespace}/${name}`);
}

/** TLS secret referenced by the K8s Gateway HTTPS wizard scenario. */
export function ensureBookinfoTlsCertSecret(): void {
  if (kubectlExec('kubectl get secret cert -n bookinfo').exitCode === 0) {
    return;
  }

  kubectlExec(
    'openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /tmp/kiali-e2e-cert.key -out /tmp/kiali-e2e-cert.crt -subj "/CN=website.com" 2>/dev/null',
    true
  );
  kubectlExec(
    'kubectl create secret tls cert --cert=/tmp/kiali-e2e-cert.crt --key=/tmp/kiali-e2e-cert.key -n bookinfo',
    true
  );
}

export function deleteK8sReferenceGrant(name: string, namespace = 'bookinfo'): void {
  kubectlDelete(`referencegrants.gateway.networking.k8s.io ${name} -n ${namespace}`);
}

/** Remove orphaned reviews-gateway left when delete traffic routing does not remove gateways. */
export function deleteBookinfoReviewsGateway(): void {
  const list = kubectlExec(
    'kubectl get gateways.gateway.networking.k8s.io -n bookinfo -o jsonpath=\'{range .items[*]}{.metadata.name}{"\\n"}{end}\''
  );
  if (list.exitCode === 0) {
    for (const name of list.stdout.split('\n').filter(line => line.startsWith('reviews-gateway'))) {
      kubectlDelete(`gateways.gateway.networking.k8s.io ${name} -n bookinfo`);
      waitForResourceDeleted(`kubectl get gateways.gateway.networking.k8s.io ${name} -n bookinfo`);
    }
  }
}

/** Remove leftover Gateway API routing from prior wizard runs on bookinfo/reviews. */
export function deleteBookinfoReviewsTrafficRouting(): void {
  kubectlDelete('httproutes.gateway.networking.k8s.io reviews -n bookinfo');
  kubectlDelete('grpcroutes.gateway.networking.k8s.io reviews -n bookinfo');
  deleteBookinfoReviewsGateway();
}
