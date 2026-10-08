---
entities:
- {entity: cluster, shows: [Name, Home cluster, Kubernetes version, API endpoint, Mesh]}
- {entity: control-plane, shows: [Revision, Version, Status, Mesh mTLS, Outbound traffic policy, Mesh configuration, Certificates, Resource usage, Managed namespaces]}
- {entity: namespace, shows: [Name, Health, mTLS, Mode, Labels, Istio config summary]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/Mesh/MeshPage.tsx
- kind: code
  role: implementation
  target: handlers/mesh.go#MeshGraph
---

# Mesh

The topology of the mesh itself: its clusters, control planes, data plane
namespaces and the observability services Kiali uses.
