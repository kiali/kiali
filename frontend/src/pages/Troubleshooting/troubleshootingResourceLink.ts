import { URLParam } from 'app/History';
import { GetIstioObjectUrl } from 'components/Link/IstioObjectLink';
import { getServiceURL } from 'components/Link/ServiceLink';
import { getWorkloadLink } from 'components/Link/WorkloadLink';
import { config, Paths } from 'config';
import type { TroubleshootingIssue, TroubleshootingSubProblem } from 'types/Chatbot';
import { DefaultTrafficRates, GraphLayout, GraphType } from 'types/Graph';
import { t } from 'utils/I18nUtils';
import { isOSSMC, OSSM_CONSOLE } from 'utils/NavigationUtils';
import type { ParsedTroubleshootingTarget } from './partitionTroubleshooting';
import { parseTroubleshootingTarget } from './partitionTroubleshooting';

export type TroubleshootingResourceLink = {
  dataTest: string;
  label: string;
  to: string;
};

export type TroubleshootingLinkOptions = {
  duration?: number;
  isOssmc?: boolean;
  refresh?: number;
};

const KIND_TO_K8S_RESOURCE: Record<string, string> = {
  CronJob: 'cronjobs',
  DaemonSet: 'daemonsets',
  Deployment: 'deployments',
  DeploymentConfig: 'deploymentconfigs',
  Job: 'jobs',
  Pod: 'pods',
  ReplicaSet: 'replicasets',
  StatefulSet: 'statefulsets'
};

const GRAPH_NODE_BADGES = new Set(['App', 'Namespace', 'NetworkTraffic', 'Pod', 'Service', 'Workload']);
const OBSERVABILITY_BADGE_KEYS = new Set(['Grafana', 'MetricStore', 'Perses', 'TraceStore']);
const UNHEALTHY_STATUS = /\b(UNHEALTHY|DEGRADED|NOT_READY|FAILING)\b/i;

const timeValues = (options?: TroubleshootingLinkOptions): { duration: number; refresh: number } => ({
  duration: options?.duration ?? config.toolbar.defaultDuration,
  refresh: options?.refresh ?? config.toolbar.defaultRefreshInterval
});

const appendQuery = (path: string, extra: Record<string, string | number | undefined>): string => {
  const queryIndex = path.indexOf('?');
  const base = queryIndex === -1 ? path : path.slice(0, queryIndex);
  const params = new URLSearchParams(queryIndex === -1 ? '' : path.slice(queryIndex + 1));
  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  const query = params.toString();
  return query ? `${base}?${query}` : base;
};

const withTimeParams = (path: string, options?: TroubleshootingLinkOptions): string => {
  const { duration, refresh } = timeValues(options);
  return appendQuery(path, { [URLParam.DURATION]: duration, [URLParam.REFRESH_INTERVAL]: refresh });
};

const applicationLink = (name: string, namespace: string, options?: TroubleshootingLinkOptions): string =>
  withTimeParams(`/namespaces/${namespace}/${Paths.APPLICATIONS}/${name}`, options);

const namespaceLink = (namespace: string, options?: TroubleshootingLinkOptions): string =>
  withTimeParams(`/namespaces/${namespace}`, options);

const observabilityMeshLink = (options?: TroubleshootingLinkOptions): string =>
  withTimeParams(`/${Paths.MESH}?${URLParam.MESH_KIALI}=true&${URLParam.MESH_LAYOUT}=${GraphLayout.Dagre}`, options);

const namespaceGraphLink = (namespace: string, options?: TroubleshootingLinkOptions): string => {
  const { duration, refresh } = timeValues(options);
  return appendQuery('/graph/namespaces', {
    [URLParam.GRAPH_TRAFFIC]: DefaultTrafficRates.join(','),
    [URLParam.GRAPH_TYPE]: GraphType.VERSIONED_APP,
    [URLParam.NAMESPACES]: namespace,
    [URLParam.DURATION]: duration,
    [URLParam.REFRESH_INTERVAL]: refresh,
    [URLParam.GRAPH_LAYOUT]: GraphLayout.Dagre
  });
};

const inOssmc = (options?: TroubleshootingLinkOptions): boolean => options?.isOssmc ?? isOSSMC();

/**
 * Maps a standalone Kiali path to the OpenShift Console URL used by OSSMC.
 * Mirrors plugin `resolveConsoleUrl` for the troubleshooting destinations.
 */
