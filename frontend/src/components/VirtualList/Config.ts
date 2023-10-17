import deepFreeze from 'deep-freeze';
import { AppListItem } from '../../types/AppList';
import { WorkloadListItem } from '../../types/Workload';
import { ServiceListItem } from '../../types/ServiceList';
import { IstioConfigItem } from '../../types/IstioConfigList';
import * as Renderers from './Renderers';
import { Health } from '../../types/Health';
import { isIstioNamespace } from 'config/ServerConfig';
import { NamespaceInfo } from '../../pages/Overview/NamespaceInfo';
import * as React from 'react';
import { StatefulFilters } from '../Filters/StatefulFilters';
import { PFBadges, PFBadgeType } from '../../components/Pf/PfBadges';
import { isGateway, isWaypoint } from '../../helpers/LabelFilterHelper';

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
  return (r as SortResource).health !== undefined;
}

export const hasMissingSidecar = (r: SortResource): boolean => {
  return !isIstioNamespace(r.namespace) && !r.istioSidecar && !isGateway(r.labels) && !isWaypoint(r.labels);
};

export const noAmbientLabels = (r: SortResource): boolean => {
  return !isIstioNamespace(r.namespace) && !r.istioAmbient;
};

export type ResourceType<R extends RenderResource> = {
  title: string;
  name: string;
  param?: string;
  renderer?: Renderer<R>;
  sortable: boolean;
  textCenter?: boolean;
  width?: 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 60 | 70 | 80 | 90 | 100;
};

// NamespaceInfo
const tlsStatus: ResourceType<NamespaceInfo> = {
  name: 'TLS',
  param: 'tls',
  title: 'TLS',
  sortable: false,
  width: 10,
  renderer: Renderers.tls
};

const istioConfiguration: ResourceType<NamespaceInfo> = {
  name: 'IstioConfiguration',
  param: 'ic',
  title: 'Config',
  sortable: true,
  width: 10,
  renderer: Renderers.istioConfig
};

const status: ResourceType<NamespaceInfo> = {
  name: 'Status',
  param: 'h',
  title: 'Status',
  sortable: true,
  width: 50,
  textCenter: true,
  renderer: Renderers.status
};

const nsItem: ResourceType<NamespaceInfo> = {
  name: 'Namespace',
  param: 'ns',
  title: 'Namespace',
  sortable: true,
  renderer: Renderers.nsItem
};

// General
const item: ResourceType<TResource> = {
  name: 'Item',
  param: 'wn',
  title: 'Name',
  sortable: true,
  width: 30,
  renderer: Renderers.item
};

const serviceItem: ResourceType<ServiceListItem> = {
  name: 'Item',
  param: 'sn',
  title: 'Name',
  sortable: true,
  width: 30,
  renderer: Renderers.item
};

const istioItem: ResourceType<IstioConfigItem> = {
  name: 'Item',
  param: 'in',
  title: 'Name',
  sortable: true,
  renderer: Renderers.item
};

const cluster: ResourceType<TResource> = {
  name: 'Cluster',
  param: 'cl',
  title: 'Cluster',
  sortable: true,
  width: 15,
  renderer: Renderers.cluster
};

const namespace: ResourceType<TResource> = {
  name: 'Namespace',
  param: 'ns',
  title: 'Namespace',
  sortable: true,
  width: 20,
  renderer: Renderers.namespace
};

const labels: ResourceType<RenderResource> = {
  name: 'Labels',
  param: 'lb',
  title: 'Labels',
  sortable: false,
  width: 20,
  renderer: Renderers.labels
};

const health: ResourceType<TResource> = {
  name: 'Health',
  param: 'he',
  title: 'Health',
  sortable: true,
  width: 15,
  renderer: Renderers.health
};

const details: ResourceType<AppListItem | WorkloadListItem | ServiceListItem> = {
  name: 'Details',
  param: 'is',
  title: 'Details',
  sortable: true,
  width: 15,
  renderer: Renderers.details
};

const serviceConfiguration: ResourceType<ServiceListItem> = {
  name: 'Configuration',
  param: 'cv',
  title: 'Configuration',
  sortable: true,
  width: 20,
  renderer: Renderers.serviceConfiguration
};

const istioObjectConfiguration: ResourceType<IstioConfigItem> = {
  name: 'Configuration',
  param: 'cv',
  title: 'Configuration',
  sortable: true,
  width: 20,
  renderer: Renderers.istioConfiguration
};

const workloadType: ResourceType<WorkloadListItem> = {
  name: 'WorkloadType',
  param: 'wt',
  title: 'Type',
  sortable: true,
  renderer: Renderers.workloadType
};

const istioType: ResourceType<IstioConfigItem> = {
  name: 'IstioType',
  param: 'it',
  title: 'Type',
  sortable: true,
  renderer: Renderers.istioType
};

type istioConfigType = {
  badge: PFBadgeType;
  name: string;
  url: string;
};

