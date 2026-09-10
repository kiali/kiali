# Plan: Scheduled Integration Tests for Supported Branches

## Goal

Run the complete integration-test suite against each supported Kiali release
branch every week. This detects broken or outdated tests before an urgent
security fix must be backported.

## Branch-specific Istio versions

The test scripts already select the compatible Istio version from the checked
out branch. The scheduled workflow must not override that selection.

| Kiali branch | Istio version selected by its scripts |
|---|---:|
| `v2.4` | `1.23.6` |
| `v2.11` | `1.26.8` |
| `v2.17` | `1.27.5` |
| `v2.22` | `1.28.3` |
| `v2.27` | `1.29.1` |

## Implementation

1. Create `.github/workflows/test-supported-branches.yml`.

   This GitHub Actions workflow coordinates the weekly test runs. Schedule it
   for Sunday UTC before the existing daily Istio-version workflows, and add a
   `workflow_dispatch` trigger so maintainers can start it manually.

2. Define the supported release branches in a single matrix:

   ```yaml
   branch: [v2.4, v2.11, v2.17, v2.22, v2.27]
   ```

   Configure `fail-fast: false`, so a failure for one branch does not cancel
   the jobs still running for other supported branches.

3. Reuse the existing build and integration-test workflows.

   The coordinator should invoke the same reusable workflows used by
   `.github/workflows/test-istio-version.yml`: lint and unit tests, frontend
   build, backend build, and every integration suite. The suite includes
   backend, frontend, core, caching, optional, ambient, AI chat,
   local/offline, tracing, and multicluster tests.

   Each job checks out the branch from its matrix entry. Consequently, its
   test scripts, dependencies, Helm-chart behavior, and Istio compatibility
   mapping come from the selected release branch rather than from `master`.

4. Support one automatic retry for a failed integration suite.

   GitHub Actions does not have a native job-retry setting. Add an optional
   `retry_on_failure` boolean input to each reusable integration workflow.
   When true, rerun its integration-test command once after an initial
   failure. Existing pull-request and nightly workflows should leave the
   input disabled; the new weekly workflow should enable it.

5. Use standard GitHub Actions failure notifications.

   Do not add Slack notifications or automatic issue creation. A failed
   scheduled workflow appears in GitHub Actions and notifies subscribed
   maintainers. Job names must identify both the affected release branch and
   the integration suite.

6. Do not include `master` in the weekly matrix.

   `.github/workflows/test-istio-version.yml` already runs daily on `master`
   against multiple Istio versions.

## Validation

Verify the workflow YAML and job graph before merging:

- every supported branch starts every integration suite;
- test jobs receive the intended branch;
- no explicit Istio version overrides the branch-specific resolver;
- a failed integration command is retried exactly once only for the weekly
  workflow; and
- failures in one matrix branch do not cancel remaining branch runs.
