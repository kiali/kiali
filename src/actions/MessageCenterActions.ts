import { MessageType } from '../types/MessageCenter';
import { createAction } from 'typesafe-actions';

export const enum MessageCenterActionKeys {
  MESSAGE_CENTER_ADD = 'MESSAGE_CENTER_ADD',
  MESSAGE_CENTER_REMOVE = 'MESSAGE_CENTER_REMOVE',
  MESSAGE_CENTER_MARK_AS_READ = 'MESSAGE_CENTER_MARK_AS_READ',
  MESSAGE_CENTER_SHOW = 'MESSAGE_CENTER_SHOW',
  MESSAGE_CENTER_HIDE = 'MESSAGE_CENTER_HIDE',
  MESSAGE_CENTER_TOGGLE_EXPAND = 'MESSAGE_CENTER_TOGGLE_EXPAND',
  MESSAGE_CENTER_TOGGLE_GROUP = 'MESSAGE_CENTER_TOGGLE_GROUP'
}

const numberArray = (n: number | number[]) => (Array.isArray(n) ? n : [n]);

export const MessageCenterActions = {
  addMessage: createAction(
    MessageCenterActionKeys.MESSAGE_CENTER_ADD,
    (content: string, groupId: string, messageType: MessageType) => ({
      type: MessageCenterActionKeys.MESSAGE_CENTER_ADD,
      content,
      groupId,
      messageType
    })
  ),
  removeMessage: createAction(MessageCenterActionKeys.MESSAGE_CENTER_REMOVE, (messageId: number | number[]) => {
    const type = MessageCenterActionKeys.MESSAGE_CENTER_REMOVE;
    messageId = numberArray(messageId);
    return {
      type,
      messageId
    };
  }),
  markAsRead: createAction(MessageCenterActionKeys.MESSAGE_CENTER_MARK_AS_READ, (messageId: number | number[]) => {
    const type = MessageCenterActionKeys.MESSAGE_CENTER_MARK_AS_READ;
    messageId = numberArray(messageId);
    return {
      type,
      messageId
    };
  }),
  toggleGroup: createAction(MessageCenterActionKeys.MESSAGE_CENTER_TOGGLE_GROUP, (groupId: number) => {
    const type = MessageCenterActionKeys.MESSAGE_CENTER_TOGGLE_GROUP;
    return {
      type,
      groupId
    };
  }),

  showMessageCenter: createAction(MessageCenterActionKeys.MESSAGE_CENTER_SHOW),
  hideMessageCenter: createAction(MessageCenterActionKeys.MESSAGE_CENTER_HIDE),
  togleExpandedMessageCenter: createAction(MessageCenterActionKeys.MESSAGE_CENTER_TOGGLE_EXPAND),

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
