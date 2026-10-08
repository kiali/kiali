---
kind: validation
routes:
  web: Web
steps:
- text: The Visitor pastes a Kubernetes token and chooses Log In
  kind: actor
  actor: visitor
  entities: []
  contexts:
    web:
      place: web-console::sign-in::login
- text: The token is invalid or expired, or can list no namespace
  kind: condition
  actor: visitor
  entities: [{entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::sign-in::login
- text: The Product refuses the sign-in and shows Login unsuccessful with the reason
  kind: product
  actor: visitor
  entities: []
  contexts:
    web:
      place: web-console::sign-in::login
---

# A token that cannot sign in is refused

## Trigger

The authentication strategy is token and the Visitor tries a token.

## Outcome

No session starts and the Visitor stays on the Login page.
