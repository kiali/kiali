---
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/components/ChatBot/ChatBot.tsx#clearChat
- kind: code
  role: implementation
  target: handlers/ai.go#DeleteConversations
---

# Clear chat

A User erases the current conversation with the AI chatbot and starts again.
