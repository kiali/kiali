import { Label, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { infoStyle } from '../../pages/Overview/OverviewCardControlPlaneNamespace';
import { useKialiTranslation } from 'utils/I18nUtils';

type Props = {
  version?: string;
};

const lockIconStyle = kialiStyle({ marginLeft: '0.25rem' });

const LockIcon = (): React.ReactElement => {
  return <KialiIcon.MtlsLock className={lockIconStyle} />;
};

const TLSInfoComponent: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();

  return (
    <div style={{ textAlign: 'left' }}>
      <div>
        <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>{t('Min TLS version')}</div>
        <Label isCompact color="blue" data-test={'label-TLS'}>
          <div style={{ display: '-webkit-box' }}>
            {props.version} <LockIcon></LockIcon>
            <Tooltip
              position={TooltipPosition.right}
              content={
                <div style={{ textAlign: 'left' }}>
                  {t(`The meshConfig.meshMTLS.minProtocolVersion field specifies the minimum TLS version for the TLS \
                  connections among Istio workloads. N/A if it was not set.`)}
                </div>
              }
            >
              <KialiIcon.Info className={infoStyle} />
            </Tooltip>
          </div>
        </Label>
      </div>
    </div>
  );
};

export const TLSInfo = TLSInfoComponent;
