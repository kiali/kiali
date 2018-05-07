import { MessageType } from '../types/MessageCenter';
import { createAction } from 'typesafe-actions';

export const enum MessageCenterActionType {
  ADD_MESSAGE = 'add_message',
  REMOVE_MESSAGE = 'remove_message',
  MARK_AS_READ = 'mark_as_read',
  SHOW_MESSAGE_CENTER = 'show_message_center',
  HIDE_MESSAGE_CENTER = 'hide_message_center',
  TOGGLE_EXPAND_MESSAGE_CENTER = 'toggle_expand_message_center',
  TOGGLE_GROUP = 'toggle_group'
}

const numberArray = (n: number | number[]) => (Array.isArray(n) ? n : [n]);

export const MessageCenterActions = {
  addMessage: createAction(
    MessageCenterActionType.ADD_MESSAGE,
    (content: string, groupId: string, messageType: MessageType) => ({
      type: MessageCenterActionType.ADD_MESSAGE,
      content,
      groupId,
      messageType
    })
  ),
  removeMessage: createAction(MessageCenterActionType.REMOVE_MESSAGE, (messageId: number | number[]) => {
    const type = MessageCenterActionType.REMOVE_MESSAGE;
    messageId = numberArray(messageId);
    return {
      type,
      messageId
    };
  }),
  markAsRead: createAction(MessageCenterActionType.MARK_AS_READ, (messageId: number | number[]) => {
    const type = MessageCenterActionType.MARK_AS_READ;
    messageId = numberArray(messageId);
    return {
      type,
      messageId
    };
  }),
  toggleGroup: createAction(MessageCenterActionType.TOGGLE_GROUP, (groupId: number) => {
    const type = MessageCenterActionType.TOGGLE_GROUP;
    return {
      type,
      groupId
    };
  }),

  showMessageCenter: createAction(MessageCenterActionType.SHOW_MESSAGE_CENTER),
  hideMessageCenter: createAction(MessageCenterActionType.HIDE_MESSAGE_CENTER),
  togleExpandedMessageCenter: createAction(MessageCenterActionType.TOGGLE_EXPAND_MESSAGE_CENTER),

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
  markGroupAsRead: (groupId: number) => {
    return (dispatch, getState) => {
      const state = getState();
      const foundGroup = state.messageCenter.groups.find(group => group.id === groupId);
      if (foundGroup) {
        dispatch(MessageCenterActions.markAsRead(foundGroup.messages.map(message => message.id)));
      }
    };
  },
  clearGroup: (groupId: number) => {
    return (dispatch, getState) => {
      const state = getState();
      const foundGroup = state.messageCenter.groups.find(group => group.id === groupId);
      if (foundGroup) {
        dispatch(MessageCenterActions.removeMessage(foundGroup.messages.map(message => message.id)));
      }
    };
  }
};
