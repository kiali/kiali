import fs from 'fs';
import os from 'os';
import path from 'path';

import { type CachingState, writeCachingState } from './cachingState';
import { kubectlExec } from './kubectl';

export type KialiRuntimeInfo = {
  configMapName: string;
  deploymentName: string;
  namespace: string;
};

const PREFERRED_NAMESPACES = ['istio-system', 'kiali-operator', 'default'];

const bothCachesEnabled = (text: string, json: boolean): boolean => {
  if (json) {
    return (
      /"graph_cache"\s*:\s*\{[^}]*"enabled"\s*:\s*true/.test(text) &&
      /"health_cache"\s*:\s*\{[^}]*"enabled"\s*:\s*true/.test(text) &&
      /"health_status"\s*:\s*\{[^}]*"enabled"\s*:\s*true/.test(text)
    );
  }
  return (
    /graph_cache:\s*\n\s+enabled:\s*true/.test(text) &&
    /health_cache:\s*\n\s+enabled:\s*true/.test(text) &&
    /health_status:\s*\n\s+enabled:\s*true/.test(text)
  );
};

const isLocalKialiBaseUrl = (baseURL: string): boolean => {
  try {
    const host = new URL(baseURL).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
};

const resolveConfigMapName = (namespace: string, deploymentName: string): string => {
  const result = kubectlExec(
    `kubectl get deployment/${deploymentName} -n ${namespace} -o jsonpath="{.spec.template.spec.volumes[?(@.configMap)].configMap.name}"`
  );
  const candidates = result.stdout.split(/\s+/).filter(Boolean);
  if (candidates.length === 0) {
    return 'kiali';
  }
  if (candidates.length === 1) {
    return candidates[0];
  }

  for (const cmName of candidates) {
    const cmResult = kubectlExec(
      `kubectl get configmap ${cmName} -n ${namespace} -o jsonpath="{.data.config\\\\.yaml}"`
    );
    if (cmResult.exitCode === 0 && cmResult.stdout.trim() !== '') {
      return cmName;
    }
  }
  return candidates[0] ?? 'kiali';
};

export const discoverKialiRuntimeInfo = (): KialiRuntimeInfo => {
  const labelResult = kubectlExec(
    'kubectl get deployments -A -l app.kubernetes.io/name=kiali -o=custom-columns=NS:.metadata.namespace,NAME:.metadata.name --no-headers'
  );
  const lines = labelResult.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length > 0 && lines[0] !== '') {
    const [namespace, deploymentName] = lines[0].split(/\s+/);
    return {
      configMapName: resolveConfigMapName(namespace, deploymentName),
      deploymentName,
      namespace
    };
  }

  const fallbackResult = kubectlExec(
    'kubectl get deployments -A -o=custom-columns=NS:.metadata.namespace,NAME:.metadata.name --no-headers'
  );
  const fallbackLines = fallbackResult.stdout
    .split('\n')
    .map(line => {
      const parts = line.trim().split(/\s+/);
      return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : '';
    })
    .filter(line => line.includes('/kiali'))
    .filter(Boolean);

  let chosen = '';
  for (const ns of PREFERRED_NAMESPACES) {
    chosen = fallbackLines.find(line => line.startsWith(`${ns}/`)) ?? '';
    if (chosen) {
      break;
    }
  }
  chosen = chosen || fallbackLines[0] || '';

  if (!chosen) {
    throw new Error(
      'Unable to locate Kiali deployment for caching setup. Tried label app.kubernetes.io/name=kiali and deployment named "kiali".'
    );
  }

  const [namespace, deploymentName] = chosen.split('/');
  return {
    configMapName: resolveConfigMapName(namespace, deploymentName),
    deploymentName,
    namespace
  };
};

const restartKiali = (deploymentName: string, namespace: string): void => {
  kubectlExec(
    `kubectl rollout restart deployment/${deploymentName} -n ${namespace} && kubectl rollout status deployment/${deploymentName} -n ${namespace} --timeout=240s`,
    true
  );
};

