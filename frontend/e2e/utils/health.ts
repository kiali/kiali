import type { APIRequestContext } from '@playwright/test';

type HealthResponse = {
  health?: {
    status?: {
      status?: string;
    };
  };
};

const waitForResourceHealthStatus = async (
  request: APIRequestContext,
  resourcePath: string,
  expectedStatus: string,
  timeoutMs = 90_000
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let lastStatus: string | undefined;
  let lastHttpStatus: number | undefined;

  while (Date.now() < deadline) {
    try {
      const response = await request.get(resourcePath);
      lastHttpStatus = response.status();
      if (response.ok()) {
        const body = (await response.json()) as HealthResponse;
        lastStatus = body.health?.status?.status;
        if (lastStatus === expectedStatus) {
          return;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('Target page, context or browser has been closed')) {
        throw new Error(
          `Health poll aborted for ${resourcePath} (expected ${expectedStatus}). Last status: ${lastStatus ?? 'unknown'}`,
          { cause: error }
        );
      }
      throw error;
    }
    await new Promise(resolve => setTimeout(resolve, 5_000));
  }

  throw new Error(
    `Timeout waiting for ${resourcePath} to reach ${expectedStatus}. Last status: ${lastStatus ?? 'unknown'}, last HTTP: ${lastHttpStatus ?? 'unknown'}`
  );
};

export const waitForAppHealthStatus = async (
  request: APIRequestContext,
  namespace: string,
  app: string,
  expectedStatus: string,
  timeoutMs = 90_000
): Promise<void> => {
  await waitForResourceHealthStatus(
    request,
    `/api/namespaces/${namespace}/apps/${app}?health=true`,
    expectedStatus,
    timeoutMs
  );
};

export const waitForServiceHealthStatus = async (
  request: APIRequestContext,
  namespace: string,
  service: string,
  expectedStatus: string,
  timeoutMs = 90_000
): Promise<void> => {
  await waitForResourceHealthStatus(
    request,
    `/api/namespaces/${namespace}/services/${service}?health=true`,
    expectedStatus,
    timeoutMs
  );
};

export const waitForWorkloadHealthStatus = async (
  request: APIRequestContext,
  namespace: string,
  workload: string,
  expectedStatus: string,
  timeoutMs = 90_000
): Promise<void> => {
  await waitForResourceHealthStatus(
    request,
    `/api/namespaces/${namespace}/workloads/${workload}?health=true`,
    expectedStatus,
    timeoutMs
  );
};
