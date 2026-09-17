import type { Workload } from 'types/Workload';
import type { EnvoyMemoryCause } from 'types/EnvoyMemory';
import type { TimeInMilliseconds, TimeRange } from 'types/Common';
import type { IstioMetricsOptions } from 'types/MetricsOptions';
import type { Status } from 'types/Health';
import { DEGRADED, HEALTHY } from 'types/Health';
import { timeRangeToOptions } from 'components/Metrics/Helper';
import { computePrometheusRateParams } from '../services/Prometheus';
import { t } from 'utils/I18nUtils';

const ISTIO_CONFIGURATION_SCOPING_URL = 'https://istio.io/latest/docs/ops/configuration/mesh/configuration-scoping/';

export const hasEnvoyMemoryWorkload = (workload?: Workload): boolean => {
  if (!workload || workload.isZtunnel) {
    return false;
  }

  return workload.istioSidecar || workload.isGateway || workload.isWaypoint;
};

export const formatEnvoyMemoryUsage = (summary: {
  memoryLimitBytes: number;
  memoryMaxBytes: number;
  memoryUsedPercent: number;
}): string => {
  const allocated = formatEnvoyMemoryBytes(summary.memoryMaxBytes);

  if (summary.memoryLimitBytes > 0) {
    const limit = formatEnvoyMemoryBytes(summary.memoryLimitBytes);
    const percent = summary.memoryUsedPercent.toFixed(1);
    return t('{{allocated}} ({{percent}}% of {{limit}} limit)', { allocated, limit, percent });
  }

  return allocated;
};

export const formatEnvoyRequestRate = (summary: { requestRate: number }): string => {
  return `${summary.requestRate.toFixed(2)} req/s`;
};

export const formatEnvoyMemoryBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '0 B';
  }

  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }

  const kib = bytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB`;
  }

  const mib = kib / 1024;
  if (mib < 1024) {
    return `${mib.toFixed(1)} MiB`;
  }

  return `${(mib / 1024).toFixed(1)} GiB`;
};

export const envoyMemoryCauseStatus = (cause: EnvoyMemoryCause): Status => {
  if (cause === 'ok') {
    return HEALTHY;
  }

  return DEGRADED;
};

export const envoyMemoryCauseLabel = (cause: EnvoyMemoryCause): string => {
  switch (cause) {
    case 'ok':
      return t('Within normal range');
    case 'configuration':
      return t('Likely due to large Envoy configuration');
    case 'traffic':
      return t('Likely due to active traffic');
    default:
      return t('High memory, cause unclear');
  }
};

export const envoyMemoryCauseDescription = (cause: EnvoyMemoryCause): string => {
  switch (cause) {
    case 'configuration':
      return t(
        'This workload has high proxy memory with little traffic and many active clusters. Consider applying configuration scoping.'
      );
    case 'traffic':
      return t('Proxy memory is elevated while the workload is handling active connections or requests.');
    case 'unknown':
      return t(
        'Proxy memory is elevated without active traffic. Memory may not have been released yet, or another factor is involved.'
      );
    default:
      return t('Envoy proxy memory is within the expected range for this workload type.');
  }
};

export const istioConfigurationScopingUrl = (): string => ISTIO_CONFIGURATION_SCOPING_URL;

export const buildEnvoyMemoryQueryParams = (
  timeRange: TimeRange,
  lastRefreshAt: TimeInMilliseconds
): IstioMetricsOptions => {
  const opts: IstioMetricsOptions = {
    direction: 'outbound',
    reporter: 'source'
  };

  timeRangeToOptions(timeRange, opts);

  if (!opts.queryTime) {
    opts.queryTime = Math.floor(lastRefreshAt / 1000);
  }

  const rateParams = computePrometheusRateParams(opts.duration || 60, 10);
  opts.rateInterval = rateParams.rateInterval;
  opts.step = rateParams.step;

  return opts;
};

export const buildEnvoyMemoryTabUrl = (pathname: string, search: string): string => {
  const urlParams = new URLSearchParams(search);
  urlParams.set('tab', 'envoy');
  urlParams.set('envoyTab', 'memory');
  return `${pathname}?${urlParams.toString()}`;
};
