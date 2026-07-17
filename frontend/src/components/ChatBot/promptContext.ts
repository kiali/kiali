import { isMultiCluster } from 'config';
import type { Prompt } from 'types/Chatbot';
import type { HealthStatusId } from 'types/Health';

export type ResourceKind =
  | 'application'
  | 'applications'
  | 'graph'
  | 'istio'
  | 'mesh'
  | 'namespace'
  | 'namespaces'
  | 'overview'
  | 'service'
  | 'services'
  | 'workload'
  | 'workloads';

export type PromptContext = {
  clusterName?: string;
  isDetailView: boolean;
  istioType?: string;
  namespace?: string;
  namespaceList?: string;
  resourceKind: ResourceKind;
  resourceName?: string;
};

export type PromptVariables = Record<string, string>;

const LIST_RESOURCE_KINDS = new Set<ResourceKind>(['applications', 'graph', 'services', 'workloads']);

const PROMPT_VARIABLE_DEFAULTS: PromptVariables = {
  application: '',
  cluster: '',
  health: '',
  health_context: '',
  istio_object: '',
  istio_type: '',
  namespace: '',
  namespaces: 'currently selected',
  service: '',
  workload: ''
};

const normalizeResourceKind = (kind: string): ResourceKind => {
  switch (kind) {
    case 'app':
    case 'application':
    case 'applications':
      return kind === 'applications' ? 'applications' : 'application';
    case 'srv':
    case 'service':
    case 'services':
      return kind === 'services' ? 'services' : 'service';
    case 'wk':
    case 'workload':
    case 'workloads':
      return kind === 'workloads' ? 'workloads' : 'workload';
    case 'namespace':
      return 'namespace';
    case 'namespaces':
      return 'namespaces';
    case 'istio':
      return 'istio';
    case 'graph':
      return 'graph';
    case 'mesh':
      return 'mesh';
    case 'overview':
      return 'overview';
    default:
      return kind as ResourceKind;
  }
};

export const buildPromptContext = (
  kind: string | undefined,
  name: string | undefined,
  namespace: string | undefined,
  istio: string | undefined,
  clusterName?: string | undefined
): PromptContext | undefined => {
  if (!kind) {
    return undefined;
  }

  const resourceKind = normalizeResourceKind(kind);
  const isDetailView = !!name;
  const resolvedClusterName = clusterName && isMultiCluster ? clusterName : undefined;

  return {
    clusterName: resolvedClusterName,
    isDetailView,
    istioType: istio || undefined,
    namespace: isDetailView && resourceKind !== 'namespace' ? namespace : undefined,
    namespaceList: !isDetailView && namespace ? namespace : undefined,
    resourceKind,
    resourceName: name || undefined
  };
};

export const enrichPromptContext = (
  ctx: PromptContext | undefined,
  activeNamespaceList: string
): PromptContext | undefined => {
  if (!ctx || ctx.isDetailView || ctx.namespaceList || !activeNamespaceList) {
    return ctx;
  }

  if (LIST_RESOURCE_KINDS.has(ctx.resourceKind)) {
    return { ...ctx, namespaceList: activeNamespaceList };
  }

  return ctx;
};

export const formatHealthContext = (status?: HealthStatusId): string => {
  if (!status || status === 'NA') {
    return '';
  }

  return ` with current health status ${status}`;
};

export const substitutePromptVariables = (text: string, variables: PromptVariables): string => {
  const merged = { ...PROMPT_VARIABLE_DEFAULTS, ...variables };
  return text.replace(/\{([a-z_]+)\}/g, (_match, key: string) => merged[key] ?? '');
};

export const buildPromptVariables = (
  ctx: PromptContext | undefined,
  healthStatus?: HealthStatusId
): PromptVariables => {
  if (!ctx) {
    return { ...PROMPT_VARIABLE_DEFAULTS };
  }

  const cluster = ctx.clusterName && isMultiCluster ? ` in cluster '${ctx.clusterName}'` : '';
  const namespaces = ctx.namespaceList || 'currently selected';
  const namespace = ctx.resourceKind === 'namespace' ? ctx.resourceName ?? '' : ctx.namespace ?? ctx.resourceName ?? '';
  const health = healthStatus && healthStatus !== 'NA' ? healthStatus : '';

  return {
    ...PROMPT_VARIABLE_DEFAULTS,
    application: ctx.resourceKind === 'application' ? ctx.resourceName ?? '' : '',
    cluster,
    health,
    health_context: formatHealthContext(healthStatus),
    istio_object: ctx.resourceKind === 'istio' ? ctx.resourceName ?? '' : '',
    istio_type: ctx.istioType ?? '',
    namespace,
    namespaces,
    service: ctx.resourceKind === 'service' ? ctx.resourceName ?? '' : '',
    workload: ctx.resourceKind === 'workload' ? ctx.resourceName ?? '' : ''
  };
};

type SubstitutablePrompt = Omit<Prompt, 'message'> & { message?: string };

export const substitutePrompt = (prompt: SubstitutablePrompt, variables: PromptVariables): Prompt => {
  const query = substitutePromptVariables(prompt.query, variables);
  const description = prompt.description
    ? substitutePromptVariables(prompt.description, variables)
    : prompt.description;
  const message = prompt.message ? substitutePromptVariables(prompt.message, variables) : prompt.message;

  return {
    ...prompt,
    description,
    message: message ?? query,
    query
  };
};

export const substitutePrompts = (prompts: Prompt[], variables: PromptVariables): Prompt[] =>
  prompts.map(prompt => substitutePrompt(prompt, variables));
