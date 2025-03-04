# Caching in Kiali

Kiali implements multiple caching layers to optimize performance and reduce the number of API calls to Kubernetes, Prometheus, and Tempo. This document describes what data is cached and what is always fetched directly from the source.

## Kiali Cache

The Kiali cache stores essential metadata and service mesh-related information to improve UI responsiveness and reduce the load on backend services.

- Webhooks Availability: Cached information about whether webhooks can be listed for a given cluster.
- Build Information: Cached version and build details of the running Kiali instance.
- Clusters: Stores the list of known clusters to optimize multi-cluster queries.
- Namespaces: Holds namespace data stored per cluster.
- Ztunnel Pods: Maintains a cache of ztunnel pods discovered in the mesh.
- Ztunnel Config Dump: Caches Ztunnel pod configurations for additional retrieval of protocol details.
- Proxy Status: Stores the status of pod proxies, suc as xDS.
- Waypoint Proxies: Stores workload data for waypoint proxies to enhance service mesh observability.
- Mesh Configuration: Caches mesh-wide settings, such as control planes running in the mesh from various sources e.g. istio configmap, istiod deployment envvars, etc.
- Istio Validations: Caches Istio Config validation results by cluster and namespaces.
- Ambient Mesh Status: Stores a flag indicating whether Istio Ambient mode is enabled.
- Registry Services: Caches Kubernetes service registry data to speed up service discovery and loading.

## Kubernetes Cache

Kiali maintains an internal cache for commonly used Kubernetes resources such as Services, Workloads, ConfigMaps and Istio Configs.

- ConfigMaps

- Workloads:
-- Deployments
-- StatefulSets
-- DaemonSets
-- Endpoints
-- Pods
-- ReplicaSets

- Services

- Istio Resources: 
-- Gateways
-- VirtualServices
-- Sidecars
-- DestinationRules
-- WorkloadEntries
-- WorkloadGroups
-- WasmPlugins
-- Telemetries
-- EnvoyFilters
-- ServiceEntries

- Security Policies: 
-- AuthorizationPolicies
-- PeerAuthentications
-- RequestAuthentications

- K8s Gateway API Resources: 
-- Gateways
-- HTTPRoutes
-- GRPCRoutes
-- TCPRoutes
-- TLSRoutes
-- ReferenceGrants

## Prometheus Cache

Kiali caches Prometheus metrics of loading request rates per cluster and namespace.

- App Request Rates
- Service Request Rates
- Workload Request Rates

## Tempo Cache

Kiali uses a cache for distributed tracing data retrieved from Tempo to improve trace analysis performance.

- Tracing Data: cached traces.

## Non cached data. Directly Fetched Kubernetes Resources

Some Kubernetes resources are not cached and are always retrieved directly from the K8s API.

- CronJobs
- Jobs
- ReplicationControllers
- DeploymentConfigs

