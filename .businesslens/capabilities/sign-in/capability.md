---
availability:
- {place: 'web-console::sign-in'}
references:
- kind: code
  role: implementation
  target: handlers/authentication/token_auth_controller.go
- kind: code
  role: implementation
  target: handlers/authentication/openid_auth_controller.go
- kind: code
  role: implementation
  target: handlers/authentication/openshift_auth_controller.go
- kind: code
  role: implementation
  target: handlers/authentication/header_auth_controller.go
- kind: code
  role: implementation
  target: frontend/src/pages/Login/LoginPage.tsx#LoginPageComponent
---

# Sign in

A Visitor proves who they are and starts a session. How depends on the
authentication strategy Kiali is deployed with: pasting a Kubernetes token,
signing in at an OpenID or OpenShift identity provider, or arriving through an
authenticating proxy. Under the anonymous strategy nobody signs in and every
request uses Kiali's own service account.
