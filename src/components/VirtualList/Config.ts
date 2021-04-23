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
import { PFBadges, PFBadgeType } from '../../components/Pf/PfBadges';

export type SortResource = AppListItem | WorkloadListItem | ServiceListItem;
export type TResource = SortResource | IstioConfigItem;
export type RenderResource = TResource | NamespaceInfo;
export type Renderer<R extends RenderResource> = (
  item: R,
  config: Resource,
  badge: PFBadgeType,
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

type istioConfigType = {
  name: string;
  url: string;
  badge: PFBadgeType;
};

export const IstioTypes = {
  gateway: { name: 'Gateway', url: 'gateways', badge: PFBadges.Gateway } as istioConfigType,
  virtualservice: { name: 'VirtualService', url: 'virtualservices', badge: PFBadges.VirtualService } as istioConfigType,
  destinationrule: {
    name: 'DestinationRule',
    url: 'destinationrules',
    badge: PFBadges.DestinationRule
  } as istioConfigType,
  serviceentry: { name: 'ServiceEntry', url: 'serviceentries', badge: PFBadges.ServiceEntry } as istioConfigType,
  rule: { name: 'Rule', url: 'rules', badge: PFBadges.Rule } as istioConfigType,
  adapter: { name: 'Adapter', url: 'adapters', badge: PFBadges.Adapter } as istioConfigType,
  template: { name: 'Template', url: 'templates', badge: PFBadges.Template } as istioConfigType,
  instance: { name: 'Instance', url: 'instances', badge: PFBadges.Instance } as istioConfigType,
  handler: { name: 'Handler', url: 'handlers', badge: PFBadges.Handler } as istioConfigType,
  policy: { name: 'Policy', url: 'policies', badge: PFBadges.Policy } as istioConfigType,
  meshpolicy: { name: 'MeshPolicy', url: 'meshpolicies', badge: PFBadges.MeshPolicy } as istioConfigType,
  clusterrbacconfig: {
    name: 'ClusterRbacConfig',
    url: 'clusterrbacconfigs',
    badge: PFBadges.ClusterRBACConfig
  } as istioConfigType,
  rbacconfig: { name: 'RbacConfig', url: 'rbacconfigs', badge: PFBadges.RBACConfig } as istioConfigType,
  authorizationpolicy: {
    name: 'AuthorizationPolicy',
    url: 'authorizationpolicies',
    badge: PFBadges.AuthorizationPolicy
  } as istioConfigType,
  sidecar: { name: 'Sidecar', url: 'sidecars', badge: PFBadges.Sidecar } as istioConfigType,
  servicerole: { name: 'ServiceRole', url: 'serviceroles', icon: PFBadges.ServiceRole },
  servicerolebinding: {
    name: 'ServiceRoleBinding',
    url: 'servicerolebindings',
    badge: PFBadges.ServiceRoleBinding
  } as istioConfigType,
  peerauthentication: {
    name: 'PeerAuthentication',
    url: 'peerauthentications',
    badge: PFBadges.PeerAuthentication
  } as istioConfigType,
  requestauthentication: {
    name: 'RequestAuthentication',
    url: 'requestauthentications',
    badge: PFBadges.RequestAuthentication
  } as istioConfigType,
  workloadentry: { name: 'WorkloadEntry', url: 'workloadentries', badge: PFBadges.WorkloadEntry } as istioConfigType,
  envoyfilter: { name: 'EnvoyFilter', url: 'envoyfilters', badge: PFBadges.EnvoyFilter } as istioConfigType,
  attributemanifest: {
    name: 'AttributeManifest',
    url: 'attributemanifests',
    badge: PFBadges.AttributeManifest
  } as istioConfigType
};

export type Resource = {
  name: string;
  columns: ResourceType<any>[];
  caption?: string;
  badge?: PFBadgeType;
};

const namespaces: Resource = {
  name: 'namespaces',
  columns: [tlsStatus, nsItem, istioConfiguration, labels, status],
  badge: PFBadges.Namespace
};

const workloads: Resource = {
  name: 'workloads',
  columns: [item, namespace, workloadType, labels, health, details],
  badge: PFBadges.Workload
};

const applications: Resource = {
  name: 'applications',
  columns: [item, namespace, labels, health, details],
  badge: PFBadges.App
};

const services: Resource = {
  name: 'services',
  columns: [serviceItem, namespace, labels, health, configuration, details],
  badge: PFBadges.Service
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
