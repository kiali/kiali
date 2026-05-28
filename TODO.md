todolist how to improve skills located in .claude/skills/regression*

- [ ] **Unified artifact flow in triage**: Triage skill only handles Jenkins artifacts via `curl`. It should also support local `cypress:run:junit` runs with same artifact structure. Local artifact locations (under `frontend/`):
  - `cypress/results/combined-report.xml` — after `yarn cypress:combine:reports`
  - `cypress/videos/featureFiles/*`
  - `cypress/screenshots/`
  Jenkins workspace artifacts (before archiving):
  - `archive_dir/` — staging dir; everything copied here then archived
  - `kiali-pod.log`, `kiali-pod-restarted.log`, `kiali-operator-pod.log` — from `oc logs`, copied into `archive_dir`
  - `ossm-env-snapshot.json` / `.yaml` — from `copyArtifacts` (get-env-snapshot job), copied into `archive_dir`
  Flow should detect environment (Jenkins URL vs local path) and read artifacts from same canonical locations regardless of source.

## Classification unification

Core problem: three overlapping terms used without a single contract — Jenkins `REGRESSION` (test passed last run, failed now), handoff `Classification` (flake/ui-bug/test-bug), and issue title prefix (`[Flake]`/`[Regression]`/`[Test]`). Goal: separate **how failure was detected** (Signal) from **what to fix** (Classification).

### Vocabulary contract

**Scope rule:** Agents must not fetch or reason over Jenkins builds other than the one the user provided. Report Portal (external) owns cross-build pattern analysis.

