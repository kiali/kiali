import * as React from 'react';
import { ComponentStatus, Status, statusMsg } from '../../types/IstioStatus';
import { PFColors } from '../Pf/PfColors';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InProgressIcon
} from '@patternfly/react-icons';
import { Label, Split, SplitItem } from '@patternfly/react-core';
import { IconProps, createIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { useKialiTranslation } from 'utils/I18nUtils';

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
  icon: InProgressIcon
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

const splitItemStyle = kialiStyle({
  marginLeft: '0.25rem',
  marginTop: '0.125rem',
  textAlign: 'left'
});

const labelStyle = kialiStyle({
  height: '1.25rem',
  backgroundColor: 'var(--pf-v6-c-label--m-outline--BackgroundColor, transparent)',
  $nest: {
    '& .pf-v6-c-label__icon': {
      marginRight: '0.125rem',
      $nest: {
        '& svg': {
          color: 'inherit'
        }
      }
    },
    '& .pf-v6-c-label__content': {
      color: 'var(--pf-t--global--text--color--primary--default)'
    }
  }
});

export const IstioComponentStatus: React.FC<Props> = (props: Props) => {
  const { t } = useKialiTranslation();

  const getIcon = (status: Status, isCore: boolean): IconProps => {
    let compIcon = validToIcon[`${status === Status.Healthy}-${isCore}`];

    if (status === Status.NotReady) {
      compIcon = NotReadyComponent;
    }

    return compIcon;
  };

  const renderIcon = (status: Status, isCore: boolean): React.ReactNode => {
    let compIcon = getIcon(status, isCore);
    const iconColor = compIcon.color || PFColors.Success;

    compIcon.className = kialiStyle({
      marginTop: '0.25rem',
      color: `${iconColor} !important`,
      $nest: {
        '& svg': {
          color: `${iconColor} !important`,
          fill: `${iconColor} !important`
        }
      }
    });

    return createIcon(compIcon);
  };

  const renderCells = (): React.ReactNode => {
    const comp = props.componentStatus;
    const iconColor = getIcon(comp.status, comp.isCore).color || PFColors.Success;

    return [
      <Split key={`cell-status-icon-${comp.name}`} hasGutter={true} className={splitItemStyle}>
        <SplitItem isFilled={true}>{comp.name}</SplitItem>
        <Label
          className={labelStyle}
          data-test="component-status-icon"
          variant={'outline'}
          style={
            {
              '--pf-v6-c-label--m-outline--BorderColor': iconColor,
              borderColor: iconColor,
              borderWidth: '1px',
              borderStyle: 'solid'
            } as React.CSSProperties
          }
          icon={renderIcon(props.componentStatus.status, props.componentStatus.isCore)}
        >
          {t(statusMsg[comp.status])}
        </Label>
      </Split>
    ];
  };

  return <>{renderCells()}</>;
};
