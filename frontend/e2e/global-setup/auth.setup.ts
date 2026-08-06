import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { AUTH_FILE } from '../utils/auth';

type AuthInfo = {
  strategy?: string;
};

/**
 * Auth setup project — replaces Cypress `cy.login()` / `cy.session()`.
 * Detects strategy from /api/auth/info and persists storageState for suite projects.
 *
 * Phase 0: anonymous validated. OpenShift / OpenID / token flows are stubs for later phases.
 */
setup('authenticate', async ({ page, request }) => {
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  const authResponse = await request.get('/api/auth/info');
  expect(authResponse.ok()).toBeTruthy();
  const authInfo = (await authResponse.json()) as AuthInfo;
  const strategy = authInfo.strategy ?? 'anonymous';

  process.env.KIALI_AUTH_STRATEGY = strategy;

  if (strategy === 'anonymous') {
    // Anonymous needs no credentials; warm the session and validate API access.
    await page.goto('/console/overview?refresh=0');
    const status = await request.get('/api/status');
    expect(status.ok()).toBeTruthy();
  } else if (strategy === 'token') {
    throw new Error(
      'token auth setup is not implemented in Phase 0 spike. Use anonymous auth locally, or extend auth.setup.ts.'
    );
  } else if (strategy === 'openshift' || strategy === 'openid') {
    throw new Error(
      `${strategy} auth setup is not implemented in Phase 0 spike. Use anonymous auth locally, or extend auth.setup.ts.`
    );
  } else {
    throw new Error(`Unsupported auth strategy: ${strategy}`);
  }

  await page.context().storageState({ path: AUTH_FILE });
});
