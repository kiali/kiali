---
name: triage
description: Use when analyzing a git diff to build structured review briefs for subagents. Reads the diff, project config, and reference docs, then groups changes into review units and produces briefs using the review-brief template.
---

# Triage — Diff Analysis & Context Builder

## Purpose

Analyze the current git diff and produce structured review briefs that subagents can act on without needing to re-analyze the raw diff themselves. This skill runs in the main context (not as a subagent).

## When to Use

- **DO:** Use at the start of every `/code-reviewer:review` (or `/review`) or phase-specific review invocation, after the setup guard passes
- **DO NOT:** Use as a standalone review — this produces briefs, not findings

## Setup Guard

Before doing any analysis, check that both exist:
1. `.cursor/code-reviewer/config.md` (project config)
2. `.cursor/code-reviewer/reference/` directory with at least one reference doc

If either is missing, stop and tell the user:
> "No project configuration found. Run `/code-reviewer:setup` first to analyze your codebase and generate reference docs."

## Workflow

### Step 1: Capture the Diff

1. Read `.cursor/code-reviewer/config.md` to get `base_branch` (default: auto-detect `main` or `master`)
2. Run `git diff {base_branch}...HEAD --stat` to get the file list and change summary
3. Run `git diff {base_branch}...HEAD` to get the full diff
4. Run `git log {base_branch}..HEAD --oneline` to get commit messages
5. If there are no changes, tell the user: "No changes found between current branch and {base_branch}."

### Step 2: Load Context

1. Read `.cursor/code-reviewer/config.md` — parse YAML frontmatter for config, read markdown body for project context
2. Read all reference docs from `.cursor/code-reviewer/reference/`:
   - `style-guide.md`
   - `testing-practices.md`
   - `security-posture.md` (if exists)
   - `api-conventions.md` (if exists)
3. Note which reference docs exist — not all projects will have all four

### Step 3: Group into Review Units

Using your judgment based on the diff, config, and project context:
- Group changed files into logical **review units** (e.g., by language, domain area, directory)
- Small diffs (< ~10 files) may be a single unit
- Large diffs should be split so each unit is a coherent, reviewable chunk
- Consider the `languages` and `key_paths` config fields as hints, but use your judgment

For very large diffs (50+ files or very extensive changes), warn the user:
> "This diff is very large ({N} files changed). I'll split it into {M} review units. For faster feedback, consider reviewing in smaller batches by committing incrementally."

### Step 4: Produce Review Briefs

For each review unit, fill in the `.cursor/code-reviewer/templates/review-brief.md` template:
- Summarize what changed and infer why from commit messages and code context
- List all files in the unit with their change type (added/modified/deleted)
- Include relevant excerpts from reference docs (not the full docs — only sections relevant to this unit's files and changes)
- Summarize what else changed in other units (cross-unit context)
- Include the actual diff content for this unit's files

### Step 5: Produce Full-Scope Brief

Create an additional brief for the adversarial reviewer that contains:
- The complete change overview across all units
- All commit messages
- All reference doc excerpts (not just unit-scoped)
- Cross-unit dependency map (which units might affect each other)
- The full diff (or, for very large diffs, the diff with context-relevant surrounding code)

## Output

Return:
1. A list of review units with their briefs (for style and testing reviewers)
2. The full-scope brief (for the adversarial reviewer)
3. Metadata: branch name, base branch, total files changed, review unit count

## Quality Standards

- Every brief must be self-contained — a subagent should understand the change without reading additional files (though it can if needed)
- Reference doc excerpts should be relevant, not exhaustive — don't paste the entire style guide into every brief
- Cross-unit context should be concise — one sentence per other unit, not their full briefs
- File lists must use exact paths as they appear in the diff
