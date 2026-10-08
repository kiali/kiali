---
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/components/TracingIntegration/TracesComponent.tsx
- kind: code
  role: implementation
  target: handlers/tracing.go
---

# Browse traces

A User looks at the distributed traces of an application, workload or service
and opens one to compare it with similar traces. The Traces tab is offered
only while Kiali is integrated with a tracing backend it can query.
