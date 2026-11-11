import type { TroubleshootingIssue, TroubleshootingSubProblem } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';

export type PartitionedTroubleshootingIssues = {
  hidden: TroubleshootingIssue[];
  visible: TroubleshootingIssue[];
};

export type TroubleshootingListSummary = {
  critical: number;
  problems: number;
  subproblems: number;
  warning: number;
};

export type TroubleshootingSeverityFilter = 'all' | 'critical' | 'warning';

export type TroubleshootingGroupBy = 'category' | 'namespace' | 'severity';

export type ParsedTroubleshootingTarget = {
  badgeKey?: string;
  kind?: string;
  name: string;
  namespace?: string;
};

const KIND_TO_BADGE_KEY: Record<string, string> = {
  app: 'App',
  application: 'App',
  'argocd application': 'App',
  authorizationpolicy: 'AuthorizationPolicy',
  'control plane': 'Istio',
  daemonset: 'Workload',
  destinationrule: 'DestinationRule',
  envoyfilter: 'EnvoyFilter',
  gateway: 'Gateway',
  grafana: 'Grafana',
  grpcroute: 'GRPCRoute',
  httproute: 'HTTPRoute',
  inferencepool: 'K8sInferencePool',
  jaeger: 'TraceStore',
  k8sgateway: 'K8sGateway',
  k8sgrpcroute: 'K8sGRPCRoute',
  k8shttproute: 'K8sHTTPRoute',
  k8sinferencepool: 'K8sInferencePool',
  k8sreferencegrant: 'K8sReferenceGrant',
  k8stcproute: 'K8sTCPRoute',
  k8stlsroute: 'K8sTLSRoute',
  k8sudproute: 'K8sUDPRoute',
  namespace: 'Namespace',
  otel: 'TraceStore',
  peerauthentication: 'PeerAuthentication',
  perses: 'Perses',
  pod: 'Pod',
  prometheus: 'MetricStore',
  'prometheus (health metrics)': 'MetricStore',
  referencegrant: 'K8sReferenceGrant',
  requestauthentication: 'RequestAuthentication',
  service: 'Service',
  serviceentry: 'ServiceEntry',
  sidecar: 'Sidecar',
  tcproute: 'TCPRoute',
  telemetry: 'Telemetry',
  tempo: 'TraceStore',
  tlsroute: 'TLSRoute',
  trafficextension: 'TrafficExtension',
  udproute: 'K8sUDPRoute',
  virtualservice: 'VirtualService',
  wasmplugin: 'WasmPlugin',
  waypoint: 'Waypoint',
  workload: 'Workload',
  workloadentry: 'WorkloadEntry',
  workloadgroup: 'WorkloadGroup',
  zipkin: 'TraceStore',
  ztunnel: 'Ztunnel'
};

export const parseTroubleshootingTarget = (subProblem: TroubleshootingSubProblem): ParsedTroubleshootingTarget => {
  if (subProblem.istioObject) {
    const { kind, name, namespace } = subProblem.istioObject;
    return {
      badgeKey: KIND_TO_BADGE_KEY[kind.toLowerCase()] ?? kind,
      kind,
      name,
      namespace: namespace || undefined
    };
  }

  const raw = subProblem.target.trim();
  if (raw.includes('→')) {
    return {
      badgeKey: 'NetworkTraffic',
      name: raw
    };
  }

  let kindPart = '';
  let rest = raw;
  const colonIdx = raw.indexOf(':');
  if (colonIdx > 0) {
    kindPart = raw.slice(0, colonIdx).trim();
    rest = raw.slice(colonIdx + 1).trim();
  }

  const baseKind = kindPart.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const badgeKey = KIND_TO_BADGE_KEY[baseKind.toLowerCase()] ?? KIND_TO_BADGE_KEY[raw.toLowerCase()];

  if (baseKind.toLowerCase() === 'namespace') {
    const nsName = rest.replace(/\s*\([^)]*\)\s*$/, '').trim();
    return {
      badgeKey: 'Namespace',
      kind: 'Namespace',
      name: nsName,
      namespace: nsName
    };
  }

  const slashIdx = rest.indexOf('/');
  if (slashIdx > 0) {
    const ns = rest.slice(0, slashIdx).trim();
    const name = rest.slice(slashIdx + 1).trim();
    if (ns.toLowerCase() === 'ztunnel') {
      return {
        badgeKey: 'Ztunnel',
        kind: kindPart || 'Pod',
        name: rest
      };
    }
    return {
      badgeKey,
      kind: kindPart || undefined,
      name,
      namespace: ns
    };
  }

  if (rest.toLowerCase() === 'ztunnel') {
    return {
      badgeKey: 'Ztunnel',
      kind: kindPart || 'DaemonSet',
      name: rest
    };
  }

  return {
    badgeKey,
    kind: kindPart || undefined,
    name: rest
  };
};

