---
kind: validation
routes:
  web: Web
steps:
- text: The User enters labels with an empty or repeated key
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Labels]}]
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

# Invalid labels are refused

## Trigger

The User edits labels.

## Outcome

The labels stay as they were.
