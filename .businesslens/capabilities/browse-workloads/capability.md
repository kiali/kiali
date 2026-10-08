---
domain: workloads
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/WorkloadList/WorkloadListPage.tsx
---

# Browse workloads

A User lists the workloads of chosen namespaces across clusters, with what keeps each out of the mesh.
