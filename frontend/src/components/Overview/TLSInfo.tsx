import {Label, Tooltip, TooltipPosition} from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import * as React from 'react';
import {style} from "typestyle";
import {KialiAppState} from "../../store/Store";
import {istioCertsInfoSelector} from "../../store/Selectors";
import {CertsInfo} from "../../types/CertsInfo";
import {connect} from "react-redux";
import {infoStyle} from "../../pages/Overview/OverviewCardControlPlaneNamespace";

type Props = {
  certificatesInformationIndicators: boolean,
  version?: string,
  certsInfo: CertsInfo[];
};

const lockIconStyle = style({ marginLeft: '5px' });

function showCerts(certs) {
  if (certs) {
    let rows = certs.map(function(item) {
      return (<div key={"showCerts"}>
        <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>From {item.issuer}</div>
        <div>
          <div>Issuer: </div>
          <div>{item.secretName}</div>
        </div>
        <div>
          <div>Valid From: </div>
          <div>{item.notAfter}</div>
        </div>
        <div>
          <div>Valid To: </div>
          <div>{item.notBefore}</div>
        </div>
      </div>)
    });
    return (
      <div>
        {rows}
      </div>
    );
  } else {
    return ("No cert info")
  }

}

function LockIcon(props) {

  return (
    props.certificatesInformationIndicators === true ? (
      <Tooltip
        position={TooltipPosition.top}
        content={showCerts(props.certsInfo)}
      >
        <div data-test={"lockerCA"}>
          <KialiIcon.MtlsLock className={lockIconStyle}/>
        </div>
      </Tooltip>)
      : (<KialiIcon.MtlsLock className={lockIconStyle}/>)
  );
};

class TLSInfo extends React.Component<Props> {

  render() {
    return (
      <div style={{ textAlign: 'left' }}>
          <div>
            <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>Min TLS version</div>
              <Label isCompact color="blue" data-test={"label-TLS"}>
                {this.props.version} <LockIcon certificatesInformationIndicators={this.props.certificatesInformationIndicators} certsInfo={this.props.certsInfo}></LockIcon>
                <Tooltip
                  position={TooltipPosition.right}
                  content={<div style={{ textAlign: 'left' }}>The meshConfig.meshMTLS.minProtocolVersion field specifies the minimum TLS version for the TLS connections among Istio workloads. N/A if it was not set.</div>}
                >
                  <KialiIcon.Info className={infoStyle} />
                </Tooltip>
              </Label>
          </div>
      </div>
    );
  };
}

const mapStateToProps = (state: KialiAppState) => ({
  certsInfo: istioCertsInfoSelector(state),
});

const TLSInfoConnect = connect(mapStateToProps)(TLSInfo);
export default TLSInfoConnect;

