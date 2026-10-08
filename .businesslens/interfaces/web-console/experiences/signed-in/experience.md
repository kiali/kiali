---
actors:
- user
access: authenticated
references:
- kind: code
  role: implementation
  target: handlers/authentication.go#AuthenticationHandler
  title: Every console request needs a session
---

# Signed-in console

Everything a signed-in person reaches: the mesh views, the details of each
namespace, application, workload, service and Istio config object, the actions
that change them, their preferences and the AI chatbot.
