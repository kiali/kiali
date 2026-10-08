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

# Edit annotations

A User adds, changes and removes the annotations of a namespace, workload or service
and saves them together. For a workload with a pod template, its own annotations and its pod template's are edited separately.
