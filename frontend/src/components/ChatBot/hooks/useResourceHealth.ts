import React from 'react';
import * as API from 'services/Api';
import type { HealthStatusId, NamespaceAppHealth, NamespaceServiceHealth, NamespaceWorkloadHealth } from 'types/Health';
import { healthComputeDurationValidSeconds } from 'utils/HealthComputeDuration';
import type { PromptContext, ResourceKind } from '../promptContext';

const DETAIL_HEALTH_KINDS = new Set<ResourceKind>(['application', 'namespace', 'service', 'workload']);

// getClusters*Health returns a Map instance populated via bracket notation (see Api.ts).
// Existing callers use results[namespace], not results.get(namespace).
const namespaceHealth = <T>(healthMap: Map<string, T>, namespace: string): T | undefined =>
  ((healthMap as unknown) as Record<string, T>)[namespace];

const readHealthStatus = (status?: string): HealthStatusId | undefined => {
  if (!status || status === 'NA') {
    return undefined;
  }

  return status as HealthStatusId;
};

const fetchResourceHealth = async (ctx: PromptContext, duration: number): Promise<HealthStatusId | undefined> => {
  const namespace = ctx.resourceKind === 'namespace' ? ctx.resourceName : ctx.namespace;
  if (!namespace) {
    return undefined;
  }

  if (ctx.resourceKind === 'namespace') {
    const healthMap = await API.getClustersHealth(namespace, duration, ctx.clusterName);
    return readHealthStatus(healthMap.get(namespace)?.worstStatus);
  }

  if (!ctx.resourceName) {
    return undefined;
  }

  switch (ctx.resourceKind) {
    case 'service': {
      const healthMap = await API.getClustersServiceHealth(namespace, duration, ctx.clusterName);
      const services = namespaceHealth<NamespaceServiceHealth>(healthMap, namespace);
      return readHealthStatus(services?.[ctx.resourceName]?.getStatus().id);
    }
    case 'application': {
      const healthMap = await API.getClustersAppHealth(namespace, duration, ctx.clusterName);
      const apps = namespaceHealth<NamespaceAppHealth>(healthMap, namespace);
      return readHealthStatus(apps?.[ctx.resourceName]?.getStatus().id);
    }
    case 'workload': {
      const healthMap = await API.getClustersWorkloadHealth(namespace, duration, ctx.clusterName);
      const workloads = namespaceHealth<NamespaceWorkloadHealth>(healthMap, namespace);
      return readHealthStatus(workloads?.[ctx.resourceName]?.getStatus().id);
    }
    default:
      return undefined;
  }
};

export const useResourceHealth = (ctx: PromptContext | undefined): HealthStatusId | undefined => {
  const [resourceHealthStatus, setResourceHealthStatus] = React.useState<HealthStatusId | undefined>(undefined);

  React.useEffect(() => {
    if (!ctx?.isDetailView || !DETAIL_HEALTH_KINDS.has(ctx.resourceKind)) {
      return;
    }

    let cancelled = false;
    const duration = healthComputeDurationValidSeconds();

    fetchResourceHealth(ctx, duration)
      .then(status => {
        if (!cancelled) {
          setResourceHealthStatus(status);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResourceHealthStatus(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ctx]);

  if (!ctx?.isDetailView || !DETAIL_HEALTH_KINDS.has(ctx.resourceKind)) {
    return undefined;
  }

  return resourceHealthStatus;
};
