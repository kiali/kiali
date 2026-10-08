---
kind: alternative
routes:
  web: Web
steps:
- text: The Visitor chooses Log In With OpenShift
  kind: actor
  actor: visitor
  entities: []
  contexts:
    web:
      place: web-console::sign-in::login
- text: The Visitor authenticates at OpenShift
  kind: actor
  actor: visitor
  entities: []
  contexts:
    web:
      place: web-console::sign-in::login
- text: The Product starts a session in the home cluster for the person OpenShift names
  kind: product
  actor: visitor
  entities: [{entity: session, effect: creates, facts: [Username, Expires on, Logged-in clusters]}, {entity: cluster, effect: reads, facts: [Name, Home cluster]}]
  contexts:
    web:
      place: web-console::sign-in::login
---

# Sign in with OpenShift

## Trigger

The authentication strategy is openshift and the Visitor opens the console.

## Outcome

The person is signed in to the home cluster; with impersonation on, that one sign-in covers every cluster.

## Edge cases

- With impersonation on, privileged system identities and users outside the allowed users are refused
