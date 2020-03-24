import Namespace from './Namespace';
import { AppHealth } from './Health';

export interface AppList {
  namespace: Namespace;
  applications: AppOverview[];
}

export interface AppOverview {
  name: string;
  istioSidecar: boolean;
  labels: { [key: string]: string };
}

export interface AppListItem extends AppOverview {
  namespace: string;
  healthPromise: Promise<AppHealth>;
}
