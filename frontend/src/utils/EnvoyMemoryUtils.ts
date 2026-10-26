import type { Workload } from 'types/Workload';
import type { EnvoyMemoryCause, EnvoyMemorySummary } from 'types/EnvoyMemory';
import type { TimeInMilliseconds, TimeRange } from 'types/Common';
import type { IstioMetricsOptions } from 'types/MetricsOptions';
import type { Status } from 'types/Health';
import { DEGRADED, HEALTHY } from 'types/Health';
import { timeRangeToOptions } from 'components/Metrics/Helper';
import * as API from '../services/Api';
import { computePrometheusRateParams } from '../services/Prometheus';
import { t } from 'utils/I18nUtils';

const ISTIO_CONFIGURATION_SCOPING_URL = 'https://istio.io/latest/docs/ops/configuration/mesh/configuration-scoping/';

// Rough estimate of Envoy config memory contribution per active cluster (matches backend).
export const ROUGH_CONFIG_BYTES_PER_CLUSTER = 50 * 1024;

// Short client-side cache so Summary and Envoy Overview tabs do not duplicate in-flight fetches.
const ENVOY_MEMORY_SUMMARY_CACHE_TTL_MS = 5000;
type EnvoyMemorySummaryCacheEntry = {
  expiresAt: number;
  promise: Promise<EnvoyMemorySummary>;
};
const envoyMemorySummaryCache = new Map<string, EnvoyMemorySummaryCacheEntry>();

export const estimateEnvoyConfigMemoryBytes = (clusterCount: number): number => {
  if (!Number.isFinite(clusterCount) || clusterCount <= 0) {
    return 0;
  }
  return Math.round(clusterCount) * ROUGH_CONFIG_BYTES_PER_CLUSTER;
};

export const fetchEnvoyMemorySummary = (
  namespace: string,
  workload: string,
  params: IstioMetricsOptions,
  cluster?: string
): Promise<EnvoyMemorySummary> => {
  const key = `${cluster ?? ''}|${namespace}|${workload}|${JSON.stringify(params)}`;
  const now = Date.now();
  const cached = envoyMemorySummaryCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = API.getWorkloadEnvoyMemory(namespace, workload, params, cluster).then(response => response.data);
  envoyMemorySummaryCache.set(key, { expiresAt: now + ENVOY_MEMORY_SUMMARY_CACHE_TTL_MS, promise });
  promise.catch(() => {
    const current = envoyMemorySummaryCache.get(key);
    if (current?.promise === promise) {
      envoyMemorySummaryCache.delete(key);
    }
  });
  return promise;
};

export const hasEnvoyMemoryWorkload = (workload?: Workload): boolean => {
  if (!workload || workload.isZtunnel) {
    return false;
  }

  return workload.istioSidecar || workload.isGateway || workload.isWaypoint;
};

export const hasEnvoyMemoryRunningPods = (workload?: Workload): boolean => {
  return (workload?.pods?.length ?? 0) > 0;
};

const istioProxyContainerName = 'istio-proxy';

// Mirrors legacy WorkloadDetails hasIstioSidecars(): Envoy UI is pod-scoped in the active cluster.
export const workloadHasEnvoyProxyInPods = (workload?: Workload): boolean => {
  if (!workload?.pods?.length) {
    return false;
  }

  let hasEnvoyProxy = false;
  workload.pods.forEach(pod => {
    if (pod.istioContainers && pod.istioContainers.length > 0) {
      hasEnvoyProxy = true;
    } else if (pod.istioInitContainers?.some(cont => cont.name === istioProxyContainerName)) {
      hasEnvoyProxy = true;
    } else {
      hasEnvoyProxy =
        hasEnvoyProxy ||
        (!!pod.containers && pod.containers.some(cont => cont.name === istioProxyContainerName && !workload.isZtunnel));
    }
  });

  return hasEnvoyProxy;
};

export const shouldShowEnvoyWorkloadTab = (workload?: Workload): boolean => {
  if (!workload || workload.isZtunnel) {
    return false;
  }

  if (workload.isWaypoint) {
    return true;
  }

  if (!hasEnvoyMemoryWorkload(workload)) {
    return false;
  }

  return workloadHasEnvoyProxyInPods(workload);
};

// Summary Envoy status and Envoy tab share the same workload eligibility; status also requires running pods.
export const shouldShowEnvoyMemoryStatus = (workload?: Workload): boolean => {
  if (!hasEnvoyMemoryRunningPods(workload)) {
    return false;
  }

  return shouldShowEnvoyWorkloadTab(workload);
};

