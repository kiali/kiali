---
appliesTo:
- type: entity
  id: pod
  effect: changes
  facts: [Proxy log level]
permits:
- configuredBy: kubernetes-role
  when: [{entity: kiali-configuration, fact: View only mode, is: 'Off'}]
references:
- kind: code
  role: implementation
  target: handlers/proxy_logging.go#LoggingUpdate
---

# Only people whose Kubernetes role allows it set a proxy log level, and never in view only mode

A User sets a pod proxy's log level only while their Kubernetes role lets them reach the pod's proxy, and Kiali refuses it outright while view only mode is on.
