---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Create Traffic Policies in the actions of a namespace
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The Product previews the policies built from each workload's observed traffic
  kind: product
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Name]}, {entity: edge, effect: reads, facts: [Source, Destination]}, {entity: istio-config, effect: reads, facts: [Kind, Name, Specification]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The User confirms
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The Product creates the policy Istio config
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: creates, facts: [Name, Kind, Created, Labels, Annotations, Specification, Validation, References]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
---

# Create traffic policies

## Trigger

The User wants only observed traffic to be allowed in a namespace.

## Outcome

The namespace denies all traffic except what each workload was seen to receive.
