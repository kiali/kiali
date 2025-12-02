import { MessageType, NotificationMessage } from '../types/MessageCenter';
import { MessageCenterState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { MessageCenterActions } from '../actions/MessageCenterActions';
import { updateState } from '../utils/Reducer';
import { LoginActions } from '../actions/LoginActions';
import _ from 'lodash';

export const INITIAL_MESSAGE_CENTER_STATE: MessageCenterState = {
  // predefined groups are specifically ordered by severity
  groups: [
    {
      id: 'danger',
      title: 'Danger',
      messages: [],
      variant: 'danger'
      //showActions: false,
      //hideIfEmpty: true
    },
    {
      id: 'warning',
      title: 'Warning',
      messages: [],
      variant: 'warning'
      //showActions: true,
      //hideIfEmpty: false
    },
    {
      id: 'info',
      title: 'Info',
      messages: [],
      variant: 'info'
      //showActions: true,
      //hideIfEmpty: false
    }
  ],
  //hidden: true,
  expanded: false,
  //expandedGroupId: 'default'
  nextId: 0
};

const createMessage = (
  id: number,
  content: string,
  detail: string,
  type: MessageType,
  count: number,
  showNotification: boolean,
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
    show_notification: showNotification,
    seen: false,
    created: created,
    showDetail: showDetail,
    firstTriggered
  };
};

// Updates several messages with the same payload, useful for marking messages
// returns the updated state
const updateMessage = (state: MessageCenterState, messageIds: number[], updater) => {
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

export const MessageCenterReducer = (
  state: MessageCenterState = INITIAL_MESSAGE_CENTER_STATE,
  action: KialiAppAction
): MessageCenterState => {
  switch (action.type) {
    case getType(MessageCenterActions.addMessage): {
      const { content, detail, groupId, messageType, showNotification } = action.payload;

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
            showNotification,
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

    case getType(MessageCenterActions.removeMessage): {
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

    case getType(MessageCenterActions.toggleMessageDetail): {
      return updateMessage(state, action.payload.messageId, message => ({
        ...message,
        showDetail: !message.showDetail
      }));
    }

    case getType(MessageCenterActions.markAsRead): {
      return updateMessage(state, action.payload.messageId, message => ({
        ...message,
        seen: true,
        show_notification: false
      }));
    }

    case getType(MessageCenterActions.hideNotification): {
      return updateMessage(state, action.payload.messageId, message => ({ ...message, show_notification: false }));
    }

    case getType(MessageCenterActions.showMessageCenter):
      if (!state.expanded) {
        return updateState(state, { expanded: true });
      }
      return state;

    case getType(MessageCenterActions.hideMessageCenter):
      if (state.expanded) {
        return updateState(state, { expanded: false });
      }
      return state;

    case getType(MessageCenterActions.toggleMessageCenter):
      return updateState(state, { expanded: !state.expanded });

    case getType(LoginActions.loginRequest): {
      // Let's clear the message center when user is logging-in. This ensures
      // that past messages won't persist.
      return INITIAL_MESSAGE_CENTER_STATE;
    }
    default:
      return state;
  }
};
