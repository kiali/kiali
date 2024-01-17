import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import fullIcon from '../../assets/img/mtls-status-full.svg';
import hollowIcon from '../../assets/img/mtls-status-partial.svg';
import fullIconDark from '../../assets/img/mtls-status-full-dark.svg';
import hollowIconDark from '../../assets/img/mtls-status-partial-dark.svg';

export { fullIcon, hollowIcon, fullIconDark, hollowIconDark };

type MTLSIconProps = {
  icon: string;
  iconClassName: string;
  tooltipPosition: TooltipPosition;
  tooltipText: string;
};

export enum MTLSIconTypes {
  LOCK_FULL = 'LOCK_FULL',
  LOCK_FULL_DARK = 'LOCK_FULL_DARK',
  LOCK_HOLLOW = 'LOCK_HOLLOW',
  LOCK_HOLLOW_DARK = 'LOCK_HOLLOW_DARK'
}

const nameToSource = new Map<string, string>([
  [MTLSIconTypes.LOCK_FULL, fullIcon],
  [MTLSIconTypes.LOCK_FULL_DARK, fullIconDark],
  [MTLSIconTypes.LOCK_HOLLOW, hollowIcon],
  [MTLSIconTypes.LOCK_HOLLOW_DARK, hollowIconDark]
]);

export const MTLSIcon: React.FC<MTLSIconProps> = (props: MTLSIconProps) => {
  return (
    <Tooltip aria-label="mTLS status" position={props.tooltipPosition} enableFlip={true} content={props.tooltipText}>
      <img className={props.iconClassName} src={nameToSource.get(props.icon)} alt={props.tooltipPosition} />
    </Tooltip>
  );
};
