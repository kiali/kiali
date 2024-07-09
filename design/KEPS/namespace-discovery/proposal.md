# Namespace Discovery

1. [Summary](#summary)
2. [Motivation](#motivation)
   1. [Goals](#goals)
3. [Solution](#solution)
4. [Roadmap](#roadmap)

# Summary

Provide a better way for namespace discovery within both server and operator.

# Motivation

Currently, the Kiali Server and Operator have many different ways to configure which namespaces should be accessible and viewable by the Kiali UI. The configurations are complex and confusing to users. We want to make things more easily configurable and understandable while still maintaining the ability for Kiali to have either cluster-wide access or limited access to specific namespaces.

## Goals

- Provide an easy way for users to configure Kiali UI to have access to specific namespaces.
- Provide a way for Kiali Server to have either cluster-wide access to all namespaces or limited access to a subset of namespaces.
- Remove the deprecated functionality that provided the old way of filtering and limiting namespace access.

# Solution

Provide a new list of "discovery selectors" in the same way that Istio itself has discovery selectors. In fact, the solution should include Kiali Server and/or Operator using the Istio Discovery Selectors where appropriate, and using Kiali's own discovery selectors as an optional mechanism to override Istio discovery selectors.

Kiali must prepare for the situation where Istio has no discovery selectors defined or Istio's discovery selectors configuration cannot be found (either Kiali does not have access to see the Istio ConfigMap or Istio simply isn't installed on the cluster where Kiali is located).

# Roadmap

- [ ] Add discovery selector support
- [ ] Remove deprecated mechanisms
- [ ] TODO...
