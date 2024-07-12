# Namespace Discovery

1. [Summary](#summary)
2. [Motivation](#motivation)
   1. [Goals](#goals)
3. [Solution](#solution)
4. [Roadmap](#roadmap)

# Summary

Provide a better way for namespace discovery within both server and operator.

# Motivation

Currently, the Kiali Server and Operator have many different ways to configure which namespaces should be accessible and viewable by the Kiali UI. The configurations are complex and confusing to users. We want to make things more easily configurable and understandable while still maintaining the ability for Kiali to have either cluster-wide access or limited access to specific namespaces. We also want Kiali to support soft multitenancy using the same mechanism as Istio to make configuration more consistent with Istio and easier for users.

## Goals

- Provide an easy way for users to configure Kiali UI to have access to specific namespaces.
- Provide a way for Kiali Server to have either cluster-wide access to all namespaces or limited access to a subset of namespaces.
- Remove the deprecated functionality that provided the old way of filtering and limiting namespace access.
- Enable soft multi-tenancy Kiali deployments where multiple Kialis with cluster wide access can be deployed to the same cluster and scoped to specific namespaces.

# Solution

Provide a new list of "discovery selectors" in the same way that Istio itself has discovery selectors. Kiali will re-use the Istio Discovery Selectors it retreive's from the controlplanes `istio` configmap. Kiali will also have a new config option `deployment.discovery_selectors` that when specificed will be used instead of the controlplane's Istio Discovery Selectors.

## Istio Discovery Selectors

Kiali already autodiscovers the istio controlplanes. Discovery selectors for the istio controlplane can be found by looking at the controlplane's `istio` configmap under `mesh.discoverySelectors`. Kiali will read this configmap and if discovery selectors have been set, Kiali will scope itself to the namespaces selected by the discovery selectors. In cases where there are multiple controlplanes e.g. with revisioned upgrades, Kiali will read both discovery selectors and OR the two together scoping itself to the disjoint of the two sets. For example:

Controlplane A discovery selector:

```yaml
discoverySelectors:
  - matchLabels:
      team: api
```

Controlplane B discovery selector:

```yaml
discoverySelectors:
  - matchLabels:
      team: backend
```

Kiali discovery selector:

```yaml
discoverySelectors:
  - matchLabels:
      team: backend
  - matchLabels:
      team: api
```

For multi-primary cluster deployments, Kiali will scope the namespaces according to the discovery selector's defined on that cluster.

Cluster A discovery selector:

```yaml
discoverySelectors:
  - matchLabels:
      team: api
```

Cluster B discovery selector:

```yaml
discoverySelectors:
  - matchLabels:
      team: backend
```

Kiali discovery selector cluster A:

```yaml
discoverySelectors:
  - matchLabels:
      team: api
```

Kiali discovery selector cluster B:

```yaml
discoverySelectors:
  - matchLabels:
      team: backend
```

The same rules for multiple revisions in a multi-cluster deployment would still apply.

Primary-remote deployments would behave the same as single cluster where the remote cluster is scoped to the primary controlplane's discovery selectors.

TODO: external control plane

### Failure scenarios

Since the discovery selectors act as a way to separate multiple Kiali deployments from one another, when Kiali relies on autodiscovering the Istio discovery selectors and it cannot auto discover them, the Kiali server will fail to start and/or panic rather than potentially show out of scope data. In a multi-primary deployment, if one primary cannot be reached then that cluster will be considered inaccessible.

## Discovery Selector Kiali Config Option

A new configuration option will be added that will mimic the Istio `discoverySelectors` configuration option. Using the configuration option, users will be able to similarly scope Kiali to the defined set of namespaces. This configuration option would take precedence over the autodiscovered controlplane discovery selectors. Having a config option within Kiali has the advantage of not relying on auto-discovery via the Istio control plane. Kiali does not need to fail if it cannot, even temporarily, access the control plane configuration, because it can rely on its own discovery selectors configuration. The configuration option needs to provide enough flexibility for users to specify different discovery selectors for each cluster in multi-primary scenarios.

Kiali would add a `deployment.discovery_selectors` config option where you can specify global discovery selectors or cluster specific overrides `map[string]labelselector` where the key is the cluster name that the discovery selector will apply to. Cluster specific overrides will take precedence over the global option for that cluster.

```yaml
discoverySelectors:
  global:
    - labelSelector:
  cluster_name:
    - labelSelector:
```

For multi-primary with different discovery selectors:

```yaml
discoverySelectors:
  east:
    - matchLabels:
        team: backend
  west:
    - matchLabels:
        team: api
```

## No cluster wide access

Kiali relies on `deployment.accessible_namespaces` when `deployment.cluster_wide_access = false` to know which namespaces the server should create a kube cache for. The operator also uses `deployment.accessible_namespaces` to create a `Role/RoleBinding` for the Kiali server's Service Account giving the Kiali server access to that namespace. In order for the operator to create RBAC rules for the Kiali server, the operator will need to reconcile the discovery selectors with namespaces that exist in the cluster. The operator can take what is set in `deployment.discovery_selectors` and set the Kiali server's `deployment.discovery_selectors` config field to be the result of this reconcilation. For example:

```yaml
spec:
  deployment:
    cluster_wide_access: false
    discovery_selectors:
      - matchLabels:
          team: backend
```

would be translated into the Kiali config as:

```yaml
spec:
  deployment:
    cluster_wide_access: false
    discovery_selectors:
      - matchLabels:
          kubernetes.io/metadata.name: backend-app1
      - matchLabels:
          kubernetes.io/metadata.name: backend-app2
```

An alternative is to keep `deployment.accessible_namespaces` and make it an "internal" field that only the operator sets and not users.

```yaml
spec:
  deployment:
    accessible_namespaces:
      - backend-app1
      - backend-app2
    cluster_wide_access: false
    discovery_selectors:
      - matchLabels:
          team: backend
```

The Kiali server could also lazily start kube caches whenever they are first accessed rather than relying on the operator to tell it which namespaces it has access to but the operator will already need to reconcile the namespaces in order to create a RBAC rules for the server in that namespace. Therefore it would be simpler for the operator to pass in the list of namespaces to the server.

Note that this won't work in multi-cluster scenarios since the operator has no access to the external clusters. Because of this, setting `deployment.cluster_wide_access = false` is unsupported for multi-cluster deployments.

# Roadmap

- [ ] Add discovery selector support
- [ ] Remove deprecated mechanisms
- [ ] TODO...
