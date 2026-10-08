---
domain: workloads
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/WorkloadDetails/WorkloadPodLogs.tsx
- kind: code
  role: implementation
  target: handlers/workloads.go
---

# View pod logs

A User reads the logs of a workload's pods, including the proxy's and, in
ambient, the ztunnel and waypoint entries for the workload. It is offered only
while the logs tab is enabled.
