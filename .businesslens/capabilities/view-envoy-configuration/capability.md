---
domain: workloads
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/components/Envoy/EnvoyDetails.tsx
- kind: code
  role: implementation
  target: handlers/proxy_status.go
---

# View Envoy configuration

A User reads the configuration a pod's Envoy proxy holds right now, to see how
the mesh is programming it.
