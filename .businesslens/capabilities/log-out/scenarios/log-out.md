---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Logout in the user menu
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in
- text: The Product ends the session and clears its cookies
  kind: product
  actor: user
  entities: [{entity: session, effect: removes}]
  contexts:
    web:
      place: web-console::signed-in
---

# Log out

## Trigger

The User is done with the console.

## Outcome

The person is signed out and returns to the Login page.

## Decision points

### Sign-out at the identity provider

Does the sign-in method hold a session outside Kiali?

- OpenShift → the Product also deletes the person's OAuth access token in each cluster
- An OpenID provider that ends sessions → the Product sends the browser to the provider to end that session too
- A token or another OpenID provider → only the Kiali session ends
