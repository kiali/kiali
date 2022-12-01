import Namespace from './Namespace';
import { Runtime } from './Workload';
import { AppHealthResponse } from '../types/Health';

export interface AppId {
  namespace: string;
  app: string;
}

export interface AppWorkload {
  workloadName: string;
  istioSidecar: boolean;
  serviceAccountNames: string[];
  labels: { [key: string]: string };
}

export interface App {
  namespace: Namespace;
  name: string;
  workloads: AppWorkload[];
  serviceNames: string[];
  runtimes: Runtime[];
  health: AppHealthResponse;
}
