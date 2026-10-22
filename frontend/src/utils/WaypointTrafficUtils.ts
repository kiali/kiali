import type { Namespace } from 'types/Namespace';
import type { WaypointBinding, WaypointTrafficSplit } from 'types/WaypointTraffic';

export const enrichActiveNamespaces = (active: Namespace[], items?: Namespace[]): Namespace[] => {
  if (!items?.length) {
    return active;
  }
  return active.map(an => {
    const full = items.find(n => n.name === an.name && (!an.cluster || !n.cluster || n.cluster === an.cluster));
    return full ?? an;
  });
};

export const findNamespaceWaypointSplit = (
  namespaces: Namespace[],
  namespace: string,
  cluster?: string
): WaypointTrafficSplit | undefined => {
  const ns = namespaces.find(n => n.name === namespace && (!cluster || !n.cluster || n.cluster === cluster));
  return ns?.waypointTrafficSplit;
};

const gatewayMatchesNode = (binding: WaypointBinding, workload: string, workloadNamespace: string): boolean => {
  return binding.name === workload && binding.namespace === workloadNamespace;
};

/** Label text for PatternFly topology badge under waypoint node labels. */
export const waypointNodeCanaryBadge = (
  workload: string,
  workloadNamespace: string,
  split: WaypointTrafficSplit | undefined
): string | undefined => {
  if (!split?.canary) {
    return undefined;
  }
  if (gatewayMatchesNode(split.canary, workload, workloadNamespace)) {
    return `Canary ${split.canaryWeight}%`;
  }
  if (gatewayMatchesNode(split.primary, workload, workloadNamespace)) {
    return `Primary ${split.primaryWeight}%`;
  }
  return undefined;
};
