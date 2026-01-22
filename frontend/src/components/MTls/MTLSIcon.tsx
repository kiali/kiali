import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { useKialiTheme } from 'utils/ThemeUtils';
import { Theme } from 'types/Common';
import { MTLSIconTypes } from './MTLSIconTypes';
import { ReactComponent as FullLockIcon } from '../../assets/img/mtls/mtls-status-full.svg';
import { ReactComponent as HollowLockIcon } from '../../assets/img/mtls/mtls-status-partial.svg';
import { LockOpenIcon } from '@patternfly/react-icons';

type MTLSIconProps = {
  color?: string;
  icon: string;
  iconClassName: string;
  tooltipPosition: TooltipPosition;
  tooltipText: string;
};

export const MTLSIcon: React.FC<MTLSIconProps> = (props: MTLSIconProps) => {
  const darkTheme = useKialiTheme() === Theme.DARK;

  const defaultColor = darkTheme ? '#d1d1d1' : '#72767b';
  const iconColor = props.color ?? defaultColor;

  const IconComponent =
    props.icon === MTLSIconTypes.LOCK_FULL
      ? FullLockIcon
      : props.icon === MTLSIconTypes.LOCK_HOLLOW
      ? HollowLockIcon
      : props.icon === MTLSIconTypes.LOCK_OPEN
      ? LockOpenIcon
      : undefined;

  return (
    <Tooltip aria-label="mTLS status" position={props.tooltipPosition} enableFlip={true} content={props.tooltipText}>
      {IconComponent ? <IconComponent className={props.iconClassName} style={{ color: iconColor }} /> : <></>}
    </Tooltip>
  );
};
