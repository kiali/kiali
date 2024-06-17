# Multicluster support

1. [Summary](#summary)
2. [Motivation](#motivation)
   1. [Goals](#goals)
   2. [Non-Goals](#nongoals)
3. [Solution](#solution)
   1. [Other solutions](#othersolutions)
4. [Roadmap](#roadmap)

# Summary

Multi-cluster support for Kiali. A “single pane of glass” for your istio service mesh.

[github discussions](https://github.com/kiali/kiali/discussions/categories/multicluster)

# Motivation

It is now common for meshes to span across multiple clusters and yet Kiali only partially supports multi-cluster deployments today. Users should be able to visualize their workloads on the graph across clusters, dig into details via the workload/app/service pages, receive validations for their istio config etc. across their whole mesh from a single Kiali.

## Goals

- Multi-cluster mesh support - single pane of glass for your entire mesh.
- Support multi-primary and primary-remote Istio deployment models.
- Support RBAC authentication strategy for multi-cluster deployments.

## Non-goals

- Custom aggregation of all Kiali’s datasources across clusters. There are other tools and initiatives for aggregating metrics/logs/traces such as otel and this does not need to be handled by Kiali.
- Ambient is not going to be touched in this effort.
- Multi-mesh support - multi-cluster is focused on single mesh support only but shouldn’t prevent Kiali from supporting multi-mesh in the future.

# Solution

A single Kiali configured to access each Kubernetes cluster that is part of the mesh. Kiali will require Metrics/traces to be aggregated in a centralized datastore that Kiali can query.

In a multicluster deployment, Kiali will only support the OIDC auth strategy for now.

## Deployment models

In each of the [deployment models](https://istio.io/latest/docs/ops/deployment/deployment-models/), these are the requirements for a centralized Kiali

1. Access to each kube API server that is part of the mesh
2. Istiod access\*
3. Aggregated metrics/traces
4. OIDC auth strategy

\*Regarding istiod access, if the istiod pods are running within the Kube clusters that are part of the multi-cluster mesh, Kiali will access these by portforwarding using the Kube API. Kiali can support control planes outside of but some features will be lost when Kiali can not access the istiod API.

A service account in each cluster will provide Kiali with access to that cluster's Kube API. Credentials for that service account will be stored in a secret and used by the Kiali pod to communicate with the external Kube APIs.

Note that a single or different network topology won't affect Kiali's configuration and deployment because Kiali will only need access to the Kubernetes API.

### Multi Primary deployment

![Multi-Primary](Multi-Primary.png "Multi Primary")

### Primary-Remote deployment

![Primary-Remote](Primary-Remote.png "Primary Remote")

## Aggregated metrics and traces

Kiali MC will require metrics to be aggregated into a central, unified datastore. It will not aggregate metrics from multiple datastores. The same is true for trace information. It is the user’s responsibility to ensure that metrics and traces are centralized by some means. Metrics and traces will need to include a cluster identifier as an attribute/label on each metric so that Kiali can distinguish between workloads/services running on separate clusters. [Istio standard metrics](https://istio.io/latest/docs/reference/config/metrics/#labels) includes `destination_cluster` and `source_cluster`. Kiali already uses these values for cluster boxing. Traces do not include a cluster identifier but one can be added by creating a telemetry api object. Example:

```
apiVersion: telemetry.istio.io/v1
kind: Telemetry
metadata:
  name: mesh-default
  namespace: istio-system
spec:
  tracing:
  - customTags:
      cluster:
        literal:
          value: Kubernetes
```

[query_scope](https://kiali.io/docs/configuration/kialis.kiali.io/#.spec.external_services.prometheus.query_scope) can be used to limit what Kiali sees from the prometheus and jaeger queries to include only workloads/services within the mesh if these datastores are shared with non-mesh workloads.

## Authentication schemes

In single-cluster, Kiali currently supports the following [authentication schemes](https://kiali.io/docs/configuration/authentication/):

- Anonymous
- Header
- OpenID Connect (OIDC)
- OpenShift
- Token

Of these, only OpenID Connect and Header currently provide the ability to perform cross-cluster authentication. The Token scheme is tied to a single cluster since it uses service account tokens tied to service accounts in a single cluster. The openshift strategy does not support multiple clusters.

The security model Kiali has today assumes a namespace boundary scoped to a single cluster. Of the different authentication options that Kiali supports, RBAC would work cross-cluster if RBAC was managed by an external provider that spanned across the clusters. This requires an admin to properly setup the OIDC provider across clusters.

The namespace service is used to determine if a user has access to resources in that namespace: https://github.com/kiali/kiali/blob/master/business/namespaces.go#L64. For multi-cluster, Kiali will check the user's permissions for that namespace across all clusters. As an optimization, the namespace service can accept a list of specific clusters to query against.

## API

Kiali’s current model of a Service/Workload/App (s/w/a) uses namespace/name to uniquely identify a particular s/w/a. For example, a “reviews” service in namespace “bookinfo” is uniquely identified as “reviews/bookinfo”. This model works fine for a single cluster deployment but does not uniquely identify a service in multi-cluster. Services and workloads can span multiple clusters.

With some exceptions, Istio sees two services with the same FQDN across two different clusters as the same service and will load balance traffic between the two. You can see this when verifying your [multi-cluster traffic](https://istio.io/latest/docs/setup/install/multicluster/verify/#verifying-cross-cluster-traffic) with requests being load balanced across services located in both clusters. Therefore in a multi-cluster deployment, Kiali should no longer treat namespace/name as unique and consider services and workloads with the same namespace/name _across_ clusters as the same service or workload. This adheres to [namespace sameness](https://github.com/kubernetes/community/blob/master/sig-multicluster/namespace-sameness-position-statement.md).

Exceptions to this are:

1. [Cluster local services](https://istio.io/latest/docs/ops/configuration/traffic-management/multicluster/#keeping-traffic-in-cluster) configured either locally or globally for a particular service.
2. [Workloads partitioned](https://istio.io/latest/docs/ops/configuration/traffic-management/multicluster/#partitioning-services) by destination rule / Virtual service.

The API routes to a particular s/w/a based on the namespace/name e.g. `/api/namespaces/{namespace}/workloads/{workload}`. These namespace specific routes will stay the same but they will include results from all clusters. e.g. given a `bookinfo/reviews` service in cluster A and cluster B, `/api/namespaces/bookinfo/services/reviews` would return info about a reviews service from both cluster A and B.

It will be up to the business layer to aggregate all of the info across clusters. Fetching workloads and services will need to be done inside the business layer for every cluster Kiali is connected to. Since details of workloads/services can vary based on the cluster, e.g. the `reviews.bookinfo` Service in cluster A may have different labels than on cluster B and Kiali needs to show those details, the Kiali details models will need to distinguish between the `Service` objects on cluster A vs. cluster B. Istio config will also need a way to uniquely identify istio config across clusters. Istio configuration is not shared across clusters and is specific to the cluster it resides in.

Some services/workloads may span across clusters but some may not. Business layer services can optionally accept a list of specific clusters to query against for a given s/w/a as an optimization. The business services will need to handle this aggregation properly and cannot assume that s/w/a will exist in all clusters or only in a single cluster.

## UI/UX

This proposal focuses mostly on the backend changes necessary to enable a multi-cluster deployment of Kiali however some UI elements can and should change with a multi-cluster deployment. Exact details of UI changes will be left to future issues.

## Configuration

To deploy Kiali MC, users are expected to configure Kiali with access to:

- Unified Prometheus
- Unified Jaeger
- 1..N Kube API servers where N is the number of Kube clusters in the mesh. Kiali will require Kube API credentials to communicate with each of these Kube API servers.

Access to the Kube API servers can be granted by:

1. Creating a service account in the target cluster.
2. Granting proper permissions for this service account.
3. Creating a secret with the credentials for this service account in the cluster/namespace where Kiali is deployed.

This process will need to be repeated for every new cluster added. Adding or removing clusters will also require restarting the Kiali pod in order for the cache watches to pick up the new kube config. Adding/removing kube clusters without having to restart Kiali can be an improvement made later.

## Operator

The Kiali operator will still be used for configuring Kiali itself however, it's assumed that the operator won't have access to other kube clusters other than where Kiali is deployed and therefore configuring multicluster access for Kiali will be a manual operation. The operator will remain unchanged in a multi-cluster deployment.

In order to configure the Kiali Server for multicluster access, you must manually create remote cluster secrets in the same namepace where the Kiali Server will be deployed (normally this is the control plane namespace, aka `istio-system`, but that is not required). A hack script will be developed for devs to use to help build these secrets, perhaps with the long term goal of providing a similar script for end users to use.

By default, the Kiali Operator will autodiscover all remote cluster secrets found in the Kiali deployment namespace and will mount them to the Kiali Server pod at install time. The same will be true for the server helm chart for those that want to install Kiali Server via Helm. When the Kiali Server starts up, it will obtain all the necessary remote cluster connection information from the mounted secrets.

### istioctl x create-remote-secret command

The `istioctl` CLI tool has a command `x create-remote-secret` that is used to create remote cluster secrets that Istio itself uses to communicate to the remote clusters. The original thought was that Kiali could simply use these same secrets for its own communications with the remote clusters. However, for the following reasons, this cannot be done - Kiali cannot re-use the remote cluster secrets created by istioctl.

1. By default, istioctl will generate remote cluster secrets that are associated with the service account "istio-reader-service-account". That Istio service account does not have the permissions that the Kiali server needs. If Kiali tries to use that remote cluster secret to communicate with the remote cluster, it will encounter multiple failures and will likely not even be able to properly initialize.
2. The istioctl command does have the ability to associate a remote cluster secret with a custom service account, however, Kiali cannot guarantee that users will do this. All the Istio multicluster docs provide instructions that assume the default service account is used. Also, the custom service account will have to have a superset of all the permissions that both Istio and Kiali need, and users may not want to create such a Service Account and give those permissions to Istio.
3. When the istioctl command creates a remote cluster secret, it puts a label on the secret to identify the secret as a remote cluster secret. That label name is hardcoded (it is not customizable) with a value of `istio/multiCluster=true`. This is the label that the Kiali Operator/Helm Charts will use to autodiscover remote cluster secrets (e.g. `kubectl get secrets -n istio-system -l istio/multiCluster=true`). This will be a problem if the user has multiple secrets where some were created using the "istio-reader-service-account" SA and some with a Kiali-specific SA. For example, assume the user created a remote cluster secret using istioctl with a custom service account that contains the necessary Kiali permissions (so Kiali can communicate with the remote cluster). Also assume the user followed the Istio docs and created a remote cluster secret using the istioctl defaults so Istio can communicate with the remote cluster. There are now two remote cluster secrets, each labeled with `istio/multiCluster=true`. Kiali will auto-discover and use both. But only one will work with Kiali; the other will cause Kiali to encounter multiple failures and will likely cause Kiali to fail to initialize properly.

For those reasons, Kiali will not support the istioctl generated remote cluster secrets. Instead, Kiali should provide documentation and/or a script (or similiar tool) to generate its own remote cluster secrets (in a similar way istioctl does it). In fact, one is currently in development (see the kiali/kiali github repo at hack/istio/multicluster/kiali-prepare-remote-cluster.sh). The idea is that the Kiali tool will generate its own secret with its own identification label (`kiali.io/multiCluster=true`). This tool can also be used to generate the necessary clusterrole/clusterrolebinding/serviceaccount/secret on the remote cluster; those would provide the necessary permissions that Kiali requires to do its work on the remote cluster.

## Testing

All automated e2e testing, API and Cypress, is currently performed against a single cluster in CI. There will be a large number of Kiali features related to multi-cluster so there needs to be a way to test multi-cluster deployments frequently and in an automated fashion. Any e2e tests that require a multi-cluster environment will need to be run separately from the rest of the suite.

## Other solutions

### Kiali Agent

A process that runs on each kube cluster that is a part of the mesh and exports Kiali’s view of that mesh to a centralized Kiali. This option offers potential performance gains and ease of configuration since Kiali no longer has to communicate with each individual kube cluster. However, it complicates Kiali’s ability to perform authorization with RBAC since the agents would be exporting data to a centralized Kiali and the centralized Kiali would not have access to the individual clusters. The agent itself adds an additional component to Kiali that would need to be maintained and configured across clusters.

### Connecting directly to istiod

The istiods provide istio config and some information about the mesh workloads. However, the endpoints are not always exposed outside of the istiod pod. Kiali today uses port forwarding through the Kubernetes API to connect to the istiod pods and thus requires access to the kube API . Some other features rely on the Kube API like streaming logs and any create/update operations need to use the Kube API ultimately making this an un-viable option to keep most of the existing Kiali features.

# Roadmap

- [ ] Multicluster Kubernetes support for Kiali.
  - [ ] Cache can be configured for multiple kubernetes clusters.
  - [ ] Client can be configured for multiple kubernetes clusters.
- [ ] Business services query across configured clusters for resources.
- [ ] Investigate automated testing setup: how kiali should test multi-cluster features in CI/CD.
- [ ] Multi-cluster demos for the different deployment models. These can also be used for testing.
- [ ] Define UI/UX changes to support MC
