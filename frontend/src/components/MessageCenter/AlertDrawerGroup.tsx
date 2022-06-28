import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from 'store/Store';
import { Card, Button, CardBody, CardFooter, ButtonVariant } from '@patternfly/react-core';
import { InfoIcon } from '@patternfly/react-icons';
import { style } from 'typestyle';
import { NotificationGroup } from '../../types/MessageCenter';
import MessageCenterThunkActions from 'actions/MessageCenterThunkActions';
import { KialiAppAction } from 'actions/KialiAppAction';
import AlertDrawerMessageContainer from './AlertDrawerMessage';

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

class AlertDrawerGroup extends React.PureComponent<AlertDrawerGroupProps> {
  static readonly body = style({
    padding: 0 // note: I don't know why but paddingTop with the additional explicit style prop used below
  });
  static readonly footer = style({
    paddingBottom: 5,
    paddingTop: 5
  });
  static readonly left = style({
    float: 'left'
  });
  static readonly right = style({
    float: 'right'
  });

  render() {
    const group: NotificationGroup = this.props.group;

    return (
      <Card>
        <CardBody className={AlertDrawerGroup.body} style={{ paddingTop: 0 }}>
          {group.messages.length === 0 && noNotificationsMessage}
          {this.getMessages().map(message => (
            <AlertDrawerMessageContainer key={message.id} message={message} />
          ))}
        </CardBody>
        {group.showActions && group.messages.length > 0 && (
          <CardFooter className={AlertDrawerGroup.footer}>
            <Button
              className={AlertDrawerGroup.left}
              variant={ButtonVariant.link}
              onClick={() => this.props.markGroupAsRead(group)}
            >
              Mark All Read
            </Button>
            <Button
              className={AlertDrawerGroup.right}
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

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    clearGroup: group => dispatch(MessageCenterThunkActions.clearGroup(group.id)),
    markGroupAsRead: group => dispatch(MessageCenterThunkActions.markGroupAsRead(group.id))
  };
};

const AlertDrawerGroupContainer = connect(null, mapDispatchToProps)(AlertDrawerGroup);
export default AlertDrawerGroupContainer;
