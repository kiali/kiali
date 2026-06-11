/*
  Shared utilities for managing Kiali configuration in Cypress tests.
  These functions allow tests to enable/disable Kiali features by modifying
  the Kiali CR (for operator installations) or ConfigMap (for Helm installations).
*/

// Type definition for Kiali runtime info
export interface KialiRuntimeInfo {
  configMapName: string;
  deploymentName: string;
  namespace: string;
}

/**
 * Discovers Kiali runtime information (deployment name, namespace, configmap name).
 * Supports both operator-managed and Helm installations.
 */
export const discoverKialiRuntimeInfo = (): Cypress.Chainable<KialiRuntimeInfo> => {
  const resolveConfigMap = (namespace: string, deploymentName: string): Cypress.Chainable<KialiRuntimeInfo> => {
    return cy
      .exec(
        `kubectl get deployment/${deploymentName} -n ${namespace} -o jsonpath="{.spec.template.spec.volumes[?(@.configMap)].configMap.name}"`,
        { failOnNonZeroExit: false }
      )
      .then(result => {
        // The jsonpath may return multiple configmap names (space-separated)
        // We need to find the one that contains config.yaml
        const configMapCandidates = result.stdout.trim().split(/\s+/).filter(Boolean);

        if (configMapCandidates.length === 0) {
          return cy.wrap({ configMapName: 'kiali', deploymentName, namespace });
        }

        if (configMapCandidates.length === 1) {
          return cy.wrap({ configMapName: configMapCandidates[0], deploymentName, namespace });
        }

        // Multiple configmaps - find the one with config.yaml
        const findConfigMapWithConfigYaml = (idx: number): Cypress.Chainable<string> => {
          if (idx >= configMapCandidates.length) {
            // Fallback to first candidate or 'kiali'
            return cy.wrap(configMapCandidates[0] || 'kiali');
          }

          const cmName = configMapCandidates[idx];
          return cy
            .exec(`kubectl get configmap ${cmName} -n ${namespace} -o jsonpath="{.data.config\\\\.yaml}"`, {
              failOnNonZeroExit: false
            })
            .then(cmRes => {
              if (cmRes.exitCode === 0 && cmRes.stdout.trim() !== '') {
                return cy.wrap(cmName);
              }
              return findConfigMapWithConfigYaml(idx + 1);
            });
        };

        return findConfigMapWithConfigYaml(0).then(configMapName => ({
          configMapName,
          deploymentName,
          namespace
        }));
      });
  };

  return cy
    .exec(
      'kubectl get deployments -A -l app.kubernetes.io/name=kiali -o=custom-columns=NS:.metadata.namespace,NAME:.metadata.name --no-headers',
      { failOnNonZeroExit: false }
    )
    .then(result => {
      cy.task(
        'log',
        `[DISCOVER_KIALI] label query: code=${result.code}, stdout="${result.stdout.trim()}", stderr="${result.stderr}"`
      );
      const lines = result.stdout
        .trim()
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

      if (!lines.length || lines[0] === '') {
        cy.task('log', '[DISCOVER_KIALI] Label query returned no results — trying fallback');
        // Fallback: look for a deployment named "kiali" in any namespace.
        return cy
          .exec(
            'kubectl get deployments -A -o=custom-columns=NS:.metadata.namespace,NAME:.metadata.name --no-headers',
            {
              failOnNonZeroExit: false
            }
          )
          .then(fallbackResult => {
            const fallbackLines = fallbackResult.stdout
              .split('\n')
              .map(l => {
                const parts = l.trim().split(/\s+/);
                return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : '';
              })
              .filter(l => l.includes('/kiali'))
              .filter(Boolean);

            cy.task('log', `[DISCOVER_KIALI] Fallback matches: ${JSON.stringify(fallbackLines)}`);

            const preferredNamespaces = ['istio-system', 'kiali-operator', 'default'];

            let fallbackChosen: string | undefined;
            for (const ns of preferredNamespaces) {
              fallbackChosen = fallbackLines.find(l => l.startsWith(`${ns}/`));
              if (fallbackChosen) {
                break;
              }
            }
            fallbackChosen = fallbackChosen ?? fallbackLines[0];

            if (!fallbackChosen) {
              throw new Error(
                'Unable to locate Kiali deployment. Tried label app.kubernetes.io/name=kiali and fallback deployment named "kiali" in any namespace.'
              );
            }

            cy.task('log', `[DISCOVER_KIALI] Fallback chosen: ${fallbackChosen}`);
            const [namespace, deploymentName] = fallbackChosen.split('/');
            return resolveConfigMap(namespace, deploymentName);
          });
      }

      // Parse the first line: "NAMESPACE   DEPLOYMENT_NAME"
      const parts = lines[0].split(/\s+/);
      const namespace = parts[0];
      const deploymentName = parts[1];
      cy.task('log', `[DISCOVER_KIALI] Found via label: namespace=${namespace}, deployment=${deploymentName}`);
      return resolveConfigMap(namespace, deploymentName);
    });
};

