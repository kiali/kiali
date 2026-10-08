---
kind: edge
routes:
  web: Web
steps:
- text: The session's expiry time is less than a minute away
  kind: condition
  unattended: true
  entities: [{entity: session, effect: reads, facts: [Expires on]}]
  contexts:
    web:
      place: web-console::signed-in
- text: The Product warns that the session will expire and offers to log out now
  kind: product
  entities: [{entity: session, effect: reads, facts: [Expires on]}]
  contexts:
    web:
      place: web-console::signed-in
- text: The Product ends the session when its expiry passes
  kind: product
  entities: [{entity: session, effect: removes}]
  contexts:
    web:
      place: web-console::signed-in
---

# The session expires

## Trigger

The session reaches its expiry time; it cannot be extended.

## Outcome

The person is signed out and must sign in again; unsaved changes are lost.

## Edge cases

- Any request that finds the session gone shows that the session has expired or was terminated in another window