| Layer | Purpose | Allowed values |
|-------|---------|----------------|
| **Signal** (optional handoff field) | Detection context from this build only | `jenkins-regression` (from this build's `testReport`), `first-occurrence` (user or Report Portal) |
| **Classification** (required) | Root cause and fix routing | `flake` \| `ui-bug` \| `test-bug` |
| **Issue title prefix** | Scan-friendly GitHub title | Derived from classification (see mapping below) |

**Classification → issue mapping:**

| Classification | Title prefix | Labels | Fix strategy |
|----------------|-------------|--------|-------------|
| `flake` | `[Flake]` | `bug`, `maintenance` | retries, timing, nested `it()` removal |
| `ui-bug` | `[Regression]` | `bug` | product fix in `frontend/src/` or backend; do not weaken test assertions |
| `test-bug` | `[Test]` or `[Maintenance]` | `maintenance` | update step defs / feature file |

**Classification rubric (single-build evidence only):**

| Evidence | Suggested classification | Notes |
|----------|-------------------------|-------|
| `TimeoutError`, element not found, typical timing/selector flake | `flake` | Default when root cause unclear and user/Report Portal cites intermittent history |
| Assertion on wrong value/text, app shows wrong data, stable repro | `ui-bug` | Product state is wrong |
| `Cannot read properties of undefined`, bad selector, stale assertion | `test-bug` | Test/code mismatch |
| Case status `REGRESSION` in this build's `testReport` | Investigate → `ui-bug` or `test-bug` | Record signal `jenkins-regression`; not auto `ui-bug` |
| Cause unclear after ruling out obvious `test-bug` | `ui-bug` (default) | Prefer product investigation over test-only workaround |

**Target handoff block shape:**

```
## Handoff Block — Failure N

- Scenario: <exact scenario name>
- Feature file: frontend/cypress/integration/featureFiles/<file>.feature
- Tag(s): @<tag1>, @<tag2>
- Failing step: <Given/When/Then/And step text>
- Error: <error message, one line>
- Signal: <optional — jenkins-regression | first-occurrence>
- Classification: <flake | ui-bug | test-bug>
- Confidence: <high | medium | low>
- Report Portal: <optional — URL or one-line recurrence summary from user>
- Environment: Jenkins nightly | kind | …
- Build URL: <full build URL>
- Kiali version: <version>
- OCP version: <version>
- Istio version: <version or "not specified">
```

---

### regression-triage

- [ ] **Remove "First failure or persistent?" prompt** — replace with optional free-text "Report Portal / recurrence note" field. Agents must not fetch other Jenkins builds.
- [ ] **Remove multi-build rubric rows** — drop "intermittent across builds", "passes on `main` but not feature branch", defaults tied to "reproducible/persistent". Replace with single-build evidence rubric above.
- [ ] **Add Signal field to handoff block** — optional `Signal: jenkins-regression | first-occurrence`. Jenkins `REGRESSION` from `testReport` is a signal, not a classification.
- [ ] **Document Jenkins REGRESSION vs Classification in Step 2** — `REGRESSION` from `testReport` = signal (`jenkins-regression`); triage still assigns `flake | ui-bug | test-bug` from error shape.
- [ ] **Remove flake handoff policy "2+ occurrences in recent nightly"** — agents do not verify recurrence by fetching other builds. Report Portal or user provides recurrence context.
- [ ] **Step 5 scope** — keep `git log`/`gh issue` for duplicate issues only, not build-history pattern analysis. Already correct, verify on changes.

### regression-report

- [ ] **Title prefix from classification** — `flake` → `[Flake]`, `ui-bug` → `[Regression]`, `test-bug` → `[Test]` or `[Maintenance]`. Currently hardcoded `[Test]` for all.
- [ ] **Add optional Signal line in issue template** — `**Signal:** <value>` when triage provides it.
- [ ] **Add title vs body precedence rule** — if title prefix and body `Classification` disagree, body wins for fix agents.
- [ ] **Replace flake filing threshold** — change from "2+ nightly failures in 7 days" to: file when user requests or triage/Report Portal indicates recurrence. Agents do not verify recurrence via Jenkins API.
- [ ] **Add optional Report Portal field** — `**Report Portal:** <url or summary>` in issue body when user provides it.

### regression-fix

- [ ] **Parse optional Signal and Report Portal fields** — Step 1 should extract `Signal` and `Report Portal` from issue body when present.
- [ ] **Add title vs body precedence rule** — trust issue body `Classification` over title prefix when they conflict.

### Peer review findings (migrated from docs/regression-skills-peer-review.md)

Resolved findings (already fixed in current skills):
- TRIAGE-01: VPN/auth fallback — Step 1a now has fallback for paste input
- TRIAGE-02: Tag extraction stale tags — Step 3 now uses `awk` scoped to target scenario
- TRIAGE-03: Screenshots unused in classification — Step 3a extracts failing step from screenshot filenames
- REPORT-01: `Failing step` and `Confidence` missing from issue template — both now in template
- FIX-01: Environment mismatch for OCP issues — prerequisites now branch on environment
- FIX-02: Commit without user request — Step 8 now says "wait for user to explicitly request"
- FIX-03: ui-bug guardrail gap — guardrail #9 now prohibits weakening assertions without product fix
- FIX-04: tsc prereq — Step 5c now notes `yarn install` needed
- INT-03: `@offline` tag semantics — fix guardrail #10 documents it

Open findings (blocked on TODO items above):
- [ ] **INT-02: Classification semantics inconsistent** — triage implied `regression` sub-type of `ui-bug` but report had no `regression` label. Resolves when title prefix and Signal/Classification separation are implemented per items above.

Contract matrix (current state — update when Signal field added):

| Field | Triage emits | Report consumes | Issue preserves | Fix parses |
|-------|:---:|:---:|:---:|:---:|
| Scenario | yes | yes | yes | yes |
| Feature file | yes | yes | yes | yes |
| Tag(s) | yes | yes | yes | yes |
| Failing step | yes | yes | yes | yes |
| Error | yes | yes | yes | yes |
| Signal | **no (TODO)** | **no (TODO)** | **no (TODO)** | **no (TODO)** |
| Classification | yes | yes | yes | yes |
| Confidence | yes | yes | yes | yes |
| Report Portal | **no (TODO)** | **no (TODO)** | **no (TODO)** | **no (TODO)** |
| Environment | yes | yes | yes | yes |
| Build URL | yes | yes | yes | yes |
| Kiali version | yes | yes | yes | yes |
| OCP version | yes | yes | yes | yes |
| Istio version | yes | yes | yes | yes |
