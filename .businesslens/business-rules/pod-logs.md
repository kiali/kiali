---
appliesTo:
- type: entity
  id: pod
  effect: reads
  facts: [Logs]
permits:
- configuredBy: kubernetes-role
  when: [{entity: kiali-configuration, fact: Logs tab, is: Enabled}]
references:
- kind: code
  role: implementation
  target: handlers/workloads.go
- kind: code
  role: implementation
  target: config/config.go#FeatureLogView
---

# Only people whose Kubernetes role allows it read pod logs, and only while the logs tab is enabled

Pod logs are shown to a User whose Kubernetes role lets them read the pod's logs, and to nobody while the logs tab is disabled.
