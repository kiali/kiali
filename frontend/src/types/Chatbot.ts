import { MessageProps } from '@patternfly/chatbot';
import { Map as ImmutableMap } from 'immutable';

export const CHATBOT_CONVERSATION_ALWAYS_NAVIGATE = 'chatbot_conversation_always_navigate';

export type ContextRequest = {
  page_url: string;
  page_description: string;
  page_namespaces: string[];
};

type LLMRequest = {
  query: string;
  conversation_id?: string | null;
  context: ContextRequest;
  media_type?: 'text/plain' | 'application/json';
};

export type ActionKind = 'navigation' | 'file';

export type Action = {
  fileName?: string; // Only for file action kind
  title: string;
  kind: ActionKind;
  payload: string;
};

type LLMResponse = {
  event: string;
  data: any;
};

export type ChatRequest = LLMRequest;
export type ChatResponse = LLMResponse;

export type ModelResponse = {
  completion_model: string;
  embedding_model: string;
};

export type AlertMessage = {
  title: string;
  message: string;
  variant: 'success' | 'danger' | 'warning' | 'info' | 'custom';
};

export type ErrorType = {
  message?: string;
  moreInfo?: string;
  response?: Response;
};

export type ExtendedMessage = Omit<MessageProps, 'ref'> & {
  referenced_documents: ReferencedDoc[];
  actions?: Action[];
  scrollToHere?: boolean;
  collapse?: boolean;
};

export type Prompt = {
  title: string;
  message: string;
  query: string;
};

export type ProviderAI = {
  name: string;
  description: string;
  defaultModel: string;
  models: ModelAI[];
};

export type ModelAI = {
  name: string;
  model: string;
  description: string;
};

export type ChatAIConfig = {
  enabled: boolean;
  providers: ProviderAI[];
  defaultProvider: string;
};

export type ReferencedDoc = {
  doc_title: string;
  doc_url: string;
};

export type Tool = {
  args: { [key: string]: Array<string> };
  content: string;
  name: string;
  status: 'error' | 'success';
};
// ChatHistory
type ChatEntryUser = {
  text: string;
  who: 'user';
};

type ChatEntryAI = {
  error?: ErrorType;
  id: string;
  isCancelled: boolean;
  isStreaming: boolean;
  isTruncated: boolean;
  references?: Array<ReferencedDoc>;
  actions?: Array<Action>;
  text?: string;
  tools?: ImmutableMap<string, Tool>;
  userFeedback?: ImmutableMap<string, object>;
  who: 'ai';
};

export type ChatEntry = ChatEntryAI | ChatEntryUser;
