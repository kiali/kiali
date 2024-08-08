import * as React from 'react';
import { NotificationMessage, MessageType } from '../../types/MessageCenter';
import { Alert, AlertActionCloseButton, AlertGroup, AlertVariant } from '@patternfly/react-core';

type NotificationListProps = {
  messages: NotificationMessage[];
  onDismiss: (message: NotificationMessage, userDismissed: boolean) => void;
};

export const NotificationList: React.FC<NotificationListProps> = (props: NotificationListProps) => {
  return (
    <AlertGroup isToast isLiveRegion>
      {props.messages.map(message => {
        let variant: AlertVariant;

        switch (message.type) {
          case MessageType.SUCCESS:
            variant = AlertVariant.success;
            break;
          case MessageType.WARNING:
            variant = AlertVariant.warning;
            break;
          case MessageType.INFO:
            variant = AlertVariant.info;
            break;
          default:
            variant = AlertVariant.danger;
        }

        return (
          <Alert
            key={`toast_${message.id}`}
            variant={variant}
            title={message.content}
            timeout={true}
            actionClose={<AlertActionCloseButton onClose={() => props.onDismiss(message, true)} />}
          />
        );
      })}
    </AlertGroup>
  );
};
