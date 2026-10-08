---
relations:
- entity: conversation
  verb: holds
  cardinality: one-to-many
references:
- kind: code
  role: implementation
  target: handlers/authentication/session_persistor.go#SessionData
- kind: code
  role: implementation
  target: handlers/authentication.go#AuthenticationHandler
- kind: code
  role: implementation
  target: ai/store.go#AIStoreImpl
- kind: code
  role: implementation
  target: handlers/ai.go#ChatSessionUsage
---

# Session

A User's signed-in visit to the console, kept in an encrypted browser cookie
only Kiali can read. Under the anonymous authentication strategy everyone
shares one session.

## Information kept

- **Username** — the name the token, identity provider or proxy gives the person, or anonymous
- **Expires on** — when the session ends; the token's own expiry for OpenID and OpenShift, otherwise the session expiration
- **Logged-in clusters** — the clusters the person has signed in to, on OpenShift installations spanning several clusters
- **Token usage** — for each language model provider and model: questions answered, prompt, completion and total tokens, and when the first and last were recorded; kept in Kiali's memory and kept when conversations are cleared
