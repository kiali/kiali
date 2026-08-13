import type { Page } from '@playwright/test';

type AuthInfo = {
  strategy?: string;
};

/** Fetch Kiali auth strategy from /api/auth/info (no login required). */
export const getAuthStrategy = async (page: Page): Promise<string> => {
  const response = await page.request.get('/api/auth/info');
  if (!response.ok()) {
    return 'anonymous';
  }
  const body = (await response.json()) as AuthInfo;
  return body.strategy ?? 'anonymous';
};
