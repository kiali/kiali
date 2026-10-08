---
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/Mesh/MeshPage.tsx
- kind: code
  role: implementation
  target: mesh/generator/generator.go#BuildMeshMap
---

# View the mesh

A User sees the mesh's own topology — clusters, control planes, data plane
namespaces, gateways, waypoints and the observability services Kiali uses —
and inspects each part. Nothing on the Mesh page changes the mesh.
