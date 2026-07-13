import React from 'react';
import { useSelector } from 'react-redux';
import * as API from 'services/Api';
import { activeNamespacesSelector } from 'store/Selectors';
import { namespacesToString } from 'types/Namespace';
import { DEGRADED, FAILURE, NOT_READY } from 'types/Health';
import type { Health, HealthStatusId, Status } from 'types/Health';
import { healthComputeDurationValidSeconds } from 'utils/HealthComputeDuration';
import type { PromptContext, ResourceKind, UnhealthyResource } from '../promptContext';

const UNHEALTHY_STATUSES = new Set<Status>([FAILURE, DEGRADED, NOT_READY]);
const MAX_UNHEALTHY_PROMPTS = 2;

const LIST_HEALTH_KINDS = new Set<ResourceKind>(['applications', 'services', 'workloads']);
const DETAIL_HEALTH_KINDS = new Set<ResourceKind>(['application', 'namespace', 'service', 'workload']);

type HealthMap = Map<string, Record<string, Health>>;

export type PromptHealth = {
  resourceHealthStatus?: HealthStatusId;
  unhealthyResources: UnhealthyResource[];
};

const collectUnhealthyResources = (healthMap: HealthMap, kind: UnhealthyResource['kind']): UnhealthyResource[] => {
  const resources: UnhealthyResource[] = [];

  healthMap.forEach((items, namespace) => {
    Object.entries(items).forEach(([name, health]) => {
      const status = health.getStatus();
      if (UNHEALTHY_STATUSES.has(status)) {
        resources.push({
          kind,
          name,
          namespace,
          status: status.id as UnhealthyResource['status']
        });
      }
    });
  });

  return resources;
};

const sortBySeverity = (resources: UnhealthyResource[]): UnhealthyResource[] =>
  [...resources].sort((a, b) => {
    const priority = (status: UnhealthyResource['status']): number => {
      switch (status) {
        case 'Failure':
          return 3;
        case 'Degraded':
          return 2;
        case 'Not Ready':
          return 1;
        default:
          return 0;
      }
    };

    return priority(b.status) - priority(a.status);
  });

const readResourceHealth = (healthMap: HealthMap, namespace: string, name: string): HealthStatusId | undefined => {
  const status = healthMap.get(namespace)?.[name]?.getStatus().id;
  return status && status !== 'NA' ? (status as HealthStatusId) : undefined;
};

const fetchListHealth = async (
  resourceKind: ResourceKind,
  namespaces: string,
  duration: number,
  clusterName?: string
): Promise<UnhealthyResource[]> => {
  switch (resourceKind) {
    case 'services': {
      const healthMap = await API.getClustersServiceHealth(namespaces, duration, clusterName);
      return collectUnhealthyResources(healthMap, 'service');
    }
    case 'applications': {
      const healthMap = await API.getClustersAppHealth(namespaces, duration, clusterName);
      return collectUnhealthyResources(healthMap, 'application');
    }
    case 'workloads': {
      const healthMap = await API.getClustersWorkloadHealth(namespaces, duration, clusterName);
      return collectUnhealthyResources(healthMap, 'workload');
    }
    default:
      return [];
  }
};

const fetchDetailHealth = async (ctx: PromptContext, duration: number): Promise<HealthStatusId | undefined> => {
  const namespace = ctx.resourceKind === 'namespace' ? ctx.resourceName : ctx.namespace;
  if (!namespace) {
    return undefined;
  }

  if (ctx.resourceKind === 'namespace') {
    const healthMap = await API.getClustersHealth(namespace, duration, ctx.clusterName);
    const worstStatus = healthMap.get(namespace)?.worstStatus;
    return worstStatus && worstStatus !== 'NA' ? (worstStatus as HealthStatusId) : undefined;
  }

  if (!ctx.resourceName) {
    return undefined;
  }

  switch (ctx.resourceKind) {
    case 'service': {
      const healthMap = await API.getClustersServiceHealth(namespace, duration, ctx.clusterName);
      return readResourceHealth(healthMap, namespace, ctx.resourceName);
    }
    case 'application': {
      const healthMap = await API.getClustersAppHealth(namespace, duration, ctx.clusterName);
      return readResourceHealth(healthMap, namespace, ctx.resourceName);
    }
    case 'workload': {
      const healthMap = await API.getClustersWorkloadHealth(namespace, duration, ctx.clusterName);
      return readResourceHealth(healthMap, namespace, ctx.resourceName);
    }
    default:
      return undefined;
  }
};

export const usePromptHealth = (ctx: PromptContext | undefined): PromptHealth => {
  const activeNamespaces = useSelector(activeNamespacesSelector);
  const [promptHealth, setPromptHealth] = React.useState<PromptHealth | undefined>(undefined);

  React.useEffect(() => {
    if (!ctx) {
      return;
    }

    let cancelled = false;
    const duration = healthComputeDurationValidSeconds();

    const loadHealth = async (): Promise<PromptHealth> => {
      if (ctx.isDetailView && DETAIL_HEALTH_KINDS.has(ctx.resourceKind)) {
        return {
          resourceHealthStatus: await fetchDetailHealth(ctx, duration),
          unhealthyResources: []
        };
      }

      if (!ctx.isDetailView && LIST_HEALTH_KINDS.has(ctx.resourceKind)) {
        const namespaces =
          ctx.namespaceList || (activeNamespaces.length > 0 ? namespacesToString(activeNamespaces) : '');

        if (!namespaces) {
          return { unhealthyResources: [] };
        }

        const unhealthyResources = sortBySeverity(
          await fetchListHealth(ctx.resourceKind, namespaces, duration, ctx.clusterName)
        ).slice(0, MAX_UNHEALTHY_PROMPTS);

        return { unhealthyResources };
      }

      return { unhealthyResources: [] };
    };

    loadHealth()
      .then(result => {
        if (!cancelled) {
          setPromptHealth(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPromptHealth({ unhealthyResources: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeNamespaces, ctx]);

  if (!ctx) {
    return { unhealthyResources: [] };
  }

  return promptHealth ?? { unhealthyResources: [] };
};
