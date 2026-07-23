# Kiali CI Infrastructure Investigation Summary

**Date:** 2025-07-22
**Workflow:** `.github/workflows/kiali-ci.yml`
**Problem:** Intermittent infrastructure failures (provisioning failures, resource exhaustion) unrelated to test failures.

## Root Causes Identified

### 1. Concurrency Saturation

16 integration test jobs launched simultaneously after `build_backend`, consuming most or all of the GitHub Actions org-wide concurrent job slots (20 on Free plan). Overlapping CI runs from different PRs or nightly workflows exceeded the limit, causing queuing that appeared as provisioning failures.

### 2. Per-Runner Resource Pressure

Each `ubuntu-latest` runner (4 vCPUs, 16 GB RAM, 14 GB SSD) runs KinD cluster(s) + Istio + demo apps + Kiali + Cypress/Chrome. Multi-cluster jobs (5 of 16) run two KinD clusters with multiple Istio installations and sometimes Keycloak -- extremely tight for the available resources.

### 3. No Job Timeouts

None of the workflow files set `timeout-minutes`. Hung provisioning or stuck tests consumed runner slots for up to 6 hours (GitHub default), compounding the queuing problem.

### 4. Unintended Push-Triggered CI

PR #9760 (June 2, 2026) added a `push` trigger to `kiali-ci.yml` for Codecov baseline updates. This inadvertently caused all 16 integration test jobs to re-run on every merge to master -- redundant work since the nightly already covers post-merge validation.

## Changes Implemented

### Trigger Changes

- **Removed `push` trigger** from `kiali-ci.yml`. CI only runs on `pull_request` events now.
- **Added `labeled` event type** so adding the `ci-full` label immediately triggers a new workflow run.
- Master baseline Codecov coverage continues via the existing `codecov-master-baseline.yml` (push-triggered, unit tests only).

### Two-Wave Gating

Integration tests are split into two waves. Wave 2 is gated behind wave 1 completion and the `ci-full` PR label.

**Wave 1 (always runs on PR, ~8 jobs):**

| Job | KinD Clusters |
|-----|:---:|
| `integration_tests_backend` | 1 |
| `integration_tests_backend_mcp` | 1 |
| `integration_tests_frontend_core_1` | 1 |
| `integration_tests_frontend_core_2` | 1 |
| `integration_tests_frontend_core_caching` | 1 |
| `integration_tests_frontend_core_optional` | 1 |
| `integration_tests_frontend_ambient` | 1 |
| `integration_tests_frontend_ambient_multi_primary` | **2** |

**Wave 2 (requires `ci-full` label + wave 1 gate, ~8 jobs):**

| Job | KinD Clusters |
|-----|:---:|
| `integration_tests_frontend_chat` | 1 |
| `integration_tests_frontend_local_offline` | 1 |
| `integration_tests_frontend_tempo` | 1 |
| `integration_tests_frontend_multicluster_primary_remote` | **2** |
| `integration_tests_frontend_multicluster_multi_primary` | **2** |
| `integration_tests_frontend_multicluster_external_kiali` | **2** |
| `integration_tests_frontend_multi_mesh` | 1 |
| `integration_tests_backend_multicluster_external_controlplane` | **2** |

The `wave2_gate` job checks for the `ci-full` label and waits for all wave 1 jobs to complete. When the label is absent, `wave2_gate` is skipped and all wave 2 jobs are automatically skipped by GitHub Actions' dependency resolution.

### Codecov Adjustments

- `codecov_merge_upload` now accepts `skipped` for `integration_tests_backend_multicluster_external_controlplane` (wave 2), since that job may not run.
- Multicluster coverage download is conditional (`if: ... result == 'success'`).
- Coverage merge step checks for the multicluster file before including it.
- Removed the push-specific Codecov upload step (no longer needed).
- Simplified PR-related `if` guards (no longer need `github.event_name == 'pull_request'` checks since the workflow is PR-only).

### Timeouts Added

| Scope | Timeout |
|-------|---------|
| Build/lint jobs (`test-lint-backend`, `build-frontend`, `build-backend`) | 30 min |
| All integration tests (single-cluster and multi-cluster) | 60 min |
| Utility jobs (`initialize`, `store_pr_metadata`, `wave2_gate`) | 5 min |
| `codecov_upload_pr_base` | 30 min |
| `codecov_merge_upload` | 15 min |

## Behavior Summary

| Event | What runs |
|-------|-----------|
| PR opened (no label) | Build + lint + wave 1 (8 integration jobs) + codecov |
| `ci-full` label added | Full workflow re-run: build + lint + wave 1 + wave 2 (sequential) |
| New commit pushed (no label) | Build + lint + wave 1 + codecov |
| New commit pushed (label present) | Build + lint + wave 1 + wave 2 (sequential) + codecov |
| Push to master (merge) | Nothing in `kiali-ci.yml`; `codecov-master-baseline.yml` uploads unit coverage |
| Nightly | Full suite via `nightly.yml` (unchanged) |

## Files Modified

- `.github/workflows/kiali-ci.yml` -- trigger changes, wave gating, codecov adjustments
- `.github/workflows/integration-tests-backend.yml` -- timeout-minutes: 60
- `.github/workflows/integration-tests-backend-mcp.yml` -- timeout-minutes: 60
- `.github/workflows/integration-tests-frontend-core-1.yml` -- timeout-minutes: 60
- `.github/workflows/integration-tests-frontend-core-2.yml` -- timeout-minutes: 60
- `.github/workflows/integration-tests-frontend-core-caching.yml` -- timeout-minutes: 60
- `.github/workflows/integration-tests-frontend-core-optional.yml` -- timeout-minutes: 60
- `.github/workflows/integration-tests-frontend-ambient.yml` -- timeout-minutes: 60
- `.github/workflows/integration-tests-frontend-chat.yml` -- timeout-minutes: 60
- `.github/workflows/integration-tests-frontend-tempo.yml` -- timeout-minutes: 60
- `.github/workflows/integration-tests-frontend-local-offline.yml` -- timeout-minutes: 60
- `.github/workflows/integration-tests-frontend-ambient-multi-primary.yml` -- timeout-minutes: 90
- `.github/workflows/integration-tests-backend-multicluster-external-controlplane.yml` -- timeout-minutes: 90
- `.github/workflows/integration-tests-frontend-multicluster-primary-remote.yml` -- timeout-minutes: 90
- `.github/workflows/integration-tests-frontend-multicluster-multi-primary.yml` -- timeout-minutes: 90
- `.github/workflows/integration-tests-frontend-multicluster-external-kiali.yml` -- timeout-minutes: 90
- `.github/workflows/integration-tests-frontend-multi-mesh.yml` -- timeout-minutes: 90
- `.github/workflows/integration-tests-frontend.yml` -- timeout-minutes: 90
- `.github/workflows/test-lint-backend.yml` -- timeout-minutes: 30
- `.github/workflows/build-frontend.yml` -- timeout-minutes: 30
- `.github/workflows/build-backend.yml` -- timeout-minutes: 30
