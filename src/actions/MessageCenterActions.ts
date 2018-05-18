import { MessageType } from '../types/MessageCenter';
import { createAction } from 'typesafe-actions';

export const enum MessageCenterActionKeys {
  ADD_MESSAGE = 'ADD_MESSAGE',
  REMOVE_MESSAGE = 'REMOVE_MESSAGE',
  MARK_MESSAGE_AS_READ = 'MARK_MESSAGE_AS_READ',
  SHOW = 'SHOW',
  HIDE = 'HIDE',
  TOGGLE_EXPAND = 'TOGGLE_EXPAND',
  TOGGLE_GROUP = 'TOGGLE_GROUP',
  HIDE_NOTIFICATION = 'HIDE_NOTIFICATION'
}

type numberOrNumberArray = number | number[];

const toNumberArray = (n: numberOrNumberArray) => (Array.isArray(n) ? n : [n]);

export const MessageCenterActions = {
  addMessage: createAction(
    MessageCenterActionKeys.ADD_MESSAGE,
    (content: string, groupId: string, messageType: MessageType) => ({
      type: MessageCenterActionKeys.ADD_MESSAGE,
      content,
      groupId,
      messageType
    })
  ),
  removeMessage: createAction(MessageCenterActionKeys.REMOVE_MESSAGE, (messageId: numberOrNumberArray) => {
    const type = MessageCenterActionKeys.REMOVE_MESSAGE;
    messageId = toNumberArray(messageId);
    return {
      type,
      messageId
    };
  }),
  markAsRead: createAction(MessageCenterActionKeys.MARK_MESSAGE_AS_READ, (messageId: numberOrNumberArray) => {
    const type = MessageCenterActionKeys.MARK_MESSAGE_AS_READ;
    messageId = toNumberArray(messageId);
    return {
      type,
      messageId
    };
  }),
  toggleGroup: createAction(MessageCenterActionKeys.TOGGLE_GROUP, (groupId: string) => {
    const type = MessageCenterActionKeys.TOGGLE_GROUP;
    return {
      type,
      groupId
    };
  }),
  hideNotification: createAction(MessageCenterActionKeys.HIDE_NOTIFICATION, (messageId: numberOrNumberArray) => {
    const type = MessageCenterActionKeys.HIDE_NOTIFICATION;
    messageId = toNumberArray(messageId);
    return {
      type,
      messageId
    };
  }),

  showMessageCenter: createAction(MessageCenterActionKeys.SHOW),
  hideMessageCenter: createAction(MessageCenterActionKeys.HIDE),
  togleExpandedMessageCenter: createAction(MessageCenterActionKeys.TOGGLE_EXPAND),

  toggleMessageCenter: () => {
    return (dispatch, getState) => {
      const state = getState();
      if (state.messageCenter.hidden) {
        dispatch(MessageCenterActions.showMessageCenter());
      } else {
        dispatch(MessageCenterActions.hideMessageCenter());
      }
      return Promise.resolve();
    };
  },
  markGroupAsRead: (groupId: string) => {
    return (dispatch, getState) => {
      const state = getState();
      const foundGroup = state.messageCenter.groups.find(group => group.id === groupId);
      if (foundGroup) {
        dispatch(MessageCenterActions.markAsRead(foundGroup.messages.map(message => message.id)));
      }
      return Promise.resolve();
    };
  },
  clearGroup: (groupId: string) => {
    return (dispatch, getState) => {
      const state = getState();
      const foundGroup = state.messageCenter.groups.find(group => group.id === groupId);
      if (foundGroup) {
        dispatch(MessageCenterActions.removeMessage(foundGroup.messages.map(message => message.id)));
      }
      return Promise.resolve();
    };
  }
};
