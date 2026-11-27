import type { APIRequestContext, Page } from '@playwright/test';
import { test } from '@playwright/test';

import { kialiUrl } from './kialiUrl';
import { loginOpenId } from './openid-auth';

/** Keycloak bookinfo-only user (multi-primary RBAC scenarios). */
export const BOOKINFO_LIMITED_USERNAME = 'bookinfouser';
export const BOOKINFO_LIMITED_PASSWORD = 'kiali';

export async function loginBookinfoLimitedUser(page: Page): Promise<void> {
  await loginOpenId(page, {
    password: BOOKINFO_LIMITED_PASSWORD,
    username: BOOKINFO_LIMITED_USERNAME
  });
}

/** Skip when KinD multi-primary Playwright job still uses anonymous auth. */
export async function skipUnlessOpenIdAuth(request: APIRequestContext): Promise<void> {
  const authInfoRes = await request.get(kialiUrl('/api/auth/info'));
  const authInfo = (await authInfoRes.json()) as { strategy?: string };
  test.skip(
    authInfo.strategy !== 'openid',
    'Limited-user RBAC scenarios require openid/Keycloak (sidecar multi-primary CI)'
  );
}