export const IstioTypes = {
  adapter: { name: 'Adapter', url: 'adapters', badge: PFBadges.Adapter } as istioConfigType,
  attributemanifest: {
    name: 'AttributeManifest',
    url: 'attributemanifests',
    badge: PFBadges.AttributeManifest
  } as istioConfigType,
  authorizationpolicy: {
    name: 'AuthorizationPolicy',
    url: 'authorizationpolicies',
    badge: PFBadges.AuthorizationPolicy
  } as istioConfigType,
  clusterrbacconfig: {
    name: 'ClusterRbacConfig',
    url: 'clusterrbacconfigs',
    badge: PFBadges.ClusterRBACConfig
  } as istioConfigType,
  destinationrule: {
    name: 'DestinationRule',
    url: 'destinationrules',
    badge: PFBadges.DestinationRule
  } as istioConfigType,
  envoyfilter: { name: 'EnvoyFilter', url: 'envoyfilters', badge: PFBadges.EnvoyFilter } as istioConfigType,
  gateway: { name: 'Gateway', url: 'gateways', badge: PFBadges.Gateway } as istioConfigType,
  handler: { name: 'Handler', url: 'handlers', badge: PFBadges.Handler } as istioConfigType,
  httproute: { name: 'HTTPRoute', url: 'k8shttproutes', badge: PFBadges.HTTPRoute } as istioConfigType,
  instance: { name: 'Instance', url: 'instances', badge: PFBadges.Instance } as istioConfigType,
  k8sgateway: { name: 'Gateway (K8s)', url: 'k8sgateways', badge: PFBadges.K8sGateway } as istioConfigType,
  k8shttproute: { name: 'HTTPRoute (K8s)', url: 'k8shttproutes', badge: PFBadges.K8sHTTPRoute } as istioConfigType,
  meshpolicy: { name: 'MeshPolicy', url: 'meshpolicies', badge: PFBadges.MeshPolicy } as istioConfigType,
  peerauthentication: {
    name: 'PeerAuthentication',
    url: 'peerauthentications',
    badge: PFBadges.PeerAuthentication
  } as istioConfigType,
  policy: { name: 'Policy', url: 'policies', badge: PFBadges.Policy } as istioConfigType,
  rbacconfig: { name: 'RbacConfig', url: 'rbacconfigs', badge: PFBadges.RBACConfig } as istioConfigType,
  requestauthentication: {
    name: 'RequestAuthentication',
    url: 'requestauthentications',
    badge: PFBadges.RequestAuthentication
  } as istioConfigType,
  rule: { name: 'Rule', url: 'rules', badge: PFBadges.Rule } as istioConfigType,
  serviceentry: { name: 'ServiceEntry', url: 'serviceentries', badge: PFBadges.ServiceEntry } as istioConfigType,
  servicerole: { name: 'ServiceRole', url: 'serviceroles', icon: PFBadges.ServiceRole },
  servicerolebinding: {
    name: 'ServiceRoleBinding',
    url: 'servicerolebindings',
    badge: PFBadges.ServiceRoleBinding
  } as istioConfigType,
  sidecar: { name: 'Sidecar', url: 'sidecars', badge: PFBadges.Sidecar } as istioConfigType,
  telemetry: { name: 'Telemetry', url: 'telemetries', badge: PFBadges.Telemetry } as istioConfigType,
  template: { name: 'Template', url: 'templates', badge: PFBadges.Template } as istioConfigType,
  virtualservice: { name: 'VirtualService', url: 'virtualservices', badge: PFBadges.VirtualService } as istioConfigType,
  wasmplugin: { name: 'WasmPlugin', url: 'wasmplugins', badge: PFBadges.WasmPlugin } as istioConfigType,
  workloadentry: { name: 'WorkloadEntry', url: 'workloadentries', badge: PFBadges.WorkloadEntry } as istioConfigType,
  workloadgroup: { name: 'WorkloadGroup', url: 'workloadgroups', badge: PFBadges.WorkloadGroup } as istioConfigType
};

export type Resource = {
  badge?: PFBadgeType;
  caption?: string;
  columns: ResourceType<any>[];
  name: string;
};

const namespaces: Resource = {
  name: 'namespaces',
  columns: [tlsStatus, nsItem, cluster, istioConfiguration, labels, status],
  badge: PFBadges.Namespace
};

const workloads: Resource = {
  name: 'workloads',
  columns: [health, item, namespace, cluster, workloadType, labels, details],
  badge: PFBadges.Workload
};

const applications: Resource = {
  name: 'applications',
  columns: [health, item, namespace, cluster, labels, details],
  badge: PFBadges.App
};

const services: Resource = {
  name: 'services',
  columns: [health, serviceItem, namespace, cluster, labels, serviceConfiguration, details],
  badge: PFBadges.Service
};

const istio: Resource = {
  name: 'istio',
  columns: [istioItem, namespace, cluster, istioType, istioObjectConfiguration]
};

const conf = {
  applications: applications,
  workloads: workloads,
  overview: namespaces,
  services: services,
  istio: istio
};

export const config = deepFreeze(conf) as typeof conf;
