import { Namespace } from './Namespace';
import { AppHealth } from './Health';
import { ObjectReference } from './IstioObjects';

export interface AppList {
  applications: AppListItem[];
  cluster?: string;
}

export interface AppListItem {
  // @TODO this should be gone as Namespace contains cluster
  cluster?: string;
  health: AppHealth;
  istioAmbient: boolean;
  istioReferences: ObjectReference[];
  istioSidecar: boolean;
  labels: { [key: string]: string };
  name: string;
  namespace: Namespace;
}

export interface AppListQuery {
  health: 'true' | 'false';
  istioResources: 'true' | 'false';
  rateInterval: string;
}
