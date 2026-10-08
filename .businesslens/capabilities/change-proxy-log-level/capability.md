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
  target: handlers/proxy_logging.go#LoggingUpdate
---

# Set Proxy Log Level

A User changes how much a pod's Envoy proxy logs, from the Logs tab of its
workload, for pods with an istio-proxy container.
