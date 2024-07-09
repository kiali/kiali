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
- Enable soft multi-tenancy kiali deployments.

# Solution

Provide a new list of "discovery selectors" in the same way that Istio itself has discovery selectors. Kiali will re-use the Istio Discovery Selectors it retreive's from the controlplanes `istio` configmap. Kiali will also have a new config option `<TODO>` that when specificed will be used instead of the controlplane's Istio Discovery Selectors.

Kiali must prepare for the situation where Istio has no discovery selectors defined or Istio's discovery selectors configuration cannot be found (either Kiali does not have access to see the Istio ConfigMap or Istio simply isn't installed on the cluster where Kiali is located).

# Roadmap

- [ ] Add discovery selector support
- [ ] Remove deprecated mechanisms
- [ ] TODO...
