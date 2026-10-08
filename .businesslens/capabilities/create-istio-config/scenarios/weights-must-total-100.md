---
kind: validation
routes:
  web: Web
steps:
- text: The User sets traffic shifting weights that do not add up to 100%
  kind: actor
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Version]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-routing-wizard
- text: The Product shows that the weights must total 100% and keeps Create unavailable
  kind: product
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::traffic-routing-wizard
---

# Weights that do not total 100% are refused

## Trigger

The User shifts traffic between versions.

## Outcome

Nothing is written until the weights are fixed.

## Edge cases

- Matches, headers, hosts, ports, timeouts and TLS settings are checked the same way
