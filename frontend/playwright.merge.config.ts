import { defineConfig } from '@playwright/test';

/**
 * Config used only by `playwright merge-reports` after CI blob runs.
 * Produces combined-report.xml for Jenkins / Polarion / Report Portal uploads.
 */
export default defineConfig({
  reporter: [
    ['list'],
    ['junit', { outputFile: 'playwright-results/combined-report.xml' }],
    ['html', { open: 'never', outputFolder: 'playwright-report' }]
  ]
});
