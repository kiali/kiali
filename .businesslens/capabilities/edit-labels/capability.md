---
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/components/Label/EditableLabelsCard.tsx
- kind: code
  role: implementation
  target: frontend/src/components/Label/EditableAnnotationsCard.tsx
- kind: code
  role: implementation
  target: frontend/src/pages/PageUtils.ts#buildMetadataPatch
---

# Edit labels

A User adds, changes and removes the labels of a namespace, workload or service
and saves them together.
