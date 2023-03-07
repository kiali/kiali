import { AppList, AppListItem } from '../../types/AppList';
import { sortIstioReferences } from './FiltersAndSorts';
import { AppHealth } from '../../types/Health';

export const getAppItems = (data: AppList, rateInterval: number): AppListItem[] => {
  if (data.applications) {
    return data.applications.map(app => ({
      namespace: data.namespace.name,
      name: app.name,
      istioSidecar: app.istioSidecar,
      health: AppHealth.fromJson(data.namespace.name, app.name, app.health, {
        rateInterval: rateInterval,
        hasSidecar: app.istioSidecar
      }),
      labels: app.labels,
      istioReferences: sortIstioReferences(app.istioReferences, true)
    }));
  }
  return [];
};
