import { MessageProps } from '@patternfly/chatbot';

export const CHATBOT_CONVERSATION_ALWAYS_NAVIGATE = 'chatbot_conversation_always_navigate';

export type ContextRequest = {
  page_description: string;
  page_namespaces: string[];
  page_url: string;
};

type LLMRequest = {
  context: ContextRequest;
  conversation_id?: string | null;
  media_type?: 'text/plain' | 'application/json';
  query: string;
};

export type ActionKind = 'navigation' | 'file';

export type Action = {
  cluster?: string;
  fileName?: string; // Only for file action kind
  group?: string;
  kind: ActionKind;
  // Optional metadata for file actions to allow editing/applying directly.
  kindName?: string;
  namespace?: string;
  object?: string;
  operation?: 'create' | 'patch' | 'delete';
  payload: string;
  title: string;
  version?: string;
};

type LLMResponse = {
  actions: Action[];
  answer: string;
  error?: string;
  referenced_docs: ReferencedDoc[];
  truncated?: boolean;
  used_models: ModelResponse;
};

export type ChatRequest = LLMRequest;
export type ChatResponse = LLMResponse;

export type ModelResponse = {
  completion_model: string;
  embedding_model: string;
};

export type AlertMessage = {
  message: string;
  title: string;
  variant: 'success' | 'danger' | 'warning' | 'info' | 'custom';
};

export type ReferencedDoc = {
  doc_title: string;
  doc_url: string;
};

export type ExtendedMessage = Omit<MessageProps, 'ref'> & {
  actions?: Action[];
  collapse?: boolean;
  referenced_docs: ReferencedDoc[];
  scrollToHere?: boolean;
};

export type Prompt = {
  message: string;
  query: string;
  title: string;
};

export type ProviderAI = {
  defaultModel: string;
  description: string;
  models: ModelAI[];
  name: string;
};

export type ModelAI = {
  description: string;
  model: string;
  name: string;
};

export type ChatAIConfig = {
  defaultProvider: string;
  enabled: boolean;
  providers: ProviderAI[];
};
