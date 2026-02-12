import { AppHealth, AppHealthResponse } from './Health';
import { ObjectReference } from './IstioObjects';
import { InstanceType } from 'types/Common';
import { SpireInfo } from './Workload';

// Raw API response - health is JSON that needs conversion
export interface AppList {
  applications: AppListItemResponse[];
  cluster?: string;
}

export interface AppListItemResponse {
  cluster?: string;
  health: AppHealthResponse;
  isAmbient: boolean;
  isGateway: boolean;
  isWaypoint: boolean;
  isZtunnel: boolean;
  istioReferences: ObjectReference[];
  istioSidecar: boolean;
  labels: { [key: string]: string };
  name: string;
  namespace: string;
}

// Processed list for internal use - health is AppHealth instance
export interface AppListItem {
  cluster?: string;
  health: AppHealth;
  instanceType: InstanceType.App;
  isAmbient: boolean;
  isGateway: boolean;
  isWaypoint: boolean;
  isZtunnel: boolean;
  istioReferences: ObjectReference[];
  istioSidecar: boolean;
  labels: { [key: string]: string };
  name: string;
  namespace: string;
  spireInfo?: SpireInfo;
}

export interface AppListQuery {
  health: 'true' | 'false';
  istioResources: 'true' | 'false';
}
