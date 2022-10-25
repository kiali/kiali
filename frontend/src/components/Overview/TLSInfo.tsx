import {Tooltip, TooltipPosition} from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import * as React from 'react';
import {style} from "typestyle";
import {KialiAppState} from "../../store/Store";
import {istioCertsInfoSelector} from "../../store/Selectors";
import {CertsInfo} from "../../types/CertsInfo";
import {connect} from "react-redux";


type Props = {
  mTLS: boolean,
  version?: string,
  certsInfo: CertsInfo[];
};

const lockIconStyle = style({ marginLeft: '5px' });

function showCerts(certs) {
  if (certs) {
    let rows = certs.map(function(item){
      return (<div>
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
    <Tooltip
      position={TooltipPosition.top}
      content={showCerts(props.certsInfo)}
    >
      <>
        {props.mTLS && (<KialiIcon.MtlsLock className={lockIconStyle}/>)}
        {!props.mTLS && (<KialiIcon.MtlsUnlock className={lockIconStyle}/>)}
      </>
    </Tooltip>
  );
};

class TLSInfo extends React.Component<Props> {

  render() {
    return (
      <div style={{ textAlign: 'left' }}>
          <div>
            <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>Min TLS Version</div>
            {this.props.version} <LockIcon mTLS={this.props.mTLS} certsInfo={this.props.certsInfo}></LockIcon>
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

