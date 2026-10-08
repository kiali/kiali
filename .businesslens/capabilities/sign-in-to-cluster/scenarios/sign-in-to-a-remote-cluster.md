---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Login to a logged-out cluster in the user menu
  kind: actor
  actor: user
  entities: [{entity: cluster, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in
- text: The User authenticates at that cluster's OpenShift OAuth server
  kind: actor
  actor: user
  entities: [{entity: cluster, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in
- text: The Product adds the cluster to the session's logged-in clusters
  kind: product
  actor: user
  entities: [{entity: session, effect: changes, facts: [Logged-in clusters]}, {entity: cluster, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in
---

# Sign in to a remote cluster

## Trigger

The User needs to see a remote cluster they are not signed in to.

## Outcome

The console shows that cluster's namespaces and objects too, as far as the User's roles there allow.
