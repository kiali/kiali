---
domain: applications
references:
- kind: code
  role: implementation
  target: business/apps.go#AppService
---

# Application

The workloads and services of one namespace that share an app label, seen
together as one application.

## Information kept

- **Name** — the shared app label value
- **Health** — Healthy, Degraded, Failure, Not Ready or no health information
- **Mode** — whether it runs with sidecars or in ambient
- **Labels** — the labels its workloads share
- **Inbound metrics** — request volume, duration, size and errors of traffic it receives
- **Outbound metrics** — the same for traffic it sends
- **Runtime metrics** — the dashboards of the runtimes its workloads expose, such as Go, JVM or Quarkus
