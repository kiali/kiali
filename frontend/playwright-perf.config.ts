import { defineConfig, devices } from '@playwright/test';
import { AUTH_FILE } from './e2e/utils/auth';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';
const isCI = !!process.env.CI;

/**
 * Perf suite — separate from `playwright.config.ts` because measurements need a
 * single worker, no retries, and no tracing/video overhead. Timings are written
 * to `playwright/results/performance.txt` by `e2e/perf/perfReporter.ts`.
 *
 * Each test loads its pages `PERF_VISITS` (default 5) times, and the details
 * suites walk every tab, so the per-test timeout is minutes rather than seconds.
 */
export default defineConfig({
  testDir: './e2e/perf/tests',
  outputDir: 'playwright/test-results',
  // Parallel pages would compete for CPU and skew every measurement.
  fullyParallel: false,
  workers: 1,
  // A retried measurement would report a second, differently warmed number.
  retries: 0,
  forbidOnly: isCI,
  timeout: Number(process.env.PERF_TEST_TIMEOUT ?? 900_000),
  expect: {
    timeout: 40_000
  },
  reporter: [['list'], ['./e2e/perf/perfReporter.ts'], ['junit', { outputFile: 'playwright/results/junit-perf.xml' }]],
  use: {
    baseURL,
    // OpenShift routes / CRC often use custom or self-signed certs
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === '1' || baseURL.startsWith('https://'),
    // Kiali interactive elements use data-test (not Playwright's default data-testid)
    testIdAttribute: 'data-test',
    // Tracing and video instrument the page under measurement — keep them off.
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 40_000,
    navigationTimeout: 90_000
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      testDir: './e2e/global-setup'
    },
    {
      name: 'perf',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    }
  ]
});
