---
domain: istio-config
references:
- kind: code
  role: implementation
  target: business/istio_config.go#IstioConfigService
- kind: code
  role: implementation
  target: kubernetes/types.go#ResourceTypesToAPI
  title: Kinds Kiali manages
---

# Istio config

One Istio or Kubernetes Gateway API configuration object in a namespace — such
as a VirtualService, DestinationRule, Gateway, AuthorizationPolicy,
PeerAuthentication, RequestAuthentication, ServiceEntry, Sidecar, HTTPRoute or
GRPCRoute.

## Information kept

- **Name** — the object's name
- **Kind** — its group, version and kind
- **Created** — when it was created
- **Labels** — its Kubernetes labels
- **Annotations** — its Kubernetes annotations
- **Specification** — the object as YAML
- **Validation** — Kiali's findings about it, each an error, warning or info with its code
- **References** — the services, workloads and other config objects it refers to
