todolist how to improve skills located in .claude/skills/regression*

- [ ] **Unified artifact flow in triage**: Triage skill only handles Jenkins artifacts via `curl`. It should also support local `cypress:run:junit` runs with same artifact structure. Abstraction lives inside triage skill — detects environment (Jenkins URL vs local path) and normalizes internally. Other skills receive the same handoff block regardless of source.
  Local artifact locations (under `frontend/`):
  - `cypress/results/combined-report.xml` — after `yarn cypress:combine:reports`
  - `cypress/videos/featureFiles/*`
  - `cypress/screenshots/`
  Jenkins workspace artifacts (before archiving):
  - `archive_dir/` — staging dir; everything copied here then archived
  - `kiali-pod.log`, `kiali-pod-restarted.log`, `kiali-operator-pod.log` — from `oc logs`, copied into `archive_dir`
  - `ossm-env-snapshot.json` / `.yaml` — from `copyArtifacts` (get-env-snapshot job), copied into `archive_dir`

## Classification unification

Core problem: three overlapping terms used without a single contract — Jenkins `REGRESSION` (test passed last run, failed now), handoff `Classification` (flake/ui-bug/test-bug), and issue title prefix (`[Test]`). Goal: separate **how failure was detected** (Signal) from **what to fix** (Classification).

### Vocabulary contract

**Scope rule:** Agents should not fetch or reason over Jenkins builds other than the one the user provided. Report Portal (external) owns cross-build pattern analysis.

| Layer | Purpose | Allowed values |
|-------|---------|----------------|
| **Signal** (optional handoff field) | Detection context from this build only — metadata for human readers, no agent logic branches on it | `jenkins-regression` (from this build's `testReport`), `first-occurrence` (user says so) |
| **Classification** (required) | Root cause and fix routing | `flake` \| `ui-bug` \| `test-bug` |
| **Issue title prefix** | Scan-friendly GitHub title | Always `[Test]` regardless of classification |

**Classification → issue mapping:**

| Classification | Title prefix | Labels | Fix strategy |
|----------------|-------------|--------|-------------|
| `flake` | `[Test]` | `bug`, `maintenance` | retries, timing, nested `it()` removal |
| `ui-bug` | `[Test]` | `bug` | product fix in `frontend/src/` or backend; do not weaken test assertions |
| `test-bug` | `[Test]` | `maintenance` | update step defs / feature file |

**Classification rubric (single-build evidence only):**

| Evidence | Suggested classification | Notes |
|----------|-------------------------|-------|
| `TimeoutError`, element not found, typical timing/selector flake | `flake` | Default when root cause unclear and user confirms intermittent history |
| Assertion on wrong value/text, app shows wrong data, stable repro | `ui-bug` | Product state is wrong |
| `Cannot read properties of undefined`, bad selector, stale assertion | `test-bug` | Test/code mismatch |
| Case status `REGRESSION` in this build's `testReport` | Investigate → any classification | Record signal `jenkins-regression`; ask user if flake suspected |
| Cause unclear after ruling out obvious `test-bug` | `ui-bug` (default) | Prefer product investigation over test-only workaround |

**Flake suspicion prompt:** When triage encounters a potential flake (especially with `jenkins-regression` signal), ask the user directly:

> "Do you suspect this is a flake? If yes, share evidence (Report Portal link, past occurrences). If unsure, say so — agent will classify from error evidence."

User answer feeds classification: yes with evidence → `flake`, no/unsure → classify from error shape (default `ui-bug`).

**Flake filing:** No automated threshold. User decides when to file. Agent does not gate flake issue creation.

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
- Environment: Jenkins nightly | kind | …
- Build URL: <full build URL>
- Kiali version: <version>
- OCP version: <version>
- Istio version: <version or "not specified">
```

Note: handoff block is a format example. Canonical field contract lives in `docs/regression-contract.md`.

---

### regression-triage

- [ ] **Replace "First failure or persistent?" prompt** — replace with flake suspicion prompt: "Do you suspect this is a flake? If yes, share evidence (Report Portal link, past occurrences). If unsure, say so — agent will classify from error evidence."
- [ ] **Remove multi-build rubric rows** — drop "intermittent across builds", "passes on `main` but not feature branch", defaults tied to "reproducible/persistent". Replace with single-build evidence rubric above.
- [ ] **Add Signal field to handoff block** — optional `Signal: jenkins-regression | first-occurrence`. Metadata only — no agent logic branches on it.
- [ ] **Document Jenkins REGRESSION vs Classification in Step 2** — `REGRESSION` from `testReport` = signal (`jenkins-regression`); triage still assigns `flake | ui-bug | test-bug` from error shape + user input.
- [ ] **Remove flake handoff policy "2+ occurrences in recent nightly"** — user decides when to file. No threshold logic.
- [ ] **Step 5 scope** — keep `git log`/`gh issue` for duplicate issues only, not build-history pattern analysis. Already correct, verify on changes.
- [ ] **Soften scope rule** — change "must not" to "should not" for fetching other Jenkins builds.

### regression-report

- [ ] **Add optional Signal line in issue template** — `**Signal:** <value>` when triage provides it. Metadata only.
- [ ] **Remove flake filing threshold** — no "2+ nightly failures in 7 days" check. File when user requests.

### regression-fix

- [ ] **Parse optional Signal field** — Step 1 should extract `Signal` from issue body when present. No behavior change based on it.

### Cross-skill

- [ ] **Extract contract matrix to standalone file** — create `docs/regression-contract.md` with the canonical field contract (who emits, who consumes). Each skill SKILL.md references it. Prevents field drift across skills.

### Contract matrix (current state — canonical version will live in `docs/regression-contract.md`):

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
| Environment | yes | yes | yes | yes |
| Build URL | yes | yes | yes | yes |
| Kiali version | yes | yes | yes | yes |
| OCP version | yes | yes | yes | yes |
| Istio version | yes | yes | yes | yes |
