---
scope: 'The Kiali server and its web console: backend handlers and business logic, the React frontend, and the AI chat integration.'
method: Static reading of source, configuration defaults and repository documentation; nothing was run.
covered:
- description: HTTP routes, handlers and authentication strategies.
  paths:
  - routing/
  - handlers/
  - server/
- description: Business logic for namespaces, apps, workloads, services, Istio config, health, mTLS and validations.
  paths:
  - business/
  - controller/
  - models/
- description: Traffic graph and mesh topology generation.
  paths:
  - graph/
  - mesh/
- description: Kubernetes and Istio client access and caches.
  paths:
  - kubernetes/
  - cache/
  - istio/
- description: Prometheus and tracing backend clients.
  paths:
  - prometheus/
  - tracing/
- description: Configuration model, defaults and built-in runtime dashboards.
  paths:
  - config/config.go
  - config/dashboards/
- description: AI chat providers, tools, prompts and conversation store.
  paths:
  - ai/
- description: Console pages, routes and navigation.
  paths:
  - frontend/src/pages/
  - frontend/src/routes.tsx
  - frontend/src/routes/
  - frontend/src/app/
- description: Console components for graph, wizards, Istio actions, labels, logs, Envoy, tracing, metrics, chatbot and masthead.
  paths:
  - frontend/src/components/
- description: Console state, services and shipped translations.
  paths:
  - frontend/src/store/
  - frontend/src/reducers/
  - frontend/src/actions/
  - frontend/src/services/
  - frontend/src/types/
  - frontend/public/locales/
exclusions:
- description: Developer, CI and cluster setup scripts and build files.
  paths:
  - hack/
  - .github/
  - make/
  - Makefile
  - deploy/
  - tools/
- description: Automated tests, fixtures and UI mocks.
  paths:
  - tests/
  - frontend/cypress/
  - frontend/src/mocks/
- description: Design proposals, generated API reference and agent-facing documentation.
  paths:
  - design/
  - docs/
  - kiali_internal_api.md
  - .code-reviewer/
  - .scribe/
- description: Shared utilities, logging and styling.
  paths:
  - util/
  - log/
  - frontend/src/styles/
  - frontend/src/utils/
unmapped:
- description: 'Command-line entry points: local run, offline run against collected data, and query gathering.'
  paths:
  - cmd/
  - kubernetes/offline/
  - config/offline.go
- description: Kiosk embedding of the console in another console.
  paths:
  - frontend/src/components/Kiosk/
- description: Notification center, About and debug information dialogs.
  paths:
  - frontend/src/components/NotificationCenter/
  - frontend/src/components/About/
- description: Grafana and Perses links.
  paths:
  - grafana/
  - perses/
- description: Individual Istio config validation checks.
  paths:
  - business/checkers/
- description: Tracing configuration tester on the Mesh page.
  paths:
  - frontend/src/components/Mesh/TracingDiagnose.tsx
  - handlers/tracing.go
- description: Direct tool calls for external MCP servers.
  paths:
  - handlers/ai.go
- description: Kiali's own status, metrics and health endpoints for operators.
  paths:
  - status/
  - prometheus/internalmetrics/
  - server/metrics_server.go
  - handlers/root.go
limitations:
- description: The Istio config tool the chat model calls, which applies changes itself when the model reports that the User agreed.
  paths:
  - ai/mcp/manage_istio_config/
---

# Coverage
