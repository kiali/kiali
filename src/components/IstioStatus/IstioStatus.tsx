import * as React from 'react';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { TimeInMilliseconds } from '../../types/Common';
import { ComponentStatus, Status } from '../../types/IstioStatus';
import { MessageType } from '../../types/MessageCenter';
import Namespace from '../../types/Namespace';
import { KialiAppState } from '../../store/Store';
import { istioStatusSelector, lastRefreshAtSelector, namespaceItemsSelector } from '../../store/Selectors';
import { KialiDispatch } from '../../types/Redux';
import { bindActionCreators } from 'redux';
import { IstioStatusActions } from '../../actions/IstioStatusActions';
import { connect } from 'react-redux';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import IstioStatusList from './IstioStatusList';
import { PFAlertColor } from '../Pf/PfColors';
import './IstioStatus.css';
import { ResourcesFullIcon } from '@patternfly/react-icons';

type ReduxProps = {
  lastRefreshAt: TimeInMilliseconds;
  setIstioStatus: (istioStatus: ComponentStatus[]) => void;
  namespaces: Namespace[] | undefined;
  status: ComponentStatus[];
};

type Props = ReduxProps & {};

const ValidToColor = {
  'false-false': PFAlertColor.Danger,
  'false-true': PFAlertColor.Danger,
  'true-false': PFAlertColor.Warning,
  'true-true': PFAlertColor.Success
};

export class IstioStatus extends React.Component<Props> {
  componentDidMount() {
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
    let coreHealthy: boolean = true;
    let addonHealthy: boolean = true;

    Object.keys(this.props.status || {}).forEach((compKey: string) => {
      const { status, is_core } = this.props.status[compKey];
      const isHealthy: boolean = status === Status.Healthy;

      if (is_core) {
        coreHealthy = coreHealthy && isHealthy;
      } else {
        addonHealthy = addonHealthy && isHealthy;
      }
    });

    return ValidToColor[`${coreHealthy}-${addonHealthy}`];
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
          <ResourcesFullIcon color={this.tooltipColor()} style={{ verticalAlign: '-0.3em', marginRight: 8 }} />
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

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  setIstioStatus: bindActionCreators(IstioStatusActions.setinfo, dispatch)
});

const IstioStatusConnected = connect(
  mapStateToProps,
  mapDispatchToProps
)(IstioStatus);

export default IstioStatusConnected;
