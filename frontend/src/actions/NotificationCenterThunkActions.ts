import { NotificationCenterActions } from './NotificationCenterActions';
import { KialiAppState } from '../store/Store';
import { KialiDispatch } from '../types/Redux';

export const NotificationCenterThunkActions = {
  markGroupAsRead: (groupId: string) => {
    return (dispatch, getState) => {
      const state = getState();
      const foundGroup = state.notificationCenter.groups.find(group => group.id === groupId);
      if (foundGroup) {
        dispatch(NotificationCenterActions.markAsRead(foundGroup.messages.map(message => message.id)));
      }
      return Promise.resolve();
    };
  },
  clearGroup: (groupId: string) => {
    return (dispatch: KialiDispatch, getState: () => KialiAppState) => {
      const state = getState();
      const foundGroup = state.notificationCenter.groups.find(group => group.id === groupId);
      if (foundGroup) {
        dispatch(NotificationCenterActions.removeMessage(foundGroup.messages.map(message => message.id)));
      }
      return Promise.resolve();
    };
  }
};
