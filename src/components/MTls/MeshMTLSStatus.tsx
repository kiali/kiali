import * as React from 'react';

import { KialiAppState } from '../../store/Store';
import { MTLSIconTypes } from './MTLSIcon';
import { default as MTLSStatus, emptyDescriptor, StatusDescriptor } from './MTLSStatus';
import { style } from 'typestyle';
import { lastRefreshAtSelector, meshWideMTLSStatusSelector, namespaceItemsSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { MTLSStatuses, TLSStatus } from '../../types/TLSStatus';
import * as MessageCenter from '../../utils/MessageCenter';
import { MessageType } from '../../types/MessageCenter';
import * as API from '../../services/Api';
import { KialiDispatch } from '../../types/Redux';
import { bindActionCreators } from 'redux';
import { MeshTlsActions } from '../../actions/MeshTlsActions';
import { PollIntervalInMs } from '../../types/Common';
import Namespace from '../../types/Namespace';

type ReduxProps = {
  lastRefreshAt: PollIntervalInMs;
  setMeshTlsStatus: (meshStatus: TLSStatus) => void;
  namespaces: Namespace[] | undefined;
  status: string;
};

type Props = ReduxProps & {};

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
  componentDidMount() {
    this.fetchStatus();
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.lastRefreshAt !== prevProps.lastRefreshAt) {
      this.fetchStatus();
    }
  }

  fetchStatus = () => {
    API.getMeshTls()
      .then(response => {
        return this.props.setMeshTlsStatus(response.data);
      })
      .catch(error => {
        // User without namespaces can't have access to mTLS information. Reduce severity to info.
        const informative = this.props.namespaces && this.props.namespaces.length < 1;
        if (informative) {
          MessageCenter.add(
            API.getInfoMsg('Mesh-wide mTLS status feature disabled.', error),
            'default',
            MessageType.INFO
          );
        } else {
          MessageCenter.add(
            API.getErrorMsg('Error fetching Mesh-wide mTLS status.', error),
            'default',
            MessageType.ERROR
          );
        }
      });
  };

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
  status: meshWideMTLSStatusSelector(state),
  lastRefreshAt: lastRefreshAtSelector(state),
  namespaces: namespaceItemsSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  setMeshTlsStatus: bindActionCreators(MeshTlsActions.setinfo, dispatch)
});

const MeshMTLSSatutsConnected = connect(
  mapStateToProps,
  mapDispatchToProps
)(MeshMTLSStatus);
export default MeshMTLSSatutsConnected;
