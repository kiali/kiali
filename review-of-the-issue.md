# Review of ISSUE-9042-PLAN.md

Review of the plan "Scheduled Integration Tests for Supported Branches".
All claims below were verified against the current `master` workflow files and
the actual `hack/run-integration-tests.sh` / `hack/setup-kind-in-ci.sh` /
`make/Makefile.build.mk` content on each release branch (fetched from the
`kiali/kiali` remote branches). Findings are ordered worst-first; items
1–3 are design blockers, not polish.

---

## Finding 1 — A single-run matrix breaks the Actions artifact namespace (breaks all branches, including v2.27)

GitHub Actions artifacts are scoped per **run**, shared by every job in that
run. The plan puts five branches in one matrix inside one workflow run, and
the reusable workflows it reuses upload and download artifacts under fixed
names:

- `kiali` — uploaded by `build-backend.yml:45`, downloaded by every
  integration suite
- `build` — uploaded by `build-frontend.yml:48` and `build-backend.yml:30`
- per-suite names: `coverage-backend`, `junit-rest-report`,
  `resource-telemetry-*`, `debug-info-*`, `cypress-screenshots-*`, etc.

With five parallel matrix entries, every one of those uploads collides.
`actions/upload-artifact` v4+ does not support re-uploading under an existing
name in the same run — the repository's own naming convention proves the team
operates under that constraint: the four parallel PR-time core suites suffix
*everything* (`cypress-screenshots-frontend-core-1` vs `-core-2`,
`resource-telemetry-frontend-core-N` in `integration-tests-frontend-core-*.yml`).

Worse than a failing upload: `actions/download-artifact` with `name: kiali`
is then a race between parallel matrix entries. A branch's integration suites
can download and execute **another branch's** compiled binary or frontend
build. The plan would validate the wrong code — defeating its purpose.

**Fix:** one workflow *run* per branch. The coordinator dispatches one
single-branch run per supported branch (e.g., via the GitHub API
`workflow_dispatch` with a `branch` input, `ref: master`). Independent runs
also give: native failure isolation without `fail-fast` tricks, trivial
per-branch manual runs, and a working `concurrency` group per run.

## Finding 2 — "Every branch × every suite" is impossible: branch scripts reject master-era suites and flags

The plan's core assumption ("each job checks out the branch … so its test
scripts come from the selected release branch") is true — and that is exactly
the problem. Each run executes the **branch's own**
`hack/run-integration-tests.sh`, but the reusable workflows (from `master`)
invoke master-era `--test-suite` values and pass master-era flags. The branch
scripts validate strictly and `exit 1` on an unknown flag or a disallowed suite
(v2.4 parser: suite check at line 59, unknown-argument `exit 1` at line 109).

