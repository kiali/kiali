import { AppList, AppListItem } from '../../types/AppList';
import * as API from '../../services/Api';
import { sortIstioReferences } from './FiltersAndSorts';

export const getAppItems = (data: AppList, rateInterval: number): AppListItem[] => {
  if (data.applications) {
    return data.applications.map(app => ({
      namespace: data.namespace.name,
      name: app.name,
      istioSidecar: app.istioSidecar,
      healthPromise: API.getAppHealth(data.namespace.name, app.name, rateInterval, app.istioSidecar),
      labels: app.labels,
      istioReferences: sortIstioReferences(app.istioReferences, true)
    }));
  }
  return [];
};
