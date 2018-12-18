import Namespace from './Namespace';
import { DashboardRef } from './Workload';

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
  customDashboards: DashboardRef[];
}