Verified per branch (full-file grep for each constant/flag; a zero count means
the value/flag exists nowhere in that branch's script):

| Capability needed by master's workflows | v2.4 | v2.11 | v2.17 | v2.22 | v2.27 |
|---|:-:|:-:|:-:|:-:|:-:|
| `--stern` (passed by **every** frontend suite invocation, e.g. `integration-tests-frontend.yml:89`) | ✗ | ✗ | ✓ | ✓ | ✓ |
| `frontend-external-kiali` suite | ✗ | ✗ | ✓ | ✓ | ✓ |
| `local` / `offline` suites (`integration-tests-frontend-local-offline.yml`) | ✗ | ✗ | ✓ | ✓ | ✓ |
| `--waypoint` (used by `integration-tests-frontend-ambient-multi-primary.yml:81`) | ✗ | ✗ | ✗ | ✓ | ✓ |
| `frontend-multi-mesh` suite (`integration-tests-frontend-multi-mesh.yml:90,98`) | ✗ | ✗ | ✗ | ✓ | ✓ |
| `--mcp-tools` (used by `integration-tests-backend-mcp.yml:66`) | ✗ | ✗ | ✗ | ✓ | ✓ |
| `ai-chatbot` suite (`integration-tests-frontend-chat.yml`) | ✗ | ✗ | ✗ | ✗ | ✓ |

Concrete consequences under the plan as written:

- **v2.4, v2.11:** the plain unsplit frontend core suite fails *instantly* —
  the workflow always passes `--stern false`, which the parser rejects with
  "Unknown argument". Additionally the local/offline, external-kiali,
  ambient-multi-primary, multi-mesh, MCP, and chat suites all hard-fail.
- **v2.17:** MCP, ambient-multi-primary, multi-mesh, and chat hard-fail.
- **v2.22:** the AI chat suite hard-fails.
- **v2.27:** the full current matrix runs.

The plan would produce a wall of guaranteed, explained failures on four of the
five branches — precisely the false-signal noise the plan exists to prevent.

**Fix:** define an explicit per-branch suite matrix and gate jobs on it
(per-branch job lists or matrix `if:` conditions). The plan's own validation
item — "every supported branch starts every integration suite" — is
unsatisfiable as written and must be reworded to "every suite that branch
supports".

## Finding 3 — The retry design (plan item 4) has structural problems

The plan: "Add an optional `retry_on_failure` boolean input to each reusable
integration workflow. When true, rerun its integration-test command once after
an initial failure." Problems:

1. **Same-job retry reuses broken cluster state.** The first failure leaves
   the kind cluster in a failed state; rerunning in the same job without
   teardown/re-setup will typically reproduce the failure while burning
   another 30–45 minutes. A meaningful retry needs a fresh runner and a
   fresh cluster (e.g., a second job gated on
   `if: needs.X.result == 'failure'`).
2. **`timeout-minutes` caps the whole job.** E.g. `timeout-minutes: 60` at
   `integration-tests-backend.yml:31`. A suite that fails at minute 40 leaves
   ~20 minutes for a "one more" run of a 40+ minute suite → guaranteed
   timeout. The plan never raises timeouts.
3. **A retry pass re-runs the trailing upload steps**, which upload the same
   fixed artifact names a second time within the same run — the same
   namespace collision as Finding 1. Artifact names need a parameterized
   suffix (e.g., a `run_suffix` input, default empty so existing callers are
   untouched) for a retry to work at all.
4. **Ambiguous target.** `integration-tests-backend.yml` contains *two* test
   commands: `hack/run-integration-tests.sh` (line 70) and
   `make test-integration-controller` (line 73). "Rerun its integration-test
   command" picks neither.
5. **Debug-info conditions break.** Those steps key off
   `steps.intTests.conclusion == 'failure'` (line 91); inserting a retry
   step changes what "failure" means at that point in the job. Unaddressed.

**Fix (with Finding 1's one-run-per-branch shape):** a second, fresh job
gated on the first job's failure, plus a `run_suffix` input that suffixes all
artifact names in the retried pass.

## Finding 4 — Scope contradictions in the suite list (plan item 3)

- "core, caching, optional" are **PR-time-only** split workflows
  (`kiali-ci.yml:95-119` → `integration-tests-frontend-core-1/2/caching/optional.yml`).
  The daily `test-istio-version.yml` covers the same specs via one unsplit
  `--test-suite frontend` run (`integration-tests-frontend.yml:89`). Item 3
  says "reuse the same reusable workflows used by `test-istio-version.yml`" —
  that set does **not** include the splits, and the old branches do not
  support `frontend-core-1`/`2` suite values anyway. The plan simultaneously
  names the split suites and the unsplit suite as if both were in scope.
  Pick one; the unsplit suite is the right one for this use case.
- The list **omits MCP** (`integration_tests_backend_mcp`,
  `test-istio-version.yml:183`) and multi-mesh. If the goal is "whatever
  master runs daily", the list is incomplete; if it is "what each branch can
  run", see Finding 2.

## Finding 5 — Scheduling, capacity, and overlap

- **Scale:** 5 branches × ~14 jobs ≈ 70 jobs per run, each with
  `timeout-minutes: 60`, plus the lint/build/frontend chain. Against a
  public repo's 20-job concurrency limit this is multi-hour queueing, and it
  stacks on top of the existing 02:00/04:00/06:00 UTC daily runs (which also
  fire on Sundays).
- **"Sunday UTC before the existing daily workflows" is vague** and
  optimistic: a 00:00 start with 70 queued jobs is realistically still
  running when the 02:00 daily starts. No runtime estimate, no `concurrency`
  group (compare `kiali-ci.yml:13-15`), no protection against a manual run
  overlapping the schedule.
- **No mention of monthly Actions minutes.** This is roughly 5× one daily
  run, every week.

**Fix:** one run per branch (Finding 1) shrinks each run to ~14 jobs; add a
`concurrency` group; measure one real run before picking a cron slot; document
the minutes budget.

## Finding 6 — Job-naming requirement (plan item 5) is not achievable as stated

"Job names must identify both the affected release branch and the
integration suite." When a reusable workflow is called, its internal jobs keep
the `name:` declared in the *called* file ("Backend API integration tests",
"Cypress tests (core)") — the caller cannot override them. Only the
caller-side job node can carry `matrix.branch` + suite. Full compliance means
threading a name-prefix input into the `name:` field of all ~14 reusable
workflows *and* every existing call site. The plan does not acknowledge this.

## Finding 7 — Smaller gaps

1. **The Istio version input must be explicitly left empty.** The pattern
   being copied does the opposite: `test-istio-version.yml` resolves a
   version in `initialize` (line 80) and passes it to every suite (line 119
   and onward). The new coordinator must pass *nothing* so each branch's own
   `setup-kind-in-ci.sh` self-resolves. (Verified: master's resolver maps
   `v2.4 → 1.23.6` … `v2.27 → 1.29.1` at `setup-kind-in-ci.sh:238-249`, and
   v2.4's own copy of the script contains the `v2.4 → 1.23.6` case — the
   plan's table is accurate. But the implementation note matters because the
   closest template does the opposite.)
2. **The ambient version gate** `if: istio-version >= '1.23'`
   (`test-istio-version.yml:166`) depends on a resolved version that no
   `initialize` job would compute in the new design. Replicate the mapping or
   run ambient unconditionally (all five branches are ≥ 1.23 today).
3. **Do not set `sail_operator_git_ref`** for release branches. The 06:00
   daily sets it to `main` (test-istio-version.yml:51-62); that combination
   is untested against old branches.
4. **Lint/unit jobs run master's pinned tool versions against old-branch
   code** (`test-lint-backend.yml`). Newer linter versions can flag old code
   as new violations. Verify before assuming green.
5. **`workflow_dispatch` with no branch filter** means every manual run is
   the full 5-branch run. An optional `branch` input (default: all branches)
   makes targeted debugging nearly free.
6. **Go toolchain on old branches:** `actions/setup-go` with
   `go-version-file: go.mod` will install whatever the old `go.mod` pins.
   Verify the oldest supported branch still builds under the pinned action
   versions before merge.

## Verified OK

- The branch → Istio version table is accurate (checked master's resolver and
  v2.4's own branch-local copy of `setup-kind-in-ci.sh`).
- `fail-fast: false` is the correct choice for cross-branch isolation (moot
  for artifacts once Finding 1 is fixed by one-run-per-branch).
- "GitHub Actions has no native job-retry setting" — correct.
- Excluding `master` from the weekly matrix — correct; the 02/04/06 UTC
  dailies already cover it.
- Frontend toolchain is **not** a risk: every release branch carries
  `"node": ">=24.0.0"` and `"packageManager": "yarn@4.12.0"` pins (CI
  toolchain updates were backported).
- The `test-integration-controller` make target exists in
  `make/Makefile.build.mk` on **every** release branch (initial suspicion
  checked and cleared).

## Bottom line / recommended shape

1. One workflow **run** per branch (coordinator dispatches single-branch
   runs via the GitHub API with a `branch` input; `ref: master` so the
   coordinator logic itself stays current).
2. An explicit per-branch suite matrix (Finding 2's table) gating which
   suites run where.
3. Retry = a second, fresh job gated on `needs.X.result == 'failure'`, with
   a `run_suffix` input parameterizing artifact names (default empty).
4. `concurrency` group, a `workflow_dispatch` `branch` filter, a measured
   runtime before picking the cron slot, and a stated minutes budget.
