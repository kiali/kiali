import { ActionType, createAction } from 'typesafe-actions';
import { MessageType } from '../types/MessageCenter';
import { ActionKeys } from './ActionKeys';

const DEFAULT_GROUP_ID = 'default';
const DEFAULT_MESSAGE_TYPE = MessageType.ERROR;

type numberOrNumberArray = number | number[];

const toNumberArray = (n: numberOrNumberArray) => (Array.isArray(n) ? n : [n]);

export const MessageCenterActions = {
  addMessage: createAction(
    ActionKeys.MC_ADD_MESSAGE,
    resolve => (content: string, groupId: string = DEFAULT_GROUP_ID, messageType: MessageType = DEFAULT_MESSAGE_TYPE) =>
      resolve({ content, groupId, messageType })
  ),
  removeMessage: createAction(ActionKeys.MC_REMOVE_MESSAGE, resolve => (messageId: numberOrNumberArray) =>
    resolve({ messageId: toNumberArray(messageId) })
  ),
  markAsRead: createAction(ActionKeys.MC_MARK_MESSAGE_AS_READ, resolve => (messageId: numberOrNumberArray) =>
    resolve({ messageId: toNumberArray(messageId) })
  ),
  toggleGroup: createAction(ActionKeys.MC_TOGGLE_GROUP, resolve => (groupId: string) => resolve({ groupId })),
  expandGroup: createAction(ActionKeys.MC_EXPAND_GROUP, resolve => (groupId: string) => resolve({ groupId })),
  hideNotification: createAction(ActionKeys.MC_HIDE_NOTIFICATION, resolve => (messageId: numberOrNumberArray) =>
    resolve({ messageId: toNumberArray(messageId) })
  ),
  showMessageCenter: createAction(ActionKeys.MC_SHOW),
  hideMessageCenter: createAction(ActionKeys.MC_HIDE),
  toggleExpandedMessageCenter: createAction(ActionKeys.MC_TOGGLE_EXPAND)
};

export type MessageCenterAction = ActionType<typeof MessageCenterActions>;
