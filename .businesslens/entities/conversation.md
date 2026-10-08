---
references:
- kind: code
  role: implementation
  target: ai/store.go#AIStoreImpl
- kind: code
  role: implementation
  target: ai/types/types.go#Conversation
---

# Conversation

A User's exchange with the AI chatbot, kept in Kiali's memory as long as it is
used. Each answer comes from the language model provider the User picked,
which may read the mesh through Kiali on the User's behalf.

## Information kept

- **Messages** — the questions and answers so far
- **Mode** — Ask or Troubleshoot
- **Model** — the provider and model answering
- **Last accessed** — when it was last used