export const formatEnvoyMemoryUsage = (
  summary: {
    memoryLimitBytes: number;
    memoryMaxBytes: number;
    memoryUsedPercent: number;
  },
  options?: { includeLimitPercent?: boolean }
): string => {
  const allocated = formatEnvoyMemoryBytes(summary.memoryMaxBytes);
  if (options?.includeLimitPercent && summary.memoryLimitBytes > 0 && Number.isFinite(summary.memoryUsedPercent)) {
    return `${allocated} (${summary.memoryUsedPercent.toFixed(1)}% of limit)`;
  }
  return allocated;
};

export const formatEnvoyRequestRate = (summary: {
  proxyType?: string;
  requestRate: number;
  trafficIsByteRate?: boolean;
}): string => {
  if (summary.trafficIsByteRate) {
    return formatEnvoyByteRate(summary.requestRate);
  }
  return `${summary.requestRate.toFixed(2)} req/s`;
};

export const formatEnvoyByteRate = (bytesPerSecond: number): string => {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond < 0) {
    return '0 B/s';
  }
  if (bytesPerSecond < 1024) {
    return `${bytesPerSecond.toFixed(1)} B/s`;
  }
  const kib = bytesPerSecond / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1)} KiB/s`;
  }
  return `${(kib / 1024).toFixed(1)} MiB/s`;
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

export const envoyMemoryThresholdHelp = (summary: {
  largeConfigClustersThreshold: number;
  memoryLimitBytes: number;
  memoryThresholdBytes: number;
  proxyType?: string;
}): string => {
  const threshold = formatEnvoyMemoryBytes(summary.memoryThresholdBytes);
  if (summary.memoryLimitBytes > 0) {
    const limitPercent = ((summary.memoryThresholdBytes / summary.memoryLimitBytes) * 100).toFixed(1);
    return t(
      'Memory is flagged as high when allocated memory exceeds {{threshold}} ({{limitPercent}}% of the proxy memory limit of {{limit}} from container_spec_memory_limit_bytes or sidecar.istio.io/proxyMemoryLimit). Large configuration is considered when active clusters exceed {{clusters}}.',
      {
        limitPercent,
        threshold,
        limit: formatEnvoyMemoryBytes(summary.memoryLimitBytes),
        clusters: summary.largeConfigClustersThreshold
      }
    );
  }

  const proxyLabel =
    summary.proxyType === 'waypoint' || summary.proxyType === 'gateway' ? t('gateways and waypoints') : t('sidecars');

  return t(
    'Memory is flagged as high when allocated memory exceeds {{threshold}} (default absolute threshold for {{proxyType}}; no proxy memory limit is set). Large configuration is considered when active clusters exceed {{clusters}}.',
    {
      threshold,
      proxyType: proxyLabel,
      clusters: summary.largeConfigClustersThreshold
    }
  );
};

export const istioConfigurationScopingUrl = (): string => ISTIO_CONFIGURATION_SCOPING_URL;

export type EnvoyMemoryMetricHelpKey =
  | 'allocatedMemory'
  | 'roughConfigMemory'
  | 'activeClusters'
  | 'listeners'
  | 'routes'
  | 'activeConnections'
  | 'requestRate';

export const envoyMemoryMetricHelp = (key: EnvoyMemoryMetricHelpKey): string => {
  switch (key) {
    case 'allocatedMemory':
      return t(
        'Prometheus metrics envoy_server_memory_allocated (Envoy) and container_memory_working_set_bytes for container istio-proxy (cgroup). When available, the chart draws a Memory limit line from container_spec_memory_limit_bytes, otherwise sidecar.istio.io/proxyMemoryLimit.'
      );
    case 'roughConfigMemory':
      return t(
        'Rough estimate, not a Prometheus metric: active clusters × 50 KiB (prefers config-dump cluster count for the selected pod when available). Used as a ballpark for configuration footprint because Envoy does not expose config vs traffic memory separately.'
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
        'Active TCP connections approximated as sum(istio_tcp_connections_opened_total) - sum(istio_tcp_connections_closed_total) for this workload. Reporter is not filtered because Istio L4 telemetry inverts reporter labels.'
      );
    case 'requestRate':
      return t(
        'Traffic rate from Istio telemetry. HTTP: rate of istio_requests_total (source/waypoint and destination reporters). L4 proxies (waypoints, or gateways with only TCP traffic): combined rate of istio_tcp_sent_bytes_total and istio_tcp_received_bytes_total (no reporter filter).'
      );
    default:
      return '';
  }
};

export const sortedEnvoyPodNames = (workload: Workload): string[] =>
  [...(workload.pods ?? [])].map(pod => pod.name).sort((a, b) => (a >= b ? 1 : -1));

export const sortedEnvoyPodName = (workload: Workload): string | undefined => sortedEnvoyPodNames(workload)[0];

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
