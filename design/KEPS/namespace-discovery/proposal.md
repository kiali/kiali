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

Provide a new list of "discovery selectors" in the same way that [Istio itself has discovery selectors](https://istio.io/latest/docs/reference/config/istio.mesh.v1alpha1/#MeshConfig). Kiali will not attempt to use the Istio Discovery Selectors, but it will be configurable using the same kind of selector mechanism. Kiali will have a new config option `deployment.discovery_selectors` that, when specified, will be used to limit what namespaces Kiali will access. It will support an array of [Kubernetes equality-based and set-based selectors](https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#resources-that-support-set-based-requirements) just like Istio Discovery Selectors.  For example:
```yaml
spec:
  deployment:
    discovery_selectors:
      default:
      - matchLabels:
          abc: def
          uvw: xyz
      - matchLabels:
          org: accounting
        matchExpressions:
        - key: tier
          operator: In
          values: ["production"]
        - key: region
          operator: NotIn
          values: ["east"]
      - matchExpressions:
        - key: country
          operator: In
          values: ["us", "ca"]
```

## Istio Discovery Selectors

Kiali currently attempts to autodiscover the Istio control planes. However, Kiali will not use the discovery selectors that have been set in Istio (the Istio meshConfig.discoverySelectors). Kiali will scope itself to the namespaces selected only by Kiali's own discovery selectors.

## Discovery Selector Kiali Config Option

A new configuration option will be added that will mimic the Istio `discoverySelectors` configuration option. Using the configuration option, users will be able to similarly scope Kiali to the defined set of namespaces. Having a config option within Kiali has the advantage of not relying on auto-discovery via the Istio control plane. Kiali does not need to fail if it cannot, even temporarily, access the control plane configuration, because it can rely on its own discovery selectors configuration. The configuration option needs to provide enough flexibility for users to specify different discovery selectors for each cluster in multi-primary scenarios.

Kiali would add a `deployment.discovery_selectors` config option where you can specify a default set of discovery selectors and additional cluster-specific overrides `map[string]labelselector` where the key is the cluster name that the discovery selector will apply to. Cluster specific overrides will take precedence over the defaults.

```yaml
discovery_selectors:
  default:
  - <array of label selectors>
  overrides:
    cluster_name:
    - <array of label selectors>
```

For multi-primary with different discovery selectors (note: there is no `default` section; each primary is its own overrides):

```yaml
discovery_selectors:
  overrides:
    east:
    - matchLabels:
        team: backend
    west:
    - matchLabels:
        team: api
```

## No cluster wide access

Kiali relies on `deployment.accessible_namespaces.default` when `deployment.cluster_wide_access = false` to know which namespaces the server should create a kube cache for. The operator also uses `deployment.accessible_namespaces.default` to create a `Role/RoleBinding` for the Kiali server's Service Account giving the Kiali server access to that namespace. In order for the operator to create RBAC rules for the Kiali server, the operator will need to reconcile the discovery selectors with namespaces that exist in the cluster. The operator can take what is set in `deployment.discovery_selectors.default` and set the Kiali server's `deployment.discovery_selectors.default` config field to be the result of this reconcilation. For example:

```yaml
spec:
  deployment:
    cluster_wide_access: false
    discovery_selectors:
      default:
      - matchLabels:
          team: backend
```

would be translated into the Kiali config as:

```yaml
spec:
  deployment:
    cluster_wide_access: false
    discovery_selectors:
      default:
      - matchLabels:
          kubernetes.io/metadata.name: backend-app1
      - matchLabels:
          kubernetes.io/metadata.name: backend-app2
```

An alternative (that has been rejected but left here for historical purposes) is to keep `deployment.accessible_namespaces` and make it an "internal" field that only the operator sets and not users.

```yaml
spec:
  deployment:
    accessible_namespaces:
    - backend-app1
    - backend-app2
    cluster_wide_access: false
    discovery_selectors:
      default:
      - matchLabels:
          team: backend
```

The Kiali server could also lazily start kube caches whenever they are first accessed rather than relying on the operator to tell it which namespaces it has access to but the operator will already need to reconcile the namespaces in order to create a RBAC rules for the server in that namespace. Therefore it would be simpler for the operator to pass in the list of namespaces to the server.

Note that this won't work in multi-cluster scenarios since the operator has no access to the external clusters. Because of this, setting `deployment.cluster_wide_access = false` is unsupported for multi-cluster deployments.

# Roadmap

- [ ] Add discovery selector support
- [ ] Remove deprecated mechanisms
- [ ] Document the new feature
