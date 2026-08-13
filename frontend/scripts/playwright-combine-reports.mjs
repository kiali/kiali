#!/usr/bin/env node
/**
 * Produce playwright-results/combined-report.xml for Jenkins / Polarion.
 *
 * Prefer merging CI blob reports (first run + optional --last-failed).
 * Fall back to the direct junit reporter output when merge is empty/missing
 * (e.g. clean run where --last-failed was a no-op).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const resultsDir = path.join(frontendRoot, 'playwright-results');
const blobDir = path.join(frontendRoot, 'blob-report');
const combinedPath = path.join(resultsDir, 'combined-report.xml');
const directJunitPath = path.join(resultsDir, 'junit-results.xml');
const playwrightBin = path.join(frontendRoot, 'node_modules', '.bin', 'playwright');

fs.mkdirSync(resultsDir, { recursive: true });

const hasTestCases = filePath => {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const xml = fs.readFileSync(filePath, 'utf8');
  return /<testcase[\s>]/i.test(xml);
};

const blobZips = fs.existsSync(blobDir)
  ? fs.readdirSync(blobDir).filter(name => name.endsWith('.zip'))
  : [];

if (blobZips.length > 0) {
  console.log(`Merging ${blobZips.length} blob report(s) from blob-report/`);
  const result = spawnSync(
    playwrightBin,
    ['merge-reports', '--config=playwright.merge.config.ts', './blob-report'],
    { cwd: frontendRoot, stdio: 'inherit', env: process.env }
  );
  if (result.status !== 0) {
    console.warn(`merge-reports exited with ${result.status}; will try junit fallback`);
  }
}

if (!hasTestCases(combinedPath) && fs.existsSync(directJunitPath)) {
  fs.copyFileSync(directJunitPath, combinedPath);
  console.log(`Copied ${path.relative(frontendRoot, directJunitPath)} -> combined-report.xml`);
}

if (!hasTestCases(combinedPath)) {
  console.error(
    'ERROR: combined-report.xml has no <testcase> entries. Check blob-report/ and playwright-results/junit-results.xml.'
  );
  process.exit(1);
}

console.log(`Wrote ${path.relative(frontendRoot, combinedPath)}`);
