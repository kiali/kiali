import { store } from 'store/ConfigStore';
import * as API from 'services/Api';
import { addError } from 'utils/AlertUtils';
import { MessageType } from 'types/NotificationCenter';
import type { ExternalLink } from 'types/Dashboards';
import { ISTIO_ZTUNNEL_DASHBOARD } from 'types/Dashboards';
import type { GrafanaInfo } from 'types/GrafanaInfo';
import { ISTIO_DASHBOARDS, ISTIO_SERVICE_DASHBOARD, ISTIO_WORKLOAD_DASHBOARD } from 'types/GrafanaInfo';
import type { PersesInfo } from 'types/PersesInfo';
import { t } from 'utils/I18nUtils';
import { GrafanaLinks } from 'components/Metrics/GrafanaLinks';
import { buildPersesLinks } from 'components/Metrics/PersesLinks';
import type { MetricsObjectTypes } from 'types/Metrics';

export type IstioDashboardKind = 'app' | 'control-plane' | 'service' | 'workload' | 'ztunnel';
export type IstioDashboardTool = 'Grafana' | 'Perses';

export type IstioDashboardLoadOptions = {
  kind: IstioDashboardKind;
  namespace?: string;
  object?: string;
  objectType?: MetricsObjectTypes;
};

export const isSafeHttpUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const dashboardNamesForKind = (kind: IstioDashboardKind): string[] => {
  return kind === 'ztunnel' ? [ISTIO_ZTUNNEL_DASHBOARD] : ISTIO_DASHBOARDS;
};

/** Keep Istio dashboards in a stable order and drop unsafe URLs. */
export const filterIstioDashboardLinks = (links: ExternalLink[], kind: IstioDashboardKind): ExternalLink[] => {
  const allowed = dashboardNamesForKind(kind);
  const byName = new Map<string, ExternalLink>();

  links.forEach(link => {
    if (allowed.includes(link.name) && isSafeHttpUrl(link.url)) {
      byName.set(link.name, link);
    }
  });

  return allowed.map(name => byName.get(name)).filter((link): link is ExternalLink => link !== undefined);
};

export const istioDashboardViewTitle = (dashboardName: string, tool: IstioDashboardTool): string => {
  return t('View {{dashboard}} in {{tool}}', { dashboard: dashboardName, tool });
};

const hasExternalService = (serviceName: string): boolean => {
  const externalServices = store.getState().statusState.externalServices ?? [];
  return externalServices.some(service => service.name.toLowerCase() === serviceName);
};

export const hasIstioExternalDashboards = (): boolean => {
  return hasExternalService('grafana') || hasExternalService('perses');
};

const controlPlaneDashboardNames = new Set<string>([...ISTIO_DASHBOARDS, ISTIO_ZTUNNEL_DASHBOARD]);

const filterBuiltObjectLinks = (built: ExternalLink[], kind: 'app' | 'service' | 'workload'): ExternalLink[] => {
  if (kind === 'workload') {
    return built.filter(link => link.name === ISTIO_WORKLOAD_DASHBOARD);
  }
  if (kind === 'service') {
    return built.filter(link => link.name === ISTIO_SERVICE_DASHBOARD);
  }

  return built.filter(link => !controlPlaneDashboardNames.has(link.name));
};

const pairsToLinks = (pairs: [string, string][]): ExternalLink[] => {
  return pairs.filter(([, url]) => isSafeHttpUrl(url)).map(([name, url]) => ({ name, url, variables: {} }));
};

const selectObjectDashboardLinks = (
  links: ExternalLink[],
  options: IstioDashboardLoadOptions,
  tool: 'grafana' | 'perses',
  extra?: { datasourceUID?: string; project?: string }
): ExternalLink[] => {
  if (options.kind === 'control-plane' || options.kind === 'ztunnel') {
    return filterIstioDashboardLinks(links, options.kind);
  }

  if (!options.namespace || !options.object || options.objectType === undefined) {
    return [];
  }

  const builderProps = {
    links,
    namespace: options.namespace,
    object: options.object,
    objectType: options.objectType,
    datasourceUID: extra?.datasourceUID,
    project: extra?.project
  };

  const built =
    tool === 'grafana'
      ? pairsToLinks(GrafanaLinks.buildGrafanaLinks(builderProps))
      : pairsToLinks(buildPersesLinks(builderProps));

  if (options.kind === 'app' || options.kind === 'workload' || options.kind === 'service') {
    return filterBuiltObjectLinks(built, options.kind);
  }

  return [];
};

let grafanaInfoPromise: Promise<GrafanaInfo | undefined> | undefined;
let persesInfoPromise: Promise<PersesInfo | undefined> | undefined;

/** Test-only: drop cached Grafana/Perses info so the next load hits the API again. */
export const resetIstioDashboardInfoCache = (): void => {
  grafanaInfoPromise = undefined;
  persesInfoPromise = undefined;
};

const loadGrafanaInfo = (): Promise<GrafanaInfo | undefined> => {
  if (!hasExternalService('grafana')) {
    return Promise.resolve(undefined);
  }

  if (!grafanaInfoPromise) {
    grafanaInfoPromise = API.getGrafanaInfo()
      .then(response => {
        if (response.status === 204 || !response.data) {
          return undefined;
        }

        return response.data;
      })
      .catch((err: Error) => {
        grafanaInfoPromise = undefined;
        addError(t('Could not fetch Grafana info. Turning off links to Grafana.'), err, false, MessageType.INFO);
        return undefined;
      });
  }

  return grafanaInfoPromise;
};

const loadPersesInfo = (): Promise<PersesInfo | undefined> => {
  if (!hasExternalService('perses')) {
    return Promise.resolve(undefined);
  }

  if (!persesInfoPromise) {
    persesInfoPromise = API.getPersesInfo()
      .then(response => {
        if (response.status === 204 || !response.data) {
          return undefined;
        }

        return response.data;
      })
      .catch((err: Error) => {
        persesInfoPromise = undefined;
        addError(t('Could not fetch Perses info. Turning off links to Perses.'), err, false, MessageType.INFO);
        return undefined;
      });
  }

  return persesInfoPromise;
};

const normalizeLoadOptions = (
  kindOrOptions: IstioDashboardKind | IstioDashboardLoadOptions
): IstioDashboardLoadOptions => {
  return typeof kindOrOptions === 'string' ? { kind: kindOrOptions } : kindOrOptions;
};

export const loadIstioDashboardLinks = (
  kindOrOptions: IstioDashboardKind | IstioDashboardLoadOptions
): Promise<{ grafanaLinks: ExternalLink[]; persesLinks: ExternalLink[] }> => {
  const options = normalizeLoadOptions(kindOrOptions);

  return Promise.all([loadGrafanaInfo(), loadPersesInfo()]).then(([grafanaInfo, persesInfo]) => ({
    grafanaLinks: grafanaInfo
      ? selectObjectDashboardLinks(grafanaInfo.externalLinks ?? [], options, 'grafana', {
          datasourceUID: grafanaInfo.datasourceUID
        })
      : [],
    persesLinks: persesInfo
      ? selectObjectDashboardLinks(persesInfo.externalLinks ?? [], options, 'perses', {
          project: persesInfo.project
        })
      : []
  }));
};
