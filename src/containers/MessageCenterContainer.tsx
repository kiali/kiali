import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { MessageCenterActions } from '../actions/MessageCenterActions';
import { MessageCenter, MessageCenterTrigger } from '../components/MessageCenter';
import { MessageType, NotificationGroup, NotificationMessage } from '../types/MessageCenter';
import { KialiAppState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import MessageCenterThunkActions from '../actions/MessageCenterThunkActions';

const mapStateToPropsMessageCenter = (state: KialiAppState) => {
  return {
    groups: state.messageCenter.groups,
    drawerIsHidden: state.messageCenter.hidden,
    drawerIsExpanded: state.messageCenter.expanded,
    drawerExpandedGroupId: state.messageCenter.expandedGroupId
  };
};

const mapDispatchToPropsMessageCenter = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    onExpandDrawer: () => dispatch(MessageCenterActions.toggleExpandedMessageCenter()),
    onHideDrawer: () => dispatch(MessageCenterActions.hideMessageCenter()),
    onToggleGroup: group => dispatch(MessageCenterActions.toggleGroup(group.id)),
    onMarkGroupAsRead: group => dispatch(MessageCenterThunkActions.markGroupAsRead(group.id)),
    onClearGroup: group => dispatch(MessageCenterThunkActions.clearGroup(group.id)),
    onNotificationClick: message => dispatch(MessageCenterActions.markAsRead(message.id)),
    onDismissNotification: (message, group, userDismissed) => {
      if (userDismissed) {
        dispatch(MessageCenterActions.markAsRead(message.id));
      } else {
        dispatch(MessageCenterActions.hideNotification(message.id));
      }
    }
  };
};

const mapStateToPropsMessageCenterTrigger = (state: KialiAppState) => {
  type MessageCenterTriggerPropsToMap = {
    newMessagesCount: number;
    badgeDanger: boolean;
    systemErrorsCount: number;
  };

  const dangerousMessageTypes = [MessageType.ERROR, MessageType.WARNING];
  let systemErrorsCount = 0;

  const systemErrorsGroup = state.messageCenter.groups.find(item => item.id === 'systemErrors');
  if (systemErrorsGroup) {
    systemErrorsCount = systemErrorsGroup.messages.length;
  }

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
      (propsToMap: MessageCenterTriggerPropsToMap, message: NotificationMessage) => {
        propsToMap.newMessagesCount++;
        propsToMap.badgeDanger = propsToMap.badgeDanger || dangerousMessageTypes.includes(message.type);
        return propsToMap;
      },
      { newMessagesCount: 0, systemErrorsCount: systemErrorsCount, badgeDanger: false }
    );
};

const mapDispatchToPropsMessageCenterTrigger = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    toggleMessageCenter: () => dispatch(MessageCenterThunkActions.toggleMessageCenter()),
    toggleSystemErrorsCenter: () => dispatch(MessageCenterThunkActions.toggleSystemErrorsCenter())
  };
};

export const MessageCenterContainer = connect(
  mapStateToPropsMessageCenter,
  mapDispatchToPropsMessageCenter
)(MessageCenter);

export const MessageCenterTriggerContainer = connect(
  mapStateToPropsMessageCenterTrigger,
  mapDispatchToPropsMessageCenterTrigger
)(MessageCenterTrigger);
