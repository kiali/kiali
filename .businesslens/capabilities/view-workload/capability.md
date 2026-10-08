---
domain: workloads
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/WorkloadDetails/WorkloadDetailsPage.tsx
- kind: code
  role: implementation
  target: business/workloads.go#WorkloadService
---

# View a workload

A User opens one workload to see its pods and proxies, health, traffic and metrics.