const fetchKialiConfigText = (info: KialiRuntimeInfo): { isJson: boolean; text: string } => {
  const primaryResource = kubectlExec(
    `kubectl get deployment/${info.deploymentName} -n ${info.namespace} -o jsonpath="{.metadata.annotations.operator-sdk\\/primary-resource}"`
  ).stdout.trim();

  if (primaryResource) {
    const [crNamespace, crName] = primaryResource.split('/');
    const crResult = kubectlExec(`kubectl get kiali ${crName} -n ${crNamespace} -o jsonpath="{.spec}"`, false);
    const text = crResult.stdout.trim();
    return { isJson: text.startsWith('{'), text };
  }

  const cmResult = kubectlExec(
    `kubectl get configmap ${info.configMapName} -n ${info.namespace} -o jsonpath="{.data.config\\\\.yaml}"`,
    false
  );
  return { isJson: false, text: cmResult.stdout };
};

const patchOperatorCaching = (info: KialiRuntimeInfo): void => {
  const primaryResource = kubectlExec(
    `kubectl get deployment/${info.deploymentName} -n ${info.namespace} -o jsonpath="{.metadata.annotations.operator-sdk\\/primary-resource}"`
  ).stdout.trim();
  const [crNamespace, crName] = primaryResource.split('/');
  const patchJson = JSON.stringify({
    spec: {
      kiali_internal: {
        graph_cache: { enabled: true },
        health_cache: { enabled: true }
      },
      server: {
        observability: {
          metrics: {
            health_status: { enabled: true }
          }
        }
      }
    }
  });
  const patchFile = path.join(os.tmpdir(), `kiali-caching-patch-${Date.now()}.json`);
  fs.writeFileSync(patchFile, patchJson);
  kubectlExec(`kubectl patch kiali ${crName} -n ${crNamespace} --type merge --patch-file ${patchFile}`, true);
  fs.unlinkSync(patchFile);
};

const patchHelmCaching = (info: KialiRuntimeInfo): void => {
  const configPath = path.join(os.tmpdir(), 'kiali-config.yaml');
  kubectlExec(
    `kubectl get configmap ${info.configMapName} -n ${info.namespace} -o jsonpath="{.data.config\\\\.yaml}" > ${configPath}`,
    true
  );
  kubectlExec(
    `yq -i '.kiali_internal.graph_cache.enabled = true | .kiali_internal.health_cache.enabled = true | .server.observability.metrics.health_status.enabled = true' ${configPath}`,
    true
  );
  kubectlExec(
    `kubectl create configmap ${info.configMapName} -n ${info.namespace} --from-file=config.yaml=${configPath} -o yaml --dry-run=client | kubectl apply -f -`,
    true
  );
};

const enableKialiCaching = (info: KialiRuntimeInfo): void => {
  const primaryResource = kubectlExec(
    `kubectl get deployment/${info.deploymentName} -n ${info.namespace} -o jsonpath="{.metadata.annotations.operator-sdk\\/primary-resource}"`
  ).stdout.trim();

  if (primaryResource) {
    patchOperatorCaching(info);
  } else {
    patchHelmCaching(info);
  }
  restartKiali(info.deploymentName, info.namespace);
};

const enabledCachingState = (mode: CachingState['mode']): CachingState => ({
  graphCacheEnabled: true,
  healthCacheEnabled: true,
  healthStatusMetricsEnabled: true,
  mode
});

/**
 * Ensures graph/health caches and health_status metrics are enabled for @core-caching tests.
 * Local Kiali (localhost) is assumed to use cache-enabled config; in-cluster installs are patched via kubectl.
 */
export const ensureKialiCachingForTests = (): CachingState => {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';
  if (isLocalKialiBaseUrl(baseURL)) {
    const state = enabledCachingState('local-config');
    writeCachingState(state);
    return state;
  }

  const info = discoverKialiRuntimeInfo();
  const { isJson, text } = fetchKialiConfigText(info);
  if (bothCachesEnabled(text, isJson)) {
    const state = enabledCachingState('cluster-already-enabled');
    writeCachingState(state);
    return state;
  }

  enableKialiCaching(info);
  const state = enabledCachingState('cluster-patched');
  writeCachingState(state);
  return state;
};
