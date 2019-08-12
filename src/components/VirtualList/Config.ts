import deepFreeze from 'deep-freeze';
import { AppListItem } from '../../types/AppList';
import { WorkloadListItem } from '../../types/Workload';
import { ServiceListItem } from '../../types/ServiceList';
import { sortable } from '@patternfly/react-table';
import { IstioConfigItem } from '../../types/IstioConfigList';
import { serverConfig } from '../../config';

export type SortResource = AppListItem | WorkloadListItem | ServiceListItem;
export type TResource = SortResource | IstioConfigItem;

export const hasMissingSidecar = (r: SortResource): boolean => {
  return r.namespace !== serverConfig.istioNamespace && !r.istioSidecar;
};

type ResourceType = {
  name: string;
  column: string;
  param?: string;
  transforms?: any;
};

const item: ResourceType = {
  name: 'Item',
  param: 'wn',
  column: 'Name',
  transforms: [sortable]
};

const serviceItem: ResourceType = {
  name: 'Item',
  param: 'sn',
  column: 'Name',
  transforms: [sortable]
};

const istioItem: ResourceType = {
  name: 'Item',
  param: 'in',
  column: 'Name',
  transforms: [sortable]
};

const namespace: ResourceType = {
  name: 'Namespace',
  param: 'ns',
  column: 'Namespace',
  transforms: [sortable]
};

const health: ResourceType = {
  name: 'Health',
  param: 'he',
  column: 'Health',
  transforms: [sortable]
};

const details: ResourceType = {
  name: 'Details',
  param: 'is',
  column: 'Details',
  transforms: [sortable]
};

const configuration: ResourceType = {
  name: 'Configuration',
  param: 'cv',
  column: 'Configuration',
  transforms: [sortable]
};

const labelValidation: ResourceType = {
  name: 'LabelValidation',
  param: 'lb',
  column: 'Label Validation',
  transforms: [sortable]
};

const workloadType: ResourceType = {
  name: 'WorkloadType',
  param: 'wt',
  column: 'Type',
  transforms: [sortable]
};

const istioType: ResourceType = {
  name: 'IstioType',
  param: 'it',
  column: 'Type',
  transforms: [sortable]
};

export const IstioTypes = {
  gateway: { name: 'Gateway', icon: 'G' },
  virtualservice: { name: 'VirtualService', icon: 'VS' },
  destinationrule: { name: 'DestinationRule', icon: 'DR' },
  serviceentry: { name: 'ServiceEntry', icon: 'SE' },
  rule: { name: 'Rule', icon: 'R' },
  adapter: { name: 'Adapter', icon: 'A' },
  template: { name: 'Template', icon: 'T' },
  quotaspec: { name: 'QuotaSpec', icon: 'QS' },
  quotaspecbinding: { name: 'QuotaSpecBinding', icon: 'QSB' },
  policy: { name: 'Policy', icon: 'P' },
  meshpolicy: { name: 'MeshPolicy', icon: 'MP' },
  servicemeshpolicy: { name: 'ServiceMeshPolicy', icon: 'SMP' },
  clusterrbacconfig: { name: 'ClusterRbacConfig', icon: 'CRC' },
  rbacconfig: { name: 'RbacConfig', icon: 'RC' },
  servicemeshrbacconfig: { name: 'ServiceMeshRbacConfig', icon: 'SRC' },
  sidecar: { name: 'Sidecar', icon: 'S' },
  servicerole: { name: 'ServiceRole', icon: 'SR' },
  servicerolebinding: { name: 'ServiceRoleBinding', icon: 'SRB' }
};

export type Resource = {
  name: string;
  columns: ResourceType[];
  caption?: string;
  icon?: string;
};

const workloads: Resource = {
  name: 'workloads',
  columns: [item, namespace, workloadType, health, details, labelValidation],
  icon: 'W'
};

const applications: Resource = {
  name: 'applications',
  columns: [item, namespace, health, details],
  icon: 'A'
};

const services: Resource = {
  name: 'services',
  columns: [serviceItem, namespace, health, details, configuration],
  icon: 'S'
};

const istio: Resource = {
  name: 'istio',
  columns: [istioItem, namespace, istioType, configuration]
};

const conf = {
  headerTable: true,
  applications: applications,
  workloads: workloads,
  services: services,
  istio: istio
};

export const config = deepFreeze(conf) as typeof conf;
