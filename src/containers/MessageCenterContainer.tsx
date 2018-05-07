import { connect } from 'react-redux';

import { MessageCenterActions } from '../actions/MessageCenterActions';
import { MessageCenter, MessageCenterTrigger } from '../components/MessageCenter';

const mapStateToPropsMC = state => {
  return {
    groups: state.messageCenter.groups,
    drawerIsHidden: state.messageCenter.hidden,
    drawerIsExpanded: state.messageCenter.expanded,
    drawerExpandedGroupId: state.messageCenter.expandedGroupId
  };
};

const mapDispatchToPropsMC = dispatch => {
  return {
    onExpandDrawer: () => dispatch(MessageCenterActions.togleExpandedMessageCenter()),
    onHideDrawer: () => dispatch(MessageCenterActions.hideMessageCenter()),
    onToggleGroup: group => dispatch(MessageCenterActions.toggleGroup(group.id)),
    onMarkGroupAsRead: group => dispatch(MessageCenterActions.markGroupAsRead(group.id)),
    onClearGroup: group => dispatch(MessageCenterActions.clearGroup(group.id)),
    onNotificationClick: message => dispatch(MessageCenterActions.markAsRead(message.id)),
    onDismissNotification: () => console.log('dismiss')
  };
};

const mapStateToPropsMCT = state => {
  return {
    newMessagesCount: state.messageCenter.groups.reduce((newMessages: number, group) => {
      return (
        newMessages +
        group.messages.reduce((newMessagesInGroup: number, message) => {
          return newMessagesInGroup + (message.seen ? 0 : 1);
        }, 0)
      );
    }, 0)
  };
};

const mapDispatchToPropsMCT = dispatch => {
  return {
    toggleMessageCenter: () => dispatch(MessageCenterActions.toggleMessageCenter())
  };
};

const MessageCenterContainer = connect(mapStateToPropsMC, mapDispatchToPropsMC)(MessageCenter);
MessageCenterContainer.Trigger = connect(mapStateToPropsMCT, mapDispatchToPropsMCT)(MessageCenterTrigger);

export default MessageCenterContainer;
