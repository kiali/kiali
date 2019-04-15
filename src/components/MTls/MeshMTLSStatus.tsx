import * as React from 'react';

import { KialiAppState } from '../../store/Store';
import { MTLSIconTypes } from './MTLSIcon';
import { default as MTLSStatus, emptyDescriptor, StatusDescriptor } from './MTLSStatus';
import { style } from 'typestyle';
import { meshWideMTLSStatusSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { MTLSStatuses } from '../../types/TLSStatus';

type Props = {
  status: string;
};

const statusDescriptors = new Map<string, StatusDescriptor>([
  [
    MTLSStatuses.ENABLED,
    {
      message: 'Mesh-wide mTLS is enabled',
      icon: MTLSIconTypes.LOCK_FULL,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.PARTIALLY,
    {
      message: 'Mesh-wide TLS is partially enabled',
      icon: MTLSIconTypes.LOCK_HOLLOW,
      showStatus: true
    }
  ],
  [MTLSStatuses.NOT_ENABLED, emptyDescriptor]
]);

class MeshMTLSStatus extends React.Component<Props> {
  iconStyle() {
    return style({
      marginTop: -3,
      marginRight: 8,
      width: 13
    });
  }

  render() {
    return (
      <div className={this.iconStyle()}>
        <MTLSStatus status={this.props.status} statusDescriptors={statusDescriptors} overlayPosition={'left'} />
      </div>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  status: meshWideMTLSStatusSelector(state)
});

const MeshMTLSSatutsConnected = connect(mapStateToProps)(MeshMTLSStatus);
export default MeshMTLSSatutsConnected;
