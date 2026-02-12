# LightSpeed Provider – Developer Notes

This provider integrates Kiali with **OpenShift LightSpeed (OLS)**, the AI-powered OCP assistant service.

## Upstream Service

- **Repository:** [openshift/lightspeed-service](https://github.com/openshift/lightspeed-service)
- **Description:** Core repository for the AI-powered OCP assistant service (FastAPI, LLM backends, K8s auth, RAG, etc.).

When implementing or changing API calls (e.g. `/v1/query`, `/v1/streaming_query`, `/authorized`, health, conversations), use the **official API contract** as the source of truth.

## API Contract (OpenAPI)

We rely on the **OpenAPI specification** published by the LightSpeed service for request/response shapes, endpoints, and semantics:

- **OpenAPI spec:** [docs/openapi.json](https://github.com/openshift/lightspeed-service/blob/main/docs/openapi.json)

Use this spec to:

- Map Kiali types to OLS request/response models (e.g. `LLMRequest`, `LLMResponse`, `Attachment`, streaming events).
- Align query parameters (e.g. optional `user_id` for no-op auth) and HTTP status handling (401, 403, 413, 422, 500).
- Stay consistent with schema versions and new fields as the OLS API evolves.

Relevant paths used by this provider include:

- `POST /v1/query` – non-streaming conversation
- `POST /v1/streaming_query` – streaming conversation (SSE/chunked)
- `POST /authorized` – validate user (K8s token)
- `GET /readiness`, `GET /liveness` – health
- Conversation and feedback endpoints as needed

## Authentication

OLS supports K8s-based auth (default) and no-op auth. This provider forwards the **Kiali user’s bearer token** to OLS (e.g. via `Authorization: Bearer <token>`). The token is taken from the request context and set on the client before each call; see `getBearerToken` and `p.client.SetAuthToken(bearerToken)` in `lightspeed.go`.

## References

- [OpenShift LightSpeed service](https://github.com/openshift/lightspeed-service) – upstream project and docs
- [OpenAPI spec (openapi.json)](https://github.com/openshift/lightspeed-service/blob/main/docs/openapi.json) – API contract for implementation and compatibility
