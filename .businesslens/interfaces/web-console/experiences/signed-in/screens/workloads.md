---
entities:
- {entity: workload, shows: [Name, Type, Health, Labels, Validations, Missing sidecar]}
- {entity: namespace, shows: [Name]}
- {entity: cluster, shows: [Name]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/WorkloadList/WorkloadListPage.tsx
---

# Workloads

The workloads of the selected namespaces.
