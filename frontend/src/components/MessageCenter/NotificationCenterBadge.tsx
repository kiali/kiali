import { NotificationBadge, NotificationBadgeVariant } from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';
import { connect } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { MessageType, NotificationGroup, NotificationMessage } from 'types/MessageCenter';
import { MessageCenterThunkActions } from 'actions/MessageCenterThunkActions';
import { KialiDispatch } from 'types/Redux';
import { NotificationList } from './NotificationList';
import { MessageCenterActions } from 'actions/MessageCenterActions';

type ReduxStateProps = {
  alerts: NotificationMessage[];
  needsAttention: boolean;
  newMessageCount: number;
};

type ReduxDispatchProps = {
  onDismissNotification: (NotificationMessage, boolean) => void;
  toggleMessageCenter: () => void;
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
          props.toggleMessageCenter();
        }}
        variant={variant}
      />
      <NotificationList messages={props.alerts} onDismiss={props.onDismissNotification} />
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

  return state.messageCenter.groups
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
        if (message.show_notification) {
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
        dispatch(MessageCenterActions.markAsRead(message.id));
      } else {
        dispatch(MessageCenterActions.hideNotification(message.id));
      }
    },
    toggleMessageCenter: () => dispatch(MessageCenterThunkActions.toggleMessageCenter())
  };
};

export const NotificationCenterBadge = connect(mapStateToProps, mapDispatchToProps)(NotificationCenterBadgeComponent);
