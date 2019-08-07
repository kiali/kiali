import { store } from '../store/ConfigStore';
import { MessageType } from '../types/MessageCenter';
import { MessageCenterActions } from '../actions/MessageCenterActions';
import { AxiosError } from 'axios';
import * as API from '../services/Api';

export const add = (content: string, group?: string, type?: MessageType) => {
  store.dispatch(MessageCenterActions.addMessage(content, '', group, type));
};

export const addDetail = (content: string, detail: string, group?: string, type?: MessageType) => {
  store.dispatch(MessageCenterActions.addMessage(content, detail, group, type));
};

export const addError = (message: string, error: AxiosError, group?: string, type?: MessageType) => {
  const errorString: string = API.getErrorString(error);
  const errorDetail: string = API.getErrorDetail(error);
  let finalMessage: string = message;
  let finalDetail: string = errorString;
  let finalType: MessageType = type ? type : MessageType.ERROR;
  if (message) {
    // combine error string and detail into a single detail
    if (errorString && errorDetail) {
      finalDetail = `${errorString}\nAdditional Detail:\n${errorDetail}`;
    } else if (errorDetail) {
      finalDetail = errorDetail;
    }
  } else {
    finalMessage = errorString;
    finalDetail = errorDetail;
  }
  addDetail(finalMessage, finalDetail, group, finalType);
};
