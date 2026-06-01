# Codecov Baseline Configuration

## Overview
This document explains how the Kiali CI workflow is configured to upload coverage data to Codecov for establishing baselines.

## Current Configuration

The `.github/workflows/kiali-ci.yml` workflow is configured to:

1. **Run on master branch pushes**: Establishes the baseline coverage for the repository
2. **Run on pull requests**: Provides PR coverage for comparison against the baseline

### Workflow Triggers
```yaml
on:
  push:
    branches:
    - master
    - v*.*
  pull_request:
    types: [opened, synchronize, reopened]
    branches:
    - master
    - v*.*
```

### Coverage Upload Job
The `codecov_merge_upload` job:
- Runs after unit tests and integration tests complete successfully
- Downloads coverage artifacts from:
  - Backend unit tests (`coverage-unit.out`)
  - Backend integration tests (`coverage-backend.out`)
  - Multicluster integration tests (`coverage-multicluster.out`)
- Merges all coverage files into a single `coverage.out`
- Uploads to Codecov with the `integration` flag

### Key Points
- ✅ Baseline coverage is established by running on **master branch** after every merge (`push` trigger)
- ✅ PR coverage is generated for every pull request
- ✅ PRs use Codecov `pr-base-picking` with `base_sha` = target branch head so the base is current, not a stale commit
- ✅ Checkout uses `fetch-depth: 0` for accurate git metadata
- ✅ Upload uses `CODECOV_TOKEN` (same pattern as sail-operator)
- ✅ Set to `fail_ci_if_error: false` to make coverage informational

## What Happens Next

1. When code is merged to master, the workflow runs and uploads baseline coverage
2. When a PR is created, the workflow runs and uploads PR coverage
3. Codecov automatically compares the PR coverage against the master baseline
4. Coverage reports appear in the PR as a comment/check

## References
- PR: https://github.com/kiali/kiali/pull/9760
- Workflow file: `.github/workflows/kiali-ci.yml`
