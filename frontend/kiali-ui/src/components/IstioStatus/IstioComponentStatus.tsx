import * as React from 'react';
import { ComponentStatus, Status } from '../../types/IstioStatus';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import { PFColors } from '../Pf/PfColors';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon
} from '@patternfly/react-icons';
import { Split, SplitItem } from '@patternfly/react-core';

type Props = {
  componentStatus: ComponentStatus;
};

export type ComponentIcon = {
  color: string;
  icon: React.ComponentClass<SVGIconProps>;
};

const ErrorCoreComponent: ComponentIcon = {
  color: PFColors.Danger,
  icon: ExclamationCircleIcon
};

const ErrorAddonComponent: ComponentIcon = {
  color: PFColors.Warning,
  icon: ExclamationTriangleIcon
};

const NotReadyComponent: ComponentIcon = {
  color: PFColors.Info,
  icon: MinusCircleIcon
};

const SuccessComponent: ComponentIcon = {
  color: PFColors.Success,
  icon: CheckCircleIcon
};

// Mapping Valid-Core to Icon representation.
const validToIcon: { [valid: string]: ComponentIcon } = {
  'false-false': ErrorAddonComponent,
  'false-true': ErrorCoreComponent,
  'true-false': SuccessComponent,
  'true-true': SuccessComponent
};

const statusMsg = {
  [Status.NotFound]: 'Not found',
  [Status.NotReady]: 'Not ready',
  [Status.Unhealthy]: 'Not healthy',
  [Status.Unreachable]: 'Unreachable'
};

class IstioComponentStatus extends React.Component<Props> {
  renderIcon = (status: Status, isCore: boolean) => {
    let compIcon = validToIcon[`${status === Status.Healthy}-${isCore}`];
    if (status === Status.NotReady) {
      compIcon = NotReadyComponent;
    }
    const IconComponent = compIcon.icon;
    return <IconComponent style={{ color: compIcon.color, marginTop: 5 }} />;
  };

  renderCells = () => {
    const comp = this.props.componentStatus;

    return [
      <Split key={'cell-status-icon-' + comp.name} hasGutter={true}>
        <SplitItem>{this.renderIcon(this.props.componentStatus.status, this.props.componentStatus.is_core)}</SplitItem>
        <SplitItem isFilled={true}>{comp.name}</SplitItem>
        <SplitItem>{statusMsg[comp.status]}</SplitItem>
      </Split>
    ];
  };

  render() {
    return this.renderCells();
  }
}

export default IstioComponentStatus;
