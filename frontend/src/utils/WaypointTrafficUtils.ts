import type { Namespace } from 'types/Namespace';
import type { GatewayWaypointTrafficSplitConfig, WaypointBinding, WaypointTrafficSplit } from 'types/WaypointTraffic';
import { t } from 'utils/I18nUtils';

export const enrichActiveNamespaces = (active: Namespace[], items?: Namespace[]): Namespace[] => {
  if (!items?.length) {
    return active;
  }
  return active.map(an => {
    const full = items.find(n => n.name === an.name && (!an.cluster || !n.cluster || n.cluster === an.cluster));
    return full ?? an;
  });
};

const gatewayMatchesNode = (binding: WaypointBinding, workload: string, workloadNamespace: string): boolean => {
  return binding.name === workload && binding.namespace === workloadNamespace;
};

const gatewaySplitScore = (split: WaypointTrafficSplit | undefined): number => {
  if (!split?.canary) {
    return split ? 1 : 0;
  }
  return split.canaryWeight > 0 ? 3 : 2;
};

export const WAYPOINT_MULTIPLE_SPLITS_LABEL = 'Multiple traffic splits';

export const pickBestGatewayWaypointSplit = (splits: WaypointTrafficSplit[]): WaypointTrafficSplit | undefined => {
  if (!splits.length) {
    return undefined;
  }
  return [...splits].sort((a, b) => {
    const scoreDiff = gatewaySplitScore(b) - gatewaySplitScore(a);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return (a.configLevel ?? '').localeCompare(b.configLevel ?? '');
  })[0];
};

/** Find a canary split that references this waypoint gateway (primary or canary). */
export const findGatewayWaypointSplit = (
  namespaces: Namespace[],
  gatewayName: string,
  gatewayNamespace: string,
  cluster?: string
): WaypointTrafficSplit | undefined => {
  const matches: WaypointTrafficSplit[] = [];
  const sorted = [...namespaces].sort((a, b) => a.name.localeCompare(b.name));
  for (const ns of sorted) {
    if (cluster && ns.cluster && ns.cluster !== cluster) {
      continue;
    }
    const split = ns.waypointTrafficSplit;
    if (!split?.canary) {
      continue;
    }
    if (gatewayMatchesNode(split.primary, gatewayName, gatewayNamespace)) {
      matches.push(split);
      continue;
    }
    if (gatewayMatchesNode(split.canary, gatewayName, gatewayNamespace)) {
      matches.push(split);
    }
  }
  return pickBestGatewayWaypointSplit(matches);
};

/** Namespace-derived configs that reference a waypoint gateway (graph fallback when the backend label is absent). */
export const findGatewayWaypointSplitConfigsFromNamespaces = (
  namespaces: Namespace[],
  gatewayName: string,
  gatewayNamespace: string,
  cluster?: string
): GatewayWaypointTrafficSplitConfig[] => {
  const configs: GatewayWaypointTrafficSplitConfig[] = [];
  const sorted = [...namespaces].sort((a, b) => a.name.localeCompare(b.name));
  for (const ns of sorted) {
    if (cluster && ns.cluster && ns.cluster !== cluster) {
      continue;
    }
    const split = ns.waypointTrafficSplit;
    if (!split?.canary) {
      continue;
    }
    if (
      gatewayMatchesNode(split.primary, gatewayName, gatewayNamespace) ||
      gatewayMatchesNode(split.canary, gatewayName, gatewayNamespace)
    ) {
      configs.push({ configLevel: 'namespace', namespace: ns.name, split });
    }
  }
  return configs;
};

export const gatewayWaypointGraphCanaryLabel = (
  configs: GatewayWaypointTrafficSplitConfig[],
  workload: string,
  workloadNamespace: string,
  includeWeight: boolean
): string | undefined => {
  const lines: string[] = [];
  for (const cfg of configs) {
    const line = waypointNodeCanaryBadge(workload, workloadNamespace, cfg.split, includeWeight);
    if (line) {
      lines.push(line);
    }
  }
  if (lines.length === 0) {
    return undefined;
  }
  if (lines.length > 1) {
    return t(WAYPOINT_MULTIPLE_SPLITS_LABEL);
  }
  return lines[0];
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
    return includeWeight ? t('Canary {{weight}}%', { weight: split.canaryWeight }) : t('Canary');
  }
  if (gatewayMatchesNode(split.primary, workload, workloadNamespace)) {
    return includeWeight ? t('Primary {{weight}}%', { weight: split.primaryWeight }) : t('Primary');
  }
  return undefined;
};

