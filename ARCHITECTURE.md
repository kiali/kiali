# Architecture

> This file is a navigation index. For detailed documentation, follow the links below.

## Documentation Index

- [Backend Architecture](docs/agents/backend-architecture.md) — Kiali is a Go binary whose `main()` calls `cmd.Execute()`, which starts a Cobra CLI that builds a Kubernetes client factory, initializes caches and controllers, then creates a gorilla/mux HTTP server with per-route authentication wrapping and a gzip/CORS/OTel middleware stack.
- [Business Logic Layer](docs/agents/business-logic.md) — The `business/` package provides per-request service objects (organised into a `Layer` struct) that implement all domain logic for Kiali's REST API — fetching and aggregating apps, workloads, services, health, Istio config, mesh topology, and validations.
- [Kubernetes Client Layer](docs/agents/kubernetes-client.md) — All Kubernetes, Istio, Gateway API, and OpenShift API access flows through a `ClientFactory` that vends short-lived per-user `UserClientInterface` clients (15-minute TTL) and long-lived Kiali SA `ClientInterface` clients; multi-cluster is handled by reading remote cluster secrets at startup.
- [Graph Engine](docs/agents/graph-engine.md) — The graph engine builds a directed traffic graph by querying Prometheus for Istio telemetry (`istio_requests_total` and related metrics), constructing a `TrafficMap` of typed nodes and edges, then running a pipeline of appenders that enrich the graph with health, security policy, Istio config decorations, and Ambient/waypoint topology.
- [Authentication and Security](docs/agents/auth-and-security.md) — Kiali supports five authentication strategies selected at startup. Each is backed by an `AuthController` implementation. Sessions are stored entirely client-side in AES-GCM encrypted cookies.
- [Observability Integrations and AI](docs/agents/observability-and-ai.md) — Kiali proxies distributed traces from Jaeger or Tempo (via HTTP or gRPC), generates deep-links to Grafana and Perses dashboards, exports its own spans via OTel, and provides an AI Chat feature backed by OpenAI-compatible or Google Gemini providers that call a set of MCP tools to query live mesh data.
- [Frontend Architecture](docs/agents/frontend-architecture.md) — A React 17 + TypeScript SPA that uses React Router v5 as a direct dependency plus `react-router-dom-v5-compat` for React Router v6 APIs, Redux with redux-persist, PatternFly 6 for UI components, typestyle for scoped CSS, and i18next for translations.
- [Build System and Dev Conventions](docs/agents/build-and-dev-conventions.md) — The Kiali build is driven by a decomposed Makefile (root + nine `.mk` files), builds a CGO-disabled Go binary with version ldflags, embeds a pre-built React frontend, and pushes images to OpenShift, Minikube, or KinD registries through a unified `cluster-push` target.

## Quick Reference

See [AGENTS.md](AGENTS.md) for commands, build instructions, and a directory overview.
