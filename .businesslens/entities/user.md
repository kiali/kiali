---
kind: person
acts: external
relations:
- entity: session
  verb: holds
  cardinality: one-to-many
- entity: preferences
  verb: keeps
  cardinality: one-to-one
references:
- kind: code
  role: implementation
  target: handlers/authentication.go#AuthenticationHandler
---

# User

A person signed in to the Kiali web console — someone who runs, secures or
builds on the mesh. What a User sees and changes in each cluster is what the
Kubernetes roles bound to their identity allow there; under the anonymous
authentication strategy every User acts with Kiali's own service account.
