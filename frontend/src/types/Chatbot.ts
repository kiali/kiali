import { MessageProps } from '@patternfly/chatbot';

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
  answer: string;
  actions: Action[];
  citations: ReferencedDocument[];
  used_models: ModelResponse;
  truncated?: boolean;
  error?: string;
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

export type ReferencedDocument = {
  link: string;
  title: string;
  body: string;
};

export type ExtendedMessage = Omit<MessageProps, 'ref'> & {
  referenced_documents: ReferencedDocument[];
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
