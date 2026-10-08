---
kind: validation
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
- text: The person's email domain is not among the allowed domains
  kind: condition
  actor: visitor
  entities: [{entity: kiali-configuration, effect: reads, facts: [Allowed domains]}]
  contexts:
    web:
      place: web-console::sign-in::login
- text: The Product refuses the sign-in and shows OpenID authentication failed
  kind: product
  actor: visitor
  entities: []
  contexts:
    web:
      place: web-console::sign-in::login
---

# An OpenID account from another domain is refused

## Trigger

The authentication strategy is openid and allowed domains are set.

## Outcome

No session starts.
