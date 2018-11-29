import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from './KialiAppAction';
import { MessageCenterActions } from './MessageCenterActions';
import { KialiAppState } from '../store/Store';

const MessageCenterThunkActions = {
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
    return (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>, getState: () => KialiAppState) => {
      const state = getState();
      const foundGroup = state.messageCenter.groups.find(group => group.id === groupId);
      if (foundGroup) {
        dispatch(MessageCenterActions.removeMessage(foundGroup.messages.map(message => message.id)));
      }
      return Promise.resolve();
    };
  }
};

export default MessageCenterThunkActions;
