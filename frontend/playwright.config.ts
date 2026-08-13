import { defineConfig, devices, type ReporterDescription } from '@playwright/test';
import { AUTH_FILE } from './e2e/utils/auth';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001';
const isCI = !!process.env.CI;

/** Jenkins / local video override: on | off | retain-on-failure (default). */
const videoMode = (process.env.PLAYWRIGHT_VIDEO ?? 'retain-on-failure') as 'on' | 'off' | 'retain-on-failure';

/**
 * CI: blob (for merge-reports) + junit (fallback when merge is empty).
 */
const reporters: ReporterDescription[] = isCI
  ? [
      ['list'],
      ['blob', { outputDir: 'blob-report' }],
      ['junit', { outputFile: 'playwright-results/junit-results.xml' }]
    ]
  : [
      ['list'],
      ['html', { open: 'never', outputFolder: 'playwright-report' }],
      ['junit', { outputFile: 'playwright-results/junit-results.xml' }]
    ];

/**
 * Projects mirror hack/run-integration-tests.sh suites.
 * Suite membership is controlled by Playwright test tags (e.g. `{ tag: '@smoke' }`).
 * Project `grep` matches those tags (and titles if tags are embedded there).
 * Overlapping tags use negative lookaheads (e.g. @waypoint vs @waypoint-tracing).
 */
export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 60_000,
  expect: {
    timeout: 40_000
  },
  reporter: reporters,
  grep: process.env.PLAYWRIGHT_GREP ? new RegExp(process.env.PLAYWRIGHT_GREP) : undefined,
  grepInvert: process.env.PLAYWRIGHT_GREP_INVERT ? new RegExp(process.env.PLAYWRIGHT_GREP_INVERT) : undefined,
  use: {
    baseURL,
    // OpenShift routes / CRC often use custom or self-signed certs
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === '1' || baseURL.startsWith('https://'),
    // Kiali interactive elements use data-test (not Playwright's default data-testid)
    testIdAttribute: 'data-test',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: videoMode,
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
      name: 'smoke',
      grep: /@smoke/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE
      }
    },
    {
      name: 'core-1',
      grep: /@core-1/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'core-2',
      grep: /@core-2/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'core-caching',
      grep: /@core-caching/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'crd-validation',
      grep: /@crd-validation/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'perses',
      grep: /@perses/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'ambient',
      grep: /@ambient(?!-)/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'waypoint',
      grep: /@waypoint(?!-)/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'waypoint-tracing',
      grep: /@waypoint-tracing/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'ambient-multi-primary',
      grep: /@ambient-multi-primary/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'waypoint-multicluster',
      grep: /@waypoint-multicluster/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'multi-cluster',
      grep: /@multi-cluster/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'multi-primary',
      grep: /@multi-primary/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'multi-mesh',
      grep: /@multi-mesh/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'external-kiali',
      grep: /@external-kiali/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'tracing',
      grep: /(?<!waypoint-)@tracing/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'offline',
      grep: /@offline/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    },
    {
      name: 'ai-chatbot',
      grep: /@ai-chatbot/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }
    }
  ]
});
