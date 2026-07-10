# Documentation Status

| Topic | Fresh | Human | Complete | Stale Flags | Review | File |
|-------|-------|-------|----------|-------------|--------|------|
| Backend Architecture | 60 | 0 | 88 | — | pending (drifted) | [backend-architecture.md](backend-architecture.md) |
| Business Logic Layer | 100 | 25 | 80 | — | pending (review needed) | [business-logic.md](business-logic.md) |
| Kubernetes Client Layer | 100 | 0 | 85 | — | pending (review needed) | [kubernetes-client.md](kubernetes-client.md) |
| Graph Engine | 100 | 9 | 83 | — | PASS_WITH_ANNOTATIONS | [graph-engine.md](graph-engine.md) |
| Observability Integrations and AI | 92 | 0 | 90 | — | PASS_WITH_ANNOTATIONS | [observability-and-ai.md](observability-and-ai.md) |
| Authentication and Security | 100 | 24 | 90 | — | PASS_WITH_ANNOTATIONS | [auth-and-security.md](auth-and-security.md) |
| Frontend Architecture | 100 | 9 | 91 | — | pending (review needed) | [frontend-architecture.md](frontend-architecture.md) |
| Build System and Dev Conventions | 100 | 0 | 78 | — | PASS | [build-and-dev-conventions.md](build-and-dev-conventions.md) |

## Stale Flags

No active stale flags.

## Review Annotations (PASS_WITH_ANNOTATIONS)

### observability-and-ai.md
- **Minor / WRONG_CLAIM**: `ai-providers:5` — StopReasonPauseTurn block is at lines 76-83 (not 72-76); at the final iteration the code returns an error rather than continuing.
- **Minor / MISSING_SECTION**: purgeInactiveSessions evicts based on session-level LastAccessed, not per-conversation timestamps.
- **Minor / STALE_REFERENCE**: Several line number citations are off by 1-3 lines.

### graph-engine.md
- **Minor / NAME_MISMATCH**: Prometheus counter was cited as `graph_cache_evictions_total`; corrected to `kiali_graph_cache_evictions_total`.

## Contradictions

None detected across topics.

---
*Updated by codebase-scribe — 2026-05-26. Scan SHA: e762c602fed1704d53eee77d820fcfd130952a70. Focus run: auth-and-security enriched with CredentialManager/token rotation, Istio certificate info, and external service credentials sections. Review: PASS_WITH_ANNOTATIONS (2 minor xref annotations remaining). 1 topic remains drifted (backend-architecture). Run `/codebase-scribe` again to continue.*
