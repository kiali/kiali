---
domain: workloads
references:
- kind: code
  role: implementation
  target: handlers/workloads.go
- kind: code
  role: implementation
  target: business/proxy_logging.go
---

# Pod

One running instance of a workload, with its containers and, in the mesh, its
Envoy proxy.

## Information kept

- **Name** — the pod's name
- **Status** — its phase and whether it is ready
- **Containers** — its containers, including the istio-proxy sidecar
- **Revision** — the Istio revision of its proxy
- **Logs** — the log lines of its containers for the chosen time
- **Proxy log level** — how much its Envoy proxy logs: off, trace, debug, info, warning, error or critical
- **Envoy configuration** — the proxy's clusters, listeners, routes, bootstrap and full configuration dump
