---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses a routing wizard in the actions of a service without routing
  kind: actor
  actor: user
  entities: [{entity: service, effect: reads, facts: [Name, Traffic routing]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
- text: The User describes the routing between the versions behind the service
  kind: actor
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Version]}, {entity: service, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-routing-wizard
- text: The User chooses Create and reviews the preview of the Istio config
  kind: actor
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Kind, Specification]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-routing-wizard
- text: The User confirms creating the objects
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::traffic-routing-wizard
- text: The Product creates the routing Istio config labelled with the wizard
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: creates, facts: [Name, Kind, Created, Labels, Annotations, Specification, Validation, References]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-routing-wizard
- text: The Product reports that Istio Config was created for the service
  kind: product
  actor: user
  entities: [{entity: service, effect: reads, facts: [Name, Traffic routing]}, {entity: istio-config, effect: reads, facts: [Name, Kind]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
---

# Create traffic routing

## Trigger

The User wants to control how requests reach the versions of a service.

## Outcome

The service's traffic follows the new routing.

## Decision points

### Which wizard

What does the User want the routing to do?

- Route requests by headers, URI or other matches, shift weights, inject faults, set timeouts or shift TCP weights → the Product writes a DestinationRule with a subset per version and a VirtualService
- Route with the Kubernetes Gateway API → the Product writes an HTTPRoute or GRPCRoute

## Edge cases

- Choosing to expose the service through a gateway also creates a Gateway or Kubernetes Gateway
- Turning on a peer authentication in the traffic policy also creates, updates or deletes a PeerAuthentication
- The preview YAML can be edited before confirming
