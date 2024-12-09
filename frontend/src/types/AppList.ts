import { AppHealth } from './Health';
import { ObjectReference } from './IstioObjects';
import { InstanceType } from 'types/Common';

export interface AppList {
  applications: AppListItem[];
  cluster?: string;
}

export interface AppListItem {
  ambient?: string;
  cluster?: string;
  health: AppHealth;
  instanceType: InstanceType.App;
  isAmbient: boolean;
  isGateway: boolean;
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
