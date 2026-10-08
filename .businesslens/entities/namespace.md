---
domain: namespaces
relations:
- entity: application
  verb: contains
  cardinality: one-to-many
- entity: workload
  verb: contains
  cardinality: one-to-many
- entity: service
  verb: contains
  cardinality: one-to-many
- entity: istio-config
  verb: holds
  cardinality: one-to-many
references:
- kind: code
  role: implementation
  target: business/namespaces.go#NamespaceService
- kind: code
  role: implementation
  target: business/tls.go#TLSService
---

# Namespace

A Kubernetes namespace in one cluster, and how it takes part in the mesh.

## Information kept

- **Name** — the namespace's name
- **Type** — Control plane, Data plane, or not part of the mesh
- **Mode** — Ambient, Sidecar or Not applicable
- **Auto injection** — whether new pods get a sidecar: Enabled, Disabled or not set
- **Ambient enrollment** — whether its workloads join the ambient data plane: ambient, none or not set
- **Revision** — the Istio revision that manages it, if one is chosen
- **Health** — the worst health of its applications, workloads and services
- **mTLS** — Strict, Permissive, Disabled, Unset or Validation error
- **Istio config summary** — how many Istio config objects it holds and how many have errors or warnings
- **Labels** — its Kubernetes labels
- **Annotations** — its Kubernetes annotations
