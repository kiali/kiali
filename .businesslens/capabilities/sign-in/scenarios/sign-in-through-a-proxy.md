---
kind: alternative
routes:
  web: Web
steps:
- text: The Visitor opens the console through the authenticating proxy in front of Kiali
  kind: actor
  actor: visitor
  entities: []
  contexts:
    web:
      place: web-console::sign-in::login
- text: The Product takes the bearer token and any impersonation the proxy sends
  kind: product
  actor: visitor
  entities: []
  contexts:
    web:
      place: web-console::sign-in::login
- text: The Product starts a session for the person the proxy names
  kind: product
  actor: visitor
  entities: [{entity: session, effect: creates, facts: [Username, Expires on, Logged-in clusters]}]
  contexts:
    web:
      place: web-console::sign-in::login
---

# Sign in through an authenticating proxy

## Trigger

The authentication strategy is header and a request arrives from the proxy.

## Outcome

The person is signed in without seeing a login form.

## Edge cases

- A request without a bearer token is refused with Token is missing
