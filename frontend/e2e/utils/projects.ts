import type { TestInfo } from '@playwright/test';

/**
 * Playwright project that runs against `kiali run offline` must-gather data.
 * Shared by playwright.config.ts and the specs that branch on offline mode.
 * If renamed, also update `playwright:run:offline` in package.json (`--project=offline`).
 */
export const OFFLINE_PROJECT_NAME = 'offline';

/** True when the current test runs in the offline must-gather project. */
export const isOfflineProject = (info: TestInfo): boolean => info.project.name === OFFLINE_PROJECT_NAME;
