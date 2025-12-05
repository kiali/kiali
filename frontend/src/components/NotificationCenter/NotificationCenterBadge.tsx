import { NotificationBadge, NotificationBadgeVariant } from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';
import { connect } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { MessageType, NotificationGroup, NotificationMessage } from 'types/NotificationCenter';
import { KialiDispatch } from 'types/Redux';
import { NotificationAlerts } from './NotificationAlerts';
import { NotificationCenterActions } from 'actions/NotificationCenterActions';

type ReduxStateProps = {
  alerts: NotificationMessage[];
  needsAttention: boolean;
  newMessageCount: number;
};

type ReduxDispatchProps = {
  onDismissNotification: (NotificationMessage, boolean) => void;
  toggleNotificationCenter: () => void;
};

type NotificationCenterBadgeProps = ReduxStateProps & ReduxDispatchProps;

export const NotificationCenterBadgeComponent: React.FunctionComponent<NotificationCenterBadgeProps> = (
  props: NotificationCenterBadgeProps
) => {
  const { t } = useKialiTranslation();

  let variant = NotificationBadgeVariant.read;
  if (props.newMessageCount > 0) {
    if (props.needsAttention) {
      variant = NotificationBadgeVariant.attention;
    } else {
      variant = NotificationBadgeVariant.unread;
    }
  }

  return (
    <>
      <NotificationBadge
        aria-label={t('Notifications')}
        count={props.newMessageCount}
        isExpanded={this}
        onClick={() => {
          props.toggleNotificationCenter();
        }}
        variant={variant}
      />
      <NotificationAlerts alerts={props.alerts} onDismiss={props.onDismissNotification} />
    </>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => {
  type propsToMap = {
    alerts: NotificationMessage[];
    needsAttention: boolean;
    newMessageCount: number;
  };

  const attentionTypes = [MessageType.DANGER, MessageType.WARNING];

  return state.notificationCenter.groups
    .reduce((unreadMessages: NotificationMessage[], group: NotificationGroup) => {
      return unreadMessages.concat(
        group.messages.reduce((unreadMessagesInGroup: NotificationMessage[], message: NotificationMessage) => {
          if (!message.seen) {
            unreadMessagesInGroup.push(message);
          }
          return unreadMessagesInGroup;
        }, [])
      );
    }, [])
    .reduce(
      (propsToMap: propsToMap, message: NotificationMessage) => {
        if (message.isAlert) {
          propsToMap.alerts.push(message);
        }
        propsToMap.newMessageCount++;
        propsToMap.needsAttention = propsToMap.needsAttention || attentionTypes.includes(message.type);
        return propsToMap;
      },
      { alerts: [], needsAttention: false, newMessageCount: 0 }
    );
};

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    onDismissNotification: (message, userDismissed) => {
      if (userDismissed) {
        dispatch(NotificationCenterActions.markAsRead(message.id));
      } else {
        dispatch(NotificationCenterActions.hideNotification(message.id));
      }
    },
    toggleNotificationCenter: () => dispatch(NotificationCenterActions.toggleNotificationCenter())
  };
};

export const NotificationCenterBadge = connect(mapStateToProps, mapDispatchToProps)(NotificationCenterBadgeComponent);