/**
 * Restarts the Kiali deployment and waits for it to be ready.
 */
export const restartKiali = (deploymentName: string, namespace: string): void => {
  cy.exec(
    `kubectl rollout restart deployment/${deploymentName} -n ${namespace} && kubectl rollout status deployment/${deploymentName} -n ${namespace} --timeout=240s`,
    { timeout: 300000 }
  );
};

/**
 * Configuration for enabling a Kiali feature.
 */
export interface KialiFeatureConfig {
  // The yq path to the config option (e.g., '.kiali_internal.graph_cache.enabled')
  configPath: string;
  // The CR spec path for operator installations (e.g., 'kiali_internal.graph_cache.enabled')
  crSpecPath: string;
  // Cypress env key to store the previous value
  envKeyPrev: string;
}

/**
 * Enables a Kiali feature by modifying the configuration.
 * Supports both operator (Kiali CR) and Helm (ConfigMap) installations.
 * Stores the previous value in Cypress env for cleanup.
 */
export const enableKialiFeature = (featureConfig: KialiFeatureConfig, value = true): void => {
  discoverKialiRuntimeInfo().then(info => {
    Cypress.env('KIALI_CONFIGMAP_NAME', info.configMapName);
    Cypress.env('KIALI_DEPLOYMENT_NAME', info.deploymentName);
    Cypress.env('KIALI_DEPLOYMENT_NAMESPACE', info.namespace);

    const doRestart = (): void => {
      restartKiali(info.deploymentName, info.namespace);
    };

    cy.exec(
      `kubectl get deployment/${info.deploymentName} -n ${info.namespace} -o jsonpath="{.metadata.annotations.operator-sdk\\/primary-resource}"`,
      { failOnNonZeroExit: false }
    ).then(result => {
      const primaryResource = result.stdout.trim();

      if (primaryResource) {
        // Operator installation - patch the Kiali CR
        const parts = primaryResource.split('/');
        const crNamespace = parts[0];
        const crName = parts[1];
        Cypress.env('KIALI_PRIMARY_RESOURCE', primaryResource);

        // Get current value
        cy.exec(`kubectl get kiali ${crName} -n ${crNamespace} -o jsonpath="{.spec.${featureConfig.crSpecPath}}"`, {
          failOnNonZeroExit: false
        }).then(r => {
          const prev = r.stdout.trim();
          Cypress.env(featureConfig.envKeyPrev, prev);
        });

        // Build the patch JSON dynamically using the last path segment as the key
        const pathParts = featureConfig.crSpecPath.split('.');
        const leafKey = pathParts[pathParts.length - 1];
        let patchObj: Record<string, unknown> = { [leafKey]: value };
        for (let i = pathParts.length - 2; i >= 0; i--) {
          patchObj = { [pathParts[i]]: patchObj };
        }
        const patchJson = JSON.stringify({ spec: patchObj });

        cy.exec(`kubectl patch kiali ${crName} -n ${crNamespace} --type merge -p '${patchJson}'`).then(() =>
          doRestart()
        );

        return;
      }

      // Helm installation - update the ConfigMap
      Cypress.env('KIALI_PRIMARY_RESOURCE', '');

      // Dump current config.yaml
      cy.exec(
        `kubectl get configmap ${info.configMapName} -n ${info.namespace} -o jsonpath="{.data.config\\\\.yaml}" > /tmp/kiali-config.yaml`
      );

      // Capture previous value (avoid yq's // alternative operator which treats false as falsy)
      cy.exec(`yq '${featureConfig.configPath}' /tmp/kiali-config.yaml`, {
        failOnNonZeroExit: false
      }).then(r => {
        Cypress.env(featureConfig.envKeyPrev, r.stdout.trim());
      });

      // Set the feature value
      cy.exec(`yq -i '${featureConfig.configPath} = ${value}' /tmp/kiali-config.yaml`);
      cy.exec(
        `kubectl create configmap ${info.configMapName} -n ${info.namespace} --from-file=config.yaml=/tmp/kiali-config.yaml -o yaml --dry-run=client | kubectl apply -f -`
      ).then(() => doRestart());
    });
  });
};

