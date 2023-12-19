import { store } from '../store/ConfigStore';
import { MessageType } from '../types/MessageCenter';
import { MessageCenterActions } from '../actions/MessageCenterActions';
import * as API from '../services/Api';
import { ApiError, isApiError } from 'types/Api';

export type Message = {
  content: string;
  detail?: string;
  group?: string;
  showNotification?: boolean;
  type?: MessageType;
};

export const add = (content: string, group?: string, type?: MessageType): void => {
  store.dispatch(MessageCenterActions.addMessage(content, '', group, type));
};

export const addMessage = (msg: Message): void => {
  store.dispatch(
    MessageCenterActions.addMessage(msg.content, msg.detail ?? '', msg.group, msg.type, msg.showNotification)
  );
};

export const addError = (message: string, error?: Error, group?: string, type?: MessageType, detail?: string): void => {
  if (isApiError(error)) {
    const finalType: MessageType = type ?? MessageType.ERROR;
    const err = extractApiError(message, error);

    addMessage({
      ...err,
      group: group,
      type: finalType
    });
  } else {
    store.dispatch(MessageCenterActions.addMessage(message, detail ?? '', group, MessageType.ERROR));
  }
};

export const extractApiError = (message: string, error: ApiError): { content: string; detail: string } => {
  const errorString: string = API.getErrorString(error);
  const errorDetail: string = API.getErrorDetail(error);

  if (message) {
    // combine error string and detail into a single detail
    if (errorString && errorDetail) {
      return { content: message, detail: `${errorString}\nAdditional Detail:\n${errorDetail}` };
    } else if (errorDetail) {
      return { content: message, detail: errorDetail };
    } else {
      return { content: message, detail: errorString };
    }
  }

  return { content: errorString, detail: errorDetail };
};

// info level message do not generate a toast notification
export const addInfo = (content: string, showNotification?: boolean, group?: string, detail?: string): void => {
  store.dispatch(MessageCenterActions.addMessage(content, detail ?? '', group, MessageType.INFO, showNotification));
};

export const addSuccess = (content: string, showNotification?: boolean, group?: string, detail?: string): void => {
  store.dispatch(MessageCenterActions.addMessage(content, detail ?? '', group, MessageType.SUCCESS, showNotification));
};

export const addWarning = (content: string, showNotification?: boolean, group?: string, detail?: string): void => {
  store.dispatch(MessageCenterActions.addMessage(content, detail ?? '', group, MessageType.WARNING, showNotification));
};
