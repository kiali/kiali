import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';

type ConfigResponse = {
  clusters?: Record<string, unknown>;
};

/** Returns the sole cluster name when Kiali is configured for single-cluster mode. */
export const getClusterForSingleCluster = async (request: APIRequestContext): Promise<string> => {
  const response = await request.get('/api/config');
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as ConfigResponse;
  const clusterNames = Object.keys(body.clusters ?? {});
  expect(clusterNames).toHaveLength(1);
  return clusterNames[0];
};
