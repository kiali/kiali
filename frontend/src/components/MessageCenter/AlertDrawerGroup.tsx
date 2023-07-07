import * as React from 'react';
import { connect } from 'react-redux';
import { KialiDispatch } from 'types/Redux';
import { Card, Button, CardBody, CardFooter, ButtonVariant } from '@patternfly/react-core';
import { InfoIcon } from '@patternfly/react-icons';
import { kialiStyle } from 'styles/StyleUtils';
import { NotificationGroup } from '../../types/MessageCenter';
import { MessageCenterThunkActions } from 'actions/MessageCenterThunkActions';
import { AlertDrawerMessage } from './AlertDrawerMessage';

type ReduxProps = {
  clearGroup: (group) => void;
  markGroupAsRead: (group) => void;
};

type AlertDrawerGroupProps = ReduxProps & {
  group: NotificationGroup;
  reverseMessageOrder?: boolean;
};

const noNotificationsMessage = (
  <>
    <InfoIcon />
    No Messages Available
  </>
);

class AlertDrawerGroupComponent extends React.PureComponent<AlertDrawerGroupProps> {
  static readonly body = kialiStyle({
    padding: 0 // note: I don't know why but paddingTop with the additional explicit style prop used below
  });
  static readonly footer = kialiStyle({
    paddingBottom: 5,
    paddingTop: 5
  });
  static readonly left = kialiStyle({
    float: 'left'
  });
  static readonly right = kialiStyle({
    float: 'right'
  });

  render() {
    const group: NotificationGroup = this.props.group;

    return (
      <Card>
        <CardBody className={AlertDrawerGroupComponent.body} style={{ paddingTop: 0 }}>
          {group.messages.length === 0 && noNotificationsMessage}
          {this.getMessages().map(message => (
            <AlertDrawerMessage key={message.id} message={message} />
          ))}
        </CardBody>
        {group.showActions && group.messages.length > 0 && (
          <CardFooter className={AlertDrawerGroupComponent.footer}>
            <Button
              className={AlertDrawerGroupComponent.left}
              variant={ButtonVariant.link}
              onClick={() => this.props.markGroupAsRead(group)}
            >
              Mark All Read
            </Button>
            <Button
              className={AlertDrawerGroupComponent.right}
              variant={ButtonVariant.link}
              onClick={() => this.props.clearGroup(group)}
            >
              Clear All
            </Button>
          </CardFooter>
        )}
      </Card>
    );
  }

  private getMessages = () => {
    return this.props.reverseMessageOrder ? [...this.props.group.messages].reverse() : this.props.group.messages;
  };
}

const mapDispatchToProps = (dispatch: KialiDispatch) => {
  return {
    clearGroup: group => dispatch(MessageCenterThunkActions.clearGroup(group.id)),
    markGroupAsRead: group => dispatch(MessageCenterThunkActions.markGroupAsRead(group.id))
  };
};

export const AlertDrawerGroup = connect(null, mapDispatchToProps)(AlertDrawerGroupComponent);
