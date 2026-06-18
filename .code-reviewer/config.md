---
base_branch: master
languages:
  - go
  - typescript
key_paths:
  - handlers/
  - business/
  - models/
  - kubernetes/
  - routing/routes.go
  - handlers/authentication/
  - frontend/src/actions/
  - frontend/src/components/
---

# Kiali

Kiali is an observability console for Istio service mesh, providing visibility into mesh topology, traffic, configuration, and health. The backend is Go (gorilla/mux, Kubernetes client-go), the frontend is TypeScript/React with PatternFly. The project supports multiple cluster types (OpenShift, minikube, kind) and integrates with Prometheus, Grafana, Jaeger/Tempo, and Istio APIs.

Key review areas: handler/business layer separation, Kubernetes client usage, authentication/authorization flow, multi-cluster support, and API route registration.
