---
name: consolidation
description: Use when merging reports from multiple review subagents into a single consolidated output with deduplication, structured ID assignment, cross-unit findings, and a final verdict.
---

# Consolidation

## Purpose

Collect reports from all review phase subagents, assign final structured IDs, deduplicate findings, surface cross-unit issues, and present a single consolidated report to the engineer.

## When to Use

- **DO:** Use after all dispatched review subagents have returned their reports
- **DO NOT:** Use as a standalone review — this merges existing reports

## Input

You receive:
- Reports from all completed review phases (some may have failed — see Failure Handling)
- The triage metadata (branch, base branch, file count, unit count)
- The review unit definitions from the triage pass

## Structured ID Scheme

Every finding gets a structured ID:

| Prefix | Category | Source Phase |
|--------|----------|-------------|
| `BUG-N` | Bugs | adversarial |
| `SEC-N` | Security vulnerabilities | adversarial |
| `STY-N` | Style / convention violations | style |
| `TST-N` | Testing gaps or quality issues | testing |
| `IMP-N` | General improvements | any |

Numbers are sequential within each prefix, ordered by severity (Critical first, then Important, then Minor).

## Workflow

### Step 1: Collect Reports

Gather all subagent reports. Note which phases completed and which failed.

### Step 2: Assign Final IDs

Renumber all findings using the structured ID scheme above. Subagents assign preliminary IDs; consolidation produces the final numbering. Order by severity within each prefix.

### Step 3: Deduplicate

When multiple phases flag the same issue (same file:line or same conceptual problem):
- Keep the most detailed version
- Use the lowest-numbered ID from the merged findings
- Tag it with all phases that caught it: e.g., `**[adversarial, testing]**`
- Multiple phases catching the same issue is signal — it's likely important

### Step 4: Surface Cross-Unit Findings

Look across review units for issues that no single unit-scoped reviewer would catch:
- API changed in one unit but callers not updated in another
- Shared types modified but consumers not adjusted
- Config changes that affect multiple areas
- Test infrastructure changes that impact multiple test suites

### Step 5: Produce Consolidated Report

Output using this format:

```
## Review Summary
[1-2 sentence overview: what was reviewed, how many units, which phases ran]
[Note any phases that did not complete]

## Findings

### Critical
- **BUG-1** [Sub-category] `file:line` — description — why it matters — how to fix
- **SEC-1** [Sub-category] `file:line` — description — why it matters — how to fix

### Important
- **TST-1** `file:line` — description — why it matters — suggested fix
- **STY-1** `file:line` — [style guide §Section] — description — how to fix

### Minor
- **IMP-1** `file:line` — description
- **STY-2** `file:line` — [style guide §Section] — description

## Cross-Unit Findings
[Issues spanning multiple review units — if none, omit this section]

## Strengths
[Consolidated from all phases — what's done well, with file:line]

## Open Questions
[Aggregated from all phases, deduplicated]

## Verdict
**Ready to submit?** Yes / No / With fixes
**Reasoning:** [1-2 sentences]
```

## Failure Handling

If one or more phases did not complete:
- Produce the report with available results
- Note the gap in the Review Summary: "Style review did not complete — consider running `/code-reviewer:review:style` (or `/review:style`) separately."
- Adjust the Verdict to reflect incomplete coverage: "With fixes (note: style review did not run)"

## Severity Definitions

- **Critical:** bugs, security issues, data loss risks, broken functionality — must fix before submitting
- **Important:** architecture problems, missing features, poor error handling, test gaps — should fix
- **Minor:** code style, optimization opportunities, documentation improvements — nice to have

## Verdict Guidelines

- **Yes:** No Critical or Important issues. Minor issues only.
- **With fixes:** Important issues that should be addressed. No Critical issues, or Critical issues with straightforward fixes.
- **No:** Critical issues that indicate fundamental problems. Significant rework needed.

## Critical Rules

- **Don't add new findings.** Your job is to merge and organize, not to review code yourself.
- **Don't inflate severity.** If a phase marked something Minor, don't upgrade it to Important just because two phases caught it.
- **Don't lose findings.** Every issue from every phase report must appear in the consolidated output.
- **Keep it scannable.** Engineers should be able to read the Critical section first and know exactly what must be fixed.
- **Every finding needs an ID.** No finding should appear without a structured ID.
