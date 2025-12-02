import { NotificationBadge, NotificationBadgeVariant } from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';
import { connect } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { MessageType, NotificationGroup, NotificationMessage } from 'types/MessageCenter';
import { MessageCenterThunkActions } from 'actions/MessageCenterThunkActions';
import { KialiDispatch } from 'types/Redux';

type ReduxStateProps = {
  needsAttention: boolean;
  newMessageCount: number;
};

type ReduxDispatchProps = {
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
    </>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => {
  type propsToMap = {
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
        propsToMap.newMessageCount++;
        propsToMap.needsAttention = propsToMap.needsAttention || attentionTypes.includes(message.type);
        return propsToMap;
      },
      { needsAttention: false, newMessageCount: 0 }
    );
};

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    toggleMessageCenter: () => dispatch(MessageCenterThunkActions.toggleMessageCenter())
  };
};

export const NotificationCenterBadge = connect(mapStateToProps, mapDispatchToProps)(NotificationCenterBadgeComponent);
