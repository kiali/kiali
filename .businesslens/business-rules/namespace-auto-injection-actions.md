---
appliesTo:
- type: entity
  id: namespace
  effect: changes
  facts: [Auto injection]
permits:
- configuredBy: kubernetes-role
  when:
  - {entity: kiali-configuration, fact: Auto injection actions, is: Enabled}
  - {entity: kiali-configuration, fact: Revision switching, is: Disabled}
- configuredBy: kubernetes-role
  when: [{entity: kiali-configuration, fact: Revision switching, is: Enabled}]
references:
- kind: code
  role: implementation
  target: frontend/src/pages/NamespaceDetails/namespaceDetailActions.ts#buildNamespaceRowActions
---

# A namespace's auto injection changes only through enabled injection actions or revision switching

The console changes a namespace's injection label through its auto injection actions only while those are enabled and revision switching is disabled, and otherwise only by switching revision while that is enabled.
