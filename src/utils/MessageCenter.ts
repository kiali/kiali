import { store } from '../store/ConfigStore';
import { MessageType } from '../types/MessageCenter';
import { MessageCenterActions } from '../actions/MessageCenterActions';

export const add = (content: string, group?: string, type?: MessageType) => {
  store.dispatch(MessageCenterActions.addMessage(content, group, type));
};
