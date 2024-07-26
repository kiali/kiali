import * as React from 'react';
import { connect } from 'react-redux';
import { NotificationList } from './NotificationList';
import { kialiStyle } from 'styles/StyleUtils';
import { NotificationMessage, NotificationGroup } from '../../types/MessageCenter';
import { AlertDrawer } from './AlertDrawer';
import { KialiAppState } from 'store/Store';
import { KialiDispatch } from 'types/Redux';
import { MessageCenterActions } from 'actions/MessageCenterActions';

const notificationStyle = kialiStyle({
  position: 'relative',
  zIndex: 500
});

type ReduxStateProps = {
  groups: NotificationGroup[];
};

type ReduxDispatchProps = {
  onDismissNotification: (message: NotificationMessage, userDismissed: boolean) => void;
};

type MessageCenterProps = ReduxStateProps &
  ReduxDispatchProps & {
    drawerTitle: string;
  };

export const MessageCenterComponent: React.FC<MessageCenterProps> = (props: MessageCenterProps) => {
  // Get messages that are meant to be show as notifications (Toast), appending
  // the groupId to allow to recognize the group they belong. (see onDismissNotification)
  const getNotificationMessages = (groups: NotificationGroup[]): NotificationMessage[] => {
    return groups.reduce((messages: NotificationMessage[], group) => {
      return messages.concat(
        group.messages
          .filter((message: NotificationMessage) => message.show_notification)
          .map((message: NotificationMessage) => ({ ...message, groupId: group.id }))
      );
    }, []);
  };

  return (
    <div className={notificationStyle}>
      <AlertDrawer title={props.drawerTitle} />
      <NotificationList messages={getNotificationMessages(props.groups)} onDismiss={props.onDismissNotification} />
    </div>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => {
  return {
    groups: state.messageCenter.groups
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
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

export const MessageCenter = connect(mapStateToProps, mapDispatchToProps)(MessageCenterComponent);
