---
kind: primary
routes:
  web: Web
steps:
- text: The User opens the Traces tab of a service
  kind: actor
  actor: user
  entities: [{entity: service, effect: reads, facts: [Name]}, {entity: trace, effect: reads, facts: [Trace ID]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
- text: The Product plots recent traces by time and duration, marking failed ones
  kind: product
  actor: user
  entities: [{entity: trace, effect: reads, facts: [Trace ID, Start time, Duration, Errors]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
- text: The User selects a trace
  kind: actor
  actor: user
  entities: [{entity: trace, effect: reads, facts: [Trace ID]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
- text: The Product shows its spans and how its duration compares with similar traces and with metrics
  kind: product
  actor: user
  entities: [{entity: trace, effect: reads, facts: [Spans, Duration]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
---

# Browse traces

## Trigger

The User wants to see individual requests behind a metric.

## Outcome

The User has found a slow or failed request and the hops it took.

## Edge cases

- The User can narrow traces by percentile, errors only and number of traces
- A selected trace can be shown on the traffic graph
