import { AlertMessage } from '../types/Chatbot';

export const defaultGatewayLabel = 'istio';
export const defaultGatewayLabelValue = 'ingressgateway';

/**  ChatBot Constants */

export const CHAT_HISTORY_HEADER = 'Chat History';

export const API_TIMEOUT = 280000;

export const API_VERSION = 'v1';
export const API_CHAT = 'chat';

export const API_PATH = `${API_VERSION}/${API_CHAT}`;

export const REFERENCED_DOCUMENTS_CAPTION = 'Refer to the following for more information:';

/* Timeout message */
export const TIMEOUT_MSG =
  '_Chatbot service is taking too long to respond to your query. ' +
  'Try to submit a different query or try again later._';

/* Too many request message */
export const TOO_MANY_REQUESTS_MSG = '_Chatbot service is busy with too many requests. Please try again later._';

/* Footnote label */
export const FOOTNOTE_LABEL = 'Always review AI-generated content prior to use.';

export const KIALI_PRODUCT_NAME = 'Kiali ServiceMesh Observability Assistant';

export const INITIAL_NOTICE: AlertMessage = {
  title: 'Important',
  message:
    `The Red Hat ` +
    KIALI_PRODUCT_NAME +
    ` provides
  answers to questions related to the Kiali console.
  Interactions with the ` +
    KIALI_PRODUCT_NAME +
    ` is not utilized to enhance our products and services. `,
  variant: 'info'
};
