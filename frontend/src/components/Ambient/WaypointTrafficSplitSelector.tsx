import type { GatewayWaypointTrafficSplitConfig } from '../../types/WaypointTraffic';
import { t } from 'utils/I18nUtils';

export const gatewaySplitConfigLabel = (cfg: GatewayWaypointTrafficSplitConfig): string => {
  if (cfg.configLevel === 'service' && cfg.serviceName) {
    return t('{{namespace}} / {{service}}', { namespace: cfg.namespace, service: cfg.serviceName });
  }
  return cfg.namespace;
};

export const gatewaySplitConfigDetailLabel = (cfg: GatewayWaypointTrafficSplitConfig): string => {
  if (!cfg.namespace || !cfg.configLevel) {
    return gatewaySplitConfigLabel(cfg);
  }
  if (cfg.configLevel === 'service' && cfg.serviceName) {
    return t('{{namespace}} / {{service}} ({{level}} level)', {
      level: cfg.configLevel,
      namespace: cfg.namespace,
      service: cfg.serviceName
    });
  }
  return t('{{namespace}} ({{level}} level)', { level: cfg.configLevel, namespace: cfg.namespace });
};

export const gatewayConfigsWithCanary = (
  configs?: GatewayWaypointTrafficSplitConfig[]
): GatewayWaypointTrafficSplitConfig[] => {
  return (configs ?? []).filter(cfg => !!cfg.split?.canary);
};
