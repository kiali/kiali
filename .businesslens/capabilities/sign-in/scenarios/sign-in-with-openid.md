---
kind: alternative
routes:
  web: Web
steps:
- text: The Visitor chooses Log In With OpenID
  kind: actor
  actor: visitor
  entities: []
  contexts:
    web:
      place: web-console::sign-in::login
- text: The Visitor authenticates at the OpenID provider
  kind: actor
  actor: visitor
  entities: []
  contexts:
    web:
      place: web-console::sign-in::login
- text: The Product checks the person's email domain against the allowed domains
  kind: product
  actor: visitor
  entities: [{entity: kiali-configuration, effect: reads, facts: [Allowed domains]}]
  contexts:
    web:
      place: web-console::sign-in::login
- text: The Product checks that the person's token can list at least one namespace
  kind: product
  actor: visitor
  entities: [{entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::sign-in::login
- text: The Product starts a session lasting as long as the provider's token
  kind: product
  actor: visitor
  entities: [{entity: session, effect: creates, facts: [Username, Expires on, Logged-in clusters]}]
  contexts:
    web:
      place: web-console::sign-in::login
references:
- kind: code
  role: implementation
  target: handlers/authentication/openid_auth_controller.go#checkDomain
---

# Sign in with OpenID

## Trigger

The authentication strategy is openid and the Visitor opens the console; with nobody signed in the Product sends them to the provider straight away.

## Outcome

The person is signed in under the name the provider gives them.

## Edge cases

- When the provider's token is not trusted by the clusters, Kiali can be set to check the token itself and then shows everyone what its own service account sees
