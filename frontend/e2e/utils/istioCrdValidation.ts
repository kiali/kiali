import { execSync } from 'child_process';

import { kubectlDelete, kubectlExec } from './kubectl';

function labelsStringToJson(labelsString: string): string {
  if (labelsString.length === 0) {
    return '{}';
  }

  const labelsJson = labelsString
    .split(',')
    .map(lbl => {
      const [key, value] = lbl.split('=');
      return `"${key}": "${value}"`;
    })
    .join(',');

  return `{${labelsJson}}`;
}

function kubectlApplyManifest(manifest: string): void {
  execSync('kubectl apply -f -', { input: manifest, encoding: 'utf-8' });
}

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

function waitForIstioConfig(kind: string, name: string, namespace: string, timeoutMs = 30_000): void {
  const getCommand = `kubectl get ${kind} ${name} -n ${namespace}`;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (kubectlExec(getCommand).exitCode === 0) {
      return;
    }
    kubectlExec('sleep 0.5');
  }
  throw new Error(`Timed out waiting for ${kind} ${namespace}/${name}`);
}

export function deleteIstioConfig(kind: string, name: string, namespace: string): void {
  kubectlDelete(`${kind} ${name} -n ${namespace}`);
}

export function deleteIstioGateway(name: string, namespace: string): void {
  kubectlDelete(`gateway.networking.istio.io ${name} -n ${namespace}`);
}

export function applyAuthorizationPolicy(name: string, namespace: string): void {
  deleteIstioConfig('AuthorizationPolicy', name, namespace);
  kubectlApplyManifest(`{
    "apiVersion": "security.istio.io/v1",
    "kind": "AuthorizationPolicy",
    "metadata": {
        "name": "${name}",
        "namespace": "${namespace}"
    }
}`);
}

export function patchAuthorizationPolicyFromSourceNamespace(
  name: string,
  namespace: string,
  sourceNamespace: string
): void {
  kubectlExec(
    `kubectl patch AuthorizationPolicy ${name} -n ${namespace} --type=merge -p '{"spec":{"rules":[{"from":[{"source": {"namespaces":["${sourceNamespace}"]}}]}]}}'`,
    true
  );
  waitForIstioConfig('AuthorizationPolicy', name, namespace);
}

export function patchAuthorizationPolicyFromSourcePrincipal(name: string, namespace: string, principal: string): void {
  kubectlExec(
    `kubectl patch AuthorizationPolicy ${name} -n ${namespace} --type=merge -p '{"spec":{"rules":[{"from":[{"source": {"principals":["${principal}"]}}]}]}}'`,
    true
  );
}

export function patchAuthorizationPolicyToOperationMethod(name: string, namespace: string, method: string): void {
  kubectlExec(
    `kubectl patch AuthorizationPolicy ${name} -n ${namespace} --type=merge -p '{"spec":{"rules":[{"to":[{"operation": {"methods":["${method}"]}}]}]}}'`,
    true
  );
}

export function patchAuthorizationPolicyToOperationHost(name: string, namespace: string, host: string): void {
  kubectlExec(
    `kubectl patch AuthorizationPolicy ${name} -n ${namespace} --type=merge -p '{"spec":{"rules":[{"to":[{"operation": {"hosts":["${host}"]}}]}]}}'`,
    true
  );
}

export function applyDestinationRule(name: string, namespace: string, host: string): void {
  deleteIstioConfig('DestinationRule', name, namespace);
  kubectlApplyManifest(`{
    "apiVersion": "networking.istio.io/v1",
    "kind": "DestinationRule",
    "metadata": {
        "name": "${name}",
        "namespace": "${namespace}"
    },
    "spec": {
      "host": "${host}"
    }
}`);
}

export function patchDestinationRuleSubset(name: string, namespace: string, subset: string, labels: string): void {
  kubectlExec(
    `kubectl patch DestinationRule ${name} -n ${namespace} --type=merge -p '{"spec":{"subsets":[ {"name":"${subset}", "labels": ${labelsStringToJson(labels)} }]}}'`,
    true
  );
}

export function patchDestinationRuleEnableMtls(name: string, namespace: string): void {
  kubectlExec(
    `kubectl patch DestinationRule ${name} -n ${namespace} --type=merge -p '{"spec":{"trafficPolicy":{"tls": {"mode": "ISTIO_MUTUAL"}} }}'`,
    true
  );
}