export const toOssmcConsoleUrl = (kialiUrl: string): string => {
  const queryIndex = kialiUrl.indexOf('?');
  const path = queryIndex > -1 ? kialiUrl.slice(0, queryIndex) : kialiUrl;
  const urlParams = new URLSearchParams(queryIndex > -1 ? kialiUrl.slice(queryIndex + 1) : '');

  const withParams = (nextPath: string, params: URLSearchParams = urlParams): string => {
    if (nextPath.startsWith('/k8s/')) {
      params.delete(URLParam.DURATION);
      params.delete(URLParam.REFRESH_INTERVAL);
      params.delete('type');
    }
    const query = params.toString();
    return query ? `${nextPath}?${query}` : nextPath;
  };

  if (path.startsWith('/graph/namespaces') || path === '/graph') {
    return withParams(`/${OSSM_CONSOLE}/graph`);
  }
  if (path.startsWith('/mesh')) {
    return withParams(path.replace(/^\/mesh/, `/${OSSM_CONSOLE}/mesh`));
  }
  if (path.startsWith('/overview')) {
    return withParams(path.replace(/^\/overview/, `/${OSSM_CONSOLE}/overview`));
  }
  if (path.startsWith('/applications')) {
    return withParams(path.replace(/^\/applications/, `/${OSSM_CONSOLE}/applications`));
  }

  const nsMatch = path.match(/^\/namespaces\/([^/]+)(?:\/(.*))?$/);
  if (!nsMatch) {
    return kialiUrl;
  }

  const namespace = nsMatch[1];
  const rest = nsMatch[2] ?? '';

  if (rest.startsWith('applications/')) {
    const application = rest.slice('applications/'.length);
    if (!application) {
      return `/${OSSM_CONSOLE}/applications?namespaces=${namespace}`;
    }
    return withParams(`/${OSSM_CONSOLE}/applications/${namespace}/${application}`);
  }

  if (rest.startsWith('workloads/')) {
    const workload = rest.slice('workloads/'.length);
    if (!workload) {
      return `/${OSSM_CONSOLE}/workloads?namespaces=${namespace}`;
    }
    const kind = urlParams.get('type') ?? 'Deployment';
    const k8sResource = KIND_TO_K8S_RESOURCE[kind] ?? 'deployments';
    urlParams.delete('type');
    return withParams(`/k8s/ns/${namespace}/${k8sResource}/${workload}/${OSSM_CONSOLE}`, urlParams);
  }

  if (rest.startsWith('services/')) {
    const service = rest.slice('services/'.length);
    if (!service) {
      return `/${OSSM_CONSOLE}/services?namespaces=${namespace}`;
    }
    return withParams(`/k8s/ns/${namespace}/services/${service}/${OSSM_CONSOLE}`);
  }

  if (rest.startsWith('istio/')) {
    const parts = rest.split('/');
    if (parts.length >= 5) {
      const [, group, version, kind, name] = parts;
      return withParams(`/k8s/ns/${namespace}/${group}~${version}~${kind}/${name}/${OSSM_CONSOLE}`);
    }
    return `/${OSSM_CONSOLE}/istio`;
  }

  if (!rest) {
    return `/k8s/cluster/projects/${namespace}/${OSSM_CONSOLE}`;
  }

  return kialiUrl;
};

const localizeUrl = (kialiUrl: string, options?: TroubleshootingLinkOptions): string =>
  inOssmc(options) ? toOssmcConsoleUrl(kialiUrl) : kialiUrl;

const isMeshWide = (namespace: string): boolean => namespace === t('Mesh-wide') || namespace === 'Mesh-wide';

export const getTroubleshootingIssueNamespace = (issue: TroubleshootingIssue): string | undefined => {
  if (issue.id.startsWith('group-ns-')) {
    const ns = issue.id.slice('group-ns-'.length);
    return ns && !isMeshWide(ns) ? ns : undefined;
  }

  const quoted = issue.problem.match(/Namespace ["']([^"']+)["']/);
  if (quoted?.[1]) {
    return quoted[1];
  }

  const labeled = issue.problem.match(/^Namespace:\s+(.+)$/);
  if (labeled?.[1] && !isMeshWide(labeled[1])) {
    return labeled[1];
  }

  const namespaces = new Set(
    (issue.subProblems ?? [])
      .map(sub => parseTroubleshootingTarget(sub).namespace)
      .filter((ns): ns is string => Boolean(ns))
  );
  return namespaces.size === 1 ? [...namespaces][0] : undefined;
};

