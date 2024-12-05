import { Namespace } from './Namespace';
import { Runtime } from './Workload';
import { InstanceType } from 'types/Common';
import { AppHealthResponse } from '../types/Health';

export type AppId = {
  app: string;
  cluster?: string;
  namespace: string;
};

export interface AppWorkload {
  ambient?: string;
  isAmbient: boolean;
  isGateway: boolean;
  istioSidecar: boolean;
  labels: { [key: string]: string };
  namespace: string;
  serviceAccountNames: string[];
  workloadName: string;
}

export interface App {
  cluster?: string;
  health: AppHealthResponse;
  instanceType: InstanceType.App;
  isAmbient: boolean;
  name: string;
  namespace: Namespace;
  runtimes: Runtime[];
  serviceNames: string[];
  workloads: AppWorkload[];
}

export interface AppQuery {
  health: 'true' | 'false';
  rateInterval: string;
}
