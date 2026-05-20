---
name: regression-triage
description: Analyze Jenkins nightly CI failure output to identify failing Cypress/Gherkin tests, map them to feature files, classify each failure (flake / ui-bug / test-bug), and produce a triage summary ready to hand off to regression-report.
disable-model-invocation: false
allowed-tools: Bash(grep *), Bash(find *), Bash(cat *), Bash(git *), Bash(curl *), Bash(gh *)
---

# Regression Triage Skill

Analyze Jenkins failure output → identify tests → classify → recommend next action.

## What you need from the user

Ask the user for the **Jenkins Cypress build URL** — must include a specific build number. A job root URL is not acceptable.

**Valid (build number present):**
```
https://<jenkins.url>/job/kiali/job/test-jobs/job/kiali-cypress-tests/5772/
```

**Invalid (job root, no build number — reject this):**
```
https://<jenkins.url>/job/kiali/job/test-jobs/job/kiali-cypress-tests/
```

If the user provides a job root URL (path ends with a job name, no numeric segment), **stop immediately** and ask them to provide a specific build number URL. Do not attempt to auto-discover the last build.

Also ask: **How many times has this build been run / is this the first failure?** (helps distinguish flake from consistent bug)

## Step 0 — Validate Jenkins URL and fetch artifacts

### 0a — Verify job is accessible

```bash
curl -s -o /dev/null -w "%{http_code}" "<jenkins-job-url>"
```

If response is not `200`, stop and tell the user the URL is not accessible. Do not proceed.

### 0b — Fetch artifact list (no authorization required)

Jenkins exposes artifacts via:
```
<jenkins-job-url>api/json?tree=artifacts[fileName,relativePath]
```

```bash
curl -s "<jenkins-job-url>api/json?tree=artifacts[fileName,relativePath]"
```

Locate test result artifacts (JUnit XML or Cypress JSON). Fetch each relevant artifact:
```bash
curl -s "<jenkins-job-url>artifact/<relativePath>"
```

No credentials needed — Jenkins nightly is publicly accessible.

## Triage process

### Step 1 — Extract failing scenarios

Parse fetched artifacts to extract:
- Exact `Scenario:` names that failed
- The step that failed (`Given/When/Then/And`)
- The error message (assertion error, timeout, element not found, etc.)

Common Jenkins/Cypress failure patterns to recognize:
```
# JUnit XML
<testcase name="<scenario>" classname="..." time="...">
  <failure message="...">...</failure>
</testcase>

# Cypress terminal
  ✗ <scenario name> (<duration>)
    AssertionError: ...
    TimeoutError: Timed out retrying after ...ms
    CypressError: cy.get() failed because this element ...

# Screenshot filenames (encode failure point)
<feature-name> -- <scenario-name> -- <step> (failed).png
```

### Step 2 — Map to feature files

For each failing scenario, locate the `.feature` file:
```bash
grep -rl "<scenario name fragment>" frontend/cypress/integration/featureFiles/
```

Then find its Cypress tags:
```bash
grep -B20 "<scenario name fragment>" frontend/cypress/integration/featureFiles/<file>.feature | grep "@"
```

### Step 3 — Classify each failure

| Signal | Classification |
|--------|---------------|
| `TimeoutError`, `element not found`, passes on retry, intermittent across builds | **flake** |
| Assertion failure on specific value/text, consistently fails, app shows wrong data | **ui-bug** |
| `Cannot read properties of undefined`, bad selector (`:nth-child`, stale text), test logic error | **test-bug** |
| New test added recently, passes on `main` branch but not on feature branch | **regression** (sub-type of ui-bug) |

When classification is ambiguous, default to **flake** if it's a first-time failure, **ui-bug** if reproducible.

### Step 4 — Check for known flakes

Look for similar failures in recent git history or existing issues:
```bash
git log --oneline --all --grep="<scenario fragment>" | head -5
```

Suggest searching GitHub issues:
```
gh issue list --repo kiali/kiali --search "<scenario fragment>" --state open
```

### Step 5 — Output triage summary

Produce a structured summary for each failure:

```
## Triage Summary

### Failure 1
- **Scenario:** <exact name>
- **Feature file:** frontend/cypress/integration/featureFiles/<file>.feature
- **Tag(s):** @<tag>
- **Failing step:** <Given/When/Then step>
- **Error:** <error message>
- **Classification:** <flake | ui-bug | test-bug>
- **Confidence:** <high | medium | low>
- **Recommended action:** <file bug via /regression-report | skip/mark flake | investigate locally>

### Failure 2
...

## Next Steps
- Run `/regression-report` for confirmed bugs (ui-bug, test-bug)
- For flakes: note frequency, re-run before filing
- For regressions: identify the commit range in Jenkins build history
```

## Environment context

Defaults:
- **Nightly CI** runs on **OCP** via **Jenkins**
- **Local verification** uses **kind**

| Environment | Common failure patterns |
|-------------|------------------------|
| Jenkins / OCP (nightly default) | Auth timeouts, `CYPRESS_PASSWD` issues, slow cluster response |
| kind (local default) | Insecure API warnings, resource limits causing slowness |
| Minikube | Missing Istio features, ambient mesh not available |
| Multi-cluster | DNS resolution, kubeconfig context switching |

## After triage

Hand off to `/regression-report` skill for each confirmed ui-bug or test-bug.
For flakes: track frequency before filing (2+ occurrences in recent nightly = file as maintenance).
