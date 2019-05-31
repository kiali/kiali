import { ActionType, createAction } from 'typesafe-actions';
import { MessageType } from '../types/MessageCenter';

const DEFAULT_GROUP_ID = 'default';
const DEFAULT_MESSAGE_TYPE = MessageType.ERROR;

enum MessageCenterActionKeys {
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
  toggleExpandedMessageCenter: createAction(MessageCenterActionKeys.TOGGLE_EXPAND)
};

export type MessageCenterAction = ActionType<typeof MessageCenterActions>;
