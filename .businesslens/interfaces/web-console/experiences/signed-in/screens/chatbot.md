---
entities:
- {entity: conversation, shows: [Messages, Mode, Model], collects: [Messages, Mode, Model]}
- {entity: istio-config, shows: [Kind, Name, Specification], collects: [Specification]}
references:
- kind: code
  role: implementation
  target: frontend/src/components/ChatBot/ChatBot.tsx
- kind: code
  role: implementation
  target: frontend/src/components/ChatBot/EntryChat/FileAttachment.tsx
---

# Chatbot

The AI chatbot panel, opened over whatever page the person is on: the
conversation, the model and mode in use, suggested prompts for the page, and
any Istio config the chatbot proposes.
