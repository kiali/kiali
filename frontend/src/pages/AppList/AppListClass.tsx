import { AppList, AppListItem } from '../../types/AppList';
import { sortIstioReferences } from './FiltersAndSorts';
import { AppHealth } from '../../types/Health';

export const getAppItems = (data: AppList, rateInterval: number): AppListItem[] => {
  if (data.applications) {
    return data.applications.map(app => ({
      namespace: data.namespace.name,
      name: app.name,
      istioSidecar: app.istioSidecar,
      istioAmbient: app.istioAmbient,
      health: AppHealth.fromJson(data.namespace.name, app.name, app.health, {
        rateInterval: rateInterval,
        hasSidecar: app.istioSidecar,
        hasAmbient: app.istioAmbient
      }),
      labels: app.labels,
      istioReferences: sortIstioReferences(app.istioReferences, true),
      cluster: app.cluster
    }));
  }
  return [];
};
