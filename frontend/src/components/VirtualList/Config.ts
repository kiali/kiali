import * as React from 'react';
import deepFreeze from 'deep-freeze';
import { AppListItem } from '../../types/AppList';
import { AppWorkload } from 'types/App';
import { WorkloadListItem, Workload } from '../../types/Workload';
import { ServiceListItem } from '../../types/ServiceList';
import { dicTypeToGVK, IstioConfigItem } from '../../types/IstioConfigList';
import * as Renderers from './Renderers';
import { Health } from '../../types/Health';
import { isIstioNamespace, serverConfig } from 'config/ServerConfig';
import { NamespaceInfo } from '../../types/NamespaceInfo';
import { StatefulFiltersRef } from '../Filters/StatefulFilters';
import { PFBadges, PFBadgeType } from '../../components/Pf/PfBadges';
import { getGVKTypeString, kindToStringIncludeK8s } from '../../utils/IstioConfigUtils';
import { TypeHeader } from '../../pages/Namespaces/TypeHeader';
import { HealthHeader } from '../../pages/Namespaces/HealthHeader';

export type SortResource = AppListItem | WorkloadListItem | ServiceListItem;
export type TResource = SortResource | IstioConfigItem;
export type RenderResource = TResource | NamespaceInfo;
export type Renderer<R extends RenderResource> = (
  item: R,
  config: Resource,
  badge: PFBadgeType,
  health?: Health,
  statefulFilter?: StatefulFiltersRef
) => JSX.Element | undefined;

// Health type guard
export const hasHealth = (r: RenderResource): r is SortResource => {
  return (r as SortResource).health !== undefined;
};

export const hasMissingSidecar = (workload: Workload | WorkloadListItem | AppWorkload | AppListItem): boolean => {
  const isSpireServer = workload.spireInfo?.isSpireServer ?? false;
  return (
    (!serverConfig.ambientEnabled &&
      !workload.istioSidecar &&
      !workload.isGateway &&
      !isSpireServer &&
      !isIstioNamespace(workload.namespace)) ||
    (serverConfig.ambientEnabled &&
      !workload.isAmbient &&
      !workload.istioSidecar &&
      !isSpireServer &&
      !workload.isWaypoint &&
      !workload.isGateway &&
      !isIstioNamespace(workload.namespace))
  );
};

export const noAmbientLabels = (r: SortResource): boolean => {
  return !isIstioNamespace(r.namespace) && !r.isAmbient;
};

export type ResourceType<R extends RenderResource> = {
  headerContent?: React.ReactNode;
  name: string;
  param?: string;
  renderer?: Renderer<R>;
  sortable: boolean;
  textCenter?: boolean;
  title: string;
  width?: 10 | 15 | 20 | 25 | 30 | 35 | 40 | 45 | 50 | 60 | 70 | 80 | 90 | 100;
};

// NamespaceInfo
const istioConfiguration: ResourceType<NamespaceInfo> = {
  name: 'IstioConfiguration',
  param: 'ic',
  title: 'Istio config',
  sortable: true,
  width: 10,
  renderer: Renderers.istioConfig
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

export const GVKToBadge: { [gvk: string]: PFBadgeType } = {};

Object.values(dicTypeToGVK).forEach(value => {
  GVKToBadge[getGVKTypeString(value)] = PFBadges[kindToStringIncludeK8s(value.Group, value.Kind)];
});

export type Resource = {
  badge?: PFBadgeType;
  caption?: string;
  columns: ResourceType<any>[];
  name: string;
};

const namespacesHealth: ResourceType<NamespaceInfo> = {
  name: 'Health',
  param: 'h',
  renderer: Renderers.nsHealth,
  sortable: true,
  title: 'Health',
  width: 20,
  headerContent: React.createElement(HealthHeader)
};

const typeNamespaces: ResourceType<NamespaceInfo> = {
  headerContent: React.createElement(TypeHeader),
  name: 'Type',
  param: 'type',
  renderer: Renderers.nsType,
  sortable: true,
  title: 'Type',
  width: 10
};

const revisionNamespaces: ResourceType<NamespaceInfo> = {
  name: 'Revision',
  param: 'rev',
  renderer: Renderers.nsRevision,
  sortable: true,
  title: 'Revision',
  width: 10
};

const nsItemNamespaces: ResourceType<NamespaceInfo> = {
  name: 'Namespace',
  param: 'ns',
  renderer: Renderers.nsItem,
  sortable: true,
  title: 'Namespace',
  width: 20
};

const tlsStatusNamespaces: ResourceType<NamespaceInfo> = {
  name: 'mTLS',
  param: 'm',
  renderer: Renderers.nsTls,
  sortable: true,
  title: 'mTLS',
  width: 10
};

const namespacesList: Resource = {
  name: 'namespaces',
  columns: [
    nsItemNamespaces,
    typeNamespaces,
    revisionNamespaces,
    cluster,
    namespacesHealth,
    tlsStatusNamespaces,
    istioConfiguration,
    labels
  ],
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

type Config = {
  applications: Resource;
  istio: Resource;
  namespaces: Resource;
  services: Resource;
  workloads: Resource;
};

const conf: Config = {
  applications: applications,
  istio: istio,
  namespaces: namespacesList,
  services: services,
  workloads: workloads
};

export const config: Config = deepFreeze(conf) as typeof conf;
