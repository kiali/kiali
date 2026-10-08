---
relations:
- entity: namespace
  verb: contains
  cardinality: one-to-many
- entity: control-plane
  verb: runs
  cardinality: one-to-many
references:
- kind: code
  role: implementation
  target: mesh/generator/generator.go#BuildMeshMap
---

# Cluster

A Kubernetes cluster of the mesh that Kiali reads: the home cluster Kiali runs
in, or a remote one.

## Information kept

- **Name** — the cluster's name in the mesh
- **Home cluster** — whether Kiali runs in it
- **Kubernetes version** — the version the cluster runs
- **API endpoint** — where Kiali reaches its Kubernetes API
- **Istio component status** — for each core and add-on component: Healthy, Unhealthy, Unreachable, Not found or Not ready
- **Mesh** — the mesh it belongs to
