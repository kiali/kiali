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

/** Find a canary split that references this waypoint gateway (primary or canary). */
export const findGatewayWaypointSplit = (
  namespaces: Namespace[],
  gatewayName: string,
  gatewayNamespace: string,
  cluster?: string
): WaypointTrafficSplit | undefined => {
  for (const ns of namespaces) {
    if (cluster && ns.cluster && ns.cluster !== cluster) {
      continue;
    }
    const split = ns.waypointTrafficSplit;
    if (!split?.canary) {
      continue;
    }
    if (gatewayMatchesNode(split.primary, gatewayName, gatewayNamespace)) {
      return split;
    }
    if (gatewayMatchesNode(split.canary, gatewayName, gatewayNamespace)) {
      return split;
    }
  }
  return undefined;
};

const gatewayMatchesNode = (binding: WaypointBinding, workload: string, workloadNamespace: string): boolean => {
  return binding.name === workload && binding.namespace === workloadNamespace;
};

/** Label text for PatternFly topology badge under waypoint node labels. */
export const waypointNodeCanaryBadge = (
  workload: string,
  workloadNamespace: string,
  split: WaypointTrafficSplit | undefined,
  includeWeight = false
): string | undefined => {
  if (!split?.canary) {
    return undefined;
  }
  if (gatewayMatchesNode(split.canary, workload, workloadNamespace)) {
    return includeWeight ? `Canary ${split.canaryWeight}%` : 'Canary';
  }
  if (gatewayMatchesNode(split.primary, workload, workloadNamespace)) {
    return includeWeight ? `Primary ${split.primaryWeight}%` : 'Primary';
  }
  return undefined;
};

/** Backend may bake the weight into waypointCanaryLabel; strip it when Traffic Distribution is off. */
export const formatWaypointCanaryLabel = (label: string, includeWeight: boolean): string => {
  return includeWeight ? label : label.replace(/\s+\d+%$/, '');
};

type WaypointCanaryLabelOptions = {
  backendLabel?: string;
  includeWeight?: boolean;
  secondaryLabel?: string;
  split?: WaypointTrafficSplit;
  workload: string;
  workloadNamespace: string;
};

/**
 * Builds the secondary label for a waypoint topology node, appending Primary/Canary
 * (optionally with weight) without duplicating on re-render.
 */
export const withWaypointCanarySecondaryLabel = (options: WaypointCanaryLabelOptions): string | undefined => {
  const includeWeight = options.includeWeight ?? false;
  let canaryLine = waypointNodeCanaryBadge(options.workload, options.workloadNamespace, options.split, includeWeight);
  if (!canaryLine && options.backendLabel) {
    canaryLine = formatWaypointCanaryLabel(options.backendLabel, includeWeight);
  }
  if (!canaryLine) {
    return options.secondaryLabel;
  }
  return options.secondaryLabel ? `${options.secondaryLabel} · ${canaryLine}` : canaryLine;
};
