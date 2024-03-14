import { Tooltip, TooltipPosition, Label } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import * as React from 'react';
import { OutboundTrafficPolicy } from 'types/IstioObjects';
import { NamespaceInfo } from '../../types/NamespaceInfo';
import { infoStyle } from './OverviewCardControlPlaneNamespace';
import { useTranslation } from 'react-i18next';
import { I18N_NAMESPACE } from 'types/Common';

type Props = {
  namespace: NamespaceInfo;
  outboundTrafficPolicy?: OutboundTrafficPolicy;
};

export const ControlPlaneNamespaceStatus: React.FC<Props> = (props: Props) => {
  const { t } = useTranslation(I18N_NAMESPACE);

  let maxProxyPushTime: number | undefined = undefined;

  if (props.namespace.controlPlaneMetrics && props.namespace.controlPlaneMetrics.istiod_proxy_time) {
    maxProxyPushTime =
      props.namespace.controlPlaneMetrics?.istiod_proxy_time[0].datapoints.reduce((a, b) => (a[1] < b[1] ? a : b))[1] *
      1000;
  }

  let showProxyPushTime = false;

  if (maxProxyPushTime && !isNaN(maxProxyPushTime)) {
    showProxyPushTime = true;
  }

  return (
    <div style={{ textAlign: 'left' }}>
      {props.outboundTrafficPolicy && (
        <div>
          <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>{t('Outbound policy')}</div>
          <Tooltip
            position={TooltipPosition.right}
            content={
              <div style={{ textAlign: 'left' }}>
                {t(`This value represents the meshConfig.outboundTrafficPolicy.mode, that configures the sidecar handling of \
                external services, that is, those services that are not defined in Istio’s internal service registry. If \
                this option is set to ALLOW_ANY, the Istio proxy lets calls to unknown services pass through. If the \
                option is set to REGISTRY_ONLY, then the Istio proxy blocks any host without an HTTP service or service \
                entry defined within the mesh`)}
              </div>
            }
          >
            <Label isCompact color="blue">
              {props.outboundTrafficPolicy.mode}
              <KialiIcon.Info className={infoStyle} />
            </Label>
          </Tooltip>
        </div>
      )}
      {showProxyPushTime && (
        <div>
          <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>{t('Proxy push time')}</div>
          <Tooltip
            position={TooltipPosition.right}
            content={
              <div style={{ textAlign: 'left' }}>
                {t(`This value represents the delay in seconds between config change and a proxy receiving all required \
                configuration.`)}
              </div>
            }
          >
            <Label isCompact color="blue">
              {maxProxyPushTime?.toFixed(2)} ms
              <KialiIcon.Info className={infoStyle} />
            </Label>
          </Tooltip>
        </div>
      )}
    </div>
  );
};
