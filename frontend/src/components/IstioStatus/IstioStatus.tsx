import * as React from 'react';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { TimeInMilliseconds } from '../../types/Common';
import { ComponentStatus, Status } from '../../types/IstioStatus';
import { MessageType } from '../../types/MessageCenter';
import Namespace from '../../types/Namespace';
import { KialiAppState } from '../../store/Store';
import { istioStatusSelector, lastRefreshAtSelector, namespaceItemsSelector } from '../../store/Selectors';
import { bindActionCreators } from 'redux';
import { IstioStatusActions } from '../../actions/IstioStatusActions';
import { connect } from 'react-redux';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import IstioStatusList from './IstioStatusList';
import { PFColors } from '../Pf/PfColors';
import './IstioStatus.css';
import { ResourcesFullIcon } from '@patternfly/react-icons';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from '../../actions/KialiAppAction';
import NamespaceThunkActions from '../../actions/NamespaceThunkActions';

type ReduxProps = {
  lastRefreshAt: TimeInMilliseconds;
  setIstioStatus: (istioStatus: ComponentStatus[]) => void;
  refreshNamespaces: () => void;
  namespaces: Namespace[] | undefined;
  status: ComponentStatus[];
};

type Props = ReduxProps & {};

const ValidToColor = {
  'true-true-true': PFColors.Danger,
  'true-true-false': PFColors.Danger,
  'true-false-true': PFColors.Danger,
  'true-false-false': PFColors.Danger,
  'false-true-true': PFColors.Warning,
  'false-true-false': PFColors.Warning,
  'false-false-true': PFColors.Info,
  'false-false-false': PFColors.Success
};

export class IstioStatus extends React.Component<Props> {
  componentDidMount() {
    this.props.refreshNamespaces();
    this.fetchStatus();
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (this.props.lastRefreshAt !== prevProps.lastRefreshAt) {
      this.fetchStatus();
    }
  }

  fetchStatus = () => {
    API.getIstioStatus()
      .then(response => {
        return this.props.setIstioStatus(response.data);
      })
      .catch(error => {
        // User without namespaces can't have access to mTLS information. Reduce severity to info.
        const informative = this.props.namespaces && this.props.namespaces.length < 1;
        if (informative) {
          AlertUtils.addError('Istio deployment status disabled.', error, 'default', MessageType.INFO);
        } else {
          AlertUtils.addError('Error fetching Istio deployment status.', error, 'default', MessageType.ERROR);
        }
      });
  };

  tooltipContent = () => {
    return <IstioStatusList status={this.props.status} />;
  };

  tooltipColor = () => {
    let coreUnhealthy: boolean = false;
    let addonUnhealthy: boolean = false;
    let notReady: boolean = false;

    Object.keys(this.props.status || {}).forEach((compKey: string) => {
      const { status, is_core } = this.props.status[compKey];
      const isNotReady: boolean = status === Status.NotReady;
      const isUnhealthy: boolean = status !== Status.Healthy && !isNotReady;

      if (is_core) {
        coreUnhealthy = coreUnhealthy || isUnhealthy;
      } else {
        addonUnhealthy = addonUnhealthy || isUnhealthy;
      }

      notReady = notReady || isNotReady;
    });

    return ValidToColor[`${coreUnhealthy}-${addonUnhealthy}-${notReady}`];
  };

  healthyComponents = () => {
    return this.props.status.reduce((healthy: boolean, compStatus: ComponentStatus) => {
      return healthy && compStatus.status === Status.Healthy;
    }, true);
  };

  render() {
    if (!this.healthyComponents()) {
      return (
        <Tooltip position={TooltipPosition.left} enableFlip={true} content={this.tooltipContent()} maxWidth={'25rem'}>
          <ResourcesFullIcon color={this.tooltipColor()} style={{ verticalAlign: '-0.2em', marginRight: -8 }} />
        </Tooltip>
      );
    }

    return null;
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  status: istioStatusSelector(state),
  lastRefreshAt: lastRefreshAtSelector(state),
  namespaces: namespaceItemsSelector(state)
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  setIstioStatus: bindActionCreators(IstioStatusActions.setinfo, dispatch),
  refreshNamespaces: () => {
    dispatch(NamespaceThunkActions.fetchNamespacesIfNeeded());
  }
});

const IstioStatusConnected = connect(mapStateToProps, mapDispatchToProps)(IstioStatus);

export default IstioStatusConnected;
