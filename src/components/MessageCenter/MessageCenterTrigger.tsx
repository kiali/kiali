import * as React from 'react';
import { Badge, Button, ButtonVariant } from '@patternfly/react-core';
import { BellIcon, WarningTriangleIcon } from '@patternfly/react-icons';

type PropsType = {
  newMessagesCount: number;
  systemErrorsCount: number;
  badgeDanger: boolean;
  toggleMessageCenter: () => void;
  toggleSystemErrorsCenter: () => void;
};

export default class MessageCenterTrigger extends React.PureComponent<PropsType, {}> {
  render() {
    return (
      <>
        {this.renderSystemErrorBadge()}
        {this.renderMessageCenterBadge()}
      </>
    );
  }

  private renderSystemErrorBadge = () => {
    if (this.props.systemErrorsCount === 0) {
      return null;
    }

    return (
      <Button
        id={'icon_warning'}
        aria-label={'SystemError'}
        onClick={this.props.toggleSystemErrorsCenter}
        variant={ButtonVariant.plain}
      >
        <WarningTriangleIcon />
        {this.props.systemErrorsCount}
        {this.props.systemErrorsCount === 1 ? ' Open Issue' : ' Open Issues'}
      </Button>
    );
  };

  private renderMessageCenterBadge = () => {
    return (
      <Button
        id={'bell_icon_warning'}
        aria-label={'Notifications'}
        onClick={this.props.toggleMessageCenter}
        variant={ButtonVariant.plain}
      >
        <BellIcon />
        {this.props.newMessagesCount > 0 && (
          <Badge className={'pf-badge-bodered' + (this.props.badgeDanger ? ' badge-danger' : '')}>
            {this.props.newMessagesCount > 0 ? this.props.newMessagesCount : ' '}
          </Badge>
        )}
      </Button>
    );
  };
}