export function patchDestinationRuleDisableMtls(name: string, namespace: string): void {
  kubectlExec(
    `kubectl patch DestinationRule ${name} -n ${namespace} --type=merge -p '{"spec":{"trafficPolicy":{"tls": {"mode": "DISABLE"}} }}'`,
    true
  );
}

export function applyVirtualService(name: string, namespace: string, routeName: string, routeHost: string): void {
  deleteIstioConfig('VirtualService', name, namespace);
  kubectlApplyManifest(`{
    "apiVersion": "networking.istio.io/v1",
    "kind": "VirtualService",
    "metadata": {
      "name": "${name}",
      "namespace": "${namespace}"
    },
    "spec": {
      "http": [
        {
          "name": "${routeName}",
          "route": [
            {
              "destination": {
                "host": "${routeHost}"
              }
            }
         ]
        }
      ]
    }
}`);
}

export function applyVirtualServiceWithSubset(
  name: string,
  namespace: string,
  routeName: string,
  routeHost: string,
  subset: string
): void {
  applyVirtualService(name, namespace, routeName, routeHost);
  kubectlExec(
    `kubectl patch VirtualService ${name} -n ${namespace} --type=json -p '[{"op": "add", "path": "/spec/http/0/route/0/destination/subset", "value": "${subset}"}]'`,
    true
  );
}

export function patchVirtualServiceHosts(name: string, namespace: string, hosts: string): void {
  const hostsJson = hosts
    .split(',')
    .map(h => `"${h}"`)
    .join(',');
  kubectlExec(
    `kubectl patch VirtualService ${name} -n ${namespace} --type=merge -p '{"spec":{"hosts": [${hostsJson}]}}'`,
    true
  );
}

export function patchVirtualServiceGateways(name: string, namespace: string, gateway: string): void {
  kubectlExec(
    `kubectl patch VirtualService ${name} -n ${namespace} --type=json -p '[{"op": "add", "path": "/spec/gateways", "value": ["${gateway}"]}]'`,
    true
  );
}

export function patchVirtualServiceRouteWeight(name: string, namespace: string, weight: number): void {
  kubectlExec(
    `kubectl patch VirtualService ${name} -n ${namespace} --type=json -p '[{"op": "add", "path": "/spec/http/0/route/0/weight", "value": ${weight}}]'`,
    true
  );
}

export function patchVirtualServiceAdditionalDestination(
  name: string,
  namespace: string,
  host: string,
  subset: string,
  weight: number
): void {
  kubectlExec(
    `kubectl patch VirtualService ${name} -n ${namespace} --type=json -p '[{"op": "add", "path": "/spec/http/0/route/-", "value": {"weight": ${weight}, "destination":{"host": "${host}", "subset": "${subset}"}} }]'`,
    true
  );
}

export function applyPeerAuthentication(name: string, namespace: string): void {
  deleteIstioConfig('PeerAuthentication', name, namespace);
  kubectlApplyManifest(`{
    "apiVersion": "security.istio.io/v1",
    "kind": "PeerAuthentication",
    "metadata": {
        "name": "${name}",
        "namespace": "${namespace}"
    }
}`);
}

export function patchPeerAuthenticationMtlsMode(name: string, namespace: string, mtlsMode: string): void {
  kubectlExec(
    `kubectl patch PeerAuthentication ${name} -n ${namespace} --type=merge -p '{"spec":{"mtls":{"mode": "${mtlsMode}"}}}'`,
    true
  );
}

export function applyIstioGateway(
  name: string,
  namespace: string,
  hosts: string,
  port: number,
  labelsString: string
): void {
  deleteIstioGateway(name, namespace);
  const hostsJson = hosts
    .split(',')
    .map(h => `"${h}"`)
    .join(',');
  kubectlApplyManifest(`{
      "apiVersion": "networking.istio.io/v1",
      "kind": "Gateway",
      "metadata": {
        "name": "${name}",
        "namespace": "${namespace}"
      },
      "spec": {
        "selector": ${labelsStringToJson(labelsString)},
        "servers": [
          {
            "port": {
              "number": ${port},
              "protocol": "HTTP",
              "name": "HTTP"
            },
            "hosts": [${hostsJson}]
          }
        ]
      }
}`);
  waitForIstioConfig('gateway.networking.istio.io', name, namespace);
}

