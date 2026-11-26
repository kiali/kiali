# Playwright Migration — Branch Review Findings

Adversarial review of `epic/playwright-migration` against `frontend/e2e/AGENTS.md`,
`frontend/e2e/MIGRATION-PLAN.md`, and `frontend/e2e/README.md`.
Review basis: `git diff 5161060fc^..HEAD` (181 files, +21k lines under `frontend/e2e`).
Four review angles: conventions compliance, test correctness, docs accuracy, structure.

Verdicts: all four reviewers returned **OK with notes**. No P0 findings.

---

## P1 — Fix before cutover

### 1. Vacuous test: namespace-dropdown sort assertion can never fail

- **File:** `frontend/e2e/pages/GraphPage.ts:736-740`, used by `tests/graph/graph_toolbar.spec.ts:7` (`core1AndOffline` — runs in core-1 and offline projects).
- **Issue:** The helper queries `[data-test="namespace-dropdown"] label`, but `data-test="namespace-dropdown"` is on the **MenuToggle** (`src/components/Dropdown/NamespaceDropdown.tsx:147`). The labels live in the sibling `DropdownList` (`namespace-dropdown-list`, line 159), rendered only when the dropdown is open — and the helper never opens it. `labels` is always `[]`, so `expect([]).toEqual([])` passes vacuously. The sort behavior is not tested at all.
- **Fix:**
  ```ts
  async expectNamespaceDropdownSorted(): Promise<void> {
    await this.getBySel('namespace-dropdown').click(); // open the toggle
    const labels = await this.getBySel('namespace-dropdown-list')
      .getByRole('checkbox') // or 'label' text within list items
      .allTextContents();
    expect(labels.length).toBeGreaterThan(0);
    const sorted = [...labels].sort((a, b) => a.localeCompare(b));
    expect(labels).toEqual(sorted);
    await this.page.keyboard.press('Escape'); // close
  }
  ```

### 2. Dead make targets documented as the way to run the perf suite

- **Files:** root `AGENTS.md` (~lines 287-292) and `frontend/e2e/README.md` (Perf section).
- **Issue:** Documents `make playwright-perf-tests-run` / `make playwright-perf-tests-gui` (and legacy `make perf-tests-gui` / `perf-tests-run`) — none of these targets exist in the `Makefile` (`grep -n perf Makefile` → no matches). Only working path is `cd frontend && yarn playwright:run:perf`.
- **Fix:** Either remove the make-target lines from both docs and document the `yarn` command, or add real `playwright-perf-tests-run` / `playwright-perf-tests-gui` targets to the `Makefile`. Pick one; docs and Makefile must agree.

---

## P2 — Report-only

### 3. `waitForTimeout(600)` in GraphPage contradicts the flat AGENTS.md ban

- **File:** `frontend/e2e/pages/GraphPage.ts:1145` (`refreshGraphTimes`), with a justifying comment (PF refresh-button debounce for graph cache-metrics determinism).
- **Issue:** Only `waitForTimeout` in the tree, but `AGENTS.md` says "No `page.waitForTimeout()`" flatly. Rule text and code disagree.
- **Fix:** Either add it to the *Sanctioned exceptions* section of `frontend/e2e/AGENTS.md` (with the debounce rationale), or replace with a deterministic wait (e.g. `data-ready` re-assert on `#pft-graph`).

### 4. PF internal class used for *interaction* (click) in AiChatbotPage

- **File:** `frontend/e2e/pages/AiChatbotPage.ts:206-207` — clicks `.pf-v6-c-switch` because the input is covered by the switch chrome.
- **Issue:** Sanctioned exception #1 covers only hovers/reads; this is the one PF-class **click** the rule names explicitly.
- **Fix:** Add `data-test` (or `aria-label`) on the PF `Switch` in the ChatBot source and click via that.

### 5. New React fiber walks outside the sanctioned-exceptions list

- **Files:** `frontend/e2e/utils/meshTopology.ts:33,239`, `frontend/e2e/utils/tracingHelpers.ts:120-135` (Victory scatter-point walk).
- **Issue:** Sanctioned exception #2 names only `utils/graphTopology.ts`; these are new walks added by this epic (both carry `TODO(#9712)` markers).
- **Fix:** Either extend the sanctioned-exceptions list to include them (same TODO framing), or land `data-test` hooks on the mesh topology and trace scatter points.

### 6. Cypress-mention comments inside `frontend/e2e` code

