import Namespace from './Namespace';
import { Runtime } from './Workload';

export interface AppId {
  namespace: string;
  app: string;
}

export interface AppWorkload {
  workloadName: string;
  istioSidecar: boolean;
}

export interface App {
  namespace: Namespace;
  name: string;
  workloads: AppWorkload[];
  serviceNames: string[];
  runtimes: Runtime[];
}
