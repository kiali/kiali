import { MessageProps } from '@patternfly/chatbot';

export type ContextRequest = {
  page_description: string;
  page_state: any;
};
type LLMRequest = {
  query: string;
  conversation_id?: string | null;
  context: ContextRequest;
  media_type?: 'text/plain' | 'application/json';
};

export type ActionKind = 'navigation' | 'tool';

export type Action = {
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
  actions?: Action[];
  referenced_documents: ReferencedDocument[];
  scrollToHere?: boolean;
  collapse?: boolean;
};

export type Prompt = {
  title: string;
  message: string;
  query: string;
};

export type ModelAI = {
  name: string;
  model: string;
  description: string;
};

export type ChatAIConfig = {
  enabled: boolean;
  models: ModelAI[];
  defaultModel: string;
};
