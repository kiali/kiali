/**
 * Playwright test tag options aligned with Cypress Gherkin @tags and playwright.config projects.
 * Use as the second argument to test(): test('title', smokeAndCoreCaching, async () => { ... })
 */

/** @smoke + @core-caching — smoke project and Cypress core-caching grep suite */
export const smokeAndCoreCaching = { tag: ['@smoke', '@core-caching'] };

/** @smoke only */
export const smokeOnly = { tag: '@smoke' as const };

/** @core-caching only */
export const coreCachingOnly = { tag: '@core-caching' as const };

/** @core-1 — frontend-core-1 Playwright / Cypress suite */
export const core1 = { tag: '@core-1' as const };

/** @core-2 — frontend-core-2 Playwright / Cypress suite */
export const core2 = { tag: '@core-2' as const };

/** @smoke + @prometheus-disabled */
export const smokeAndPrometheusDisabled = { tag: ['@smoke', '@prometheus-disabled'] };

/** @crd-validation — frontend-core-optional Playwright / Cypress suite */
export const crdValidationOnly = { tag: '@crd-validation' as const };

/** @perses — frontend-core-optional Playwright / Cypress suite */
export const persesOnly = { tag: '@perses' as const };

/** @ambient — frontend-ambient Playwright / Cypress suite */
export const ambientOnly = { tag: '@ambient' as const };

/** @ambient-multi-primary — KinD multi-primary ambient Playwright suite */
export const ambientMultiPrimaryOnly = { tag: '@ambient-multi-primary' as const };

/** @waypoint-multicluster — KinD multi-primary ambient + bookinfo-waypoints Playwright suite */
export const waypointMulticlusterOnly = { tag: '@waypoint-multicluster' as const };

/** @waypoint — frontend-ambient Playwright / Cypress suite */
export const waypointOnly = { tag: '@waypoint' as const };

/** @waypoint-tracing — frontend-ambient Playwright / Cypress suite */
export const waypointTracingOnly = { tag: '@waypoint-tracing' as const };

/** @external-kiali — external Kiali multicluster mesh page suite */
export const externalKialiOnly = { tag: '@external-kiali' as const };

/** @offline — offline mode Playwright / Cypress suite */
export const offlineOnly = { tag: '@offline' as const };

/** @ai-chatbot — AI chatbot Playwright suite */
export const aiChatbotOnly = { tag: '@ai-chatbot' as const };

/** @tracing — frontend-tempo / Playwright tracing project (excludes @waypoint-tracing) */
export const tracingOnly = { tag: '@tracing' as const };

/** @multi-cluster — primary-remote KinD (excludes dual-tagged @multi-primary scenarios) */
export const multiClusterOnly = { tag: '@multi-cluster' as const };

/**
 * @multi-cluster-mutations — scales istiod/grafana down on east, breaking istio
 * webhook-validated writes cluster-wide. Runs in a separate sequential project
 * after the multi-cluster project so it never overlaps parallel workers.
 */
export const multiClusterMutating = { tag: '@multi-cluster-mutations' as const };

/** @multi-primary — KinD multi-primary (sidecar) Playwright suite */
export const multiPrimaryOnly = { tag: '@multi-primary' as const };

/** @authorization — limited-user RBAC (dual-tagged @multi-primary in Cypress) */
export const authorizationOnly = { tag: ['@authorization', '@multi-primary'] };

/** @multi-mesh — extra control planes on a single cluster (istio-system-31 / istio-system-31-1) */
export const multiMeshOnly = { tag: '@multi-mesh' as const };

/** Dual-tagged mesh infra check: core-caching and multi-mesh suites */
export const coreCachingAndMultiMesh = { tag: ['@core-caching', '@multi-mesh'] };
