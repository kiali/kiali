---
name: regression-triage
description: Analyze Jenkins nightly CI failure output to identify failing Cypress/Gherkin tests, map them to feature files, classify each failure (flake / ui-bug / test-bug), and produce a triage summary ready to hand off to regression-report.
disable-model-invocation: false
allowed-tools: Bash(awk *), Bash(grep *), Bash(find *), Bash(cat *), Bash(git *), Bash(curl *), Bash(gh *), Bash(jq *)
---

# Regression Triage Skill

Analyze Jenkins failure output → identify tests → classify → emit handoff block for `/regression-report`.

> Field contract and vocabulary: `.claude/docs/regression-contract.md`

## What you need from the user

Ask for:
1. **Jenkins Cypress build URL** — must include a specific build number. Job root URL is not acceptable.

**Valid (build number present):**
```
https://<jenkins.url>/job/kiali/job/test-jobs/job/kiali-cypress-tests/5772/
```

**Invalid (job root — reject this):**
```
https://<jenkins.url>/job/kiali/job/test-jobs/job/kiali-cypress-tests/
```

If URL has no numeric build segment, stop and ask for a specific build URL.

## Step 1 — Validate and fetch

### 1a — Verify accessibility

```bash
curl -s -o /dev/null -w "%{http_code}" "<build-url>"
```

Non-`200` or HTTP 000 (DNS failure / connection refused) → the Jenkins instance is not accesible on public network and requires VPN.

**Fallback when Jenkins is unreachable:**

1. Ask the user to connect to VPN and retry, **or**
2. Ask the user to paste one of the following manually:
   - The Jenkins console log output (copy from the browser while on VPN), **or**
   - The exported `testReport` JSON (`<build-url>testReport/api/json?...` → Save As)

Resume from Step 2 with the pasted content — skip further `curl` calls for that build.

### 1b — Fetch artifact list

```bash
curl -k -s "<build-url>api/json?tree=artifacts%5BfileName%2CrelativePath%5D" | jq '.artifacts[] | .relativePath'
```

Key artifacts:
- `archive_dir/screenshots/*.png` — filenames encode scenario + step of failure
- `archive_dir/kiali-pod.log` — Kiali version
- `archive_dir/ossm-env-snapshot.json` — OCP version

### 1c — Auto-fetch build metadata

Run all three in parallel:

```bash
# Kiali version
curl -k -s "<build-url>artifact/archive_dir/kiali-pod.log" | grep "Kiali: Version:" | head -1

# OCP version
curl -k -s "<build-url>artifact/archive_dir/ossm-env-snapshot.json" | jq -r '.ocp.version'

# Istio version from build params (may be empty = auto-detected by nightly)
curl -k -s "<build-url>api/json?tree=actions%5Bparameters%5Bname%2Cvalue%5D%5D" | \
  jq -r '[.actions[] | select(.parameters?) | .parameters[] | select(.name=="ISTIO_VERSION")] | first | .value // "not specified"'
```

## Step 2 — Extract failing scenarios

Use Jenkins test report API — no XML parsing needed:

```bash
curl -k -s "<build-url>testReport/api/json?tree=suites%5Bcases%5Bname%2Cstatus%2CerrorMessage%2CerrorDetails%5D%5D" | \
  jq '[.suites[].cases[] | select(.status == "FAILED" or .status == "REGRESSION") | {name, status, errorDetails}]'
```

## Step 3 — Map to feature files

For each failing scenario:

```bash
grep -rl "<scenario name fragment>" frontend/cypress/integration/featureFiles/
```

Find its tags — scope to the target scenario only (avoid picking up tags from preceding scenarios):

```bash
awk '/^\s+@/ { buf=buf" "$0; next } /Scenario.*<scenario name fragment>/ { print buf; exit } { buf="" }' \
  frontend/cypress/integration/featureFiles/<file>.feature
```

This accumulates `@` lines, resets on any non-`@` line, and prints only when the target `Scenario:` line is reached.

## Step 3a — Extract failing step from screenshot filenames (optional)

Screenshot filenames encode the scenario name and the failing step. List them:

```bash
curl -k -s "<build-url>api/json?tree=artifacts%5BrelativePath%5D" | \
  jq -r '.artifacts[] | .relativePath | select(test("screenshots/.+\\.png"))'
```

Filename pattern: `<feature-file>/<Scenario name> -- <step text> (failed).png`

