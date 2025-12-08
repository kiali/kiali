import { ActionType, createAction } from 'typesafe-actions';
import { MessageType } from '../types/NotificationCenter';
import { ActionKeys } from './ActionKeys';

type numberOrNumberArray = number | number[];

const toNumberArray = (n: numberOrNumberArray) => (Array.isArray(n) ? n : [n]);

export const NotificationCenterActions = {
  addMessage: createAction(
    ActionKeys.NC_ADD_MESSAGE,
    resolve => (content: string, detail: string, groupId: string, messageType: MessageType, isAlert: boolean) =>
      resolve({ content, detail, groupId, messageType, isAlert })
  ),
  removeMessage: createAction(ActionKeys.NC_REMOVE_MESSAGE, resolve => (messageId: numberOrNumberArray) =>
    resolve({ messageId: toNumberArray(messageId) })
  ),
  toggleMessageDetail: createAction(ActionKeys.NC_TOGGLE_MESSAGE_DETAIL, resolve => (messageId: numberOrNumberArray) =>
    resolve({ messageId: toNumberArray(messageId) })
  ),
  markAsRead: createAction(ActionKeys.NC_MARK_MESSAGE_AS_READ, resolve => (messageId: numberOrNumberArray) =>
    resolve({ messageId: toNumberArray(messageId) })
  ),
  hideNotification: createAction(ActionKeys.NC_HIDE_NOTIFICATION, resolve => (messageId: numberOrNumberArray) =>
    resolve({ messageId: toNumberArray(messageId) })
  ),
  toggleNotificationCenter: createAction(ActionKeys.NC_TOGGLE_EXPAND)
};

export type NotificationCenterAction = ActionType<typeof NotificationCenterActions>;
