---
type: web
actors:
- visitor
- user
entryPoints:
- web: /console/overview
references:
- kind: code
  role: implementation
  target: frontend/src/routes.tsx#navMenuItems
  title: Console navigation
- kind: code
  role: implementation
  target: routing/router.go#NewRouter
  title: Console and API routing
---

# Kiali web console

The browser console Kiali serves from its own address, usually under a
`/kiali` web root. People sign in there and then move between Overview, the
Traffic Graph, Mesh, Namespaces, Applications, Services, Workloads and Istio
Config.
