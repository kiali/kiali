import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import fullIcon from '../../assets/img/mtls-status-full.svg';
import hollowIcon from '../../assets/img/mtls-status-partial.svg';
import fullIconDark from '../../assets/img/mtls-status-full-dark.svg';
import hollowIconDark from '../../assets/img/mtls-status-partial-dark.svg';

export { fullIcon, hollowIcon, fullIconDark, hollowIconDark };

type Props = {
  icon: string;
  iconClassName: string;
  tooltipText: string;
  tooltipPosition: TooltipPosition;
};

export enum MTLSIconTypes {
  LOCK_FULL = 'LOCK_FULL',
  LOCK_HOLLOW = 'LOCK_HOLLOW',
  LOCK_FULL_DARK = 'LOCK_FULL_DARK',
  LOCK_HOLLOW_DARK = 'LOCK_HOLLOW_DARK'
}

const nameToSource = new Map<string, string>([
  [MTLSIconTypes.LOCK_FULL, fullIcon],
  [MTLSIconTypes.LOCK_FULL_DARK, fullIconDark],
  [MTLSIconTypes.LOCK_HOLLOW, hollowIcon],
  [MTLSIconTypes.LOCK_HOLLOW_DARK, hollowIconDark]
]);

class MTLSIcon extends React.Component<Props> {
  render() {
    return (
      <Tooltip
        aria-label={'mTLS status'}
        position={this.props.tooltipPosition}
        enableFlip={true}
        content={this.props.tooltipText}
      >
        <img
          className={this.props.iconClassName}
          src={nameToSource.get(this.props.icon)}
          alt={this.props.tooltipPosition}
        />
      </Tooltip>
    );
  }
}
export default MTLSIcon;
