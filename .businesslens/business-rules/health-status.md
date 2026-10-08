---
appliesTo:
- type: entity
  id: application
  facts: [Health]
- type: entity
  id: workload
  facts: [Health]
- type: entity
  id: service
  facts: [Health]
- type: entity
  id: namespace
  facts: [Health]
references:
- kind: code
  role: implementation
  target: models/health_status.go
- kind: code
  role: implementation
  target: business/health_calculator.go
- kind: code
  role: implementation
  target: business/health_cache.go
---

# Health is the worse of pod readiness and request errors against the health tolerances

A workload is Not Ready with no desired pods, Failure with none available or with pending pods, Degraded with some unavailable or proxies out of sync. Request health is Failure or Degraded once the error rate reaches the health tolerances — by default 10% of 5xx, gRPC or unanswered requests fails, and 4xx degrades at 10% and fails at 20% — unless the object's own health annotation sets other rates. An application merges its workloads, a namespace shows its worst object, and without data health is unknown.

## Rationale

Health is computed for the health window in the background and served from a cache, so it can trail the mesh by up to one refresh, and health not computed yet is unknown rather than computed on demand.
