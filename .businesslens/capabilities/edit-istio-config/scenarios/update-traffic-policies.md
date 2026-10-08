---
kind: alternative
routes:
  web: Web
steps:
- text: The User chooses Update Traffic Policies in the actions of a namespace that has AuthorizationPolicies
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The Product previews the namespace's current AuthorizationPolicies and Sidecars
  kind: product
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name]}, {entity: istio-config, as: old-policy, effect: reads, facts: [Kind, Name, Specification]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The User edits the previewed YAML if needed and confirms
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The Product deletes the namespace's AuthorizationPolicies and Sidecars and recreates them as shown in the preview
  kind: product
  actor: user
  entities: [{entity: istio-config, as: old-policy, effect: removes}, {entity: istio-config, as: new-policy, effect: creates, facts: [Name, Kind, Created, Labels, Annotations, Specification, Validation, References]}, {entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
---

# Update traffic policies

## Trigger

The User wants to change the AuthorizationPolicies and Sidecars a namespace already has.

## Outcome

The namespace's AuthorizationPolicies and Sidecars are the ones the User confirmed in the preview.

## Edge cases

- The previewed policies are the namespace's existing ones, not policies rebuilt from observed traffic
- A policy the cluster refuses to recreate is reported, and the deleted original is not restored
