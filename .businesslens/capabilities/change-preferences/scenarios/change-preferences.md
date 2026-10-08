---
kind: primary
routes:
  web: Web
steps:
- text: The User opens Preferences from the user menu
  kind: actor
  actor: user
  entities: [{entity: preferences, effect: reads, facts: [Color scheme, Contrast mode, Theme, Language]}]
  contexts:
    web:
      place: web-console::signed-in
- text: The User picks a color scheme, contrast mode, theme and language
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::preferences
- text: The Product applies the choices and saves them in the browser
  kind: product
  actor: user
  entities: [{entity: preferences, effect: changes, facts: [Color scheme, Contrast mode, Theme, Language]}]
  contexts:
    web:
      place: web-console::signed-in::preferences
---

# Change preferences

## Trigger

The User wants the console darker, higher in contrast, or in another language.

## Outcome

The console uses the new appearance and language in that browser.
