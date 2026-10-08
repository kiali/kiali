---
references:
- kind: code
  role: implementation
  target: handlers/tracing.go
- kind: code
  role: implementation
  target: frontend/src/components/TracingIntegration/TracesComponent.tsx
---

# Trace

One request followed through the mesh, read from the tracing backend.

## Information kept

- **Trace ID** — the trace's identifier
- **Start time** — when the request started
- **Duration** — how long it took end to end
- **Spans** — each hop, with its application, workload, operation and duration
- **Errors** — whether any span failed
