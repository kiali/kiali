---
name: regression-report
description: Create a GitHub issue on kiali/kiali for a confirmed Cypress test failure. Use after identifying a failing test (from Jenkins nightly or local run) to file a structured bug report via gh CLI.
disable-model-invocation: false
allowed-tools: Bash(gh *), Bash(oc *), Bash(kubectl *), Bash(grep *), Bash(cat *)
---

# Regression Report Skill

Create a GitHub issue for a confirmed Cypress test failure on kiali/kiali.

## What you need from the user

Ask the user to provide:

1. **Failing scenario name** — exact Gherkin `Scenario:` title from the Jenkins output or test run
2. **Feature file** — which `.feature` file it lives in (e.g. `graph_display_user.feature`). If unknown, search for it:
   ```bash
   grep -rl "<scenario name fragment>" frontend/cypress/integration/featureFiles/
   ```
3. **Cypress tag(s)** — e.g. `@core-1`, `@ambient`, `@multi-cluster`. Find from the feature file if needed.
4. **Classification** — one of:
   - `flake` — intermittent, timing-related, element not found transiently
   - `ui-bug` — consistent assertion failure, wrong data, missing element in the app
   - `test-bug` — bad selector, wrong expectation, stale step definition
5. **Environment** — where failure was observed:
   - `Jenkins nightly` — remote OCP cluster
   - `Remote OCP` — manual remote cluster (VPN)
   - `CRC` — local CodeReady Containers
   - `Minikube` — local Kubernetes
6. **Kiali version** (optional) — try `oc get kiali kiali -n istio-system -o jsonpath='{.status.operatorVersion}'` or from Jenkins build info
7. **Istio version** (optional) — try `oc get istio -o jsonpath='{.items[0].status.meshVersion}'` or `istioctl version`
8. **Error message / screenshot description** — the actual failure output or what was visually wrong

## Issue construction rules

### Title format
```
[Test] <Scenario name> — <feature-file-basename> / <environment>
```
Examples:
- `[Test] See minigraph for service — service_details.feature / Jenkins nightly`
- `[Test] Display idle nodes option — graph_display_user.feature / CRC`

### Labels
| Classification | Labels |
|---------------|--------|
| `flake` | `bug`, `maintenance` |
| `ui-bug` | `bug` |
| `test-bug` | `maintenance` |

### Reproduce command
Always include a reproduction command in the issue body. Use `@selected` tag pattern:

1. User must first tag the failing scenario with `@selected` in the `.feature` file
2. Then run:
```bash
# From repo root
cd frontend
CYPRESS_BASE_URL=<kiali-url> \
CYPRESS_USERNAME=<username> \
CYPRESS_PASSWD=<password> \
yarn cypress:run:selected
```

Environment-specific notes to include in the issue:
- **Jenkins/Remote OCP**: Requires VPN + `oc login <cluster-url>`, `CYPRESS_ALLOW_INSECURE_KIALI_API` may be needed
- **CRC**: `CYPRESS_USERNAME=kubeadmin`, `CYPRESS_ALLOW_INSECURE_KIALI_API=true`
- **Minikube**: `CYPRESS_BASE_URL=http://localhost:3000`, no credentials needed typically

## Execution steps

1. Collect all required information from the user (ask if missing).

2. Try to fetch version info automatically if on a connected cluster:
   ```bash
   oc get kiali kiali -n istio-system -o jsonpath='{.status.operatorVersion}' 2>/dev/null || echo "unavailable"
   ```

3. Construct the issue body (fill template below).

4. Run:
   ```bash
   gh issue create \
     --repo kiali/kiali \
     --title "[Test] <scenario> — <feature-file> / <environment>" \
     --label "<labels>" \
     --body "$(cat <<'BODY'
   <filled-body>
   BODY
   )"
   ```

5. Output the created issue URL to the user.

## Issue body template

```markdown
### Describe the bug

Cypress test failure observed on <environment>.

**Scenario:** `<exact scenario name>`
**Feature file:** `frontend/cypress/integration/featureFiles/<feature-file>`
**Tag(s):** `<cypress-tags>`
**Classification:** <flake | ui-bug | test-bug>

<error message or screenshot description provided by user>

### Expected Behavior

<what the test expects — infer from scenario name or ask user>

### What are the steps to reproduce this bug?

1. Tag the failing scenario with `@selected` in `frontend/cypress/integration/featureFiles/<feature-file>`
2. Ensure a running Kiali instance is accessible
3. Set environment variables:
   ```bash
   export CYPRESS_BASE_URL=<kiali-url>
   export CYPRESS_USERNAME=<username>
   export CYPRESS_PASSWD=<password>
   # For OCP/CRC:
   # export CYPRESS_ALLOW_INSECURE_KIALI_API=true
   ```
4. Run from repo root:
   ```bash
   cd frontend && yarn cypress:run:selected
   ```

### Environment

- **Kiali version:** <version or "check Jenkins build">
- **Istio version:** <version or "check Jenkins build">
- **Kubernetes impl:** <OpenShift | Minikube | CRC>
- **Kubernetes version:** <version if known>
- **Other notable environmental factors:** Failure observed in Jenkins nightly CI / <details>
```
