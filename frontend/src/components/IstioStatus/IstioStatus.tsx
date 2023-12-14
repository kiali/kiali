import * as React from 'react';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { TimeInMilliseconds } from '../../types/Common';
import { ComponentStatus, Status } from '../../types/IstioStatus';
import { MessageType } from '../../types/MessageCenter';
import { Namespace } from '../../types/Namespace';
import { KialiAppState } from '../../store/Store';
import { istioStatusSelector, namespaceItemsSelector } from '../../store/Selectors';
import { bindActionCreators } from 'redux';
import { IstioStatusActions } from '../../actions/IstioStatusActions';
import { connect } from 'react-redux';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { IstioStatusList } from './IstioStatusList';
import { PFColors } from '../Pf/PfColors';
import { ResourcesFullIcon } from '@patternfly/react-icons';
import { KialiDispatch } from 'types/Redux';
import { NamespaceThunkActions } from '../../actions/NamespaceThunkActions';
import { connectRefresh } from '../Refresh/connectRefresh';
import { kialiStyle } from 'styles/StyleUtils';
import { IconProps, createIcon } from 'config/KialiIcon';

type ReduxStateProps = {
  namespaces?: Namespace[];
  status: ComponentStatus[];
};

type ReduxDispatchProps = {
  refreshNamespaces: () => void;
  setIstioStatus: (istioStatus: ComponentStatus[]) => void;
};

type StatusIcons = {
  ErrorIcon?: React.ComponentClass<SVGIconProps>;
  HealthyIcon?: React.ComponentClass<SVGIconProps>;
  InfoIcon?: React.ComponentClass<SVGIconProps>;
  WarningIcon?: React.ComponentClass<SVGIconProps>;
};

type Props = ReduxStateProps &
  ReduxDispatchProps & {
    cluster?: string;
    icons?: StatusIcons;
    lastRefreshAt: TimeInMilliseconds;
  };

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

const defaultIcons = {
  ErrorIcon: ResourcesFullIcon,
  HealthyIcon: ResourcesFullIcon,
  InfoIcon: ResourcesFullIcon,
  WarningIcon: ResourcesFullIcon
};

const iconStyle = kialiStyle({
  marginLeft: '0.5rem',
  verticalAlign: '-0.125rem'
});

export class IstioStatusComponent extends React.Component<Props> {
  componentDidMount(): void {
    this.props.refreshNamespaces();
    this.fetchStatus();
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (this.props.lastRefreshAt !== prevProps.lastRefreshAt) {
      this.fetchStatus();
    }
  }

  fetchStatus = (): void => {
    API.getIstioStatus(this.props.cluster)
      .then(response => {
        this.props.setIstioStatus(response.data);
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

  tooltipContent = (): React.ReactNode => {
    return <IstioStatusList status={this.props.status} />;
  };

  tooltipColor = (): string => {
    let coreUnhealthy = false;
    let addonUnhealthy = false;
    let notReady = false;

    Object.keys(this.props.status ?? {}).forEach((compKey: string) => {
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

  healthyComponents = (): boolean => {
    return this.props.status.reduce((healthy: boolean, compStatus: ComponentStatus) => {
      return healthy && compStatus.status === Status.Healthy;
    }, true);
  };

  render(): React.ReactNode {
    if (!this.healthyComponents()) {
      const icons = this.props.icons ? { ...defaultIcons, ...this.props.icons } : defaultIcons;
      const iconColor = this.tooltipColor();
      let icon = ResourcesFullIcon;
      let dataTest = 'istio-status';

      if (iconColor === PFColors.Danger) {
        icon = icons.ErrorIcon;
        dataTest = `${dataTest}-danger`;
      } else if (iconColor === PFColors.Warning) {
        icon = icons.WarningIcon;
        dataTest = `${dataTest}-warning`;
      } else if (iconColor === PFColors.Info) {
        icon = icons.InfoIcon;
        dataTest = `${dataTest}-info`;
      } else if (iconColor === PFColors.Success) {
        icon = icons.HealthyIcon;
        dataTest = `${dataTest}-success`;
      }

      const iconProps: IconProps = {
        className: iconStyle,
        dataTest: dataTest
      };

      return (
        <Tooltip position={TooltipPosition.left} enableFlip={true} content={this.tooltipContent()} maxWidth="25rem">
          {createIcon(iconProps, icon, iconColor)}
        </Tooltip>
      );
    }

    return null;
  }
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  status: istioStatusSelector(state),
  namespaces: namespaceItemsSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  setIstioStatus: bindActionCreators(IstioStatusActions.setinfo, dispatch),
  refreshNamespaces: () => {
    dispatch(NamespaceThunkActions.fetchNamespacesIfNeeded());
  }
});

export const IstioStatus = connectRefresh(connect(mapStateToProps, mapDispatchToProps)(IstioStatusComponent));
