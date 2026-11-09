import * as React from 'react';
import { FormSelect, FormSelectOption } from '@patternfly/react-core';
import type { GatewayWaypointTrafficSplitConfig } from '../../types/WaypointTraffic';
import { t } from 'utils/I18nUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { PFFontSize } from 'styles/PfTypography';

const compactSelectWrapperStyle = kialiStyle({
  flex: '1 1 55%',
  maxWidth: '100%',
  minWidth: '10rem',
  width: '100%',
  '& .pf-v6-c-form-control, & .pf-v5-c-form-control': {
    fontSize: PFFontSize.small
  },
  '& .pf-v6-c-form-control__utilities, & .pf-v5-c-form-control__utilities': {
    alignItems: 'center',
    alignSelf: 'center',
    display: 'flex'
  },
  '& select': {
    fontSize: PFFontSize.small
  }
});

export const gatewaySplitConfigLabel = (cfg: GatewayWaypointTrafficSplitConfig): string => {
  if (cfg.configLevel === 'service' && cfg.serviceName) {
    return t('{{namespace}} / {{service}}', { namespace: cfg.namespace, service: cfg.serviceName });
  }
  return cfg.namespace;
};

type Props = {
  configs: GatewayWaypointTrafficSplitConfig[];
  onSelect: (index: number) => void;
  selectedIndex: number;
};

/** Dropdown to pick which enrollment’s split feeds the donut (shared waypoint gateways). */
export const WaypointTrafficSplitSelector: React.FC<Props> = ({ configs, onSelect, selectedIndex }) => {
  if (configs.length <= 1) {
    return null;
  }

  return (
    <div className={compactSelectWrapperStyle}>
      <FormSelect
        aria-label={t('Traffic split configuration')}
        data-test="waypoint-traffic-split-config-select"
        id="waypoint-traffic-split-config-select"
        onChange={(_event, value) => onSelect(Number(value))}
        value={String(selectedIndex)}
      >
        {configs.map((cfg, index) => {
          const weight = cfg.split?.canaryWeight;
          const suffix = weight !== undefined ? t(' ({{weight}}% canary)', { weight }) : '';
          return (
            <FormSelectOption
              key={`${cfg.namespace}-${cfg.serviceName ?? ''}-${index}`}
              label={`${gatewaySplitConfigLabel(cfg)}${suffix}`}
              value={String(index)}
            />
          );
        })}
      </FormSelect>
    </div>
  );
};

export const gatewayConfigsWithCanary = (
  configs?: GatewayWaypointTrafficSplitConfig[]
): GatewayWaypointTrafficSplitConfig[] => {
  return (configs ?? []).filter(cfg => !!cfg.split?.canary);
};
