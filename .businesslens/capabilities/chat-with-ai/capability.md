---
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: handlers/ai.go#ChatAI
- kind: code
  role: implementation
  target: ai/providers/chat_loop.go#RunChatLoop
- kind: code
  role: implementation
  target: frontend/src/components/ChatBot/ChatBot.tsx
- kind: code
  role: implementation
  target: ai/mcp/mcp_tools.go
- kind: code
  role: implementation
  target: ai/prompts/catalog.go#Catalog
---

# Chat with AI

A User asks the AI chatbot about the mesh from any page. The Product sends the
question, the page the User is on and the conversation so far to the language
model provider and model the User picked — OpenAI-compatible, Azure, Gemini,
Anthropic or Lightspeed — and lets the model read the mesh, logs, metrics and
traces through Kiali with the User's own access. Answers can link to
documentation, move the console to a relevant page and propose Istio config the
User may apply. It exists only while Chat AI is enabled, a developer preview.
