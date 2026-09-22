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

export type EnvoyMemoryMetricHelpKey =
  | 'allocatedMemory'
  | 'roughConfigMemory'
  | 'activeClusters'
  | 'listeners'
  | 'routes'
  | 'activeConnections'
  | 'requestRate'
  | 'memoryStatus';

export const envoyMemoryMetricHelp = (key: EnvoyMemoryMetricHelpKey): string => {
  switch (key) {
    case 'allocatedMemory':
      return t(
        'Prometheus metric envoy_server_memory_allocated (max over the selected time range). The limit uses container_spec_memory_limit_bytes when available, otherwise the sidecar.istio.io/proxyMemoryLimit annotation.'
      );
    case 'roughConfigMemory':
      return t(
        'Rough estimate, not a Prometheus metric: active clusters × 50 KiB. Used as a ballpark for configuration footprint because Envoy does not expose config vs traffic memory separately.'
      );
    case 'activeClusters':
      return t(
        'Prefer the Envoy config dump cluster count for the selected pod when available; otherwise Prometheus metric envoy_cluster_manager_active_clusters (max over the time range).'
      );
    case 'listeners':
      return t('Count of listeners from the Envoy config dump of the selected pod (not a Prometheus metric).');
    case 'routes':
      return t('Count of routes from the Envoy config dump of the selected pod (not a Prometheus metric).');
    case 'activeConnections':
      return t(
        'Sum of Prometheus metrics envoy_cluster_upstream_cx_active and envoy_listener_downstream_cx_active (latest values).'
      );
    case 'requestRate':
      return t(
        'Rate of Prometheus metric istio_requests_total for this proxy (Upstream = reporter=~"source|waypoint", Downstream = reporter=destination). Envoy request counters are usually absent with default Istio stats, so they are only used when present.'
      );
    case 'memoryStatus':
      return t(
        'Heuristic classification from allocated memory, request rate, active connections, and active clusters. High memory with idle traffic and many clusters is labeled as configuration; high memory with active traffic is labeled as traffic.'
      );
    default:
      return '';
  }
};

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

export const buildEnvoyTabUrl = (pathname: string, search: string, envoyTab: string): string => {
  const urlParams = new URLSearchParams(search);
  urlParams.set('tab', 'envoy');
  urlParams.set('envoyTab', envoyTab);
  return `${pathname}?${urlParams.toString()}`;
};

export const buildEnvoyMemoryTabUrl = (pathname: string, search: string): string => {
  return buildEnvoyTabUrl(pathname, search, 'memory');
};
