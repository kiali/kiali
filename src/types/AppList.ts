import Namespace from './Namespace';

export interface AppList {
  namespace: Namespace;
  applications: AppOverview[];
}

export interface AppOverview {
  name: string;
  istioSidecar: boolean;
}

export interface AppListItem extends AppOverview {
  namespace: string;
}

export const overviewToItem = (overview: AppOverview, namespace: string): AppListItem => {
  return {
    namespace: namespace,
    name: overview.name,
    istioSidecar: overview.istioSidecar
  };
};
