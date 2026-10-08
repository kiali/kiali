---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Session Token Stats in the user menu
  kind: actor
  actor: user
  entities: [{entity: session, effect: reads, facts: [Username]}]
  contexts:
    web:
      place: web-console::signed-in
- text: The Product shows requests and prompt, completion and total tokens per provider and model
  kind: product
  actor: user
  entities: [{entity: session, effect: reads, facts: [Token usage]}]
  contexts:
    web:
      place: web-console::signed-in::session-token-stats
---

# View session token stats

## Trigger

The User wants to know what their chatting has cost.

## Outcome

The User sees the token totals.

## Edge cases

- Before any question there are no token stats yet
