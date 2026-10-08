---
kind: validation
routes:
  web: Web
steps:
- text: The User enters a name that is not a valid Kubernetes name
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::new-istio-config
- text: The Product marks the name as invalid and offers no preview until it is fixed
  kind: product
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::new-istio-config
---

# An invalid name is refused

## Trigger

The User fills in the form.

## Outcome

Nothing is created.

## Edge cases

- A form with no namespace or no cluster chosen is refused the same way
- Kind-specific settings such as hosts, IP addresses and label selectors are checked as they are typed
