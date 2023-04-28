import Namespace from './Namespace';
import { Runtime } from './Workload';
import { AppHealthResponse } from '../types/Health';

export interface AppId {
  cluster: string;
  namespace: string;
  app: string;
}

export interface AppWorkload {
  workloadName: string;
  istioSidecar: boolean;
  istioAmbient: boolean;
  serviceAccountNames: string[];
  labels: { [key: string]: string };
}

export interface App {
  namespace: Namespace;
  cluster: string;
  name: string;
  workloads: AppWorkload[];
  serviceNames: string[];
  runtimes: Runtime[];
  health: AppHealthResponse;
}
