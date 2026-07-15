import { isMultiCluster } from 'config';
import { useSelector } from 'react-redux';
import type { KialiAppState } from 'store/Store';
import type { HealthStatusId } from 'types/Health';
import type { PromptContext } from '../promptContext';

const DETAIL_HEALTH_KINDS = new Set(['application', 'namespace', 'service', 'workload']);

export const selectChatResourceHealthStatus = (
  state: KialiAppState,
  ctx: PromptContext | undefined
): HealthStatusId | undefined => {
  if (!ctx?.isDetailView || !DETAIL_HEALTH_KINDS.has(ctx.resourceKind)) {
    return undefined;
  }

  const stored = state.aiChat.resourceHealth;
  if (!stored || stored.resourceKind !== ctx.resourceKind || stored.resourceName !== ctx.resourceName) {
    return undefined;
  }

  const ctxNamespace = ctx.resourceKind === 'namespace' ? ctx.resourceName : ctx.namespace;
  if (!ctxNamespace || stored.namespace !== ctxNamespace) {
    return undefined;
  }

  if (isMultiCluster && stored.clusterName !== ctx.clusterName) {
    return undefined;
  }

  return stored.status;
};

export const useChatResourceHealth = (ctx: PromptContext | undefined): HealthStatusId | undefined =>
  useSelector((state: KialiAppState) => selectChatResourceHealthStatus(state, ctx));
