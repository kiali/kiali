---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Disable Auto Injection in the actions of a namespace
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name, Auto injection]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The User confirms
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The Product sets the injection label to disabled and drops any revision label on the namespace
  kind: product
  actor: user
  entities: [{entity: namespace, effect: changes, facts: [Auto injection, Revision]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
---

# Disable auto injection for a namespace

## Trigger

The User wants to change whether new pods in a namespace join the mesh with a sidecar.

## Outcome

Pods created in the namespace from now on follow the new setting; running pods are unchanged until restarted.
