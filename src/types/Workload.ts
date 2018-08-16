import Namespace from './Namespace';

export const WorloadLink = (ns: string, name: string) => {
  return '';
  // Change the return in Workload Details Merge
};

export const WorkloadIcons = {
  Deployment: 'process-automation'
};

export const WorkloadType = {
  Deployment: 'Deployment'
};

export interface WorkloadOverview {
  name: string;
  type: string;
  istioSidecar: boolean;
  appLabel: boolean;
  versionLabel: boolean;
}

export interface WorkloadListItem {
  namespace: string;
  workload: WorkloadOverview;
}

export interface WorkloadNamespaceResponse {
  namespace: Namespace;
  workloads: WorkloadOverview[];
}
