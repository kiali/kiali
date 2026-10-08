---
kind: primary
routes:
  web: Web
steps:
- text: The User opens a service
  kind: actor
  actor: user
  entities: [{entity: service, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
- text: The Product shows its type, IP, ports, endpoints, hostnames, health, labels, annotations and validations
  kind: product
  actor: user
  entities: [{entity: service, effect: reads, facts: [Name, Type, Created, IP, Ports, Endpoints, Hostnames, Health, Labels, Annotations, Validations, Traffic routing]}, {entity: workload, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
- text: The Product lists the Istio config that applies to it with each object's validation
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Name, Kind, Validation]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
- text: The User opens the Traffic or Inbound Metrics tab
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::service-details
- text: The Product shows the service's edges and its inbound request metrics
  kind: product
  actor: user
  entities: [{entity: edge, effect: reads, facts: [Source, Destination, Request rate, Error rate]}, {entity: service, effect: reads, facts: [Inbound metrics]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
---

# View a service

## Trigger

The User selects a service.

## Outcome

The User understands where the service's traffic goes and which config shapes it.
