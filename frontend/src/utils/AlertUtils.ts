import { store } from '../store/ConfigStore';
import { MessageType } from '../types/NotificationCenter';
import { NotificationCenterActions } from '../actions/NotificationCenterActions';
import { getErrorDetail, getErrorString } from '../services/Api';
import { type ApiError, isApiError } from 'types/Api';

export type Message = {
  content: string;
  detail?: string;
  isAlert?: boolean;
  showOnce?: boolean;
  type: MessageType;
};

const getMessageTypeGroup = (type?: MessageType): string => {
  switch (type) {
    case MessageType.DANGER:
      return MessageType.DANGER;
    case MessageType.SUCCESS:
      return MessageType.SUCCESS;
    case MessageType.WARNING:
      return MessageType.WARNING;
    default:
      return MessageType.INFO;
  }
};

const addMessage = (msg: Message): void => {
  store.dispatch(
    NotificationCenterActions.addMessage(
      msg.content,
      msg.detail ?? '',
      getMessageTypeGroup(msg.type),
      msg.type,
      msg.isAlert ?? true,
      msg.showOnce ?? false
    )
  );
};

// addDanger adds a Danger level notification message. Defaults: detail='', isAlert=true, showOnce=false
export const addDanger = (content: string, detail = '', isAlert = true, showOnce = false): void => {
  store.dispatch(
    NotificationCenterActions.addMessage(
      content,
      detail,
      getMessageTypeGroup(MessageType.DANGER),
      MessageType.DANGER,
      isAlert,
      showOnce
    )
  );
};

// addWarning adds a Warning level notification message. Defaults: detail='', isAlert=true, showOnce=false
export const addWarning = (content: string, detail = '', isAlert = true, showOnce = false): void => {
  store.dispatch(
    NotificationCenterActions.addMessage(
      content,
      detail,
      getMessageTypeGroup(MessageType.WARNING),
      MessageType.WARNING,
      isAlert,
      showOnce
    )
  );
};

// addSuccess adds a Success level notification message. Defaults: detail='', isAlert=true, showOnce=false
export const addSuccess = (content: string, detail = '', isAlert = true, showOnce = false): void => {
  store.dispatch(
    NotificationCenterActions.addMessage(
      content,
      detail,
      getMessageTypeGroup(MessageType.SUCCESS),
      MessageType.SUCCESS,
      isAlert,
      showOnce
    )
  );
};

// addInfo adds an Info level notification message. Defaults: detail='', isAlert=true, showOnce=false
export const addInfo = (content: string, detail = '', isAlert = true, showOnce = false): void => {
  store.dispatch(
    NotificationCenterActions.addMessage(
      content,
      detail,
      getMessageTypeGroup(MessageType.INFO),
      MessageType.INFO,
      isAlert,
      showOnce
    )
  );
};

// addError converts an Error into a notification message. It parses the Error into additional message content, and
// detail. Defaults: isAlert=true, type=DANGER, showOnce=false
export const addError = (
  message: string,
  error: Error,
  isAlert = true,
  type: MessageType = MessageType.DANGER,
  showOnce = false
): void => {
  if (isApiError(error)) {
    const err = extractApiError(message, error);

    addMessage({
      ...err,
      type: type,
      isAlert,
      showOnce
    });
  } else {
    store.dispatch(
      NotificationCenterActions.addMessage(message, error.message, getMessageTypeGroup(type), type, isAlert, showOnce)
    );
  }
};

const extractApiError = (message: string, error: ApiError): { content: string; detail: string } => {
  const errorString: string = getErrorString(error);
  const errorDetail: string = getErrorDetail(error);

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
