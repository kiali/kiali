import * as React from 'react';
import { connect } from 'react-redux';
import NotificationList from './NotificationList';
import { style } from 'typestyle';
import { NotificationMessage, NotificationGroup } from '../../types/MessageCenter';
import AlertDrawerContainer from './AlertDrawer';
import { KialiAppState } from 'store/Store';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from 'actions/KialiAppAction';
import { MessageCenterActions } from 'actions/MessageCenterActions';

const notificationStyle = style({
  position: 'relative',
  zIndex: 100
});

type ReduxProps = {
  groups: NotificationGroup[];

  onDismissNotification: (message: NotificationMessage, userDismissed: boolean) => void;
};

type MessageCenterProps = ReduxProps & {
  drawerTitle: string;
};

export class MessageCenter extends React.Component<MessageCenterProps> {
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

  render() {
    return (
      <div className={notificationStyle}>
        <AlertDrawerContainer title={this.props.drawerTitle} />
        <NotificationList
          messages={this.getNotificationMessages(this.props.groups)}
          onDismiss={this.props.onDismissNotification}
        />
      </div>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    groups: state.messageCenter.groups
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    onDismissNotification: (message, userDismissed) => {
      if (userDismissed) {
        dispatch(MessageCenterActions.markAsRead(message.id));
      } else {
        dispatch(MessageCenterActions.hideNotification(message.id));
      }
    }
  };
};

const MessageCenterContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(MessageCenter);
export default MessageCenterContainer;
