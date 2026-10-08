---
singleton: true
references:
- kind: code
  role: implementation
  target: config/config.go#Config
---

# Kiali configuration

The settings the team deploying Kiali gives it, through its configuration file
or Kiali custom resource. Kiali reads them and never changes them, and there is
one per Kiali installation.

## Information kept

- **View only mode** — On or Off; while On the console offers nothing that changes the clusters
- **Authentication strategy** — how people sign in: anonymous, token, openid, openshift or header; token unless set
- **Allowed domains** — the email domains an OpenID sign-in may come from; any domain while empty
- **Session expiration** — how long a token or header session lasts; 24 hours unless set
- **Chat AI** — Enabled or Disabled; whether the AI chatbot is offered; Disabled unless set
- **Chat allowed users** — the usernames allowed to chat with AI; everyone while empty
- **Conversation inactivity timeout** — how long conversations nobody uses are kept; 30 minutes unless set
- **Auto injection actions** — Enabled or Disabled; whether sidecar auto injection actions are offered; Enabled unless set
- **Revision switching** — Enabled or Disabled; whether switching a namespace to another Istio revision is offered; Disabled unless set
- **Logs tab** — Enabled or Disabled; whether workload logs are offered; Disabled only when listed among disabled features
- **Health tolerances** — the request error rates at which health turns Degraded or Failure, by namespace, kind, name, protocol and response code
- **Validation interval** — how often all Istio config is revalidated; one minute unless set, and zero turns validation off
- **Ignored validations** — validation codes never reported
