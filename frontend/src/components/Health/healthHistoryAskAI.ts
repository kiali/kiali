import { isMultiCluster } from 'config';
import type { HealthHistoryType } from 'services/Api';
import type { HealthStatusId } from 'types/Health';
import { formatHealthHistoryInvestigationBound, type HealthHistoryRange } from './HealthHistoryNavigation';
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

export const buildHealthHistoryChatQuery = (
  t: TranslateFn,
  healthType: HealthHistoryType,
  name: string,
  namespace: string,
  status: HealthStatusId,
  range: HealthHistoryRange,
  selectedTimeMs: number,
  cluster?: string
): string => {
  const resource = formatResourceDescription(healthType, name, namespace, t);
  const clusterSuffix = cluster && isMultiCluster ? t(" in cluster '{{cluster}}'", { cluster }) : '';

  return t(
    'The health history shows status "{{status}}" from {{from}} to {{to}} for {{resource}}{{clusterSuffix}}. What likely caused this and what should I investigate?',
    {
      clusterSuffix,
      from: formatHealthHistoryInvestigationBound(range.from, selectedTimeMs),
      resource,
      status: t(healthStatusI18nKey(status)),
      to: formatHealthHistoryInvestigationBound(range.to, selectedTimeMs)
    }
  );
};
