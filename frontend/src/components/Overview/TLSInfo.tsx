import { Label, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiAppState } from '../../store/Store';
import { istioCertsInfoSelector } from '../../store/Selectors';
import { CertsInfo } from '../../types/CertsInfo';
import { connect } from 'react-redux';
import { infoStyle } from '../../pages/Overview/OverviewCardControlPlaneNamespace';
import { t, useKialiTranslation } from 'utils/I18nUtils';

type ReduxProps = {
  certsInfo: CertsInfo[];
};

type Props = ReduxProps & {
  certificatesInformationIndicators: boolean;
  version?: string;
};

const lockIconStyle = kialiStyle({ marginLeft: '0.25rem' });

const showCerts = (certs: CertsInfo[]): React.ReactNode => {
  if (certs) {
    let rows = certs.map(item => {
      return (
        <div key={'showCerts'}>
          <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>From {item.issuer}</div>
          <div>
            <div>{t('Issuer:')}</div>
            <div>{item.secretName}</div>
          </div>
          <div>
            <div>{t('Valid From:')}</div>
            <div>{item.notAfter}</div>
          </div>
          <div>
            <div>{t('Valid To:')}</div>
            <div>{item.notBefore}</div>
          </div>
        </div>
      );
    });

    return <div>{rows}</div>;
  } else {
    return t('No cert info');
  }
};

const LockIcon = (props: Props): React.ReactElement => {
  return props.certificatesInformationIndicators === true ? (
    <Tooltip position={TooltipPosition.top} content={showCerts(props.certsInfo)}>
      <div data-test={'lockerCA'}>
        <KialiIcon.MtlsLock className={lockIconStyle} />
      </div>
    </Tooltip>
  ) : (
    <KialiIcon.MtlsLock className={lockIconStyle} />
  );
};

const TLSInfoComponent: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();

  return (
    <div style={{ textAlign: 'left' }}>
      <div>
        <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>{t('Min TLS version')}</div>
        <Label isCompact color="blue" data-test={'label-TLS'}>
          <div style={{ display: '-webkit-box' }}>
            {props.version}{' '}
            <LockIcon
              certificatesInformationIndicators={props.certificatesInformationIndicators}
              certsInfo={props.certsInfo}
            ></LockIcon>
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

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  certsInfo: istioCertsInfoSelector(state)
});

export const TLSInfo = connect(mapStateToProps)(TLSInfoComponent);
