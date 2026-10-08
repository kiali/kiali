---
entities:
- {entity: namespace, shows: [Name, Type, Mode, Revision, Health, mTLS, Labels, Annotations, Auto injection, Ambient enrollment, Istio config summary], collects: [Labels, Annotations]}
- {entity: cluster, shows: [Name]}
- {entity: workload, shows: [Name]}
- {entity: edge, shows: [Source, Destination]}
- {entity: istio-config, shows: [Kind, Name, Specification]}
- {entity: control-plane, shows: [Revision]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/NamespaceDetails/NamespaceDetailsPage.tsx
- kind: code
  role: implementation
  target: frontend/src/pages/NamespaceDetails/namespaceDetailActions.ts#buildNamespaceRowActions
---

# Namespace details

One namespace: its status, mesh membership, labels and annotations, a mini
graph, and the actions that enroll it in the mesh or write traffic policies
for it.
