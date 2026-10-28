import { isMultiCluster } from 'config';
import type { HealthHistoryType } from 'services/Api';
import type { HealthStatusId } from 'types/Health';
import {
  formatHealthHistoryChatRangeTo,
  formatHealthHistoryChatTimestamp,
  type HealthHistoryRange
} from './HealthHistoryNavigation';
import { healthStatusI18nKey } from './HealthStatusRibbonUtils';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

const resourceKindLabel = (healthType: HealthHistoryType, t: TranslateFn): string => {
  switch (healthType) {
    case 'app':
      return t('application');
    case 'namespace':
      return t('namespace');
    case 'service':
      return t('service');
    case 'workload':
      return t('workload');
  }
};

const formatResourceDescription = (
  healthType: HealthHistoryType,
  name: string,
  namespace: string,
  t: TranslateFn
): string => {
  if (healthType === 'namespace') {
    return t("namespace '{{name}}'", { name });
  }

  const kind = resourceKindLabel(healthType, t);
  return t("{{kind}} '{{name}}' in namespace '{{namespace}}'", { kind, name, namespace });
};

const buildHealthHistoryToolGuidance = (
  healthType: HealthHistoryType,
  name: string,
  namespace: string,
  from: string,
  to: string
): string => {
  const window = `Investigation window: ${from} to ${to}. Tool time parameters default to "now"; when the window is not today, say so in your analysis and interpret metrics/logs/traces as recent state unless the user opened Logs/Traces tabs with this range in the UI.`;

  switch (healthType) {
    case 'workload':
      return `${window} MCP tools: list_or_get_resources (resourceType workload, resourceName "${name}", namespace "${namespace}"); get_metrics (resourceType workload, resourceName "${name}"); get_pod_performance (workloadName "${name}"); get_logs (name must be this workload name "${name}" or a pod name—never a service or app name); list_traces (serviceName must be an Istio/Kubernetes service name—if unsure, call list_or_get_resources for the workload and use an associated service name, not "${name}"); manage_istio_config_read for related config.`;
    case 'service':
      return `${window} MCP tools: list_or_get_resources (resourceType service, resourceName "${name}"); get_metrics (resourceType service, resourceName "${name}"); list_traces (serviceName "${name}"); get_logs only after list_or_get_resources returns a backing workload name—do not pass service name "${name}" to get_logs; manage_istio_config_read for related VirtualServices/DestinationRules.`;
    case 'app':
      return `${window} MCP tools: list_or_get_resources (resourceType app, resourceName "${name}"); get_metrics (resourceType app, resourceName "${name}"); list_traces (pick a serviceName from list_or_get_resources for app "${name}"—not the app name); get_logs only with a workload name from that app (never "${name}" or a service name directly); manage_istio_config_read as needed.`;
    case 'namespace':
      return `${window} MCP tools: list_or_get_resources (resourceType namespace, namespaces "${name}"); get_mesh_status for mesh-wide context; get_mesh_traffic_graph (namespaces "${name}"); do not call get_logs or list_traces for the namespace alone—drill into a specific workload or service first.`;
  }
};

export const buildHealthHistoryChatContext = (
  t: TranslateFn,
  healthType: HealthHistoryType,
  name: string,
  namespace: string,
  status: HealthStatusId,
  range: HealthHistoryRange,
  cluster?: string
): string => {
  const resource = formatResourceDescription(healthType, name, namespace, t);
  const from = formatHealthHistoryChatTimestamp(range.from);
  const to = formatHealthHistoryChatRangeTo(range.to);
  const statusLabel = t(healthStatusI18nKey(status));
  const clusterSuffix = cluster && isMultiCluster ? t(" in cluster '{{cluster}}'", { cluster }) : '';
  const intro = `Health history investigation: status ${statusLabel}, window ${from} to ${to}, ${resource}${clusterSuffix}.`;

  return `${intro} ${buildHealthHistoryToolGuidance(healthType, name, namespace, from, to)}`;
};

export const buildHealthHistoryChatQuery = (
  t: TranslateFn,
  healthType: HealthHistoryType,
  name: string,
  namespace: string,
  status: HealthStatusId,
  range: HealthHistoryRange,
  _selectedTimeMs: number,
  cluster?: string
): string => {
  const resource = formatResourceDescription(healthType, name, namespace, t);
  const clusterSuffix = cluster && isMultiCluster ? t(" in cluster '{{cluster}}'", { cluster }) : '';
  const options = {
    clusterSuffix,
    from: formatHealthHistoryChatTimestamp(range.from),
    resource,
    status: t(healthStatusI18nKey(status)),
    to: formatHealthHistoryChatRangeTo(range.to)
  };

  if (status === 'Healthy') {
    return t(
      'The health history shows status "{{status}}" from {{from}} to {{to}} for {{resource}}{{clusterSuffix}}. Investigate whether any notable events, changes, or anomalies occurred during this period.',
      options
    );
  }

  return t(
    'The health history shows status "{{status}}" from {{from}} to {{to}} for {{resource}}{{clusterSuffix}}. What likely caused this and what should I investigate?',
    options
  );
};
