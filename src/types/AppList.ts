import Namespace from './Namespace';
import { AppHealth } from './Health';
import { ObjectReference } from './IstioObjects';

export interface AppList {
  namespace: Namespace;
  applications: AppOverview[];
}

export interface AppOverview {
  name: string;
  istioSidecar: boolean;
  labels: { [key: string]: string };
  istioReferences: ObjectReference[];
}

export interface AppListItem extends AppOverview {
  namespace: string;
  healthPromise: Promise<AppHealth>;
}
