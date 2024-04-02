import { AppHealth } from './Health';
import { ObjectReference } from './IstioObjects';

export interface AppList {
  applications: AppListItem[];
  cluster?: string;
}

export interface AppListItem {
  cluster?: string;
  health: AppHealth;
  istioAmbient: boolean;
  istioReferences: ObjectReference[];
  istioSidecar: boolean;
  labels: { [key: string]: string };
  name: string;
  namespace: string;
}

export interface AppListQuery {
  health: 'true' | 'false';
  istioResources: 'true' | 'false';
  rateInterval: string;
}