/** Enrolled-resource role column: "Canary (30%)" / "Primary (70%)". */
export const formatEnrolledWaypointRoleLabel = (waypointRole: string | undefined, roleWeight?: number): string => {
  if (roleWeight === undefined || roleWeight < 0 || !waypointRole) {
    return '';
  }
  if (waypointRole === 'canary') {
    return `${t('Canary')} (${roleWeight}%)`;
  }
  if (waypointRole === 'primary') {
    return `${t('Primary')} (${roleWeight}%)`;
  }
  return '';
};

/**
 * Workload details "Waypoint" field: show "true", or role+weight when this gateway participates in a canary split.
 */
export const formatWaypointGatewayDetailLabel = (
  workload: string,
  workloadNamespace: string,
  configs?: GatewayWaypointTrafficSplitConfig[]
): string | undefined => {
  const withCanary = (configs ?? []).filter(cfg => !!cfg.split?.canary);
  if (withCanary.length > 1) {
    return t('Multiple configurations ({{count}})', { count: withCanary.length });
  }
  const split = withCanary.length === 1 ? withCanary[0].split : undefined;
  if (!split?.canary) {
    return undefined;
  }
  if (gatewayMatchesNode(split.canary, workload, workloadNamespace)) {
    return formatEnrolledWaypointRoleLabel('canary', split.canaryWeight);
  }
  if (gatewayMatchesNode(split.primary, workload, workloadNamespace)) {
    return formatEnrolledWaypointRoleLabel('primary', split.primaryWeight);
  }
  return undefined;
};

const backendRoleLabel = (label: string, includeWeight: boolean): string | undefined => {
  const canary = label.match(/^Canary(?: (\d+)%)?$/) ?? label.match(/^Waypoint role canary(?: (\d+)%)?$/);
  if (canary) {
    return includeWeight && canary[1] ? t('Canary {{weight}}%', { weight: Number(canary[1]) }) : t('Canary');
  }
  const primary = label.match(/^Primary(?: (\d+)%)?$/) ?? label.match(/^Waypoint role primary(?: (\d+)%)?$/);
  if (primary) {
    return includeWeight && primary[1] ? t('Primary {{weight}}%', { weight: Number(primary[1]) }) : t('Primary');
  }
  return undefined;
};

/** Backend may bake the weight into waypointCanaryLabel; strip it when Traffic Distribution is off. */
export const formatWaypointCanaryLabel = (label: string, includeWeight: boolean): string => {
  if (label === WAYPOINT_MULTIPLE_SPLITS_LABEL) {
    return t(WAYPOINT_MULTIPLE_SPLITS_LABEL);
  }
  const translated = backendRoleLabel(label, includeWeight);
  if (translated) {
    return translated;
  }
  return includeWeight ? label : label.replace(/\s+\d+%$/, '');
};

type WaypointCanaryLabelOptions = {
  backendLabel?: string;
  includeWeight?: boolean;
  secondaryLabel?: string;
  split?: WaypointTrafficSplit;
  splitConfigs?: GatewayWaypointTrafficSplitConfig[];
  workload: string;
  workloadNamespace: string;
};

/**
 * Builds the secondary label for a waypoint topology node, appending Primary/Canary
 * (optionally with weight) without duplicating on re-render.
 */
export const withWaypointCanarySecondaryLabel = (options: WaypointCanaryLabelOptions): string | undefined => {
  const includeWeight = options.includeWeight ?? false;
  // The backend resolves Service overrides; namespace configuration is only a fallback.
  const canaryLine = options.backendLabel
    ? formatWaypointCanaryLabel(options.backendLabel, includeWeight)
    : options.splitConfigs && options.splitConfigs.length > 0
      ? gatewayWaypointGraphCanaryLabel(
          options.splitConfigs,
          options.workload,
          options.workloadNamespace,
          includeWeight
        )
      : waypointNodeCanaryBadge(options.workload, options.workloadNamespace, options.split, includeWeight);
  if (!canaryLine) {
    return options.secondaryLabel;
  }
  return options.secondaryLabel ? `${options.secondaryLabel} · ${canaryLine}` : canaryLine;
};