const issueHasGraphNodes = (issue: TroubleshootingIssue): boolean => {
  if (UNHEALTHY_STATUS.test(issue.problem) || UNHEALTHY_STATUS.test(issue.description ?? '')) {
    return true;
  }
  return (issue.subProblems ?? []).some(sub => {
    const badgeKey = parseTroubleshootingTarget(sub).badgeKey;
    return Boolean(badgeKey && GRAPH_NODE_BADGES.has(badgeKey));
  });
};

const isObservabilityIssue = (issue: TroubleshootingIssue): boolean => {
  if (issue.category === 'observability_stack') {
    return true;
  }
  return (issue.subProblems ?? []).some(sub => {
    const badgeKey = parseTroubleshootingTarget(sub).badgeKey;
    return Boolean(badgeKey && OBSERVABILITY_BADGE_KEYS.has(badgeKey));
  });
};

const viewMeshLink = (options?: TroubleshootingLinkOptions): TroubleshootingResourceLink => ({
  dataTest: 'ai-troubleshooting-view-mesh',
  label: t('View Mesh'),
  to: localizeUrl(observabilityMeshLink(options), options)
});

/**
 * Parent-problem links: View Mesh for the observability stack, namespace
 * details when the issue is scoped to one namespace, plus Check graph when
 * that namespace has unhealthy graph nodes.
 */
export const getTroubleshootingIssueLinks = (
  issue: TroubleshootingIssue,
  options?: TroubleshootingLinkOptions
): TroubleshootingResourceLink[] => {
  if (issue.category === 'observability_stack') {
    return [viewMeshLink(options)];
  }

  const links: TroubleshootingResourceLink[] = [];
  if (isObservabilityIssue(issue)) {
    links.push(viewMeshLink(options));
  }

  const namespace = getTroubleshootingIssueNamespace(issue);
  if (!namespace) {
    return links;
  }

  links.push({
    dataTest: 'ai-troubleshooting-view-namespace',
    label: t('View Namespace'),
    to: localizeUrl(namespaceLink(namespace, options), options)
  });

  if (issueHasGraphNodes(issue)) {
    links.push({
      dataTest: 'ai-troubleshooting-check-graph',
      label: t('Check graph'),
      to: localizeUrl(namespaceGraphLink(namespace, options), options)
    });
  }

  return links;
};

/**
 * Resolves a details-page link for a troubleshooting subproblem target.
 * Paths are Kiali routes, rewritten for OSSMC when running in the plugin.
 */
export const getTroubleshootingResourceLink = (
  subProblem: TroubleshootingSubProblem,
  parsed: ParsedTroubleshootingTarget,
  options?: TroubleshootingLinkOptions
): TroubleshootingResourceLink | undefined => {
  if (subProblem.istioObject) {
    const { group, kind, name, namespace, version } = subProblem.istioObject;
    return {
      dataTest: 'ai-troubleshooting-view-resource',
      label: t('View IstioObject'),
      to: localizeUrl(GetIstioObjectUrl(name, namespace, { Group: group, Kind: kind, Version: version }), options)
    };
  }

  const { badgeKey, k8sKind, name, namespace } = parsed;
  if (!badgeKey || !name) {
    return undefined;
  }

  switch (badgeKey) {
    case 'Workload':
    case 'Pod': {
      if (!namespace) {
        return undefined;
      }
      const type = k8sKind ?? (badgeKey === 'Pod' ? 'Pod' : undefined);
      const href = getWorkloadLink(name, namespace, undefined, type ? `type=${encodeURIComponent(type)}` : undefined);
      return {
        dataTest: 'ai-troubleshooting-view-resource',
        label: badgeKey === 'Pod' ? t('View Pod') : t('View Workload'),
        to: localizeUrl(withTimeParams(href, options), options)
      };
    }
    case 'Service':
      if (!namespace) {
        return undefined;
      }
      return {
        dataTest: 'ai-troubleshooting-view-resource',
        label: t('View Service'),
        to: localizeUrl(withTimeParams(getServiceURL(name, namespace), options), options)
      };
    case 'App':
      if (!namespace) {
        return undefined;
      }
      return {
        dataTest: 'ai-troubleshooting-view-resource',
        label: t('View Application'),
        to: localizeUrl(applicationLink(name, namespace, options), options)
      };
    case 'Namespace':
      return {
        dataTest: 'ai-troubleshooting-view-resource',
        label: t('View Namespace'),
        to: localizeUrl(namespaceLink(name, options), options)
      };
    default:
      return undefined;
  }
};
