import deepFreeze from 'deep-freeze';
import { sortable } from '@patternfly/react-table';

import { AppListItem } from '../../types/AppList';
import { WorkloadListItem } from '../../types/Workload';
import { ServiceListItem } from '../../types/ServiceList';
import { IstioConfigItem } from '../../types/IstioConfigList';
import { serverConfig } from '../../config';
import * as Renderers from './Renderers';
import { Health } from '../../types/Health';

export type SortResource = AppListItem | WorkloadListItem | ServiceListItem;
export type TResource = SortResource | IstioConfigItem;
export type Renderer<R extends TResource> = (
  item: R,
  config: Resource,
  icon: string,
  health?: Health
) => JSX.Element | undefined;

// Health type guard
export function hasHealth(r: TResource): r is SortResource {
  return (r as SortResource).healthPromise !== undefined;
}

export const hasMissingSidecar = (r: SortResource): boolean => {
  return r.namespace !== serverConfig.istioNamespace && !r.istioSidecar;
};

type ResourceType<R extends TResource> = {
  name: string;
  column: string;
  param?: string;
  transforms?: any;
  renderer: Renderer<R>;
};

const item: ResourceType<TResource> = {
  name: 'Item',
  param: 'wn',
  column: 'Name',
  transforms: [sortable],
  renderer: Renderers.item
};

const serviceItem: ResourceType<ServiceListItem> = {
  name: 'Item',
  param: 'sn',
  column: 'Name',
  transforms: [sortable],
  renderer: Renderers.item
};

const istioItem: ResourceType<IstioConfigItem> = {
  name: 'Item',
  param: 'in',
  column: 'Name',
  transforms: [sortable],
  renderer: Renderers.item
};

const namespace: ResourceType<TResource> = {
  name: 'Namespace',
  param: 'ns',
  column: 'Namespace',
  transforms: [sortable],
  renderer: Renderers.namespace
};

const health: ResourceType<TResource> = {
  name: 'Health',
  param: 'he',
  column: 'Health',
  transforms: [sortable],
  renderer: Renderers.health
};

const details: ResourceType<AppListItem | WorkloadListItem | ServiceListItem> = {
  name: 'Details',
  param: 'is',
  column: 'Details',
  transforms: [sortable],
  renderer: Renderers.details
};

const configuration: ResourceType<ServiceListItem | IstioConfigItem> = {
  name: 'Configuration',
  param: 'cv',
  column: 'Configuration',
  transforms: [sortable],
  renderer: Renderers.configuration
};

const labelValidation: ResourceType<WorkloadListItem> = {
  name: 'LabelValidation',
  param: 'lb',
  column: 'Label Validation',
  transforms: [sortable],
  renderer: Renderers.labelValidation
};

const workloadType: ResourceType<WorkloadListItem> = {
  name: 'WorkloadType',
  param: 'wt',
  column: 'Type',
  transforms: [sortable],
  renderer: Renderers.workloadType
};

const istioType: ResourceType<IstioConfigItem> = {
  name: 'IstioType',
  param: 'it',
  column: 'Type',
  transforms: [sortable],
  renderer: Renderers.istioType
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
  columns: ResourceType<any>[];
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
