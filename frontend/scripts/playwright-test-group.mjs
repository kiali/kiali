#!/usr/bin/env node
/**
 * Run a grep-filtered Playwright suite for Jenkins TEST_TAGS.
 *
 * Auth setup must run first without PLAYWRIGHT_GREP: the setup test title is
 * "authenticate" (no suite tag), so --grep=@smoke would skip it and leave
 * playwright/.auth/user.json missing → instant ENOENT on every suite project.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const playwrightBin = path.join(frontendRoot, 'node_modules', '.bin', 'playwright');

const run = (args, env) => {
  const result = spawnSync(playwrightBin, args, {
    cwd: frontendRoot,
    env,
    stdio: 'inherit'
  });
  return result.status ?? 1;
};

const baseEnv = { ...process.env };
const { PLAYWRIGHT_GREP, PLAYWRIGHT_GREP_INVERT, ...setupEnv } = baseEnv;

console.log('Running auth setup project (ignoring PLAYWRIGHT_GREP)...');
const setupStatus = run(['test', '--project=setup'], setupEnv);
if (setupStatus !== 0) {
  process.exit(setupStatus);
}

console.log(
  `Running filtered tests (grep=${PLAYWRIGHT_GREP ?? '<none>'}, grepInvert=${PLAYWRIGHT_GREP_INVERT ?? '<none>'})...`
);
process.exit(run(['test', '--pass-with-no-tests'], baseEnv));
