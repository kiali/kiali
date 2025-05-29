import * as React from 'react';

import { KialiAppState } from '../../store/Store';
import { MTLSStatus, emptyDescriptor, StatusDescriptor } from './MTLSStatus';
import { kialiStyle } from 'styles/StyleUtils';
import { meshWideMTLSEnabledSelector, meshWideMTLSStatusSelector, namespaceItemsSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { MTLSStatuses, TLSStatus } from '../../types/TLSStatus';
import * as AlertUtils from '../../utils/AlertUtils';
import { MessageType } from '../../types/MessageCenter';
import * as API from '../../services/Api';
import { KialiDispatch } from '../../types/Redux';
import { bindActionCreators } from 'redux';
import { MeshTlsActions } from '../../actions/MeshTlsActions';
import { TimeInMilliseconds } from '../../types/Common';
import { Namespace } from '../../types/Namespace';
import { connectRefresh } from '../Refresh/connectRefresh';
import { MTLSIconTypes } from './NamespaceMTLSStatus';

type ReduxStateProps = {
  autoMTLSEnabled: boolean;
  namespaces: Namespace[] | undefined;
  status: string;
};

type ReduxDispatchProps = {
  setMeshTlsStatus: (meshStatus: TLSStatus) => void;
};

type Props = ReduxStateProps &
  ReduxDispatchProps & {
    cluster: string;
    lastRefreshAt: TimeInMilliseconds;
    revision: string;
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
  [
    MTLSStatuses.ENABLED_DEFAULT,
    {
      message: 'Mesh-wide mTLS is enabled, configured by default',
      icon: MTLSIconTypes.LOCK_FULL,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.PARTIALLY_DEFAULT,
    {
      message: 'Mesh-wide TLS is partially enabled, configured by default',
      icon: MTLSIconTypes.LOCK_HOLLOW,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.AUTO_DEFAULT,
    {
      message: 'Automatic Mesh-wide mTLS is enabled',
      icon: MTLSIconTypes.LOCK_FULL,
      showStatus: true
    }
  ],
  [MTLSStatuses.NOT_ENABLED, emptyDescriptor]
]);

const iconStyle = kialiStyle({
  marginRight: '0.5rem',
  width: '0.75rem'
});

class MeshMTLSStatusComponent extends React.Component<Props> {
  componentDidMount(): void {
    this.fetchStatus();
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.props.lastRefreshAt !== prevProps.lastRefreshAt) {
      this.fetchStatus();
    }
  }

  fetchStatus = (): void => {
    // leaving empty cluster param here, home cluster will be used by default
    API.getMeshTls(this.props.cluster, this.props.revision)
      .then(response => {
        return this.props.setMeshTlsStatus(response.data);
      })
      .catch(error => {
        // User without namespaces can't have access to mTLS information. Reduce severity to info.
        const informative = this.props.namespaces && this.props.namespaces.length < 1;
        if (informative) {
          AlertUtils.addError('Mesh-wide mTLS status feature disabled.', error, 'default', MessageType.INFO);
        } else {
          AlertUtils.addError('Error fetching Mesh-wide mTLS status.', error, 'default', MessageType.ERROR);
        }
      });
  };

  finalStatus = (): string => {
    if (this.props.autoMTLSEnabled) {
      if (this.props.status === MTLSStatuses.ENABLED) {
        return MTLSStatuses.ENABLED_DEFAULT;
      }

      if (this.props.status === MTLSStatuses.PARTIALLY) {
        return MTLSStatuses.PARTIALLY_DEFAULT;
      }

      return MTLSStatuses.AUTO_DEFAULT;
    }

    return this.props.status;
  };

  render(): JSX.Element {
    return <MTLSStatus className={iconStyle} status={this.finalStatus()} statusDescriptors={statusDescriptors} />;
  }
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  status: meshWideMTLSStatusSelector(state),
  autoMTLSEnabled: meshWideMTLSEnabledSelector(state),
  namespaces: namespaceItemsSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  setMeshTlsStatus: bindActionCreators(MeshTlsActions.setinfo, dispatch)
});

export const MeshMTLSStatus = connectRefresh(connect(mapStateToProps, mapDispatchToProps)(MeshMTLSStatusComponent));
