import deepFreeze from 'deep-freeze';
import { cellWidth, sortable, textCenter } from '@patternfly/react-table';

import { AppListItem } from '../../types/AppList';
import { WorkloadListItem } from '../../types/Workload';
import { ServiceListItem } from '../../types/ServiceList';
import { IstioConfigItem } from '../../types/IstioConfigList';
import * as Renderers from './Renderers';
import { Health } from '../../types/Health';
import { isIstioNamespace } from 'config/ServerConfig';
import NamespaceInfo from '../../pages/Overview/NamespaceInfo';
import * as React from 'react';
import { StatefulFilters } from '../Filters/StatefulFilters';

export type SortResource = AppListItem | WorkloadListItem | ServiceListItem;
export type TResource = SortResource | IstioConfigItem;
export type RenderResource = TResource | NamespaceInfo;
export type Renderer<R extends RenderResource> = (
  item: R,
  config: Resource,
  icon: string,
  health?: Health,
  statefulFilter?: React.RefObject<StatefulFilters>
) => JSX.Element | undefined;

// Health type guard
export function hasHealth(r: RenderResource): r is SortResource {
  return (r as SortResource).healthPromise !== undefined;
}

export const hasMissingSidecar = (r: SortResource): boolean => {
  return !isIstioNamespace(r.namespace) && !r.istioSidecar;
};

type ResourceType<R extends RenderResource> = {
  name: string;
  column: string;
  param?: string;
  transforms?: any;
  cellTransforms?: any;
  renderer: Renderer<R>;
};

// NamespaceInfo
const tlsStatus: ResourceType<NamespaceInfo> = {
  name: 'TLS',
  param: 'tls',
  column: 'TLS',
  transforms: [sortable, cellWidth(5)],
  renderer: Renderers.tls
};

const istioConfiguration: ResourceType<NamespaceInfo> = {
  name: 'IstioConfiguration',
  param: 'ic',
  column: 'Config',
  transforms: [sortable, cellWidth(5)],
  renderer: Renderers.istioConfig
};

const status: ResourceType<NamespaceInfo> = {
  name: 'Status',
  param: 'h',
  column: 'Status',
  transforms: [sortable, cellWidth(40)],
  cellTransforms: [textCenter],
  renderer: Renderers.status
};

const links: ResourceType<NamespaceInfo> = {
  name: 'Links',
  param: 'links',
  column: 'Links',
  transforms: [cellWidth(15)],
  renderer: Renderers.links
};

const nsItem: ResourceType<NamespaceInfo> = {
  name: 'Namespace',
  param: 'ns',
  column: 'Namespace',
  transforms: [sortable, cellWidth(15)],
  renderer: Renderers.nsItem
};
// General

const item: ResourceType<TResource> = {
  name: 'Item',
  param: 'wn',
  column: 'Name',
  transforms: [sortable, cellWidth(15)],
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

const labels: ResourceType<RenderResource> = {
  name: 'Labels',
  param: 'lb',
  column: 'Labels',
  transforms: [cellWidth(30)],
  renderer: Renderers.labels
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
  gateway: { name: 'Gateway', url: 'gateways', icon: 'G' },
  virtualservice: { name: 'VirtualService', url: 'virtualservices', icon: 'VS' },
  destinationrule: { name: 'DestinationRule', url: 'destinationrules', icon: 'DR' },
  serviceentry: { name: 'ServiceEntry', url: 'serviceentries', icon: 'SE' },
  rule: { name: 'Rule', url: 'rules', icon: 'R' },
  adapter: { name: 'Adapter', url: 'adapters', icon: 'A' },
  template: { name: 'Template', url: 'templates', icon: 'T' },
  quotaspec: { name: 'QuotaSpec', url: 'quotaspecs', icon: 'QS' },
  quotaspecbinding: { name: 'QuotaSpecBinding', url: 'quotaspecbindings', icon: 'QSB' },
  policy: { name: 'Policy', url: 'policies', icon: 'P' },
  meshpolicy: { name: 'MeshPolicy', url: 'meshpolicies', icon: 'MP' },
  servicemeshpolicy: { name: 'ServiceMeshPolicy', url: 'servicemeshpolicy', icon: 'SMP' },
  clusterrbacconfig: { name: 'ClusterRbacConfig', url: 'clusterrbacconfigs', icon: 'CRC' },
  rbacconfig: { name: 'RbacConfig', url: 'rbacconfigs', icon: 'RC' },
  authorizationpolicy: { name: 'AuthorizationPolicy', url: 'authorizationpolicy', icon: 'AP' },
  servicemeshrbacconfig: { name: 'ServiceMeshRbacConfig', url: 'servicemeshrbacconfigs', icon: 'SRC' },
  sidecar: { name: 'Sidecar', url: 'sidecars', icon: 'S' },
  servicerole: { name: 'ServiceRole', url: 'serviceroles', icon: 'SR' },
  servicerolebinding: { name: 'ServiceRoleBinding', url: 'servicerolebindings', icon: 'SRB' },
  peerauthentication: { name: 'PeerAuthentication', url: 'peerauthentications', icon: 'PA' },
  requestauthentication: { name: 'RequestAuthentication', url: 'requestauthentications', icon: 'RA' },
  workloadentry: { name: 'WorkloadEntry', url: 'workloadentries', icon: 'WE' }
};

export type Resource = {
  name: string;
  columns: ResourceType<any>[];
  caption?: string;
  icon?: string;
};

const namespaces: Resource = {
  name: 'namespaces',
  columns: [tlsStatus, nsItem, istioConfiguration, labels, status, links],
  icon: 'NS'
};

const workloads: Resource = {
  name: 'workloads',
  columns: [item, namespace, workloadType, labels, health, details],
  icon: 'W'
};

const applications: Resource = {
  name: 'applications',
  columns: [item, namespace, labels, health, details],
  icon: 'A'
};

const services: Resource = {
  name: 'services',
  columns: [serviceItem, namespace, labels, health, configuration, details],
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
  overview: namespaces,
  services: services,
  istio: istio
};

export const config = deepFreeze(conf) as typeof conf;
