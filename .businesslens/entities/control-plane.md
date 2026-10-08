---
references:
- kind: code
  role: implementation
  target: handlers/mesh.go#MeshControlPlanes
---

# Control plane

An istiod deployment managing part of the mesh, told apart by its revision.

## Information kept

- **Revision** — the Istio revision or tag it serves
- **Version** — the Istio version it runs
- **Status** — whether it is healthy
- **Mesh mTLS** — whether mutual TLS is enforced or automatic mesh-wide
- **Outbound traffic policy** — whether traffic to unknown destinations is allowed
- **Mesh configuration** — the effective mesh configuration and where each part comes from
- **Certificates** — the certificates it issues and trusts
- **Resource usage** — istiod CPU and memory against their thresholds
- **Managed namespaces** — the data plane namespaces it manages
