import { store } from 'store/ConfigStore';
import * as API from 'services/Api';
import { addError } from 'utils/AlertUtils';
import { MessageType } from 'types/NotificationCenter';
import type { ExternalLink } from 'types/Dashboards';
import { ISTIO_ZTUNNEL_DASHBOARD } from 'types/Dashboards';
import { ISTIO_DASHBOARDS } from 'types/GrafanaInfo';
import { t } from 'utils/I18nUtils';

export type IstioDashboardKind = 'control-plane' | 'ztunnel';
export type IstioDashboardTool = 'Grafana' | 'Perses';

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

const fetchGrafanaDashboardLinks = (kind: IstioDashboardKind): Promise<ExternalLink[]> => {
  return API.getGrafanaInfo()
    .then(response => {
      if (response.status === 204 || !response.data) {
        return [];
      }

      return filterIstioDashboardLinks(response.data.externalLinks ?? [], kind);
    })
    .catch((err: Error) => {
      addError(t('Could not fetch Grafana info. Turning off links to Grafana.'), err, false, MessageType.INFO);
      return [];
    });
};

const fetchPersesDashboardLinks = (kind: IstioDashboardKind): Promise<ExternalLink[]> => {
  return API.getPersesInfo()
    .then(response => {
      if (response.status === 204 || !response.data) {
        return [];
      }

      return filterIstioDashboardLinks(response.data.externalLinks ?? [], kind);
    })
    .catch((err: Error) => {
      addError(t('Could not fetch Perses info. Turning off links to Perses.'), err, false, MessageType.INFO);
      return [];
    });
};

export const loadIstioDashboardLinks = (
  kind: IstioDashboardKind
): Promise<{ grafanaLinks: ExternalLink[]; persesLinks: ExternalLink[] }> => {
  return Promise.all([
    hasExternalService('grafana') ? fetchGrafanaDashboardLinks(kind) : Promise.resolve([]),
    hasExternalService('perses') ? fetchPersesDashboardLinks(kind) : Promise.resolve([])
  ]).then(([grafanaLinks, persesLinks]) => ({ grafanaLinks, persesLinks }));
};
