import type { APIRequestContext } from '@playwright/test';
import { test } from '@playwright/test';

import { isCachingConfigured, readCachingState } from './cachingState';

const skipUnlessCachingReady = (feature: string): void => {
  const state = readCachingState();
  if (state && !isCachingConfigured()) {
    test.skip(true, `${feature} requires graph and health caches enabled on Kiali`);
  }
};

/** Skip when Kiali is not running with cache test metrics (e.g. ci-test-config-cache.yaml). */
export const skipUnlessHealthTestMetrics = async (request: APIRequestContext): Promise<void> => {
  skipUnlessCachingReady('Health cache test metrics');
  const cache = await request.get('/api/test/metrics/health/cache');
  if (!cache.ok()) {
    test.skip(true, 'Health cache test metrics endpoint is unavailable');
  }
};

export const skipUnlessHealthStatusTestMetrics = async (request: APIRequestContext): Promise<void> => {
  skipUnlessCachingReady('Health status test metrics');
  const state = readCachingState();
  if (state && !state.healthStatusMetricsEnabled) {
    test.skip(true, 'Health status test metrics require server.observability.metrics.health_status');
  }
  const response = await request.get('/api/test/metrics/health/status');
  if (!response.ok()) {
    test.skip(true, 'Health status test metrics endpoint is unavailable');
    return;
  }
  const body = (await response.json()) as { metrics?: unknown[] };
  if (!body.metrics?.length) {
    test.skip(true, 'Health status metrics are empty — enable server.observability.metrics.health_status');
  }
};

export const skipUnlessGraphTestMetrics = async (request: APIRequestContext): Promise<void> => {
  skipUnlessCachingReady('Graph cache test metrics');
  const response = await request.get('/api/test/metrics/graph/cache');
  if (!response.ok()) {
    test.skip(true, 'Graph cache test metrics endpoint is unavailable');
  }
};
