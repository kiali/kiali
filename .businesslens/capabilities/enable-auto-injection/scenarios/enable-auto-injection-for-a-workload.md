---
kind: alternative
routes:
  web: Web
steps:
- text: The User chooses Enable Auto Injection in the actions of a workload
  kind: actor
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Name, Auto injection]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The Product sets the inject label to true on the workload's template
  kind: product
  actor: user
  entities: [{entity: workload, effect: changes, facts: [Auto injection]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
---

# Enable auto injection for a workload

## Trigger

The User wants one workload to differ from its namespace.

## Outcome

New pods of the workload follow the new setting.