export function applySidecar(name: string, namespace: string, hosts: string): void {
  deleteIstioConfig('Sidecar', name, namespace);
  const hostsJson = hosts
    .split(',')
    .map(h => `"${h}"`)
    .join(',');
  kubectlApplyManifest(`{
      "apiVersion": "networking.istio.io/v1",
      "kind": "Sidecar",
      "metadata": {
        "name": "${name}",
        "namespace": "${namespace}"
      },
      "spec": {
        "egress": [
          { "hosts": [${hostsJson}] }
        ]
      }
}`);
}

export function patchSidecarWorkloadSelector(name: string, namespace: string, labelsString: string): void {
  kubectlExec(
    `kubectl patch Sidecar ${name} -n ${namespace} --type=merge -p '{"spec":{"workloadSelector":{"labels": ${labelsStringToJson(labelsString)}}}}'`,
    true
  );
}

export function applyK8sGateway(
  name: string,
  namespace: string,
  hostname: string,
  protocol: string,
  port: string,
  gatewayClassName: string
): void {
  kubectlApplyManifest(`{
        "kind": "Gateway",
        "apiVersion": "gateway.networking.k8s.io/v1",
        "metadata": {
          "name": "${name}",
          "namespace": "${namespace}",
          "labels": {},
          "annotations": {}
        },
        "spec": {
          "gatewayClassName": "${gatewayClassName}",
          "listeners": [
            {
              "name": "foo",
              "port": ${port},
              "protocol": "${protocol}",
              "hostname": "${hostname}",
              "allowedRoutes": {
                "namespaces": {
                  "from": "All",
                  "selector": {
                    "matchLabels": {}
                  }
                }
              }
            }
          ],
          "addresses": []
        }
      }`);
}

export function patchK8sGatewayAddress(name: string, namespace: string, type: string, value: string): void {
  kubectlExec(
    `kubectl patch Gateway ${name} -n ${namespace} --type=merge -p '{"spec":{"addresses":[{"type": "${type}","value":"${value}"}]}}'`,
    true
  );
}

export function applyK8sReferenceGrant(name: string, namespace: string, fromNamespace: string): void {
  kubectlApplyManifest(`{
  "kind": "ReferenceGrant",
  "apiVersion": "gateway.networking.k8s.io/v1beta1",
  "metadata": {
    "name": "${name}",
    "namespace": "${namespace}",
    "labels": {},
    "annotations": {}
  },
  "spec": {
    "from": [
      {
        "kind": "HTTPRoute",
        "group": "gateway.networking.k8s.io",
        "namespace": "${fromNamespace}"
      }
    ],
    "to": [
      {
        "kind": "Service",
        "group": ""
      }
    ]
  }
}`);
}

/** Mirrors Cypress `@clean-istio-namespace-resources-after` hook. */
export function cleanIstioSystemTestResources(): void {
  kubectlDelete('PeerAuthentication default -n istio-system');
  kubectlDelete('Sidecar default -n istio-system');
  waitForResourceDeleted('kubectl get PeerAuthentication default -n istio-system');
  waitForResourceDeleted('kubectl get Sidecar default -n istio-system');
  kubectlExec('kubectl rollout restart deployment -n alpha', false);
  kubectlExec('kubectl rollout restart deployment -n beta', false);
  kubectlExec('kubectl rollout status deployment -n alpha --timeout=60s', false);
  kubectlExec('kubectl rollout status deployment -n beta --timeout=60s', false);
}

/** KIA0104 and similar scenarios delete VirtualService/bookinfo; restore sample networking once. */
export function restoreBookinfoNetworking(): void {
  kubectlExec(
    'sh -c \'ISTIO_DIR=$(ls -dt1 ../_output/istio-* 2>/dev/null | head -n1); [ -z "$ISTIO_DIR" ] && exit 0; NET="$ISTIO_DIR/samples/bookinfo/networking/bookinfo-gateway.yaml"; [ -f "$NET" ] || exit 0; kubectl apply -n bookinfo -f "$NET"\'',
    false
  );
  waitForResourceDeleted('kubectl get PeerAuthentication default -n istio-system');
  waitForResourceDeleted('kubectl get Sidecar default -n istio-system');
  kubectlExec('kubectl rollout restart deployment -n alpha', false);
  kubectlExec('kubectl rollout restart deployment -n beta', false);
  kubectlExec('kubectl rollout status deployment -n alpha --timeout=60s', false);
  kubectlExec('kubectl rollout status deployment -n beta --timeout=60s', false);
}
