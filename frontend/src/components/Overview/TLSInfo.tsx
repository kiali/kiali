import { Label, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
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
        <Tooltip
          position={TooltipPosition.right}
          content={
            <div style={{ textAlign: 'left' }}>
              {t(
                `The minimum TLS version for connections among Istio workloads. Defaults to TLSV1_2 if not set. Set by the 'meshConfig.meshMTLS.minProtocolVersion' field.`
              )}
            </div>
          }
        >
          <Label isCompact color="blue" data-test={'label-TLS'}>
            <div style={{ display: '-webkit-box' }}>
              {props.version} <LockIcon></LockIcon>
            </div>
          </Label>
        </Tooltip>
      </div>
    </div>
  );
};

export const TLSInfo = TLSInfoComponent;
