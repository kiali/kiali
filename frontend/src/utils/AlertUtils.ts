import { store } from '../store/ConfigStore';
import { MessageType } from '../types/MessageCenter';
import { MessageCenterActions } from '../actions/MessageCenterActions';
import * as API from '../services/Api';
import { ApiError, isApiError } from 'types/Api';

export type Message = {
  content: string;
  detail?: string;
  showNotification?: boolean;
  type: MessageType;
};

const getMessageTypeGroup = (type?: MessageType): string => {
  switch (type) {
    case MessageType.DANGER:
      return 'danger';
    case MessageType.WARNING:
      return 'warn';
    default:
      return 'info';
  }
};

export const add = (content: string, type: MessageType): void => {
  store.dispatch(MessageCenterActions.addMessage(content, '', getMessageTypeGroup(type), type));
};

export const addMessage = (msg: Message): void => {
  store.dispatch(
    MessageCenterActions.addMessage(
      msg.content,
      msg.detail ?? '',
      getMessageTypeGroup(msg.type),
      msg.type,
      msg.showNotification
    )
  );
};

export const addError = (message: string, error: Error, type?: MessageType): void => {
  const finalType = type ?? MessageType.DANGER;
  if (isApiError(error)) {
    const err = extractApiError(message, error);

    addMessage({
      ...err,
      type: finalType
    });
  } else {
    store.dispatch(MessageCenterActions.addMessage(message, error.message, getMessageTypeGroup(finalType), finalType));
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

export const addDanger = (content: string, detail?: string): void => {
  store.dispatch(
    MessageCenterActions.addMessage(content, detail ?? '', getMessageTypeGroup(MessageType.DANGER), MessageType.DANGER)
  );
};

// info level message do not generate a toast notification
export const addInfo = (content: string, showNotification?: boolean, detail?: string): void => {
  store.dispatch(
    MessageCenterActions.addMessage(
      content,
      detail ?? '',
      getMessageTypeGroup(MessageType.INFO),
      MessageType.INFO,
      showNotification
    )
  );
};

export const addSuccess = (content: string, showNotification?: boolean, detail?: string): void => {
  store.dispatch(
    MessageCenterActions.addMessage(
      content,
      detail ?? '',
      getMessageTypeGroup(MessageType.SUCCESS),
      MessageType.SUCCESS,
      showNotification
    )
  );
};

export const addWarning = (content: string, showNotification?: boolean, detail?: string): void => {
  store.dispatch(
    MessageCenterActions.addMessage(
      content,
      detail ?? '',
      getMessageTypeGroup(MessageType.WARNING),
      MessageType.WARNING,
      showNotification
    )
  );
};
