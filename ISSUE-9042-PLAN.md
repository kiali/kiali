# Plan: Buildable State First, Then Scheduled Integration Tests for Supported Branches (Issue #9042)

Two phases, in strict order. Phase 1 establishes a verified buildable state
for every supported branch. Phase 2 adds the scheduled CI that keeps it that
way. Phase 2 is not started until Phase 1 is done — a weekly workflow pointed
at red branches only produces false-signal noise.

## Verified current state (checked 2026-11-11)

| Branch | Go in `go.mod` | Last full CI verification | Result |
|---|---|---|---|
| `v2.4` | 1.25.8 | Kiali CI push run 2026-03-24 | ✅ pass |
| `v2.11` | 1.26.10 | PR #10489 merged 2026-11-03 | ✅ all checks pass |
| `v2.17` | 1.26.10 | PR #10490 merged 2026-11-03 | ✅ all checks pass |
| `v2.22` | 1.26.10 | PR #10491 merged 2026-11-03 | ✅ all checks pass |
| `v2.27` | 1.26.10 | PR #10493 merged 2026-11-03 | ✅ all checks pass |

Key structural fact: `kiali-ci.yml` on the supported branches triggers only
on `pull_request` — there is **no push or schedule trigger**. Branch heads
are verified exactly once, at PR merge time, then decay unobserved (external
registries, action versions, cluster image availability all drift). The last
push-triggered Kiali CI runs are from 2026-03-24 and their logs have expired
(HTTP 410). Historical failures from those runs (v2.17: local/offline cypress;
v2.22: backend unit tests) predate the November tooling bumps and may already
be fixed — but nobody has re-run them on the branch heads.

`hack/run-integration-tests.sh` capability matrix (verified per branch;
drives the Phase 2 suite matrix):

| Capability | v2.4 | v2.11 | v2.17 | v2.22 | v2.27 |
|---|:-:|:-:|:-:|:-:|:-:|
| `--stern` flag | ✗ | ✗ | ✓ | ✓ | ✓ |
| `local` / `offline` suites | ✗ | ✗ | ✓ | ✓ | ✓ |
| `frontend-external-kiali` suite | ✗ | ✗ | ✓ | ✓ | ✓ |
| `--waypoint` flag | ✗ | ✗ | ✗ | ✓ | ✓ |
| `frontend-multi-mesh` suite | ✗ | ✗ | ✗ | ✓ | ✓ |
| `--mcp-tools` flag | ✗ | ✗ | ✗ | ✓ | ✓ |
| `ai-chatbot` suite | ✗ | ✗ | ✗ | ✗ | ✓ |

Branch-local Istio versions (self-resolved by each branch's
`setup-kind-in-ci.sh`; the coordinator must not override them):
`v2.4 → 1.23.6`, `v2.11 → 1.26.8`, `v2.17 → 1.27.5`, `v2.22 → 1.28.3`,
`v2.27 → 1.29.1`.

PR #9311 ("disabling cache in local/offline CI") is backported to `v2.27`
only (`41ba5f4e4`), not to v2.4–v2.22.

## Phase 1 — Buildable state

Goal: every supported branch head passes lint, unit, build, and the
integration suites that branch supports.

1. **Re-verify every branch head.** Dispatch one manual full CI run per
   branch against its current head (see Phase 2 shape — the same
   single-branch dispatch mechanism, before the cron schedule exists).
   Do not trust the March push runs; they are expired and predate the
   November Go/lint tooling bumps (#10489–#10493).
2. **Fix what is red.** Failures are fixed on the affected branch and
   backported as needed. Known candidates:
   - v2.17 local/offline cypress (failed 2026-03-24; possibly fixed by
     later backports — verify, don't assume)
   - v2.22 backend unit tests (same caveat)
   - v2.4: never received the Go 1.26.10 / lint tooling bump; verify it
     still builds with its pinned Go 1.25.8 and current action versions.
3. **Backport PR #9311** (cache disable in local/offline CI) to v2.17 and
   v2.22 — required for trustworthy local/offline suite results on those
   branches. Not applicable to v2.4/v2.11 (no local/offline suites).
4. **Definition of done:** one green full-CI run per supported branch on its
   head, with the per-branch suite matrix of Phase 2 (only suites the branch
   supports).

## Phase 2 — Scheduled CI (weekly)

Design is corrected per the review of the original plan; the review's
findings 1–7 are folded in below.

1. **One workflow run per branch.** A coordinator workflow
   `.github/workflows/test-supported-branches.yml` on `master` dispatches a
   single-branch run per supported branch via the GitHub API
   (`workflow_dispatch` with a `branch` input, `ref: master`). No shared
   matrix: reusable workflows upload artifacts under fixed names
   (`kiali`, `build`, per-suite names) and `actions/upload-artifact` v4+
   forbids duplicate names within one run — a shared matrix would race
   artifact downloads across branches and validate the wrong binaries.
2. **Per-branch suite matrix.** Each dispatched run executes only the
   suites its branch supports (capability table above), enforced by matrix
   `if:` conditions or per-branch job lists. Master-era flags unknown to a
   branch's `run-integration-tests.sh` (e.g. `--stern` on v2.4/v2.11)
   hard-fail that branch's parser.
3. **Retry = second fresh job.** A retry job gated on
   `if: needs.<suite>.result == 'failure'`, on a fresh runner with a fresh
   cluster. Same-job retries reuse broken cluster state and collide with
   `timeout-minutes`. Retry passes must suffix artifact names (add a
   `run_suffix` input, default empty, so existing callers are untouched).
4. **No Istio version, no `sail_operator_git_ref` inputs.** Leave both
   empty so each branch's own resolver and defaults apply. Do not copy the
   `test-istio-version.yml` initialize-time version resolution.
5. **Unsplit frontend suite.** Use `--test-suite frontend` (the daily
   pattern), not the PR-time core-1/2 splits; old branches do not know the
   split suite names.
6. **Scheduling and capacity.** Weekly cron, `concurrency` group per run,
   optional `workflow_dispatch` `branch` input for targeted debugging.
   Measure one real run before choosing the cron slot; document the weekly
   Actions-minutes cost (~5× one daily run).
7. **Exclude `master`** — the 02:00/04:00/06:00 UTC dailies already cover
   it.
8. **Notifications:** standard GitHub Actions failure notifications only —
   subscribed maintainers see the failed scheduled run. No Slack bots, no
   auto-created issues.

## Validation

- Phase 1 exit: green full-CI run on the head of every supported branch.
- Workflow YAML/job-graph checks before merging Phase 2:
  - every branch runs every suite it supports, and none it does not;
  - test jobs receive the intended branch ref;
  - no explicit Istio version overrides the branch-specific resolver;
  - a failed suite is retried exactly once, on a fresh runner, with suffixed
    artifact names;
  - failures on one branch do not cancel other branches' runs.
