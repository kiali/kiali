---
kind: primary
routes:
  web: Web
steps:
- text: The User opens a namespace
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The Product shows its cluster, health, revision, mode, type, mTLS, labels and annotations
  kind: product
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Health, Revision, Mode, Type, mTLS, Labels, Annotations, Auto injection, Ambient enrollment, Istio config summary]}, {entity: cluster, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
---

# View a namespace

## Trigger

The User selects a namespace anywhere in the console.

## Outcome

The User knows how the namespace takes part in the mesh.
