import { MessageType, NotificationMessage } from '../types/NotificationCenter';
import { NotificationCenterState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { NotificationCenterActions } from '../actions/NotificationCenterActions';
import { updateState } from '../utils/Reducer';
import { LoginActions } from '../actions/LoginActions';
import _ from 'lodash';

export const INITIAL_NOTIFICATION_CENTER_STATE: NotificationCenterState = {
  // predefined groups are specifically ordered by status
  groups: [
    {
      id: MessageType.DANGER,
      title: 'Error',
      messages: [],
      variant: 'danger'
    },
    {
      id: MessageType.WARNING,
      title: 'Warning',
      messages: [],
      variant: 'warning'
    },
    {
      id: MessageType.SUCCESS,
      title: 'Success',
      messages: [],
      variant: 'success'
    },
    {
      id: MessageType.INFO,
      title: 'Info',
      messages: [],
      variant: 'info'
    }
  ],
  expanded: false,
  nextId: 0
};

const createMessage = (
  id: number,
  content: string,
  detail: string,
  type: MessageType,
  count: number,
  isAlert: boolean,
  created: Date,
  showDetail: boolean,
  firstTriggered?: Date
): NotificationMessage => {
  return {
    id,
    content,
    detail,
    type,
    count,
    isAlert: isAlert,
    seen: false,
    created: created,
    showDetail: showDetail,
    firstTriggered
  };
};

// Updates several messages with the same payload, useful for marking messages
// returns the updated state
const updateMessage = (state: NotificationCenterState, messageIds: number[], updater) => {
  const groups = state.groups.map(group => {
    group = {
      ...group,
      messages: group.messages.map(message => {
        if (messageIds.includes(message.id)) {
          message = updater(message);
        }
        return message;
      })
    };
    return group;
  });
  return updateState(state, { groups });
};

export const NotificationCenterReducer = (
  state: NotificationCenterState = INITIAL_NOTIFICATION_CENTER_STATE,
  action: KialiAppAction
): NotificationCenterState => {
  switch (action.type) {
    case getType(NotificationCenterActions.addMessage): {
      const { content, detail, groupId, messageType, isAlert } = action.payload;

      const groups = state.groups.map(group => {
        if (group.id === groupId) {
          const existingMessage = group.messages.find(message => {
            // Note, we don't include detail when determining same-ness, just the main content.  This is to avoid
            // trivial detail differences (like a timestamp).  If changing this approach apply the same change below
            // for message removal.
            return message.content === content;
          });

          // remove the old message from the list
          const filteredArray = _.filter(group.messages, message => {
            return message.content !== content;
          });

          let newMessage: NotificationMessage;
          let count = 1;
          let firstTriggered: Date | undefined = undefined;

          if (existingMessage) {
            // it is in the list already
            firstTriggered = existingMessage.firstTriggered ? existingMessage.firstTriggered : existingMessage.created;

            count += existingMessage.count;
          }

          newMessage = createMessage(
            state.nextId,
            content,
            detail,
            messageType,
            count,
            isAlert,
            new Date(),
            false,
            firstTriggered
          );

          group = { ...group, messages: filteredArray.concat(newMessage) };

          return group;
        }
        return group;
      });
      return updateState(state, { groups: groups, nextId: state.nextId + 1 });
    }

    case getType(NotificationCenterActions.removeMessage): {
      const messageId = action.payload.messageId;
      const groups = state.groups.map(group => {
        group = {
          ...group,
          messages: group.messages.filter(message => {
            return !messageId.includes(message.id);
          })
        };
        return group;
      });
      return updateState(state, { groups });
    }

    case getType(NotificationCenterActions.toggleMessageDetail): {
      return updateMessage(state, action.payload.messageId, message => ({
        ...message,
        showDetail: !message.showDetail
      }));
    }

    case getType(NotificationCenterActions.markAsRead): {
      return updateMessage(state, action.payload.messageId, message => ({
        ...message,
        seen: true,
        isAlert: false
      }));
    }

    case getType(NotificationCenterActions.hideNotification): {
      return updateMessage(state, action.payload.messageId, message => ({ ...message, isAlert: false }));
    }

    case getType(NotificationCenterActions.toggleNotificationCenter):
      return updateState(state, { expanded: !state.expanded });

    case getType(LoginActions.loginRequest): {
      // Let's clear the message center when user is logging-in. This ensures
      // that past messages won't persist.
      return INITIAL_NOTIFICATION_CENTER_STATE;
    }
    default:
      return state;
  }
};
