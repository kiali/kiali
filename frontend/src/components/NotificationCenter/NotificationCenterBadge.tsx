import { NotificationBadge, NotificationBadgeVariant } from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';
import { connect } from 'react-redux';
import type { KialiAppState } from 'store/Store';
import { MessageType, type NotificationGroup, type NotificationMessage } from 'types/NotificationCenter';
import type { KialiDispatch } from 'types/Redux';
import {
  partitionTroubleshootingIssues,
  summarizeTroubleshootingIssues
} from 'pages/AIDashboard/AITroubleshooting/partitionTroubleshooting';
import { NotificationAlerts } from './NotificationAlerts';
import { ChatAIActions } from 'actions/ChatAIActions';
import { NotificationCenterActions } from 'actions/NotificationCenterActions';

type ReduxStateProps = {
  alerts: NotificationMessage[];
  chatbotVisible?: boolean;
  isExpanded?: boolean;
  needsAttention: boolean;
  newMessageCount: number;
  troubleshootingCount?: number;
  troubleshootingNeedsAttention?: boolean;
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
  const count = props.newMessageCount + (props.troubleshootingCount ?? 0);
  const needsAttention = props.needsAttention || !!props.troubleshootingNeedsAttention;

  let variant = NotificationBadgeVariant.read;
  if (count > 0) {
    if (needsAttention) {
      variant = NotificationBadgeVariant.attention;
    } else {
      variant = NotificationBadgeVariant.unread;
    }
  }

  return (
    <>
      <NotificationBadge
        aria-label={t('Notifications')}
        count={count}
        data-test="notifications-badge"
        isExpanded={props.isExpanded}
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

  const issues = state.ai?.enabled && state.ai.troubleshooting?.loaded ? (state.ai.troubleshooting.issues ?? []) : [];
  const visibleIssues = partitionTroubleshootingIssues(
    issues,
    state.ai?.troubleshooting?.hiddenSubProblemIds ?? []
  ).visible;
  const summary = summarizeTroubleshootingIssues(visibleIssues);

  return {
    ...notifications,
    chatbotVisible: !!state.ai?.chat?.visible,
    isExpanded: state.notificationCenter.expanded,
    troubleshootingCount: summary.problems,
    troubleshootingNeedsAttention: summary.critical > 0
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
