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

export type Tool = {
  args: { [key: string]: Array<string> };
  content: string;
  name: string;
  status: 'error' | 'success';
};

export type ToolCall = {
  name: string;
  args: { [key: string]: Array<string> };
  id: string;
  type: string;
};

export type ToolResult = {
  id: string;
  status: 'success' | 'error';
  content: string;
  type: string;
};

type LLMResponse = {
  available_quotas: {
    [key: string]: number;
  };
  conversation_id: string;
  input_tokens: number;
  output_tokens: number;
  referenced_documents: ReferencedDocument[];
  response: string;
  tool_calls: ToolCall[];
  tool_results: ToolResult[];
  truncated: boolean;
  error?: string;
  actions?: Action[];
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
  doc_url: string;
  doc_title: string;
};

export type ExtendedMessage = Omit<MessageProps, 'ref'> & {
  tools?: ImmutableMap<string, Tool>;
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
