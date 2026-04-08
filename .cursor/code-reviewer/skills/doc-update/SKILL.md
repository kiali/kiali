---
name: doc-update
description: Use when considering whether review findings or engineer responses suggest the project's living reference docs need updating. Proposes changes explicitly and requires engineer confirmation before writing.
---

# Doc Update — Living Documentation Maintenance

## Purpose

After a review is complete and the engineer has responded to findings, consider whether the reference docs need updating. This skill guides the judgment about when to propose changes and how to apply them.

## When to Use

- **DO:** Use after the engineer has responded to review findings or open questions
- **DO NOT:** Use during the review itself — this is a post-review step
- **DO NOT:** Make any doc changes without explicit engineer confirmation

## Guidance for When to Propose Updates

Use your judgment. These are examples of the kind of situations that warrant asking, not an exhaustive checklist:

- The engineer confirms code is correct but it contradicts a reference doc
- The engineer pushes back on a finding and the pushback is valid — the doc may be outdated
- A pattern appears in the code that isn't documented at all — worth capturing
- A documented convention is consistently not followed across the diff — may be outdated
- The engineer explicitly says "we do it this way now" or similar

When in doubt, ask. The cost of asking is low; the cost of stale docs is high.

## How to Propose Changes

For each potential update, ask the engineer explicitly:

> "You confirmed that [specific thing]. The current [doc name] says [current rule]. Should I update it to reflect [proposed change]?"

Or for new conventions:

> "I noticed [pattern] consistently in this diff but it's not in the [doc name]. Should I add it?"

## Engineer Responses

- **Approve:** Update the doc with the change. Add a changelog entry.
- **Refine:** The engineer adjusts your proposed wording. Use their version. Add a changelog entry.
- **Decline:** "This was a one-off exception." Do not change the doc.

## Applying Updates

When updating a reference doc:

1. Read the current doc from `.cursor/code-reviewer/reference/`
2. Make the specific change (add, modify, or remove the convention)
3. Add a changelog entry:

| Date | Change | Trigger |
|------|--------|---------|
| {today} | {what changed} | Review feedback on {branch_name} |

4. Do NOT rewrite or reorganize the rest of the doc — only change what was approved

## Critical Rules

- **Never update silently.** Every change requires explicit engineer confirmation.
- **Never rewrite docs wholesale.** Make targeted changes only.
- **Preserve the changelog.** Always append, never clear.
- **One question per convention.** Don't batch multiple potential updates into a single question.
