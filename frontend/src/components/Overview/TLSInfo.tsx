import { Label, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiAppState } from '../../store/Store';
import { istioCertsInfoSelector } from '../../store/Selectors';
import { CertsInfo } from '../../types/CertsInfo';
import { connect } from 'react-redux';
import { infoStyle } from '../../pages/Overview/OverviewCardControlPlaneNamespace';

type Props = {
  certificatesInformationIndicators: boolean;
  version?: string;
  certsInfo: CertsInfo[];
};

const lockIconStyle = kialiStyle({ marginLeft: '5px' });

function showCerts(certs) {
  if (certs) {
    let rows = certs.map(function (item) {
      return (
        <div key={'showCerts'}>
          <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>From {item.issuer}</div>
          <div>
            <div>{$t('Issuer')}: </div>
            <div>{item.secretName}</div>
          </div>
          <div>
            <div>{$t('ValidFrom', 'Valid from')}: </div>
            <div>{item.notAfter}</div>
          </div>
          <div>
            <div>{$t('ValidTo', 'Valid To')}: </div>
            <div>{item.notBefore}</div>
          </div>
        </div>
      );
    });
    return <div>{rows}</div>;
  } else {
    return $t('NoCertInfo', 'No cert info');
  }
}

function LockIcon(props) {
  return props.certificatesInformationIndicators === true ? (
    <Tooltip position={TooltipPosition.top} content={showCerts(props.certsInfo)}>
      <div data-test={'lockerCA'}>
        <KialiIcon.MtlsLock className={lockIconStyle} />
      </div>
    </Tooltip>
  ) : (
    <KialiIcon.MtlsLock className={lockIconStyle} />
  );
}

class TLSInfoComponent extends React.Component<Props> {
  render() {
    return (
      <div style={{ textAlign: 'left' }}>
        <div>
          <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>
            {$t('MinTLSversion', 'Min TLS version')}
          </div>
          <Label isCompact color="blue" data-test={'label-TLS'}>
            <div style={{ display: '-webkit-box' }}>
              {this.props.version}{' '}
              <LockIcon
                certificatesInformationIndicators={this.props.certificatesInformationIndicators}
                certsInfo={this.props.certsInfo}
              ></LockIcon>
              <Tooltip
                position={TooltipPosition.right}
                content={
                  <div style={{ textAlign: 'left' }}>
                    {$t(
                      'tooltip.MeshMinTLSVersion',
                      'The meshConfig.meshMTLS.minProtocolVersion field specifies the minimum TLS version for the TLS connections among Istio workloads. N/A if it was not set.'
                    )}
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
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  certsInfo: istioCertsInfoSelector(state)
});

export const TLSInfo = connect(mapStateToProps)(TLSInfoComponent);
