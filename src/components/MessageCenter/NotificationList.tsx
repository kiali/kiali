import * as React from 'react';

import { NotificationMessage } from '../../types/MessageCenter';

import { ToastNotificationList, TimedToastNotification } from 'patternfly-react';

const DEFAULT_TIMER_DELAY = 5000;

type PropsType = {
  messages: NotificationMessage[];
  onDismiss: (message: NotificationMessage, userDismissed: boolean) => void;
};
type StateType = {};

export default class NotificationList extends React.PureComponent<PropsType, StateType> {
  render() {
    return (
      <ToastNotificationList>
        {this.props.messages.map(message => (
          <TimedToastNotification
            key={message.id}
            persistent={false}
            paused={false}
            timerdelay={DEFAULT_TIMER_DELAY}
            onDismiss={event => this.props.onDismiss(message, event !== undefined)}
            type={message.type}
          >
            <span>{message.content}</span>
          </TimedToastNotification>
        ))}
      </ToastNotificationList>
    );
  }
}
