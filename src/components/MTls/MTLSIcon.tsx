import * as React from 'react';
import { OverlayTrigger, Tooltip } from 'patternfly-react';

type Props = {
  icon: string;
  iconClassName: string;
  overlayText: string;
  overlayPosition: string;
};

const fullIcon = require('../../assets/img/mtls-status-full.svg');
const hollowIcon = require('../../assets/img/mtls-status-partial.svg');
const fullIconDark = require('../../assets/img/mtls-status-full-dark.svg');
const hollowIconDark = require('../../assets/img/mtls-status-partial-dark.svg');

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
  infotipContent() {
    return <Tooltip id={'mtls-status-masthead'}>{this.props.overlayText}</Tooltip>;
  }

  render() {
    return (
      <OverlayTrigger
        placement={this.props.overlayPosition}
        overlay={this.infotipContent()}
        trigger={['hover', 'focus']}
        rootClose={false}
      >
        <img
          className={this.props.iconClassName}
          src={nameToSource.get(this.props.icon)}
          alt={this.props.overlayPosition}
        />
      </OverlayTrigger>
    );
  }
}
export default MTLSIcon;
