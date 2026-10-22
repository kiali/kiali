/**
 * Playwright test tag options aligned with the CI suite projects in playwright.config.
 * Use as the second argument to test(): test('title', smokeAndCoreCaching, async () => { ...
 */

/** @smoke + @core-caching — smoke project and core-caching CI suite */
export const smokeAndCoreCaching = { tag: ['@smoke', '@core-caching'] };

/** @smoke only */
export const smokeOnly = { tag: '@smoke' as const };

/** @core-caching only */
export const coreCachingOnly = { tag: '@core-caching' as const };

/** @core-1 — frontend-core-1 Playwright suite */
export const core1 = { tag: '@core-1' as const };

/** @core-2 — frontend-core-2 Playwright suite */
export const core2 = { tag: '@core-2' as const };

/** @smoke + @prometheus-disabled */
export const smokeAndPrometheusDisabled = { tag: ['@smoke', '@prometheus-disabled'] };

/** @crd-validation — frontend-core-optional suite */
export const crdValidationOnly = { tag: '@crd-validation' as const };

/** @perses — frontend-core-optional suite */
export const persesOnly = { tag: '@perses' as const };

/** @ambient — frontend-ambient suite */
export const ambientOnly = { tag: '@ambient' as const };

/** @ambient-multi-primary — KinD multi-primary ambient suite */
export const ambientMultiPrimaryOnly = { tag: '@ambient-multi-primary' as const };

/** @waypoint-multicluster — KinD multi-primary ambient + bookinfo-waypoints Playwright suite */
export const waypointMulticlusterOnly = { tag: '@waypoint-multicluster' as const };

/** @waypoint — frontend-ambient suite */
export const waypointOnly = { tag: '@waypoint' as const };

/** @waypoint-tracing — frontend-ambient suite */
export const waypointTracingOnly = { tag: '@waypoint-tracing' as const };

/** @external-kiali — external Kiali multicluster mesh page suite */
export const externalKialiOnly = { tag: '@external-kiali' as const };

/** @offline — offline mode suite */
export const offlineOnly = { tag: '@offline' as const };

/** @ai-chatbot — AI chatbot suite */
export const aiChatbotOnly = { tag: '@ai-chatbot' as const };

/** @tracing — tracing project (excludes @waypoint-tracing) */
export const tracingOnly = { tag: '@tracing' as const };

/** @multi-cluster — primary-remote KinD suite (excludes dual-tagged @multi-primary tests) */
export const multiClusterOnly = { tag: '@multi-cluster' as const };

/**
 * @multi-cluster-mutations — scales istiod/grafana down on east, breaking istio
 * webhook-validated writes cluster-wide. Runs in its own project that depends on
 * the multi-cluster project in playwright.config.ts, so it never overlaps that
 * suite's parallel workers.
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

/**
 * Dual-tagged offline reruns: the same test runs in its live-cluster suite
 * (core-1, core-2, core-caching, ambient) and in the offline must-gather
 * project, mirroring Cypress scenarios tagged e.g. `@core-1 @offline`.
 */
export const core1AndOffline = { tag: ['@core-1', '@offline'] };

export const core2AndOffline = { tag: ['@core-2', '@offline'] };

export const coreCachingAndOffline = { tag: ['@core-caching', '@offline'] };

export const ambientAndOffline = { tag: ['@ambient', '@offline'] };
