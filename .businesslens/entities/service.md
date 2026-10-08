---
domain: services
references:
- kind: code
  role: implementation
  target: business/services.go#SvcService
---

# Service

A Kubernetes service, or an external service a ServiceEntry declares, that
traffic is addressed to.

## Information kept

- **Name** — the service's name
- **Type** — Kubernetes or External
- **Created** — when it was created
- **IP** — its cluster IP
- **Ports** — its ports and their protocols
- **Endpoints** — the pods behind it
- **Hostnames** — the names it answers to
- **Health** — Healthy, Degraded, Failure, Not Ready or no health information
- **Labels** — its Kubernetes labels
- **Annotations** — its Kubernetes annotations
- **Traffic routing** — which routing wizard wrote its current routing, if any
- **Validations** — findings about its ports and the config that applies to it
- **Inbound metrics** — request volume, duration, size and errors of traffic it receives
