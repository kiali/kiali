# Upstream Relationship

## Overview

Kiali is developed as a community project at
[kiali/kiali](https://github.com/kiali/kiali) (this repository).

Unlike Istio and the Sail Operator — which maintain separate midstream forks under
[openshift-service-mesh](https://github.com/openshift-service-mesh) — **there is no
`openshift-service-mesh/kiali` midstream repository**. Red Hat OpenShift Service Mesh
(OSSM) ships Kiali built from upstream sources. OSSM-specific packaging and
distribution live in the operator bundles and related repositories described below.

Kiali derives its core server and UI from this upstream codebase. The Kiali Operator
publishes separate OLM bundles for community (`kiali-upstream`) and Red Hat
(`kiali-ossm`) channels.

## Repository Structure

| Role | Repository | Description |
|------|------------|-------------|
| Upstream (server + UI) | https://github.com/kiali/kiali | Kiali server, frontend, hack scripts, CI |
| Upstream (operator) | https://github.com/kiali/kiali-operator | Ansible operator, OLM bundles, CRDs |
| Upstream (charts) | https://github.com/kiali/helm-charts | Helm charts for server and operator |
| Upstream (OSSMC plugin) | https://github.com/kiali/openshift-servicemesh-plugin | OpenShift Console dynamic plugin |
| Upstream (docs site) | https://github.com/kiali/kiali.io | https://kiali.io documentation |
| Mesh midstream (Istio) | https://github.com/openshift-service-mesh/istio | OSSM Istio control plane; see [istio upstream docs](https://github.com/openshift-service-mesh/istio/blob/master/docs/upstream.md) |
| Mesh midstream (Sail) | https://github.com/openshift-service-mesh/sail-operator | OSSM Sail operator; see [sail-operator upstream docs](https://github.com/openshift-service-mesh/sail-operator/blob/main/docs/upstream.md) |

### Local developer layout

Clone the repositories as siblings and link the operator into the server repo:

```bash
mkdir kiali_sources && cd kiali_sources
git clone https://github.com/kiali/kiali.git
git clone https://github.com/kiali/kiali-operator.git
git clone https://github.com/kiali/helm-charts.git
ln -s $PWD/kiali-operator kiali/operator
```

See [README.adoc](../README.adoc#developer-setup) and [AGENTS.md](../AGENTS.md) for
build and test workflows.

## Branch Mapping

Kiali releases on a three-week minor cadence. Supported release branches receive
backports and security fixes. OSSM product versions align with specific Kiali
release branches.

| OSSM Release | Kiali Branch | Kiali Version |
|--------------|--------------|---------------|
| 3.4 | `v2.27` | 2.27 |
| 3.3 | `v2.22` | 2.22 |
| 3.2 | `v2.17` | 2.17 |
| 3.1 | `v2.11` | 2.11 |
| 3.0 | `v2.4` | 2.4 |

`master` is the active development branch for the next Kiali release.

The same branch names (`v2.27`, `v2.22`, …) are used across the related upstream
repositories (`kiali`, `kiali-operator`, `helm-charts`, `openshift-servicemesh-plugin`)
when a release is cut.

For the mapping between OSSM releases, OpenShift versions, and Istio/Sail branches,
see the [sail-operator upstream relationship
documentation](https://github.com/openshift-service-mesh/sail-operator/blob/main/docs/upstream.md).

## Contribution Workflow

1. **All server and UI changes belong here.** Feature work, bug fixes, and refactors for
   Kiali server and frontend are proposed as pull requests to `kiali/kiali`.
2. **Operator and packaging changes** go to `kiali/kiali-operator` and
   `kiali/helm-charts` when they affect deployment, CRDs, RBAC, or OLM bundles.
3. **OpenShift Console integration** (OSSMC) changes go to
   `kiali/openshift-servicemesh-plugin` when they affect the dynamic plugin only.
4. **Discuss first.** Open a [discussion](https://github.com/kiali/kiali/discussions) or
   [issue](https://github.com/kiali/kiali/issues) before large changes. See
   [CONTRIBUTING.md](../CONTRIBUTING.md).

Because there is no Kiali midstream fork, bug fixes that affect both community Kiali
and OSSM should land in this upstream repository. Red Hat product builds consume
tagged releases from here.

## Release and Downstream Sync

Upstream releases are automated via GitHub Actions (see [RELEASING.md](../RELEASING.md)):

| Artifact | Registry / location |
|----------|---------------------|
| Kiali server image | `quay.io/kiali/kiali` |
| Kiali operator image | `quay.io/kiali/kiali-operator` |
| OSSMC plugin image | `quay.io/kiali/ossmconsole` |
| Helm charts | https://kiali.io/helm-charts/ |

Release cadence (typical sprint):

1. **Day 1:** `kiali`, `kiali-operator`, `helm-charts`, and `kiali.io`
2. **Day 2:** `openshift-servicemesh-plugin` (OSSMC)

When frontend files change on a supported release branch, the
[Notify OSSMC Frontend Sync](https://github.com/kiali/kiali/blob/master/.github/workflows/notify-ossmc-sync.yml)
workflow dispatches an event to `openshift-servicemesh-plugin` so the plugin can
rebuild against the updated UI.

Red Hat OSSM does **not** merge upstream Kiali through an automator bot the way
`openshift-service-mesh/istio` and `openshift-service-mesh/sail-operator` do.
Product teams consume published upstream images and operator bundles for the
matching `vX.Y` release branch.

## Coding Conventions

- Follow [STYLE_GUIDE.adoc](../STYLE_GUIDE.adoc) and [AGENTS.md](../AGENTS.md).
- Keep OSSM/OpenShift-specific logic isolated:
  - **Operator bundles:** `kiali-operator/manifests/kiali-ossm/` (Red Hat channel) vs
    `kiali-operator/manifests/kiali-upstream/` (community channel)
  - **OSSMC plugin:** `kiali/openshift-servicemesh-plugin`
  - **Server/UI:** prefer features that work in both standalone Kiali and OSSMC;
    see OSSMC compatibility patterns in [AGENTS.md](../AGENTS.md#writing-new-e2e-tests)
    and [WORKING_WITH_OSSMC.md](../WORKING_WITH_OSSMC.md)

### OSSMC compatibility in tests and UI

Cypress tests and UI code must work in standalone Kiali and in OSSMC (kiosk mode behind
the OpenShift Console proxy). In particular:

- Use `cy.request({ url: '...' })` object form for API calls
- Use `cy.intercept('**/api/...')` patterns with a leading `**` glob
- Use `linkSelector()` for navigation links (`<a href>` vs `<button data-href>`)

### OSSM-only server changes

Avoid permanent OSSM-only divergences in `kiali/kiali` server or frontend code when
possible. If a change truly applies only to the Red Hat product and cannot be shared
with the community project, document the reason in the commit message and PR
description. Prefer configuration, operator defaults, or plugin-specific code over
forking behavior in the main codebase.

## CI Configuration

Kiali upstream CI runs on **GitHub Actions** in `kiali/kiali`:

- [.github/workflows/](https://github.com/kiali/kiali/tree/master/.github/workflows) —
  build, test, lint, integration, and release pipelines

Integration tests use KinD clusters and Cypress; see
[hack/run-integration-tests.sh](../hack/run-integration-tests.sh) and
[AGENTS.md](../AGENTS.md#integration-tests-via-hackrun-integration-testssh).

Red Hat OSSM prow jobs for Istio and Sail live in
[openshift/release](https://github.com/openshift/release) under
`ci-operator/config/openshift-service-mesh/`; Kiali itself is not part of that
midstream CI model.

## PR Process

| Change type | Where to open the PR |
|-------------|----------------------|
| Server, API, graph, UI | https://github.com/kiali/kiali |
| Operator, CRDs, OLM bundles | https://github.com/kiali/kiali-operator |
| Helm charts | https://github.com/kiali/helm-charts |
| OSSMC OpenShift Console plugin | https://github.com/kiali/openshift-servicemesh-plugin |
| Documentation website | https://github.com/kiali/kiali.io |

- All Kiali organization repositories require **signed commits**. See
  [COMMIT-SIGNING-SETUP.md](../COMMIT-SIGNING-SETUP.md).
- Run `make format lint` and relevant tests before submitting.
- Link the GitHub issue in the PR description.
- For OSSM release alignment, maintainers backport fixes to the appropriate `vX.Y`
  branch listed in the branch mapping table above.
