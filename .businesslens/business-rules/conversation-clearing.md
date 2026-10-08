---
appliesTo:
- type: entity
  id: conversation
  effect: removes
permits:
- related: [{verb: holds, entity: session}, {verb: holds, entity: user}]
- unattended: true
references:
- kind: code
  role: implementation
  target: handlers/ai.go#DeleteConversations
- kind: code
  role: implementation
  target: ai/store.go#AIStoreImpl
---

# Only the User whose session holds a conversation clears it, or the Product once it goes unused

A User can discard only conversations of their own session; otherwise conversations disappear when the Product forgets unused ones or when Kiali restarts.
