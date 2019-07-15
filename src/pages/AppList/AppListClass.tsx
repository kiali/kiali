import { AppList, AppListItem } from '../../types/AppList';
import * as API from '../../services/Api';

export const getAppItems = (data: AppList, rateInterval: number): AppListItem[] => {
  if (data.applications) {
    return data.applications.map(app => ({
      namespace: data.namespace.name,
      name: app.name,
      istioSidecar: app.istioSidecar,
      healthPromise: API.getAppHealth(data.namespace.name, app.name, rateInterval, app.istioSidecar)
    }));
  }
  return [];
};
