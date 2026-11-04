import { store } from 'store/ConfigStore';
import * as API from 'services/Api';
import { addError } from 'utils/AlertUtils';
import { MessageType } from 'types/NotificationCenter';
import type { ExternalLink } from 'types/Dashboards';
import { ISTIO_ZTUNNEL_DASHBOARD } from 'types/Dashboards';
import { ISTIO_DASHBOARDS, ISTIO_MESH_DASHBOARD } from 'types/GrafanaInfo';
import { t } from 'utils/I18nUtils';
import { GrafanaLinks } from 'components/Metrics/GrafanaLinks';
import { buildPersesLinks } from 'components/Metrics/PersesLinks';
import { MetricsObjectTypes } from 'types/Metrics';

export type IstioDashboardKind = 'control-plane' | 'ztunnel' | 'workload' | 'service';
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

const pairsToLinks = (pairs: [string, string][]): ExternalLink[] => {
  return pairs.filter(([, url]) => isSafeHttpUrl(url)).map(([name, url]) => ({ name, url, variables: {} }));
};

const appendMeshDashboard = (built: ExternalLink[], all: ExternalLink[]): ExternalLink[] => {
  if (built.some(link => link.name === ISTIO_MESH_DASHBOARD)) {
    return built;
  }

  const mesh = all.find(link => link.name === ISTIO_MESH_DASHBOARD && isSafeHttpUrl(link.url));
  return mesh ? [...built, mesh] : built;
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

  if (options.objectType === MetricsObjectTypes.ZTUNNEL) {
    return built;
  }

  return appendMeshDashboard(built, links);
};

const fetchGrafanaDashboardLinks = (options: IstioDashboardLoadOptions): Promise<ExternalLink[]> => {
  return API.getGrafanaInfo()
    .then(response => {
      if (response.status === 204 || !response.data) {
        return [];
      }

      return selectObjectDashboardLinks(response.data.externalLinks ?? [], options, 'grafana', {
        datasourceUID: response.data.datasourceUID
      });
    })
    .catch((err: Error) => {
      addError(t('Could not fetch Grafana info. Turning off links to Grafana.'), err, false, MessageType.INFO);
      return [];
    });
};

const fetchPersesDashboardLinks = (options: IstioDashboardLoadOptions): Promise<ExternalLink[]> => {
  return API.getPersesInfo()
    .then(response => {
      if (response.status === 204 || !response.data) {
        return [];
      }

      return selectObjectDashboardLinks(response.data.externalLinks ?? [], options, 'perses', {
        project: response.data.project
      });
    })
    .catch((err: Error) => {
      addError(t('Could not fetch Perses info. Turning off links to Perses.'), err, false, MessageType.INFO);
      return [];
    });
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

  return Promise.all([
    hasExternalService('grafana') ? fetchGrafanaDashboardLinks(options) : Promise.resolve([]),
    hasExternalService('perses') ? fetchPersesDashboardLinks(options) : Promise.resolve([])
  ]).then(([grafanaLinks, persesLinks]) => ({ grafanaLinks, persesLinks }));
};
