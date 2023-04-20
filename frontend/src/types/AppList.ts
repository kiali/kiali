import Namespace from './Namespace';
import { AppHealth } from './Health';
import { ObjectReference } from './IstioObjects';

export interface AppList {
  namespace: Namespace;
  applications: AppOverview[];
}

export interface AppOverview {
  name: string;
  cluster: string;
  istioSidecar: boolean;
  istioAmbient: boolean;
  labels: { [key: string]: string };
  istioReferences: ObjectReference[];
  health: AppHealth;
}

export interface AppListItem extends AppOverview {
  namespace: string;
}
