import { MessageType } from '../types/MessageCenter';
import { ActionType, createAction } from 'typesafe-actions';

const DEFAULT_GROUP_ID = 'default';
const DEFAULT_MESSAGE_TYPE = MessageType.ERROR;

const enum MessageCenterActionKeys {
  ADD_MESSAGE = 'ADD_MESSAGE',
  REMOVE_MESSAGE = 'REMOVE_MESSAGE',
  MARK_MESSAGE_AS_READ = 'MARK_MESSAGE_AS_READ',
  SHOW = 'SHOW',
  HIDE = 'HIDE',
  TOGGLE_EXPAND = 'TOGGLE_EXPAND',
  TOGGLE_GROUP = 'TOGGLE_GROUP',
  HIDE_NOTIFICATION = 'HIDE_NOTIFICATION',
  EXPAND_GROUP = 'EXPAND_GROUP'
}

type numberOrNumberArray = number | number[];

const toNumberArray = (n: numberOrNumberArray) => (Array.isArray(n) ? n : [n]);

export const MessageCenterActions = {
  addMessage: createAction(
    MessageCenterActionKeys.ADD_MESSAGE,
    resolve => (content: string, groupId: string = DEFAULT_GROUP_ID, messageType: MessageType = DEFAULT_MESSAGE_TYPE) =>
      resolve({ content, groupId, messageType })
  ),
  removeMessage: createAction(MessageCenterActionKeys.REMOVE_MESSAGE, resolve => (messageId: numberOrNumberArray) =>
    resolve({ messageId: toNumberArray(messageId) })
  ),
  markAsRead: createAction(MessageCenterActionKeys.MARK_MESSAGE_AS_READ, resolve => (messageId: numberOrNumberArray) =>
    resolve({ messageId: toNumberArray(messageId) })
  ),
  toggleGroup: createAction(MessageCenterActionKeys.TOGGLE_GROUP, resolve => (groupId: string) => resolve({ groupId })),
  expandGroup: createAction(MessageCenterActionKeys.EXPAND_GROUP, resolve => (groupId: string) => resolve({ groupId })),
  hideNotification: createAction(
    MessageCenterActionKeys.HIDE_NOTIFICATION,
    resolve => (messageId: numberOrNumberArray) => resolve({ messageId: toNumberArray(messageId) })
  ),
  showMessageCenter: createAction(MessageCenterActionKeys.SHOW),
  hideMessageCenter: createAction(MessageCenterActionKeys.HIDE),
  togleExpandedMessageCenter: createAction(MessageCenterActionKeys.TOGGLE_EXPAND)
};

export const MessageCenterThunkActions = {
  toggleMessageCenter: () => {
    return (dispatch, getState) => {
      const state = getState();
      if (state.messageCenter.hidden) {
        dispatch(MessageCenterActions.showMessageCenter());
        dispatch(MessageCenterActions.expandGroup('default'));
      } else {
        dispatch(MessageCenterActions.hideMessageCenter());
      }
      return Promise.resolve();
    };
  },
  toggleSystemErrorsCenter: () => {
    return (dispatch, getState) => {
      const state = getState();
      if (state.messageCenter.hidden) {
        dispatch(MessageCenterActions.showMessageCenter());
        dispatch(MessageCenterActions.expandGroup('systemErrors'));
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

export type MessageCenterAction = ActionType<typeof MessageCenterActions>;
