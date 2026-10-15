import type { APIRequestContext } from '@playwright/test';
import { kialiUrl } from './kialiUrl';

type HealthResponse = {
  health?: {
    status?: {
      status?: string;
    };
  };
};

type HealthProbe = {
  httpStatus: number;
  status?: string;
};

/** Single health read. `status` is absent when the resource is not resolvable yet (non-2xx). */
const probeHealthStatus = async (request: APIRequestContext, resourcePath: string): Promise<HealthProbe> => {
  try {
    const response = await request.get(kialiUrl(resourcePath));
    if (!response.ok()) {
      return { httpStatus: response.status() };
    }
    const body = (await response.json()) as HealthResponse;
    return { httpStatus: response.status(), status: body.health?.status?.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('Target page, context or browser has been closed')) {
      throw new Error(`Health poll aborted for ${resourcePath}`, { cause: error });
    }
    throw error;
  }
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
    const probe = await probeHealthStatus(request, resourcePath);
    lastHttpStatus = probe.httpStatus;
    lastStatus = probe.status ?? lastStatus;
    if (probe.status === expectedStatus) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 5_000));
  }

  throw new Error(
    `Timeout waiting for ${resourcePath} to reach ${expectedStatus}. Last status: ${lastStatus ?? 'unknown'}, last HTTP: ${lastHttpStatus ?? 'unknown'}`
  );
};

/**
 * Resolve as soon as any one of `services` reports `expectedStatus`. Use this when a test needs
 * the namespace to have at least one row in a health-filtered table: pinning the wait to a single
 * service makes it hostage to that service's error rate rolling out of the health rate window.
 */
export const waitForAnyServiceHealthStatus = async (
  request: APIRequestContext,
  namespace: string,
  services: string[],
  expectedStatus: string,
  timeoutMs = 90_000
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  const lastStatuses = new Map<string, string>();

  while (Date.now() < deadline) {
    for (const service of services) {
      const probe = await probeHealthStatus(request, `/api/namespaces/${namespace}/services/${service}?health=true`);
      if (probe.status === expectedStatus) {
        return;
      }
      lastStatuses.set(service, probe.status ?? `HTTP ${probe.httpStatus}`);
    }
    await new Promise(resolve => setTimeout(resolve, 5_000));
  }

  const seen = services.map(service => `${service}=${lastStatuses.get(service) ?? 'unknown'}`).join(', ');
  throw new Error(`Timeout waiting for any ${namespace} service to reach ${expectedStatus}. Last statuses: ${seen}`);
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
