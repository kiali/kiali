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

export type AIConfig = {
  chat: ChatAIConfig;
  consumption: AIrights;
  enabled: boolean;
};

export type AIrights = {
  allowed: boolean;
  enabled: boolean;
};

export type ChatAIConfig = AIrights & {
  defaultProvider: string;
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

export type ChatSessionUsageBudget = {
  has_budget: boolean;
  interval: string;
  max_cost: number;
  max_tokens: number;
  remaining_cost: number;
  remaining_tokens: number;
};

export type ChatSessionUsageResponse = {
  budget: ChatSessionUsageBudget;
  currentPeriod?: AIUsageResponse;
  metrics?: AIUsageResponse;
  session: ChatSessionUsageMetric[];
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

/** Values are expressed in millions of tokens (see AIUsageResponse.tokenUnit). */
export const formatTokensInMillions = (value: number): string =>
  `${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} M`;

export const formatCost = (value: number, currency = 'USD'): string =>
  `${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
// ---- AI global usage (GET /api/chat/usage) ----------------------------------

export type AICost = {
  currency?: string;
  input: number;
  output: number;
  total: number;
};

/** One row in a provider- or model-level aggregation. Token counts are in millions. */
export type AITokenRow = {
  completionTokens: number;
  cost?: AICost;
  model?: string;
  promptTokens: number;
  provider?: string;
  timeSeries?: AITimeSeriesPoint[];
  totalTokens: number;
};

/** A single time-bucket point in a per-(provider, model) series. */
export type AITimeSeriesPoint = {
  completionTokens: number;
  cost?: AICost;
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

export type UsageValueKind = 'cost' | 'tokens';

export type AITopModelRow = {
  cost?: AICost;
  model: string;
  provider: string;
  totalTokens: number;
};

export type AITopUserRow = {
  cost?: AICost;
  totalTokens: number;
  username: string;
};

export type AITopSummary = {
  topModels: AITopModelRow[];
  topUsers: AITopUserRow[];
};

/** Full response shape returned by GET /api/chat/usage. Token counts are in millions. */
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
  tokenUnit: 'millions';
  topSummary?: AITopSummary;
};