const LONG_HEX_HASH_REGEX = /\b([0-9a-f]{12,64})\b/gi;

export const truncateLongHashes = (text: string): string =>
  text.replace(LONG_HEX_HASH_REGEX, match => `${match.slice(0, 8)}...`);

// Strips redundant `<Kind> "<name>" ` prefixes from subProblem.issue when the card header already displays the badge and name,
// and shortens long SHA hashes to 8 characters in the title.
export const cleanSubProblemIssueText = (
  subProblem: TroubleshootingSubProblem,
  parsed: ParsedTroubleshootingTarget
): string => {
  let issue = subProblem.issue.trim();
  if (parsed.name) {
    const candidates = [
      parsed.kind ? `${parsed.kind} "${parsed.name}" ` : '',
      parsed.kind ? `${parsed.kind} '${parsed.name}' ` : '',
      `"${parsed.name}" `
    ].filter(Boolean);

    for (const prefix of candidates) {
      if (issue.startsWith(prefix)) {
        issue = issue.slice(prefix.length).trim();
        break;
      }
    }
  }
  return truncateLongHashes(issue);
};

// Returns true when the impact text only repeats the object name/namespace validation failure already shown in the header and checks list.
export const isRedundantSubProblemImpact = (subProblem: TroubleshootingSubProblem): boolean => {
  const checks = subProblem.checks ?? [];
  if (checks.length > 0) {
    return true;
  }
  const impact = (subProblem.impact ?? '').trim();
  if (!impact) {
    return true;
  }
  if (
    /in namespace "[^"]+" (fails validation|is valid but has warning validation checks|was not validated|is not healthy)\.$/i.test(
      impact
    )
  ) {
    return true;
  }
  return false;
};

// A hidden parent id hides that problem and every subproblem.
// Otherwise a parent with both hidden and visible subproblems is copied into both lists.
// Parents with no subproblems stay visible unless their own id is hidden.
export const partitionTroubleshootingIssues = (
  issues: TroubleshootingIssue[],
  hiddenIds: readonly string[]
): PartitionedTroubleshootingIssues => {
  const hiddenSet = new Set(hiddenIds);
  const hidden: TroubleshootingIssue[] = [];
  const visible: TroubleshootingIssue[] = [];

  issues.forEach(issue => {
    if (hiddenSet.has(issue.id)) {
      hidden.push(issue);
      return;
    }

    const subProblems = issue.subProblems ?? [];
    if (subProblems.length === 0) {
      visible.push(issue);
      return;
    }

    const visibleSubs = subProblems.filter(subProblem => !hiddenSet.has(subProblem.id));
    const hiddenSubs = subProblems.filter(subProblem => hiddenSet.has(subProblem.id));
    if (visibleSubs.length > 0) {
      visible.push({ ...issue, subProblems: visibleSubs });
    }
    if (hiddenSubs.length > 0) {
      hidden.push({ ...issue, subProblems: hiddenSubs });
    }
  });

  return { hidden, visible };
};

export const summarizeTroubleshootingIssues = (issues: TroubleshootingIssue[]): TroubleshootingListSummary => {
  let critical = 0;
  let subproblems = 0;
  let warning = 0;

  issues.forEach(issue => {
    (issue.subProblems ?? []).forEach(subProblem => {
      subproblems += 1;
      if (subProblem.severity === 'critical') {
        critical += 1;
      } else if (subProblem.severity === 'warning') {
        warning += 1;
      }
    });
  });

  return { critical, problems: issues.length, subproblems, warning };
};

