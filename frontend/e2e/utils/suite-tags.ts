/**
 * Playwright test tag options aligned with Cypress Gherkin @tags and playwright.config projects.
 * Use as the second argument to test(): test('title', smokeAndCoreCaching, async () => { ... })
 */

/** @smoke + @core-caching — smoke project and Cypress core-caching grep suite */
export const smokeAndCoreCaching = { tag: ['@smoke', '@core-caching'] as const };

/** @smoke only */
export const smokeOnly = { tag: '@smoke' as const };

/** @core-caching only */
export const coreCachingOnly = { tag: '@core-caching' as const };

/** @core-1 — frontend-core-1 Playwright / Cypress suite */
export const core1 = { tag: '@core-1' as const };

/** @smoke + @prometheus-disabled */
export const smokeAndPrometheusDisabled = { tag: ['@smoke', '@prometheus-disabled'] as const };