Extract the step text from the filename and use it as the `Failing step` field in the handoff block. This is more reliable than inferring from the error message alone and also signals whether the failure is in a `Given`/`When`/`Then` step.

## Step 4 — Classify each failure

> Canonical rubric and vocabulary contract: `.claude/docs/regression-contract.md`

### Signal vs Classification

`REGRESSION` from Jenkins `testReport` = detection signal (`jenkins-regression`). It means the test passed last run and failed now — it does **not** determine classification. Triage still assigns `flake | ui-bug | test-bug` from error shape + user input.

Record `Signal: jenkins-regression` in the handoff block when the case status is `REGRESSION`. This is metadata only — no agent logic branches on it.

### Classification rubric (single-build evidence only)

Agents should not fetch or reason over Jenkins builds other than the one the user provided.

| Evidence | Suggested classification | Notes |
|----------|-------------------------|-------|
| `TimeoutError`, element not found, typical timing/selector flake | `flake` | Default when root cause unclear and user confirms intermittent history |
| Assertion on wrong value/text, app shows wrong data, stable repro | `ui-bug` | Product state is wrong |
| `Cannot read properties of undefined`, bad selector, stale assertion | `test-bug` | Test/code mismatch |
| Case status `REGRESSION` in this build's `testReport` | Investigate → any classification | Record signal `jenkins-regression`; ask user if flake suspected |
| Cause unclear after ruling out obvious `test-bug` | `ui-bug` (default) | Prefer product investigation over test-only workaround |

### Flake suspicion prompt

When triage encounters a potential flake (especially with `jenkins-regression` signal), ask the user:

> "Do you suspect this is a flake? If yes, share evidence (Report Portal link, past occurrences). If unsure, say so — agent will classify from error evidence."

User answer feeds classification: yes with evidence → `flake`, no/unsure → classify from error shape (default `ui-bug`).

## Step 5 — Group by root cause

After classifying all failures, check if multiple failures share the same root cause — same error message pattern, same underlying component, or same code path.

### When to group

- **Same error string** (modulo scenario-specific names): e.g. all fail with `TimeoutError: cy.intercept() timed out`
- **Same failing step pattern**: e.g. all fail on a `Given` step that sets up the same precondition
- **Same component**: e.g. all failures trace back to the same selector or API endpoint

### What to do

If ≥2 failures share root cause:

1. Present the grouping to the user:

```
Root cause group: <short description>
Affected scenarios:
  - <scenario 1>
  - <scenario 2>
  - ...
Error pattern: <common error>
Classification: <shared classification>
```

2. Ask: "These N failures share the same root cause. Create one combined handoff block / issue, or separate ones?"

3. If user picks combined → emit a **grouped handoff block** (see below). If separate → emit individual blocks as normal.

### Grouped handoff block format

```
## Handoff Block — Group: <root cause summary>

- Scenarios:
  - <scenario 1> (feature: <file1>.feature, tags: @tag1)
  - <scenario 2> (feature: <file2>.feature, tags: @tag2)
- Common error: <shared error pattern>
- Signal: <if shared>
- Classification: <shared classification>
- Confidence: <high | medium | low>
- Environment: Jenkins nightly
- Build URL: <full build URL with trailing slash>
- Kiali version: <version>
- OCP version: <version>
- Istio version: <version or "not specified">
```

### No grouping

If all failures have distinct root causes, skip this step — emit individual handoff blocks.

## Step 6 — Check for known issues

```bash
git log --oneline --all --grep="<scenario fragment>" | head -5
gh issue list --repo kiali/kiali --search "<scenario fragment>" --state open
```

## Step 7 — Emit handoff block

Emit one block per confirmed failure. No automated flake filing threshold — user decides when to file.

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
- Environment: Jenkins nightly
- Build URL: <full build URL with trailing slash>
- Kiali version: <from kiali-pod.log, e.g. v2.27.0-SNAPSHOT>
- OCP version: <from ossm-env-snapshot.json, e.g. 4.21.15>
- Istio version: <from build params or "not specified">
```

## After triage

- Pass each handoff block to `/regression-report`

## Environment context

| Environment | Common failure patterns |
|-------------|------------------------|
| Jenkins / OCP (nightly default) | Auth timeouts, `CYPRESS_PASSWD` issues, slow cluster response |
| kind (local default) | Insecure API warnings, resource limits |
| Minikube | Missing Istio features, ambient mesh not available |
| Multi-cluster | DNS resolution, kubeconfig context switching |
