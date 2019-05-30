import * as React from 'react';

import { KialiAppState } from '../../store/Store';
import { MTLSIconTypes } from './MTLSIcon';
import { default as MTLSStatus, emptyDescriptor, StatusDescriptor } from './MTLSStatus';
import { style } from 'typestyle';
import { meshWideMTLSStatusSelector, refreshIntervalSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { MTLSStatuses, TLSStatus } from '../../types/TLSStatus';
import * as MessageCenter from '../../utils/MessageCenter';
import { MessageType } from '../../types/MessageCenter';
import * as API from '../../services/Api';
import { KialiDispatch } from '../../types/Redux';
import { bindActionCreators } from 'redux';
import { MeshTlsActions } from '../../actions/MeshTlsActions';
import { PollIntervalInMs } from '../../types/Common';

type Props = {
  status: string;
  refreshInterval: PollIntervalInMs;
  setMeshTlsStatus: (meshStatus: TLSStatus) => void;
};

type State = {
  intervalId: NodeJS.Timeout;
  refreshInterval: PollIntervalInMs;
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

class MeshMTLSStatus extends React.Component<Props, State> {
  componentDidMount() {
    const intervalId = setInterval(this.fetchStatus, this.props.refreshInterval);
    this.setState({
      intervalId: intervalId,
      refreshInterval: this.props.refreshInterval
    });
  }

  componentWillUnmount() {
    clearInterval(this.state.intervalId);
  }

  componentDidUpdate() {
    if (this.props.refreshInterval !== this.state.refreshInterval) {
      clearInterval(this.state.intervalId);

      const intervalId = setInterval(this.fetchStatus, this.props.refreshInterval);
      this.setState({
        intervalId: intervalId,
        refreshInterval: this.props.refreshInterval
      });
    }
  }

  fetchStatus = () => {
    API.getMeshTls()
      .then(response => {
        return this.props.setMeshTlsStatus(response.data);
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Error fetching status.', error), 'default', MessageType.WARNING);
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
  refreshInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  setMeshTlsStatus: bindActionCreators(MeshTlsActions.setinfo, dispatch)
});

const MeshMTLSSatutsConnected = connect(
  mapStateToProps,
  mapDispatchToProps
)(MeshMTLSStatus);
export default MeshMTLSSatutsConnected;
