---
appliesTo:
- {type: entity, id: namespace, effect: reads}
- {type: entity, id: application, effect: reads}
- {type: entity, id: workload, effect: reads}
- {type: entity, id: pod, effect: reads}
- {type: entity, id: service, effect: reads}
- {type: entity, id: istio-config, effect: reads}
- {type: entity, id: control-plane, effect: reads}
permits:
- configuredBy: kubernetes-role
references:
- kind: code
  role: implementation
  target: business/namespaces.go#NamespaceService
- kind: code
  role: implementation
  target: handlers/authentication.go#AuthenticationHandler
---

# People see only what their Kubernetes role lets them read

Every list, graph, count and detail page in the console covers only the
namespaces the User's Kubernetes roles let them see, and the objects in them,
so two Users may see different meshes. Traffic from namespaces they cannot see
appears without details, and control planes in namespaces they cannot access
are left out. Under the anonymous strategy everyone sees what Kiali's own
service account may read.
