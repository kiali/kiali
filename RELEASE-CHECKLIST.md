# Kiali Sprint Release Checklist (Minor/Major)

Use this checklist to verify that all expected artifacts were produced after a sprint release.
This checklist is for **minor/major releases only** — patch releases have different expectations.
Replace `X.Y.Z` and `X.Y` with the actual release version numbers throughout.

To run these checks automatically (replace X.Y with the release version you are verifying):

```bash
./hack/verify-github-release.sh -v X.Y -d 1    # Day 1 (Monday) checks
./hack/verify-github-release.sh -v X.Y -d 2    # Day 2 (Tuesday) checks
./hack/verify-github-release.sh -v X.Y -d all  # Both days
```

The release happens in two phases:
- **Day 1 (Monday):** kiali, kiali-operator, helm-charts, and kiali.io are released.
- **Day 2 (Tuesday):** openshift-servicemesh-plugin (OSSMC) is released.

> **Note:** GitHub Actions scheduled workflows can be delayed by several hours or skipped entirely
> due to platform load. If the release workflows have not run by Monday afternoon, trigger them
> manually (see [Re-Trigger Release Workflows Manually](#step-6-re-trigger-release-workflows-manually)).

---

# Day 1 — Main Release (Monday)

## Container Images (Quay.io)

- [ ] **Kiali Server image** — `quay.io/kiali/kiali` with `X.Y` and `X.Y.Z` version tags, each in distroless and `-distro` variants. Multi-arch: amd64, arm64, s390x, ppc64le. Verify tags at https://quay.io/repository/kiali/kiali?tab=tags
  ```bash
  skopeo inspect --raw docker://quay.io/kiali/kiali:vX.Y.Z | jq '.manifests[].platform'
  skopeo inspect --raw docker://quay.io/kiali/kiali:vX.Y.Z-distro | jq '.manifests[].platform'
  skopeo inspect --raw docker://quay.io/kiali/kiali:vX.Y | jq '.manifests[].platform'
  ```

- [ ] **Kiali Operator image** — `quay.io/kiali/kiali-operator` with `X.Y` and `X.Y.Z` version tags. Multi-arch: amd64, arm64, s390x, ppc64le. Verify tags at https://quay.io/repository/kiali/kiali-operator?tab=tags
  ```bash
  skopeo inspect --raw docker://quay.io/kiali/kiali-operator:vX.Y.Z | jq '.manifests[].platform'
  skopeo inspect --raw docker://quay.io/kiali/kiali-operator:vX.Y | jq '.manifests[].platform'
  ```

## Git Tags

- [ ] **Kiali server tag** — `v<X.Y.Z>` on `kiali/kiali`
  ```bash
  git ls-remote --tags https://github.com/kiali/kiali.git vX.Y.Z
  ```

- [ ] **Kiali operator tag** — `v<X.Y.Z>` on `kiali/kiali-operator`
  ```bash
  git ls-remote --tags https://github.com/kiali/kiali-operator.git vX.Y.Z
  ```

- [ ] **Helm charts tags** — both `v<X.Y.Z>-master` and `v<X.Y.Z>` on `kiali/helm-charts`
  ```bash
  git ls-remote --tags https://github.com/kiali/helm-charts.git vX.Y.Z vX.Y.Z-master
  ```

## Git Branches

- [ ] **Kiali server version branch** — `v<X.Y>` on `kiali/kiali`
  ```bash
  git ls-remote --heads https://github.com/kiali/kiali.git vX.Y
  ```

- [ ] **Kiali operator version branch** — `v<X.Y>` on `kiali/kiali-operator`
  ```bash
  git ls-remote --heads https://github.com/kiali/kiali-operator.git vX.Y
  ```

- [ ] **Helm charts version branch** — `v<X.Y>` on `kiali/helm-charts`
  ```bash
  git ls-remote --heads https://github.com/kiali/helm-charts.git vX.Y
  ```

- [ ] **kiali.io versioned docs branch** — `v<X.Y>` branch created for the *previous* release (e.g. if releasing v2.27, a `v2.26` branch is created as a frozen snapshot at https://v2-26.kiali.io)
  ```bash
  git ls-remote --heads https://github.com/kiali/kiali.io.git vX.Y
  ```

- [ ] **kiali.io `staging` branch updated** — new version menu entry for the *previous* release in `config.toml` + regenerated CRD reference docs (e.g. if releasing v2.27, look for a `v2.26` entry)
  ```bash
  curl -s https://raw.githubusercontent.com/kiali/kiali.io/staging/config.toml | grep 'vPREV'
  ```

## GitHub Releases

- [ ] **Kiali server GitHub Release** — confirm a new release exists with binaries attached. See https://github.com/kiali/kiali/releases
  ```bash
  gh release view vX.Y.Z --repo kiali/kiali
  ```

## Pull Requests ("Prepare for next version")

- [ ] **Kiali server PR** — titled **"Prepare for next version"**. Changes: `Makefile` VERSION bumped to `<NEXT>-SNAPSHOT` and `frontend/package.json` version bumped to the next version.
  ```bash
  gh pr list --repo kiali/kiali --search "Prepare for next version" --state open
  ```

- [ ] **Kiali operator PR** — titled **"Prepare for next version"**. Changes: `Makefile` VERSION bumped to `<NEXT>-SNAPSHOT` and new OLM bundle directories created under `manifests/kiali-upstream/` via `create-new-version.sh`.
  ```bash
  gh pr list --repo kiali/kiali-operator --search "Prepare for next version" --state open
  ```

- [ ] **Helm charts PR** — titled **"Prepare for next version (smoke test passed)"**. Changes: `Makefile` VERSION bumped to `<NEXT>-SNAPSHOT`, packaged chart `.tgz` files and updated `docs/index.yaml` in `docs/`. Merging this PR publishes the charts at https://kiali.org/helm-charts. **WARNING:** If the PR title is **"[DO NOT MERGE YET] Prepare for next version"**, STOP — the smoke test failed. Investigate the failure, fix the problem, and attempt a manual re-release.
  ```bash
  gh pr list --repo kiali/helm-charts --search "Prepare for next version" --state open
  ```

## Documentation Site

- [ ] **Netlify site deployments** — verify that https://kiali.io and the *previous* version's site https://vPREV.kiali.io (e.g. if releasing v2.27, check https://v2-26.kiali.io) are live and serving the correct content.
  ```bash
  curl -sI https://kiali.io | head -5
  curl -sI https://vPREV.kiali.io | head -5
  ```

---

# Day 2 — OSSMC Plugin Release (Tuesday)

## Container Images (Quay.io)

- [ ] **OSSMC plugin image** — `quay.io/kiali/ossmconsole` with `X.Y` and `X.Y.Z` version tags. Multi-arch: amd64, arm64, s390x, ppc64le (no `-distro` variants). Verify tags at https://quay.io/repository/kiali/ossmconsole?tab=tags
  ```bash
  skopeo inspect --raw docker://quay.io/kiali/ossmconsole:vX.Y.Z | jq '.manifests[].platform'
  skopeo inspect --raw docker://quay.io/kiali/ossmconsole:vX.Y | jq '.manifests[].platform'
  ```

## Git Tag

- [ ] **OSSMC plugin tag** — `v<X.Y.Z>` on `kiali/openshift-servicemesh-plugin`
  ```bash
  git ls-remote --tags https://github.com/kiali/openshift-servicemesh-plugin.git vX.Y.Z
  ```

## Git Branch

- [ ] **OSSMC plugin version branch** — `v<X.Y>` on `kiali/openshift-servicemesh-plugin`
  ```bash
  git ls-remote --heads https://github.com/kiali/openshift-servicemesh-plugin.git vX.Y
  ```

## GitHub Release

- [ ] **OSSMC plugin GitHub Release** — confirm a new release titled "OpenShift Service Mesh Console vX.Y.Z" exists. See https://github.com/kiali/openshift-servicemesh-plugin/releases
  ```bash
  gh release view vX.Y.Z --repo kiali/openshift-servicemesh-plugin
  ```

## Pull Request ("Prepare for next version")

- [ ] **OSSMC plugin PR** — titled **"Prepare for next version"**. Changes: `Makefile` VERSION bumped to `<NEXT>-SNAPSHOT`, `plugin/package.json` and `plugin/plugin-metadata.ts` version bumped to the next version.
  ```bash
  gh pr list --repo kiali/openshift-servicemesh-plugin --search "Prepare for next version" --state open
  ```

---

## Troubleshooting a Failed Release

If a checklist item above is not confirmed, use these steps to investigate before jumping
to cleanup.

> **Important:** The release pipelines are **not idempotent**. You cannot simply re-run a
> failed workflow — you must clean up partial artifacts first (see the Recovery section below).

### Step 1: Check Which Workflow Failed

Open the GitHub Actions page for each repo and look for failed runs:

- https://github.com/kiali/kiali/actions/workflows/release.yml
- https://github.com/kiali/kiali-operator/actions/workflows/release.yml
- https://github.com/kiali/openshift-servicemesh-plugin/actions/workflows/release.yaml
- https://github.com/kiali/helm-charts/actions/workflows/release.yml
- https://github.com/kiali/kiali.io/actions/workflows/release.yaml

Or from the command line:

```bash
gh run list --repo kiali/kiali --workflow release.yml --limit 3
gh run list --repo kiali/kiali-operator --workflow release.yml --limit 3
gh run list --repo kiali/openshift-servicemesh-plugin --workflow release.yaml --limit 3
gh run list --repo kiali/helm-charts --workflow release.yml --limit 3
gh run list --repo kiali/kiali.io --workflow release.yaml --limit 3
```

### Step 2: Check the "Log information" Step

Each workflow has an `initialize` job with a **"Log information"** step that logs the computed
release parameters. This is the first thing to verify — it confirms that the pipeline detected
the correct release type, version numbers, and image tags. Look for:

- **Release type** — should be `minor` (or `major`), not `skip`
- **Release version** — the version being released (e.g. `v2.27.0`)
- **Next version** — the next development version (e.g. `v2.28.0`)
- **Branch version** — the major.minor branch (e.g. `v2.27`)
- **Quay tag** — the image tags that will be pushed

If `release_type` is `skip`, the pipeline determined it was not a release week.

### Step 3: Inspect the Failed Step

Click into the failed workflow run and expand the failed job to see exactly which step broke.
Common failure categories:

- **Build/test failures** (kiali server only) — frontend build, backend build, or molecule
  tests failed. Nothing was published yet — no cleanup needed, just fix the code and re-run.
- **Image push failures** — Quay.io credentials may have expired, or Quay is having an outage.
  Check https://status.quay.io for service status.
- **Git push failures** — the tag or branch may already exist from a previous partial run, or
  there may be a permissions issue with the `GITHUB_TOKEN`.
- **PR creation failures** — usually means the temporary branch already exists from a prior
  failed run.
- **Helm charts smoke test failure** — the kiali or operator images are not yet available on
  Quay. This can happen if the helm-charts workflow runs before the image workflows finish.
  Verify images exist first:
  ```bash
  skopeo inspect --raw docker://quay.io/kiali/kiali:vX.Y.Z
  skopeo inspect --raw docker://quay.io/kiali/kiali-operator:vX.Y.Z
  ```

### Step 4: View Full Logs from the Command Line

To view the logs of a specific failed run:

```bash
# Get the run ID from the list above, then view logs
gh run view RUN_ID --repo kiali/kiali --log-failed
```

### Step 5: Determine How Far the Release Got

Before cleaning up, figure out which artifacts were already created. Run the verification
commands from the checklist above to see what exists and what's missing. This tells you
exactly what needs to be cleaned up.

---

## Recovery: Cleaning Up a Failed Release and Re-Releasing

If one or more checklist items above failed, follow these steps to clean up the partial release
and then manually re-trigger the workflows. Replace `X.Y.Z` and `X.Y` with actual versions.

### Step 1: Clean Up Git Tags

Delete any tags that were created by the failed release. Only delete tags that exist.

```bash
# kiali/kiali
git push --delete https://github.com/kiali/kiali.git vX.Y.Z

# kiali/kiali-operator
git push --delete https://github.com/kiali/kiali-operator.git vX.Y.Z

# kiali/openshift-servicemesh-plugin
git push --delete https://github.com/kiali/openshift-servicemesh-plugin.git vX.Y.Z

# kiali/helm-charts (may have one or both)
git push --delete https://github.com/kiali/helm-charts.git vX.Y.Z
git push --delete https://github.com/kiali/helm-charts.git vX.Y.Z-master
```

### Step 2: Clean Up Git Branches

Delete version branches that were created by the failed release. Only delete branches that exist
and were created by *this* release (do not delete pre-existing branches). If a version branch
existed before the failed release, revert the kiali-bot commit on it instead of deleting it.

```bash
# kiali/kiali
git push --delete https://github.com/kiali/kiali.git vX.Y

# kiali/kiali-operator
git push --delete https://github.com/kiali/kiali-operator.git vX.Y

# kiali/openshift-servicemesh-plugin
git push --delete https://github.com/kiali/openshift-servicemesh-plugin.git vX.Y

# kiali/helm-charts
git push --delete https://github.com/kiali/helm-charts.git vX.Y
```

Also delete any temporary PR branches left behind:

```bash
# Find and delete temporary release branches (pattern: <repo>-release-*-main)
git ls-remote --heads https://github.com/kiali/kiali.git 'kiali-release-*-main'
git ls-remote --heads https://github.com/kiali/kiali-operator.git 'kiali-operator-release-*-main'
git ls-remote --heads https://github.com/kiali/openshift-servicemesh-plugin.git 'kiali-release-*'
git ls-remote --heads https://github.com/kiali/helm-charts.git 'helm-charts-release-*-main'

# Delete them (replace BRANCH_NAME with actual branch name from above)
git push --delete https://github.com/kiali/kiali.git BRANCH_NAME
git push --delete https://github.com/kiali/kiali-operator.git BRANCH_NAME
git push --delete https://github.com/kiali/openshift-servicemesh-plugin.git BRANCH_NAME
git push --delete https://github.com/kiali/helm-charts.git BRANCH_NAME
```

### Step 3: Clean Up GitHub Releases

Delete any GitHub release that was created by the failed run.

```bash
gh release delete vX.Y.Z --repo kiali/kiali --yes
gh release delete vX.Y.Z --repo kiali/openshift-servicemesh-plugin --yes
```

### Step 4: Close Leftover Pull Requests

Close any "Prepare for next version" PRs opened by the failed release.

```bash
# List them first
gh pr list --repo kiali/kiali --search "Prepare for next version" --state open
gh pr list --repo kiali/kiali-operator --search "Prepare for next version" --state open
gh pr list --repo kiali/openshift-servicemesh-plugin --search "Prepare for next version" --state open
gh pr list --repo kiali/helm-charts --search "Prepare for next version" --state open

# Close them (replace PR_NUMBER with actual PR number from above)
gh pr close PR_NUMBER --repo kiali/kiali
gh pr close PR_NUMBER --repo kiali/kiali-operator
gh pr close PR_NUMBER --repo kiali/openshift-servicemesh-plugin
gh pr close PR_NUMBER --repo kiali/helm-charts
```

### Step 5: Revert kiali.io Changes

If the kiali.io release workflow ran, you may need to revert changes to the `staging` and
`current` branches. Check if the versioned docs branch was created and delete it if so:

```bash
git ls-remote --heads https://github.com/kiali/kiali.io.git vX.Y
git push --delete https://github.com/kiali/kiali.io.git vX.Y
```

For `staging` and `current` branch reverts, manually inspect and revert the commits pushed
by `kiali-bot` as needed.

### Step 6: Re-Trigger Release Workflows Manually

Once cleanup is complete, manually trigger the release workflows. The order matters — kiali
and kiali-operator must complete first (images must exist on Quay) before helm-charts can
pass its smoke test.

**1. Kiali server** (run first):
```bash
gh workflow run release.yml --repo kiali/kiali \
  -f release_type=minor \
  -f release_branch=master
```

**2. Kiali operator** (run in parallel with kiali server):
```bash
gh workflow run release.yml --repo kiali/kiali-operator \
  -f release_type=minor \
  -f release_branch=master
```

**3. OSSMC plugin** (run in parallel with kiali server and operator):
```bash
gh workflow run release.yaml --repo kiali/openshift-servicemesh-plugin \
  -f release_type=minor \
  -f release_branch=main
```

**4. Helm charts** (run after kiali and kiali-operator images are on Quay):
```bash
gh workflow run release.yml --repo kiali/helm-charts \
  -f release_type=minor \
  -f release_branch=master
```

**5. kiali.io** (run after other releases are done):

> **Note:** The kiali.io release workflow enforces the 3-week release cadence even on manual
> dispatch. If you are re-releasing outside the release week window, the workflow will skip
> automatically. In that case, you will need to run the release script manually or wait until
> the next release window.

```bash
gh workflow run release.yaml --repo kiali/kiali.io \
  -f release_branch=staging
```

### Step 8: Re-Run This Checklist

After the manual release workflows complete, go back to the top of this document and verify
every checklist item again.
