---
kind: validation
routes:
  web: Web
steps:
- text: The User enters annotations with an empty or repeated key
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Annotations]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The Product marks the problem and does not save
  kind: product
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::namespace-details
---

# Invalid annotations are refused

## Trigger

The User edits annotations.

## Outcome

The annotations stay as they were.
