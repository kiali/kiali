import {
  buildEnvoyMemoryQueryParams,
  hasEnvoyMemoryWorkload,
  formatEnvoyMemoryBytes,
  formatEnvoyMemoryUsage,
  formatEnvoyRequestRate,
  envoyMemoryCauseLabel,
  envoyMemoryCauseStatus
} from '../EnvoyMemoryUtils';
import { DEGRADED, HEALTHY } from 'types/Health';
import type { Workload } from 'types/Workload';

describe('EnvoyMemoryUtils', () => {
  it('detects workloads with an Envoy proxy', () => {
    const workload = {
      isGateway: false,
      isWaypoint: false,
      isZtunnel: false,
      istioSidecar: true
    } as Workload;

    expect(hasEnvoyMemoryWorkload(workload)).toBe(true);
    expect(hasEnvoyMemoryWorkload({ ...workload, isZtunnel: true })).toBe(false);
  });

  it('formats memory bytes', () => {
    expect(formatEnvoyMemoryBytes(512)).toBe('512 B');
    expect(formatEnvoyMemoryBytes(2048)).toBe('2.0 KiB');
    expect(formatEnvoyMemoryBytes(1048576)).toBe('1.0 MiB');
  });

  it('formats request rate for envoy-only metrics', () => {
    expect(formatEnvoyRequestRate({ requestRate: 1.5 })).toBe('1.50 req/s');
    expect(formatEnvoyRequestRate({ requestRate: 0 })).toBe('0.00 req/s');
  });

  it('formats memory usage with limit', () => {
    expect(
      formatEnvoyMemoryUsage({
        memoryLimitBytes: 1073741824,
        memoryMaxBytes: 8703180,
        memoryUsedPercent: 0.8
      })
    ).toContain('0.8%');
    expect(
      formatEnvoyMemoryUsage({
        memoryLimitBytes: 0,
        memoryMaxBytes: 8703180,
        memoryUsedPercent: 0
      })
    ).toBe('8.3 MiB');
  });

  it('maps cause labels', () => {
    expect(envoyMemoryCauseLabel('configuration')).toContain('configuration');
    expect(envoyMemoryCauseLabel('traffic')).toContain('traffic');
  });

  it('maps cause status to health icons', () => {
    expect(envoyMemoryCauseStatus('ok')).toBe(HEALTHY);
    expect(envoyMemoryCauseStatus('configuration')).toBe(DEGRADED);
    expect(envoyMemoryCauseStatus('traffic')).toBe(DEGRADED);
    expect(envoyMemoryCauseStatus('unknown')).toBe(DEGRADED);
  });

  it('builds query params with queryTime in seconds', () => {
    const params = buildEnvoyMemoryQueryParams({ rangeDuration: 300 }, 1_700_000_000_000);

    expect(params.duration).toBe(300);
    expect(params.queryTime).toBe(1_700_000_000);
    expect(params.direction).toBe('outbound');
    expect(params.reporter).toBe('source');
    expect(params.rateInterval).toBeDefined();
    expect(params.step).toBeDefined();
  });
});
