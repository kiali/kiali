---
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/ChatSessionUsage/ChatSessionUsagePage.tsx
- kind: code
  role: implementation
  target: handlers/ai.go#ChatSessionUsage
---

# View session token stats

A User sees what the AI chatbot has spent during their session, per provider
and model. It is offered while Chat AI and its conversation store are enabled;
the stats live in Kiali's memory and reset with the session or a restart.