- **Files:** `utils/kialiUrl.ts:12-13`, `utils/suite-tags.ts:71,83` ("mirroring the Cypress translation layer…", "dual-tagged @multi-primary in Cypress").
- **Issue:** Root AGENTS.md rule 9 forbids Cypress mentions in `e2e/` code; commit b1c402b0c claimed these were reworded but four remain. (`demoApps.ts:65,149` references are functional `hack/istio/cypress/` script paths — not violations.)
- **Fix:** Reword to describe behavior standalone (e.g. "translates OSSMC kiosk route prefixes").

### 7. MIGRATION-PLAN.md contradicts itself on `@offline` status

- **File:** `frontend/e2e/MIGRATION-PLAN.md` — "Decisions & tracking" says **subset of 13 tests, re-runs are a follow-up**; "Migration completeness" says **fully ported, all 146 scenarios (139 dual-tagged + offline-specific)**; `README.md` says **~167 tests**. Three different stories (and 139+13=152≠146).
- **Fix:** Update the stale "Decisions" bullet to match the implemented dual-tag helpers (`core1AndOffline` etc. in `suite-tags.ts`); reconcile the counts to one true number.
- **Related:** stale unchecked checkbox "[ ] `hack/run-integration-tests.sh` updated for all remaining Playwright projects" directly below the checked all-14-suites box — delete it.

### 8. Copy-pasted `expectTableHeadings` (3 copies)

- **Files:** `frontend/e2e/pages/ServicesPage.ts:84`, `frontend/e2e/pages/WorkloadsPage.ts:54` — byte-identical private copies; `utils/table.ts:167` already exports the same helper (used by `NamespacesPage.ts:70-72`).
- **Fix:** Delete both privates; delegate to the `utils/table.ts` export.

### 9. ~19 identical `use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE }` blocks

- **File:** `frontend/playwright.config.ts:107-216` (and `playwright-perf.config.ts:32-46` duplicates the main config's context options verbatim).
- **Fix:** Hoist one `const chromeAuth = { ...devices['Desktop Chrome'], storageState: AUTH_FILE };`. Keeps future viewport/cert changes a one-line edit.

### 10. Over-exported internals and dead export

- `frontend/e2e/utils/waypointHelpers.ts` (714 lines): 7 exports (`waitForHealthyWaypoint`, `waitForWorkloadTraces`, `labelNamespaceWithWaypoint`, `waitForWaypointInGraphClusters`, `waitForBookinfoWaypointGraphTraffic`, `resolveZtunnelWorkload`, `waitForAllWaypointsHealthy`) used only inside the file. Drop the `export` keyword; optionally split kubectl-side from graph-wait-side helpers.
- `frontend/e2e/utils/multiCluster.ts`: `cluster2Context` is dead (single repo-wide occurrence = its definition). Delete.

### 11. MeshPage duplicates the monacoEditor window-global pattern

- **File:** `frontend/e2e/pages/MeshPage.ts:648-675` — hand-rolled `window.tracingConfigEditor` typed shape + guard, duplicating `utils/monacoEditor.ts`.
- **Fix:** Add a `getWindowEditor(page, globalName)` (or `readEditorText`/`applyEditorText`) helper in `monacoEditor.ts` and call it from MeshPage.

### 12. `ListPage.filterBy` hardcoded filter-name lists with silent fall-through

- **File:** `frontend/e2e/pages/ListPage.ts:54-60` — `nameFilters`/`dropdownFilters` string lists; a typo silently applies no filter.
- **Fix:** Minimum: `else throw` on no branch match. Better: typed map of filter name → kind.

### 13. Branch hygiene / rebase debt

- Branch is 152 commits behind `origin/master` (rebase PRs #10435/#10497 merged master *into* the epic; epic content is **not** yet in master — verified `frontend/e2e/` absent from `origin/master`). The "delete AGENTS.md before merging to master" contract is still pending and valid. Plan one more rebase before cutover; the accumulating debt only grows.

---

## Ignored / not defects

- `playwright.config.ts` `failOnFlakyTests: isCI` with `retries: 1` — intentional strictness for migration confidence.
- `ChatBotHeader.tsx:21` `import type` scope creep (PR #10328) — harmless type-only import; retroactive change not worth it.
- Health-tooltip hover-retry loop in `utils/table.ts` — retries with a refresh (state change), consistent with AGENTS.md guidance.
- `expect.poll` / `toPass` callbacks — all wrapped throw-safe.
- `tsc --noEmit` clean; all 14 `playwright-*` suites wired in `hack/run-integration-tests.sh`; all documented `yarn playwright:run:*` scripts exist; `PLAYWRIGHT_BLOB_NAME` unique per suite; no `--last-failed` script; generated outputs properly nested and gitignored.
