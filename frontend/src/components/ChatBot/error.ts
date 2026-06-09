import { ErrorType } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';

export type FetchError = {
  json?: {
    detail?: string | { cause?: string; message?: string; response?: string };
    message?: string;
  };
  message?: string;
  response?: Response;
};
// Extracts the error message from a Fetch error
export const getFetchErrorMessage = (error: FetchError): ErrorType => {
  // For OpenShift Lightspeed API errors, the `detail` field will either be a single string or
  // an object containing `response` and `cause` strings
  const detail = error.json?.detail;
  if (detail && typeof detail === 'string') {
    return { message: detail };
  }
  if (detail && typeof detail === 'object' && typeof detail.response === 'string' && typeof detail.cause === 'string') {
    return { message: detail.response, moreInfo: detail.cause };
  }
  // detail is an object with only a message field (e.g. { message: "tool error..." })
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return { message: detail.message };
  }
  return {
    message: t('If this error persists, please contact an administrator. Error details: {{e}}', {
      e: error.json?.message || error.message || error.response?.statusText
    })
  };
};
