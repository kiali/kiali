---
appliesTo:
- type: entity
  id: conversation
  effect: changes
permits:
- configuredBy: kiali-configuration
  when: [{entity: kiali-configuration, fact: Chat AI, is: Enabled}]
references:
- kind: code
  role: implementation
  target: handlers/ai.go#ChatAI
- kind: code
  role: implementation
  target: handlers/config.go
---

# Only allowed users continue a conversation with AI, and only while Chat AI is enabled

A User may continue a conversation with the AI chatbot only while Chat AI is enabled and, when chat allowed users are set, only if their username is among them.
