import { Namespace } from './Namespace';
import { Runtime } from './Workload';
import { AppHealthResponse } from '../types/Health';

export interface AppId {
  app: string;
  cluster?: string;
  namespace: string;
}

export interface AppWorkload {
  isAmbient: boolean;
  istioSidecar: boolean;
  labels: { [key: string]: string };
  serviceAccountNames: string[];
  workloadName: string;
}

export interface App {
  cluster?: string;
  health: AppHealthResponse;
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
