# Namespaces

Listing namespaces, their place in the mesh, and the namespace actions that
enroll them in the ambient data plane or move them to another revision.

## Boundary

It does not own sidecar auto injection, which workloads share, the traffic
policies its actions write, which are Istio config, nor label and annotation
editing, which every kind of object shares.
