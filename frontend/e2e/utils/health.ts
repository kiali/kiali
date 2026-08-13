import type { APIRequestContext } from '@playwright/test';

type AppHealthResponse = {
  health?: {
    status?: {
      status?: string;
    };
  };
};

export const waitForAppHealthStatus = async (
  request: APIRequestContext,
  namespace: string,
  app: string,
  expectedStatus: string,
  timeoutMs = 90_000
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let lastStatus: string | undefined;

  while (Date.now() < deadline) {
    const response = await request.get(`/api/namespaces/${namespace}/apps/${app}?health=true`);
    if (response.ok()) {
      const body = (await response.json()) as AppHealthResponse;
      lastStatus = body.health?.status?.status;
      if (lastStatus === expectedStatus) {
        return;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 5_000));
  }

  throw new Error(
    `Timeout waiting for app ${app} in ${namespace} to reach ${expectedStatus}. Last status: ${lastStatus ?? 'unknown'}`
  );
};