/**
 * Single-restart helper so callers that already know the install type
 * (operator vs Helm) don't have to re-discover deployment info.
 */
export const enableKialiCaching = (existingInfo?: KialiRuntimeInfo): void => {
  cy.task('log', `[ENABLE_CACHING] enableKialiCaching called, existingInfo=${existingInfo ? 'provided' : 'null'}`);

  const doPatch = (info: KialiRuntimeInfo): void => {
    const doRestart = (): void => {
      cy.task('log', `[ENABLE_CACHING] Restarting Kiali: deployment/${info.deploymentName} -n ${info.namespace}`);
      restartKiali(info.deploymentName, info.namespace);
      cy.task('log', '[ENABLE_CACHING] Kiali restart complete');
    };

    cy.exec(
      `kubectl get deployment/${info.deploymentName} -n ${info.namespace} -o jsonpath="{.metadata.annotations.operator-sdk\\/primary-resource}"`,
      { failOnNonZeroExit: false }
    ).then(result => {
      const primaryResource = result.stdout.trim();
      cy.task('log', `[ENABLE_CACHING] primary-resource="${primaryResource}" (code=${result.code})`);

      if (primaryResource) {
        const parts = primaryResource.split('/');
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
        cy.task('log', `[ENABLE_CACHING] Operator path: patching kiali ${parts[1]} -n ${parts[0]} with ${patchJson}`);
        cy.exec(`kubectl patch kiali ${parts[1]} -n ${parts[0]} --type merge -p '${patchJson}'`).then(patchResult => {
          cy.task(
            'log',
            `[ENABLE_CACHING] Patch result: code=${patchResult.code}, stdout="${patchResult.stdout}", stderr="${patchResult.stderr}"`
          );
          doRestart();
        });
        return;
      }

      cy.task('log', `[ENABLE_CACHING] Helm path: updating configmap ${info.configMapName} -n ${info.namespace}`);
      cy.exec(
        `kubectl get configmap ${info.configMapName} -n ${info.namespace} -o jsonpath="{.data.config\\\\.yaml}" > /tmp/kiali-config.yaml`
      );
      cy.exec(
        `yq -i '.kiali_internal.graph_cache.enabled = true | .kiali_internal.health_cache.enabled = true | .server.observability.metrics.health_status.enabled = true' /tmp/kiali-config.yaml`
      );
      cy.exec(
        `kubectl create configmap ${info.configMapName} -n ${info.namespace} --from-file=config.yaml=/tmp/kiali-config.yaml -o yaml --dry-run=client | kubectl apply -f -`
      ).then(() => {
        cy.task('log', '[ENABLE_CACHING] ConfigMap updated');
        doRestart();
      });
    });
  };

  if (existingInfo) {
    doPatch(existingInfo);
  } else {
    discoverKialiRuntimeInfo().then(info => doPatch(info));
  }
};

// Pre-defined feature configurations
export const GRAPH_CACHE_CONFIG: KialiFeatureConfig = {
  configPath: '.kiali_internal.graph_cache.enabled',
  crSpecPath: 'kiali_internal.graph_cache.enabled',
  envKeyPrev: 'GRAPH_CACHE_PREV'
};

export const HEALTH_CACHE_CONFIG: KialiFeatureConfig = {
  configPath: '.kiali_internal.health_cache.enabled',
  crSpecPath: 'kiali_internal.health_cache.enabled',
  envKeyPrev: 'HEALTH_CACHE_PREV'
};

export const PROMETHEUS_DISABLED_CONFIG: KialiFeatureConfig = {
  configPath: '.external_services.prometheus.enabled',
  crSpecPath: 'external_services.prometheus.enabled',
  envKeyPrev: 'PROMETHEUS_ENABLED_PREV'
};

export const USE_WAYPOINT_NAME_CONFIG: KialiFeatureConfig = {
  configPath: '.external_services.tracing.use_waypoint_name',
  crSpecPath: 'external_services.tracing.use_waypoint_name',
  envKeyPrev: 'USE_WAYPOINT_NAME_PREV'
};
