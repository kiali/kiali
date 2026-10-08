---
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/IstioConfigNew/IstioConfigNewPage.tsx
- kind: code
  role: implementation
  target: handlers/istio_config.go#IstioConfigCreate
- kind: code
  role: implementation
  target: business/istio_config.go#CreateIstioConfigDetail
- kind: code
  role: implementation
  target: frontend/src/components/IstioWizards/ServiceWizard.tsx
- kind: code
  role: implementation
  target: frontend/src/components/IstioWizards/WizardActions.ts#buildIstioConfig
- kind: code
  role: implementation
  target: frontend/src/components/IstioWizards/ServiceWizardActionsDropdownGroup.tsx
- kind: code
  role: implementation
  target: frontend/src/pages/Namespaces/NamespaceTrafficPolicies.tsx
- kind: code
  role: implementation
  target: frontend/src/components/ChatBot/EntryChat/FileAttachment.tsx
---

# Create Istio config

A User creates Istio or Gateway API configuration objects in the mesh. Kiali
offers four ways to do it:

- **A form** on the Istio Config list for an AuthorizationPolicy, Gateway,
  Kubernetes Gateway, ReferenceGrant, PeerAuthentication,
  RequestAuthentication, ServiceEntry or Sidecar, in one or more namespaces and
  clusters at once. Kinds whose APIs the cluster lacks are not offered.
- **A traffic routing wizard** — Request Routing, Fault Injection, Traffic
  Shifting, TCP Traffic Shifting, Request Timeouts, K8s HTTP Routing or K8s
  GRPC Routing — reached from a service's actions or its node on the Traffic
  Graph. The Product writes the routing objects the wizard describes and labels
  them with the wizard. The wizards need workloads with app and version labels
  behind the service; the Istio wizards need Istio's API and the K8s ones the
  Gateway API. Once a service has routing, only the wizard that wrote it is
  offered, to update it.
- **Create Traffic Policies** on a namespace outside the control plane, while
  Istio's API is enabled and the namespace has no AuthorizationPolicy yet.
- **A file the AI chatbot proposed**, applied from the chat.
