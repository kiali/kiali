---
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/components/Nav/Masthead/UserDropdown.tsx
- kind: code
  role: implementation
  target: handlers/authentication/openshift_auth_controller.go#OpenshiftAuthRedirect
---

# Sign in to a cluster

On an OpenShift installation spanning several clusters, without impersonation,
a User signs in to each remote cluster separately from the user menu. It exists
only under the openshift authentication strategy.
