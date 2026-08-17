import type { MessageProps } from '@patternfly/chatbot';
import type { Map as ImmutableMap } from 'immutable';
import type { HealthStatusId } from 'types/Health';

export type ChatInteractionMode = 'ask' | 'troubleshoot';

export type ErrorType = {
  message?: string;
  moreInfo?: string;
  response?: Response;
};

type LLMRequest = {
  conversation_id?: string | null;
  interaction_mode?: ChatInteractionMode;
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
  conversation_id: string;
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
  category?: string;
  description?: string;
  message: string;
  name?: string;
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
  store: {
    enabled: boolean;
  };
};

export type Tool = {
  approvalID?: string;
  args: { [key: string]: unknown };
  content: string;
  description?: string;
  isApproved?: boolean;
  isDenied?: boolean;
  isRunning?: boolean;
  isUserApproval?: boolean;
  name: string;
  olsToolUiID?: string;
  serverName?: string;
  status?: 'error' | 'success' | 'truncated';
  structuredContent?: Record<string, unknown>;
  uiResourceUri?: string;
};

type ChatEntryUser = {
  hidden?: boolean;
  text: string;
  who: 'user';
};

type ChatEntryAI = {
  actions?: Array<Action>;
  error?: ErrorType;
  id: string;
  isCancelled: boolean;
  isStreaming: boolean;
  isTruncated: boolean;
  references?: Array<ReferencedDoc>;
  text?: string;
  tools?: ImmutableMap<string, Tool>;
  who: 'ai';
};

export type ChatEntry = ChatEntryAI | ChatEntryUser;

export type ChatResourceHealth = {
  clusterName?: string;
  namespace: string;
  resourceKind: 'application' | 'namespace' | 'service' | 'workload';
  resourceName: string;
  status?: HealthStatusId;
};

export type ChatSessionUsageMetric = {
  completion_tokens: number;
  last_updated: string;
  model: string;
  prompt_tokens: number;
  provider: string;
  request_count: number;
  since: string;
  total_tokens: number;
  user_id: string;
};

// ---- AI global usage (GET /api/chat/usage) ----------------------------------

/** One row in a provider- or model-level aggregation. */
export type AITokenRow = {
  completionTokens: number;
  model?: string;
  promptTokens: number;
  provider?: string;
  totalTokens: number;
  timeSeries?: AITimeSeriesPoint[];
};

/** A single time-bucket point in a per-(provider, model) series. */
export type AITimeSeriesPoint = {
  completionTokens: number;
  promptTokens: number;
  timestamp: string;
  totalTokens: number;
};

/** One time series for a specific provider + model combination. */
export type AITimeSeriesEntry = {
  model: string;
  points: AITimeSeriesPoint[];
  provider: string;
};

export type TokenMetric = 'totalTokens' | 'promptTokens' | 'completionTokens';
/** Full response shape returned by GET /api/chat/usage. */
export type AIUsageResponse = {
  summary: {
    byModel: AITokenRow[];
    byProvider: AITokenRow[];
  };
  timeSeries: {
    series: AITimeSeriesEntry[];
    step: string;
    window: string;
  };
};
