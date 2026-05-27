---
name: regression-triage
description: Analyze Jenkins nightly CI failure output to identify failing Cypress/Gherkin tests, map them to feature files, classify each failure (flake / ui-bug / test-bug), and produce a triage summary ready to hand off to regression-report.
disable-model-invocation: false
allowed-tools: Bash(awk *), Bash(grep *), Bash(find *), Bash(cat *), Bash(git *), Bash(curl *), Bash(gh *), Bash(jq *)
---

# Regression Triage Skill

Analyze Jenkins failure output → identify tests → classify → emit handoff block for `/regression-report`.

## What you need from the user

Ask for:
1. **Jenkins Cypress build URL** — must include a specific build number. Job root URL is not acceptable.
2. **First failure or persistent?** — helps distinguish flake from consistent bug.

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

| Signal | Classification |
|--------|---------------|
| `TimeoutError`, `element not found`, passes on retry, intermittent across builds | **flake** |
| Assertion failure on specific value/text, consistently fails, app shows wrong data | **ui-bug** |
| New test, passes on `main` but not feature branch | **ui-bug** |
| `Cannot read properties of undefined`, bad selector, stale text, test logic error | **test-bug** |

Default: **flake** if first failure, **ui-bug** if reproducible/persistent.

## Step 5 — Check for known issues

```bash
git log --oneline --all --grep="<scenario fragment>" | head -5
gh issue list --repo kiali/kiali --search "<scenario fragment>" --state open
```

## Step 6 — Emit handoff block

Emit one block per confirmed failure (ui-bug or test-bug). For flakes, note frequency recommendation instead.

```
## Handoff Block — Failure N

- Scenario: <exact scenario name>
- Feature file: frontend/cypress/integration/featureFiles/<file>.feature
- Tag(s): @<tag1>, @<tag2>
- Failing step: <Given/When/Then/And step text>
- Error: <error message, one line>
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
- For flakes: track frequency — 2+ occurrences in recent nightly = file as maintenance

## Environment context

| Environment | Common failure patterns |
|-------------|------------------------|
| Jenkins / OCP (nightly default) | Auth timeouts, `CYPRESS_PASSWD` issues, slow cluster response |
| kind (local default) | Insecure API warnings, resource limits |
| Minikube | Missing Istio features, ambient mesh not available |
| Multi-cluster | DNS resolution, kubeconfig context switching |
