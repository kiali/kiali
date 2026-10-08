---
kind: configuration
of: capability-scenario
settings:
- {entity: kiali-configuration, fact: Authentication strategy}
takesEffect: When Kiali starts with its configuration; a changed strategy applies once Kiali restarts with it.
stability: A session started under another strategy is no longer accepted after the strategy changes, and the person signs in again.
alternatives:
- id: sign-in-with-token
  selectedWhen: Authentication strategy is token, which applies when none is set.
- id: sign-in-with-openid
  selectedWhen: Authentication strategy is openid.
- id: sign-in-with-openshift
  selectedWhen: Authentication strategy is openshift.
- id: sign-in-through-a-proxy
  selectedWhen: Authentication strategy is header.
---

# Sign-in method

Each Kiali installation signs people in one way, chosen by the team deploying it to fit how their clusters authenticate people.
