# Codecov Fork PR Fix

## Problem

The Codecov upload was failing for fork PRs with the error:
```
Upload queued for processing failed: {"message":"Token required because branch is protected"}
```

### Root Cause

1. **Fork Detection**: When a PR comes from a forked repository, GitHub Actions detects it as a fork (`CC_FORK="true"`)
2. **Missing Token**: Fork PRs don't have access to repository secrets (`secrets.CODECOV_TOKEN`) for security reasons
3. **Protected Branch**: The master branch is protected in Codecov, requiring authentication via token
4. **Workflow Condition Missing**: The workflow was attempting to upload coverage for ALL pull requests, including those from forks

The workflow had three problematic steps:
- `codecov_upload_pr_base` job (line 254)
- `Select Codecov PR base commit` step (line 348)
- `Upload coverage to Codecov (pull request)` step (line 358)

All three were running on fork PRs without checking if the PR had access to secrets.

## Solution

Add a condition to skip Codecov uploads for fork PRs by checking if the PR head repository matches the base repository:

```yaml
github.event.pull_request.head.repo.full_name == github.repository
```

This condition ensures:
- ✅ Internal PRs (same repo): Have access to `secrets.CODECOV_TOKEN` → uploads succeed
- ✅ Fork PRs: Skip Codecov steps → no token errors, other CI jobs still run

### Changes Made

1. **Job-level condition** (line 254):
   ```yaml
   codecov_upload_pr_base:
     if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
   ```

2. **PR base picking step** (line 348):
   ```yaml
   - name: Select Codecov PR base commit
     if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
   ```

3. **PR upload step** (line 358):
   ```yaml
   - name: Upload coverage to Codecov (pull request)
     if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository
   ```

## Impact

- **Fork PRs**: Will skip Codecov uploads (expected behavior - they can't access secrets)
- **Internal PRs**: Will continue uploading coverage normally
- **Push to master**: Unaffected (uses separate push upload step)
- **CI Status**: Other jobs continue running for fork PRs (tests, linting, builds)

## Testing

To verify the fix:
1. Fork PRs should no longer fail at the Codecov upload step
2. Internal PRs should continue uploading coverage successfully
3. The `codecov_upload_pr_base` job should show as "Skipped" for fork PRs
