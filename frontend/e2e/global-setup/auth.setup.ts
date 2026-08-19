import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { AUTH_FILE } from '../utils/auth';
import { loginOpenShift, playwrightCredentials } from '../utils/openshift-auth';

type AuthInfo = {
  strategy?: string;
};

/**
 * Auth setup project — detects strategy from /api/auth/info and persists
 * storageState for suite projects.
 *
 * Supports anonymous (local) and openshift (Jenkins OCP htpasswd).
 * Token / OpenID remain for later phases.
 */
setup('authenticate', async ({ page, request }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const authResponse = await request.get('/api/auth/info');
  expect(authResponse.ok()).toBeTruthy();
  const authInfo = (await authResponse.json()) as AuthInfo;
  const strategy = authInfo.strategy ?? 'anonymous';

  if (strategy === 'anonymous') {
    await page.goto('/console/overview?refresh=0');
    const status = await request.get('/api/status');
    expect(status.ok()).toBeTruthy();
  } else if (strategy === 'openshift') {
    const { username, password, authProvider } = playwrightCredentials();
    await loginOpenShift(page, {
      authProvider,
      password,
      username
    });
  } else {
    // Write empty storageState before failing so dependent projects produce JUnit
    // output (skipped) instead of crashing with zero results, which breaks Jenkins.
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }));
    const implemented = ['anonymous', 'openshift'];
    expect(
      implemented,
      `Auth strategy "${strategy}" is not implemented in auth.setup.ts — add support or switch to: ${implemented.join(', ')}`
    ).toContain(strategy);
    return;
  }

  await page.context().storageState({ path: AUTH_FILE });
});
