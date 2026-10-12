#!/usr/bin/env node
/**
 * Produce playwright/results/combined-report.xml for Jenkins / Polarion.
 *
 * Primary path (Cypress parity): jrm-merge every per-suite
 * playwright/results/junit-*.xml written with PLAYWRIGHT_BLOB_NAME.
 * Optional: merge-reports blob zips for the HTML report.
 *
 * Do not fall back to a single overwritten junit file — that under-reports
 * chained suites (Jenkins showed ~164 = core-caching only instead of ~374).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const resultsDir = path.join(frontendRoot, 'playwright/results');
const blobDir = path.join(frontendRoot, 'playwright/blob-report');
const combinedPath = path.join(resultsDir, 'combined-report.xml');
const playwrightBin = path.join(frontendRoot, 'node_modules', '.bin', 'playwright');
const jrmBin = path.join(frontendRoot, 'node_modules', '.bin', 'jrm');

fs.mkdirSync(resultsDir, { recursive: true });

const hasTestCases = filePath => {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const xml = fs.readFileSync(filePath, 'utf8');
  return /<testcase[\s>]/.test(xml);
};

const countTestCases = filePath => {
  if (!fs.existsSync(filePath)) {
    return 0;
  }
  const xml = fs.readFileSync(filePath, 'utf8');
  return (xml.match(/<testcase[\s>]/g) ?? []).length;
};

// HTML report from blobs (does not own Jenkins JUnit counts).
const blobZips = fs.existsSync(blobDir)
  ? fs.readdirSync(blobDir).filter(name => name.endsWith('.zip'))
  : [];

if (blobZips.length > 0) {
  console.log(`Merging ${blobZips.length} blob report(s) from playwright/blob-report/ (HTML)`);
  const result = spawnSync(
    playwrightBin,
    ['merge-reports', '--config=playwright.merge.config.ts', './playwright/blob-report'],
    { cwd: frontendRoot, stdio: 'inherit', env: process.env }
  );
  if (result.status !== 0) {
    console.warn(`merge-reports exited with ${result.status}; continuing with junit merge`);
  }
}

// Authoritative JUnit for Jenkins: merge per-suite XMLs (like cypress:combine:reports).
const suiteJunitFiles = fs
  .readdirSync(resultsDir)
  .filter(name => /^junit-.+\.xml$/.test(name))
  .map(name => path.join(resultsDir, name))
  .filter(hasTestCases)
  .sort();

if (suiteJunitFiles.length > 0) {
  console.log(`Merging ${suiteJunitFiles.length} suite JUnit file(s) with jrm:`);
  for (const filePath of suiteJunitFiles) {
    console.log(`  ${path.relative(frontendRoot, filePath)} (${countTestCases(filePath)} testcases)`);
  }
  if (fs.existsSync(combinedPath)) {
    fs.unlinkSync(combinedPath);
  }
  const jrmResult = spawnSync(
    jrmBin,
    [combinedPath, ...suiteJunitFiles],
    { cwd: frontendRoot, stdio: 'inherit', env: process.env }
  );
  if (jrmResult.status !== 0) {
    console.error(`jrm exited with ${jrmResult.status}`);
    process.exit(jrmResult.status ?? 1);
  }
}

if (!hasTestCases(combinedPath)) {
  console.error(
    'ERROR: combined-report.xml has no <testcase> entries. Check playwright/results/junit-*.xml and playwright/blob-report/.'
  );
  process.exit(1);
}

console.log(
  `Wrote ${path.relative(frontendRoot, combinedPath)} (${countTestCases(combinedPath)} testcases)`
);
