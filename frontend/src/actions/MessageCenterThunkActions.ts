import { MessageCenterActions } from './MessageCenterActions';
import { KialiAppState } from '../store/Store';
import { KialiDispatch } from '../types/Redux';

export const MessageCenterThunkActions = {
  toggleMessageCenter: () => {
    return (dispatch, getState) => {
      const state = getState();
      if (state.messageCenter.expanded) {
        dispatch(MessageCenterActions.hideMessageCenter());
      } else {
        dispatch(MessageCenterActions.showMessageCenter());
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
    return (dispatch: KialiDispatch, getState: () => KialiAppState) => {
      const state = getState();
      const foundGroup = state.messageCenter.groups.find(group => group.id === groupId);
      if (foundGroup) {
        dispatch(MessageCenterActions.removeMessage(foundGroup.messages.map(message => message.id)));
      }
      return Promise.resolve();
    };
  }
};
