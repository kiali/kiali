import { store } from '../store/ConfigStore';
import { MessageType } from '../types/MessageCenter';
import { MessageCenterActions } from '../actions/MessageCenterActions';

const DEFAULT_GROUP_ID = 'default';
const DEFAULT_MESSAGE_TYPE = MessageType.ERROR;

export const add = (content: string, group: string = DEFAULT_GROUP_ID, type: MessageType = DEFAULT_MESSAGE_TYPE) => {
  store.dispatch(MessageCenterActions.addMessage(content, group, type));
};
