import { Button, ButtonState, ButtonVariant } from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';
import { connect } from 'react-redux';
import type { KialiAppState } from 'store/Store';
import { MessageType, type NotificationGroup, type NotificationMessage } from 'types/NotificationCenter';
import type { KialiDispatch } from 'types/Redux';
import { NotificationAlerts } from './NotificationAlerts';
import { ChatAIActions } from 'actions/ChatAIActions';
import { NotificationCenterActions } from 'actions/NotificationCenterActions';
import { RhUiAttentionBellFillIcon, RhUiNotificationFillIcon } from '@patternfly/react-icons';

type ReduxStateProps = {
  alerts: NotificationMessage[];
  chatbotVisible?: boolean;
  isExpanded?: boolean;
  needsAttention: boolean;
  newMessageCount: number;
};

type ReduxDispatchProps = {
  hideChat?: () => void;
  onDismissNotification: (NotificationMessage, boolean) => void;
  toggleNotificationCenter: () => void;
};

type NotificationCenterBadgeProps = ReduxStateProps & ReduxDispatchProps;

export const NotificationCenterBadgeComponent: React.FunctionComponent<NotificationCenterBadgeProps> = (
  props: NotificationCenterBadgeProps
) => {
  const { t } = useKialiTranslation();
  const count = props.newMessageCount;
  const needsAttention = props.needsAttention;

  let buttonState = ButtonState.read;
  if (count > 0) {
    if (needsAttention) {
      buttonState = ButtonState.attention;
    } else {
      buttonState = ButtonState.unread;
    }
  }

  return (
    <>
      <Button
        aria-expanded={props.isExpanded}
        aria-label={t('Notifications')}
        data-test="notifications-badge"
        isClicked={props.isExpanded}
        state={buttonState}
        variant={ButtonVariant.stateful}
        onClick={() => {
          if (props.chatbotVisible) {
            props.hideChat?.();
            if (!props.isExpanded) {
              props.toggleNotificationCenter();
            }
            return;
          }
          props.toggleNotificationCenter();
        }}
      >
        {count > 0 && needsAttention ? (
          <>
            <RhUiAttentionBellFillIcon /> {count}{' '}
          </>
        ) : (
          <>
            <RhUiNotificationFillIcon /> {count > 0 ? count : ''}{' '}
          </>
        )}
      </Button>
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

  const notifications = state.notificationCenter.groups
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

  return {
    ...notifications,
    chatbotVisible: !!state.ai?.chat?.visible,
    isExpanded: state.notificationCenter.expanded
  };
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
    hideChat: () => dispatch(ChatAIActions.setChatVisible(false)),
    toggleNotificationCenter: () => dispatch(NotificationCenterActions.toggleNotificationCenter())
  };
};

export const NotificationCenterBadge = connect(mapStateToProps, mapDispatchToProps)(NotificationCenterBadgeComponent);
