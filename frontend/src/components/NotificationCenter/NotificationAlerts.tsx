import * as React from 'react';
import { NotificationMessage, MessageType } from '../../types/NotificationCenter';
import { Alert, AlertActionCloseButton, AlertGroup, AlertVariant } from '@patternfly/react-core';

type NotificationAlertsProps = {
  alerts: NotificationMessage[];
  onDismiss: (alert: NotificationMessage, userDismissed: boolean) => void;
};

export const NotificationAlerts: React.FC<NotificationAlertsProps> = (props: NotificationAlertsProps) => {
  return (
    <AlertGroup isToast isLiveRegion>
      {props.alerts.map(alert => {
        let variant: AlertVariant;

        switch (alert.type) {
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
            key={`toast_${alert.id}`}
            variant={variant}
            title={alert.content}
            timeout={6000}
            actionClose={<AlertActionCloseButton onClose={() => props.onDismiss(alert, true)} />}
          />
        );
      })}
    </AlertGroup>
  );
};
