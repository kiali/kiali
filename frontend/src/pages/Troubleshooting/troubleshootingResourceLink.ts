import { URLParam } from 'app/History';
import { GetIstioObjectUrl } from 'components/Link/IstioObjectLink';
import { getServiceURL } from 'components/Link/ServiceLink';
import { getWorkloadLink } from 'components/Link/WorkloadLink';
import { Paths } from 'config';
import type { TroubleshootingSubProblem } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';
import type { ParsedTroubleshootingTarget } from './partitionTroubleshooting';

export type TroubleshootingResourceLink = {
  dataTest: string;
  label: string;
  to: string;
};

const applicationLink = (name: string, namespace: string): string =>
  `/namespaces/${namespace}/${Paths.APPLICATIONS}/${name}`;

const namespaceLink = (namespace: string): string => `/namespaces/${namespace}`;

/** Mesh page with Kiali infra nodes shown (observability stack context). */
const observabilityMeshLink = (): string => `/${Paths.MESH}?${URLParam.MESH_KIALI}=true`;

const OBSERVABILITY_BADGE_KEYS = new Set(['Grafana', 'MetricStore', 'Perses', 'TraceStore']);

/**
 * Resolves a Kiali details-page link for a troubleshooting subproblem target.
 * Istio objects use the existing config URL; Workload / Service / Application /
 * Namespace use their entity pages; observability stack targets open Mesh with
 * Kiali nodes enabled. Other kinds return undefined until supported.
 */
export const getTroubleshootingResourceLink = (
  subProblem: TroubleshootingSubProblem,
  parsed: ParsedTroubleshootingTarget
): TroubleshootingResourceLink | undefined => {
  if (subProblem.istioObject) {
    const { group, kind, name, namespace, version } = subProblem.istioObject;
    return {
      dataTest: 'ai-troubleshooting-view-resource',
      label: t('View IstioObject'),
      to: GetIstioObjectUrl(name, namespace, { Group: group, Kind: kind, Version: version })
    };
  }

  const { badgeKey, name, namespace } = parsed;
  if (!badgeKey || !name) {
    return undefined;
  }

  if (OBSERVABILITY_BADGE_KEYS.has(badgeKey)) {
    return {
      dataTest: 'ai-troubleshooting-view-resource',
      label: t('View Mesh'),
      to: observabilityMeshLink()
    };
  }

  switch (badgeKey) {
    case 'Workload':
      if (!namespace) {
        return undefined;
      }
      return {
        dataTest: 'ai-troubleshooting-view-resource',
        label: t('View Workload'),
        to: getWorkloadLink(name, namespace)
      };
    case 'Service':
      if (!namespace) {
        return undefined;
      }
      return {
        dataTest: 'ai-troubleshooting-view-resource',
        label: t('View Service'),
        to: getServiceURL(name, namespace)
      };
    case 'App':
      if (!namespace) {
        return undefined;
      }
      return {
        dataTest: 'ai-troubleshooting-view-resource',
        label: t('View Application'),
        to: applicationLink(name, namespace)
      };
    case 'Namespace':
      return {
        dataTest: 'ai-troubleshooting-view-resource',
        label: t('View Namespace'),
        to: namespaceLink(name)
      };
    default:
      return undefined;
  }
};
