import * as React from 'react';
import { NotificationMessage, MessageType } from '../../types/MessageCenter';
import { AlertVariant } from '@patternfly/react-core';
import AlertToast from './AlertToast';

type NotificationListProps = {
  messages: NotificationMessage[];
  onDismiss: (message: NotificationMessage, userDismissed: boolean) => void;
};

export default class NotificationList extends React.PureComponent<NotificationListProps> {
  render() {
    return (
      <>
        {this.props.messages.map((message, i) => {
          let variant: AlertVariant;
          switch (message.type) {
            case MessageType.SUCCESS:
              variant = AlertVariant.success;
              break;
            case MessageType.WARNING:
              variant = AlertVariant.warning;
              break;
            default:
              variant = AlertVariant.danger;
          }
          const onClose = () => {
            this.props.onDismiss(message, true);
          };
          return (
            <AlertToast
              style={{ width: '30em', right: '0', top: `${i * 5}em`, position: 'absolute' }}
              message={message}
              variant={variant}
              title={message.content}
              onClose={onClose}
              onTtl={onClose}
            />
          );
        })}
      </>
    );
  }
}
