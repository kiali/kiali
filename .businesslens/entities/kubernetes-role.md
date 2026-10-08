---
references:
- kind: code
  role: implementation
  target: business/istio_config.go#getPermissionsApi
  title: Self-subject access reviews
---

# Kubernetes role

The permissions a person holds in a cluster Kiali reads, defined and bound in
Kubernetes outside Kiali. Kiali asks the cluster what the signed-in person may
list, create, patch and delete, offers only what is allowed, and the cluster
itself refuses anything the role does not permit.

## Information kept

- **Name** — the role's name in the cluster
- **Permissions** — the resources and verbs it allows, cluster-wide or in one namespace
- **Subjects** — the users, groups and service accounts bound to it
