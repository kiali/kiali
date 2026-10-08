---
kind: primary
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
- text: The Product checks that the token can list at least one namespace
  kind: product
  actor: visitor
  entities: [{entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::sign-in::login
- text: The Product starts a session for the subject the token names
  kind: product
  actor: visitor
  entities: [{entity: session, effect: creates, facts: [Username, Expires on, Logged-in clusters]}]
  contexts:
    web:
      place: web-console::sign-in::login
- text: The Product opens the console where the person was going
  kind: product
  actor: visitor
  entities: []
  contexts:
    web:
      place: web-console::sign-in::login
---

# Sign in with a token

## Trigger

The authentication strategy is token and the Visitor opens the console.

## Outcome

The person is signed in until the session expiration passes, seeing what the token's Kubernetes roles allow.

## Edge cases

- An empty Log In asks the person to provide a service account token
