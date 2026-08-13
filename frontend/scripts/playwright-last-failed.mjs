#!/usr/bin/env node
/**
 * Rerun only previously failed Playwright tests.
 * No-op when the last run had zero failures (avoids empty blob reports that
 * wipe/poison merge-reports output used by Jenkins).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const lastRunPath = path.join(frontendRoot, 'test-results', '.last-run.json');
const playwrightBin = path.join(frontendRoot, 'node_modules', '.bin', 'playwright');

if (!fs.existsSync(lastRunPath)) {
  console.log('No test-results/.last-run.json; skipping --last-failed');
  process.exit(0);
}

let lastRun;
try {
  lastRun = JSON.parse(fs.readFileSync(lastRunPath, 'utf8'));
} catch (err) {
  console.warn(`Could not parse ${lastRunPath}: ${err}`);
  process.exit(0);
}

const failedTests = lastRun.failedTests ?? [];
if (failedTests.length === 0) {
  console.log('No failed tests to rerun; skipping --last-failed');
  process.exit(0);
}

console.log(`Rerunning ${failedTests.length} previously failed Playwright test(s)`);
const result = spawnSync(
  playwrightBin,
  ['test', '--last-failed', '--pass-with-no-tests'],
  { cwd: frontendRoot, stdio: 'inherit', env: process.env }
);
process.exit(result.status ?? 1);
