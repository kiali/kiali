import { connect } from 'react-redux';

import { MessageCenterActions, MessageCenterThunkActions } from '../actions/MessageCenterActions';
import { MessageCenter, MessageCenterTrigger } from '../components/MessageCenter';
import { MessageType } from '../types/MessageCenter';

const mapStateToPropsMessageCenter = state => {
  return {
    groups: state.messageCenter.groups,
    drawerIsHidden: state.messageCenter.hidden,
    drawerIsExpanded: state.messageCenter.expanded,
    drawerExpandedGroupId: state.messageCenter.expandedGroupId
  };
};

const mapDispatchToPropsMessageCenter = dispatch => {
  return {
    onExpandDrawer: () => dispatch(MessageCenterActions.togleExpandedMessageCenter()),
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

const mapStateToPropsMessageCenterTrigger = state => {
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
    .reduce((unreadMessages: any[], group) => {
      return unreadMessages.concat(
        group.messages.reduce((unreadMessagesInGroup: any[], message) => {
          if (!message.seen) {
            unreadMessagesInGroup.push(message);
          }
          return unreadMessagesInGroup;
        }, [])
      );
    }, [])
    .reduce(
      (propsToMap: MessageCenterTriggerPropsToMap, message) => {
        propsToMap.newMessagesCount++;
        propsToMap.badgeDanger = propsToMap.badgeDanger || dangerousMessageTypes.includes(message.type);
        return propsToMap;
      },
      { newMessagesCount: 0, systemErrorsCount: systemErrorsCount, badgeDanger: false }
    );
};

const mapDispatchToPropsMessageCenterTrigger = dispatch => {
  return {
    toggleMessageCenter: () => dispatch(MessageCenterThunkActions.toggleMessageCenter()),
    toggleSystemErrorsCenter: () => dispatch(MessageCenterThunkActions.toggleSystemErrorsCenter())
  };
};

const MessageCenterContainer = connect(
  mapStateToPropsMessageCenter,
  mapDispatchToPropsMessageCenter
)(MessageCenter);
MessageCenterContainer.Trigger = connect(
  mapStateToPropsMessageCenterTrigger,
  mapDispatchToPropsMessageCenterTrigger
)(MessageCenterTrigger);

export default MessageCenterContainer;
