import type { APIRequestContext } from '@playwright/test';
import { test } from '@playwright/test';

/** Skip when Kiali is not running with cache test metrics (e.g. ci-test-config-cache.yaml). */
export const skipUnlessHealthTestMetrics = async (request: APIRequestContext): Promise<void> => {
  const cache = await request.get('/api/test/metrics/health/cache');
  if (!cache.ok()) {
    test.skip(true, 'Health cache test metrics require cache-enabled Kiali config (ci-test-config-cache.yaml)');
  }
};

export const skipUnlessHealthStatusTestMetrics = async (request: APIRequestContext): Promise<void> => {
  const response = await request.get('/api/test/metrics/health/status');
  if (!response.ok()) {
    test.skip(true, 'Health status test metrics require cache-enabled Kiali config (ci-test-config-cache.yaml)');
    return;
  }
  const body = (await response.json()) as { metrics?: unknown[] };
  if (!body.metrics?.length) {
    test.skip(true, 'Health status metrics are empty — enable server.observability.metrics.health_status');
  }
};

export const skipUnlessGraphTestMetrics = async (request: APIRequestContext): Promise<void> => {
  const response = await request.get('/api/test/metrics/graph/cache');
  if (!response.ok()) {
    test.skip(true, 'Graph cache test metrics require cache-enabled Kiali config (ci-test-config-cache.yaml)');
  }
};