export const troubleshootingDetail = (summary: TroubleshootingListSummary): string => {
  const detected =
    summary.problems === 1 ? t('1 problem detected') : t('{{count}} problems detected', { count: summary.problems });
  const subproblems =
    summary.subproblems === 1 ? t('1 subproblem') : t('{{count}} subproblems', { count: summary.subproblems });

  return `${detected} (${subproblems}, ${t('{{count}} critical', { count: summary.critical })}, ${t('{{count}} warning', { count: summary.warning })})`;
};

export const troubleshootingDetectedTitle = (summary: TroubleshootingListSummary): string =>
  `${t('Troubleshooting')}: ${troubleshootingDetail(summary)}`;

export const hiddenProblemsTitle = (summary: TroubleshootingListSummary): string =>
  `${t('Hidden problems')}: ${troubleshootingDetail(summary)}`;

const matchesSubProblemSearch = (
  issue: TroubleshootingIssue,
  subProblem: TroubleshootingSubProblem,
  query: string
): boolean => {
  if (!query) {
    return true;
  }
  const parsed = parseTroubleshootingTarget(subProblem);
  const haystacks = [
    issue.problem,
    issue.category,
    subProblem.id,
    subProblem.target,
    subProblem.issue,
    subProblem.impact,
    parsed.name,
    parsed.namespace ?? '',
    parsed.kind ?? '',
    ...(subProblem.checks ?? []).flatMap(c => [c.code, c.message, c.path ?? ''])
  ];
  return haystacks.some(h => h.toLowerCase().includes(query));
};

export const filterAndGroupTroubleshootingIssues = (
  issues: TroubleshootingIssue[],
  options: {
    groupBy: TroubleshootingGroupBy;
    search: string;
    severityFilter: TroubleshootingSeverityFilter;
  }
): TroubleshootingIssue[] => {
  const query = options.search.trim().toLowerCase();
  const { groupBy, severityFilter } = options;

  const filteredIssues: TroubleshootingIssue[] = [];
  issues.forEach(issue => {
    const subProblems = issue.subProblems ?? [];
    if (subProblems.length === 0) {
      if (
        severityFilter === 'all' &&
        (!query || issue.problem.toLowerCase().includes(query) || issue.category.toLowerCase().includes(query))
      ) {
        filteredIssues.push(issue);
      }
      return;
    }

    const matchingSubs = subProblems.filter(sub => {
      if (severityFilter !== 'all' && sub.severity !== severityFilter) {
        return false;
      }
      return matchesSubProblemSearch(issue, sub, query);
    });

    if (matchingSubs.length > 0) {
      filteredIssues.push({ ...issue, subProblems: matchingSubs });
    }
  });

  if (groupBy === 'category') {
    return filteredIssues;
  }

  if (groupBy === 'severity') {
    const criticalSubs: TroubleshootingSubProblem[] = [];
    const warningSubs: TroubleshootingSubProblem[] = [];
    filteredIssues.forEach(issue => {
      (issue.subProblems ?? []).forEach(sub => {
        if (sub.severity === 'critical') {
          criticalSubs.push(sub);
        } else {
          warningSubs.push(sub);
        }
      });
    });

    const grouped: TroubleshootingIssue[] = [];
    if (criticalSubs.length > 0) {
      grouped.push({
        category: 'critical',
        id: 'group-severity-critical',
        problem: t('Critical issues'),
        subProblems: criticalSubs
      });
    }
    if (warningSubs.length > 0) {
      grouped.push({
        category: 'warning',
        id: 'group-severity-warning',
        problem: t('Warning issues'),
        subProblems: warningSubs
      });
    }
    return grouped;
  }

  // Group by namespace
  const byNamespace = new Map<string, TroubleshootingSubProblem[]>();
  filteredIssues.forEach(issue => {
    (issue.subProblems ?? []).forEach(sub => {
      const parsed = parseTroubleshootingTarget(sub);
      const ns = parsed.namespace || t('Mesh-wide');
      const list = byNamespace.get(ns) ?? [];
      list.push(sub);
      byNamespace.set(ns, list);
    });
  });

  return Array.from(byNamespace.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ns, subs]) => ({
      category: 'namespace',
      id: `group-ns-${ns}`,
      problem: ns === t('Mesh-wide') ? ns : `${t('Namespace')}: ${ns}`,
      subProblems: subs
    }));
};
