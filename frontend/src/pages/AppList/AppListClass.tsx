import { AppList, AppListItem } from '../../types/AppList';
import { sortIstioReferences } from './FiltersAndSorts';
import { AppHealth } from '../../types/Health';
import { InstanceType } from 'types/Common';

export const getAppItems = (data: AppList, rateInterval: number): AppListItem[] => {
  if (data.applications) {
    return data.applications.map(app => ({
      namespace: app.namespace,
      name: app.name,
      instanceType: InstanceType.App,
      istioSidecar: app.istioSidecar,
      isAmbient: app.isAmbient,
      isGateway: app.isGateway,
      isWaypoint: app.isWaypoint,
      isZtunnel: app.isZtunnel,
      health: AppHealth.fromJson(app.namespace, app.name, app.health, {
        rateInterval: rateInterval,
        hasSidecar: app.istioSidecar,
        hasAmbient: app.isAmbient
      }),
      labels: app.labels,
      istioReferences: sortIstioReferences(app.istioReferences, true),
      cluster: app.cluster
    }));
  }
  return [];
};
