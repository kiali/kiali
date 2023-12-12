import * as React from 'react';
import { ComponentStatus, Status } from '../../types/IstioStatus';
import { PFColors } from '../Pf/PfColors';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon
} from '@patternfly/react-icons';
import { Split, SplitItem } from '@patternfly/react-core';
import { IconProps, createIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';

type Props = {
  componentStatus: ComponentStatus;
};

const ErrorCoreComponent: IconProps = {
  color: PFColors.Danger,
  icon: ExclamationCircleIcon
};

const ErrorAddonComponent: IconProps = {
  color: PFColors.Warning,
  icon: ExclamationTriangleIcon
};

const NotReadyComponent: IconProps = {
  color: PFColors.Info,
  icon: MinusCircleIcon
};

const SuccessComponent: IconProps = {
  color: PFColors.Success,
  icon: CheckCircleIcon
};

// Mapping Valid-Core to Icon representation.
const validToIcon: { [valid: string]: IconProps } = {
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

const splitItemStyle = kialiStyle({
  textAlign: 'left'
});

export const IstioComponentStatus: React.FC<Props> = (props: Props) => {
  const renderIcon = (status: Status, isCore: boolean): React.ReactNode => {
    let compIcon = validToIcon[`${status === Status.Healthy}-${isCore}`];

    if (status === Status.NotReady) {
      compIcon = NotReadyComponent;
    }

    compIcon.className = kialiStyle({
      marginTop: '0.25rem'
    });

    return createIcon(compIcon);
  };

  const renderCells = (): React.ReactNode => {
    const comp = props.componentStatus;

    return [
      <Split key={`cell-status-icon-${comp.name}`} hasGutter={true} className={splitItemStyle}>
        <SplitItem>{renderIcon(props.componentStatus.status, props.componentStatus.is_core)}</SplitItem>
        <SplitItem isFilled={true}>{comp.name}</SplitItem>
        <SplitItem>{statusMsg[comp.status]}</SplitItem>
      </Split>
    ];
  };

  return <>{renderCells()}</>;
};
