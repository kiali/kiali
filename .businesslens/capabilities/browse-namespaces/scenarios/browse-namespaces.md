---
kind: primary
routes:
  web: Web
steps:
- text: The User opens Namespaces
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::namespaces
- text: The Product lists each namespace with its type, mode, revision, health, mTLS, config validation summary and labels
  kind: product
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name, Type, Mode, Revision, Health, mTLS, Istio config summary, Labels]}, {entity: cluster, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::namespaces
- text: The User filters by name, health, type, mode, mTLS or label
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::namespaces
---

# Browse namespaces

## Trigger

The User wants to see which namespaces are in the mesh and how they are doing.

## Outcome

The User finds a namespace and can open it.

## Edge cases

- The revision column shows only while revision switching is enabled
