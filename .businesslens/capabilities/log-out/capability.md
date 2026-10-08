---
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: handlers/authentication.go#Logout
- kind: code
  role: implementation
  target: frontend/src/components/SessionTimeout/SessionTimeout.tsx
---

# Log out

A User ends their session from the user menu, or the Product ends it when it
expires. Logout is not offered under the anonymous and header strategies.
