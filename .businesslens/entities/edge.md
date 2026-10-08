---
references:
- kind: code
  role: implementation
  target: graph/types.go
- kind: code
  role: implementation
  target: graph/telemetry/istio/appender/appender.go#ParseAppenders
---

# Edge

Traffic observed from one graph node to another over one protocol during the
chosen time, computed from the mesh's telemetry.

## Information kept

- **Source** — the node the traffic comes from
- **Destination** — the node it goes to
- **Protocol** — HTTP, gRPC or TCP
- **Request rate** — requests, messages or bytes per second
- **Error rate** — the share of failed requests by response code
- **Response time** — average, median, 95th or 99th percentile
- **Throughput** — request or response bytes per second
- **Traffic distribution** — its share of the source's requests
- **mTLS** — the share of the traffic protected by mutual TLS
- **Principals** — the source and destination identities
- **Response flags** — Envoy response flags by code
