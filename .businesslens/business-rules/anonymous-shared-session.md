---
appliesTo:
- {type: entity, id: session}
- {type: entity, id: conversation}
references:
- kind: code
  role: implementation
  target: handlers/authentication.go#AuthenticationHandler
- kind: code
  role: implementation
  target: handlers/ai.go#ChatSessionUsage
---

# Everyone using an anonymous Kiali shares one session

Under the anonymous authentication strategy every person reaches the console
through one shared session, so the conversations Kiali keeps for the chatbot
and the session token stats are shared by everyone using that Kiali.
