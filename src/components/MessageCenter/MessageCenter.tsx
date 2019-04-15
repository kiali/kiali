import * as React from 'react';

import NotificationDrawer from './NotificationDrawer';
import NotificationList from './NotificationList';
import { style } from 'typestyle';
import { NotificationMessage, NotificationGroup, MessageCenterPropsType } from '../../types/MessageCenter';

const notificationStyle = style({
  zIndex: 100
});

type StateType = {};

export default class MessageCenter extends React.Component<MessageCenterPropsType, StateType> {
  // Get messages that are meant to be show as notifications (Toast), appending
  // the groupId to allow to recognize the group they belong. (see onDismissNotification)
  getNotificationMessages = (groups: NotificationGroup[]) => {
    return groups.reduce((messages: NotificationMessage[], group) => {
      return messages.concat(
        group.messages
          .filter((message: NotificationMessage) => message.show_notification)
          .map((message: NotificationMessage) => ({ ...message, groupId: group.id }))
      );
    }, []);
  };

  onDismissNotification = (message: NotificationMessage, userDismissed: boolean) => {
    this.props.onDismissNotification(
      message,
      this.props.groups.find(group => group.id === message.groupId)!,
      userDismissed
    );
  };

  render() {
    return (
      <div className={notificationStyle}>
        <NotificationDrawer
          title={this.props.drawerTitle}
          isHidden={this.props.drawerIsHidden}
          isExpanded={this.props.drawerIsExpanded}
          expandedGroupId={this.props.drawerExpandedGroupId}
          groups={this.props.groups}
          reverseMessageOrder={this.props.drawerReverseMessageOrder}
          onExpandDrawer={this.props.onExpandDrawer}
          onHideDrawer={this.props.onHideDrawer}
          onToggleGroup={this.props.onToggleGroup}
          onMarkGroupAsRead={this.props.onMarkGroupAsRead}
          onClearGroup={this.props.onClearGroup}
          onNotificationClick={this.props.onNotificationClick}
        />
        <NotificationList
          messages={this.getNotificationMessages(this.props.groups)}
          onDismiss={this.onDismissNotification}
        />
      </div>
    );
  }
}
