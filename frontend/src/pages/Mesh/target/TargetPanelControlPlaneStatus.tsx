import { Tooltip, TooltipPosition, Label } from '@patternfly/react-core';
import * as React from 'react';
import { OutboundTrafficPolicy } from 'types/IstioObjects';
import { useKialiTranslation } from 'utils/I18nUtils';
import { ControlPlaneMetricsMap } from 'types/Metrics';

type Props = {
  controlPlaneMetrics?: ControlPlaneMetricsMap;
  outboundTrafficPolicy?: OutboundTrafficPolicy;
};

export const TargetPanelControlPlaneStatus: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();

  const proxyTime = props.controlPlaneMetrics?.istiod_proxy_time;
  const proxySyncTime =
    proxyTime && proxyTime.length > 0
      ? proxyTime[0].datapoints.reduce((a, b) => (a[1] < b[1] ? a : b))[1] * 1000
      : undefined;
  const proxySyncTimeStr = !proxySyncTime || isNaN(proxySyncTime) ? 'N/A' : `${proxySyncTime.toFixed(2)}ms`;

  return (
    <div style={{ textAlign: 'left' }}>
      {props.outboundTrafficPolicy && (
        <div>
          <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>{t('Outbound policy')}</div>
          <Tooltip
            position={TooltipPosition.right}
            content={
              <div style={{ textAlign: 'left' }}>
                {t(`This shows the meshConfig.outboundTrafficPolicy.mode setting. It controls the sidecar handling of \
                requests to external services (services not defined in Istio’s internal service registry). When \
                set to ALLOW_ANY the Istio proxy performs a passthrough to the unknown services. When set to REGISTRY_ONLY \
                the Istio proxy blocks requets to hosts without a defined HTTP service or service entry.`)}
              </div>
            }
          >
            <Label isCompact color="blue">
              {props.outboundTrafficPolicy.mode}
            </Label>
          </Tooltip>
        </div>
      )}
      <div>
        <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>{t('Proxy sync time')}</div>
        <Tooltip
          position={TooltipPosition.right}
          content={
            <div style={{ textAlign: 'left' }}>
              {t(`The control plane must sync each proxy when there is a configuration change. This is the average time spent, per proxy, \
                 to perform the update. N/A means there was no syncing performed for the configured time period.`)}
            </div>
          }
        >
          <Label isCompact color="blue">
            {proxySyncTimeStr}
          </Label>
        </Tooltip>
      </div>
    </div>
  );
};
