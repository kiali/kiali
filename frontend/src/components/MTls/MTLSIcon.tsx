import * as React from 'react';
import type { TooltipPosition } from '@patternfly/react-core';
import { Tooltip } from '@patternfly/react-core';
import { PFColors } from 'components/Pf/PfColors';
import { MTLSIconTypes } from './MTLSIconTypes';
import { ReactComponent as FullLockIcon } from '../../assets/img/mtls/mtls-status-full.svg';
import { ReactComponent as HollowLockIcon } from '../../assets/img/mtls/mtls-status-partial.svg';
import { ReactComponent as InheritArrowIcon } from '../../assets/img/mtls/mtls-inherit-arrow.svg';
import { LockOpenIcon } from '@patternfly/react-icons';

type MTLSIconProps = {
  backgroundColor?: string;
  color?: string;
  icon: string;
  iconClassName: string;
  tooltipPosition: TooltipPosition;
  tooltipText: string;
};

export const MTLSIcon: React.FC<MTLSIconProps> = (props: MTLSIconProps) => {
  // Use a semantic token so the icon tracks light/dark/glass/high-contrast automatically.
  const iconColor = props.color ?? PFColors.Color200;

  const circleBackgroundColor = props.backgroundColor;

  const IconComponent =
    props.icon === MTLSIconTypes.LOCK_FULL
      ? FullLockIcon
      : props.icon === MTLSIconTypes.LOCK_HOLLOW
        ? HollowLockIcon
        : props.icon === MTLSIconTypes.LOCK_OPEN
          ? LockOpenIcon
          : props.icon === MTLSIconTypes.ARROW_DOWN
            ? InheritArrowIcon
            : undefined;

  const useCircle = !!circleBackgroundColor;
  const circleStyle: React.CSSProperties = useCircle
    ? {
        backgroundColor: circleBackgroundColor,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        width: '1em',
        height: '1em'
      }
    : {};

  const innerIconStyle: React.CSSProperties = useCircle
    ? {
        color: iconColor,
        width: '0.9em',
        height: '0.9em',
        display: 'block'
      }
    : {};

  return (
    <Tooltip aria-label="mTLS status" position={props.tooltipPosition} enableFlip={true} content={props.tooltipText}>
      {IconComponent ? (
        useCircle ? (
          <span className={props.iconClassName} style={circleStyle}>
            <IconComponent style={innerIconStyle} />
          </span>
        ) : (
          <IconComponent className={props.iconClassName} style={{ color: iconColor }} />
        )
      ) : (
        <></>
      )}
    </Tooltip>
  );
};
