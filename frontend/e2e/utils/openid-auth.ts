import { expect, type Page } from '@playwright/test';
import { kialiUrl } from './kialiUrl';

type OpenIdLoginOptions = {
  password: string;
  username: string;
};

type AuthInfo = {
  authorizationEndpoint?: string;
  strategy?: string;
};

/**
 * OpenID / Keycloak login for KinD external-kiali (and similar) suites.
 *
 * Posts credentials to the Keycloak login form discovered via
 * /api/auth/info → authorizationEndpoint, then verifies a Kiali session.
 * Cookies are stored on the page request context for storageState.
 */
export async function loginOpenId(page: Page, { username, password }: OpenIdLoginOptions): Promise<void> {
  if (!password) {
    throw new Error('Password is required for openid auth. Set PLAYWRIGHT_PASSWD (or PASSWD).');
  }

  const authInfoRes = await page.request.get(kialiUrl('/api/auth/info'));
  expect(authInfoRes.ok(), `Expected /api/auth/info OK, got ${authInfoRes.status()}`).toBeTruthy();
  const authInfo = (await authInfoRes.json()) as AuthInfo;
  const authorizationEndpoint = authInfo.authorizationEndpoint;
  expect(authorizationEndpoint, 'Expected authorizationEndpoint from /api/auth/info').toBeTruthy();

  // KinD Keycloak uses a self-signed cert. Kiali's base URL is HTTP, so the
  // global ignoreHTTPSErrors flag stays off and Node rejects the Keycloak TLS handshake.
  const loginPageRes = await page.request.get(authorizationEndpoint!, {
    ignoreHTTPSErrors: true,
    maxRedirects: 10
  });
  expect(loginPageRes.ok(), `Expected Keycloak login page OK, got ${loginPageRes.status()}`).toBeTruthy();
  const html = await loginPageRes.text();

  const formMatch =
    html.match(/<form[^>]*\bid=["']kc-form-login["'][^>]*\baction=["']([^"']+)["']/i) ??
    html.match(/<form[^>]*\baction=["']([^"']+)["'][^>]*\bid=["']kc-form-login["']/i);
  expect(formMatch?.[1], 'Expected Keycloak kc-form-login action URL').toBeTruthy();
  const postUrl = new URL(formMatch![1].replace(/&amp;/g, '&'), loginPageRes.url()).toString();

  const loginRes = await page.request.post(postUrl, {
    form: { password, username },
    ignoreHTTPSErrors: true,
    maxRedirects: 10
  });
  expect(
    loginRes.ok() || loginRes.status() === 302 || loginRes.status() === 303,
    `Expected Keycloak login to succeed, got ${loginRes.status()}`
  ).toBeTruthy();

  await page.goto(kialiUrl('/console/overview?refresh=0'));
  await expect(page).toHaveURL(/\/(console|kiali)/, { timeout: 120_000 });
  const status = await page.request.get(kialiUrl('/api/status'));
  expect(status.ok(), `Expected /api/status OK after openid login, got ${status.status()}`).toBeTruthy();
}
