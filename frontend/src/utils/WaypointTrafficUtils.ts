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
export const WAYPOINT_MULTI_WEIGHT_GRAPH_LABEL = 'multi-%';

const formatWaypointRoleWeightGraphLabel = (role: 'canary' | 'primary', weight: number): string => {
  return `${role} (${weight}%)`;
};

const inferWaypointGraphRoleFromWorkload = (workload: string): 'canary' | 'primary' =>
  /canary/i.test(workload) ? 'canary' : 'primary';

/** Secondary label when several splits reference the same gateway (always role-prefixed, e.g. canary (multi-%)). */
export const formatWaypointMultiWeightGraphLabel = (
  role: 'canary' | 'primary' | undefined,
  workload?: string
): string => {
  const multi = `(${WAYPOINT_MULTI_WEIGHT_GRAPH_LABEL})`;
  const resolved = role ?? (workload ? inferWaypointGraphRoleFromWorkload(workload) : 'primary');
  return `${resolved} ${multi}`;
};

const gatewayWaypointGraphRole = (
  configs: GatewayWaypointTrafficSplitConfig[],
  workload: string,
  workloadNamespace: string
): 'canary' | 'primary' | undefined => {
  for (const cfg of configs) {
    const role = waypointNodeCanaryBadge(workload, workloadNamespace, cfg.split, false);
    if (role === 'canary' || role === 'primary') {
      return role;
    }
  }
  return undefined;
};

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
  const uniqueLines = [...new Set(lines)];
  if (uniqueLines.length > 1) {
    return includeWeight
      ? formatWaypointMultiWeightGraphLabel(gatewayWaypointGraphRole(configs, workload, workloadNamespace), workload)
      : uniqueLines[0];
  }
  return uniqueLines[0];
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
    return includeWeight ? formatWaypointRoleWeightGraphLabel('canary', split.canaryWeight) : 'canary';
  }
  if (gatewayMatchesNode(split.primary, workload, workloadNamespace)) {
    return includeWeight ? formatWaypointRoleWeightGraphLabel('primary', split.primaryWeight) : 'primary';
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
  const canary = label.match(/^Canary(?: (\d+)%)?$/i) ?? label.match(/^Waypoint role canary(?: (\d+)%)?$/i);
  if (canary) {
    return includeWeight && canary[1] ? formatWaypointRoleWeightGraphLabel('canary', Number(canary[1])) : 'canary';
  }
  const primary = label.match(/^Primary(?: (\d+)%)?$/i) ?? label.match(/^Waypoint role primary(?: (\d+)%)?$/i);
  if (primary) {
    return includeWeight && primary[1] ? formatWaypointRoleWeightGraphLabel('primary', Number(primary[1])) : 'primary';
  }
  return undefined;
};

/** Backend may bake the weight into waypointCanaryLabel; strip it when Traffic Distribution is off. */
export const formatWaypointCanaryLabel = (label: string, includeWeight: boolean): string => {
  if (label === WAYPOINT_MULTIPLE_SPLITS_LABEL) {
    return label;
  }
  const translated = backendRoleLabel(label, includeWeight);
  if (translated) {
    return translated;
  }
  return includeWeight ? label : label.replace(/\s+\d+%$/, '').replace(/\s*\(\d+%\)$/, '');
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
  const backendIsAggregate = options.backendLabel === WAYPOINT_MULTIPLE_SPLITS_LABEL;
  const canaryLine =
    options.backendLabel && !backendIsAggregate
      ? formatWaypointCanaryLabel(options.backendLabel, includeWeight)
      : backendIsAggregate && includeWeight
        ? formatWaypointMultiWeightGraphLabel(
            options.splitConfigs
              ? gatewayWaypointGraphRole(options.splitConfigs, options.workload, options.workloadNamespace)
              : (waypointNodeCanaryBadge(options.workload, options.workloadNamespace, options.split, false) as
                  'canary' | 'primary' | undefined),
            options.workload
          )
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

export type WaypointTrafficSplitSlice = {
  cluster?: string;
  role: 'canary' | 'primary';
  share: number;
  workloadName: string;
  workloadNamespace: string;
};

/** Primary and canary rows for split table / donut chart. */
export const buildWaypointTrafficSplitSlices = (split: WaypointTrafficSplit): WaypointTrafficSplitSlice[] => {
  const primary = split.primary;
  const canary = split.canary!;
  return [
    {
      cluster: primary.cluster,
      role: 'primary',
      share: split.primaryWeight,
      workloadName: primary.name,
      workloadNamespace: primary.namespace
    },
    {
      cluster: canary.cluster,
      role: 'canary',
      share: split.canaryWeight,
      workloadName: canary.name,
      workloadNamespace: canary.namespace
    }
  ];
};

export const isViewingWaypointSlice = (
  slice: WaypointTrafficSplitSlice,
  viewingWorkload: string,
  viewingNamespace: string,
  viewingCluster?: string
): boolean => {
  return (
    slice.workloadName === viewingWorkload &&
    slice.workloadNamespace === viewingNamespace &&
    (!viewingCluster || !slice.cluster || slice.cluster === viewingCluster)
  );
};
