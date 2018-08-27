import Namespace from './Namespace';

export interface AppId {
  namespace: string;
  app: string;
}

export interface AppWorkload {
  workloadName: string;
  istioSidecar: boolean;
  serviceNames: string[];
}

export interface App {
  namespace: Namespace;
  name: string;
  workloads: AppWorkload[];
}
