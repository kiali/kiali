---
scribe:
  title: "Build System and Dev Conventions"
  description: "How the Kiali build system is structured — Makefile decomposition, Go and frontend build mechanics, container image variants, multi-cluster push paths, operator symlink, test wiring, and CI."
  watch_paths: [Makefile, hack/, operator/, make/, STYLE_GUIDE.adoc, CONTRIBUTING.md]
  scan: "5b5a2d914858e50b0072a7b3fbf6c92e564908c1"
  freshness: 100
  human_input: 0
  completeness: 78
  inferred_sections:
    - {id: "overview", heading: "Overview"}
    - {id: "makefile-structure", heading: "Makefile Structure"}
    - {id: "go-build", heading: "Go Binary Build"}
    - {id: "frontend-build", heading: "Frontend Build"}
    - {id: "container-images", heading: "Container Image Variants"}
    - {id: "cluster-push", heading: "Cluster-Specific Image Push"}
    - {id: "operator-symlink", heading: "The Operator Symlink Pattern"}
    - {id: "test-infrastructure", heading: "Test Infrastructure"}
    - {id: "hack-scripts", heading: "hack/ Script Ecosystem"}
    - {id: "ci", heading: "CI/CD Pipeline"}
    - {id: "code-conventions", heading: "Code Conventions"}
  stale_flags: []
---

# Build System and Dev Conventions

> TL;DR: The Kiali build is driven by a decomposed Makefile (root + nine `.mk` files), builds a CGO-disabled Go binary with version ldflags, embeds a pre-built React frontend, and pushes images to OpenShift, Minikube, or KinD registries through a unified `cluster-push` target. The operator is a filesystem symlink to a sibling repo.

See [AGENTS.md](../../AGENTS.md) for the full command reference and developer quick-start. This document explains the architectural choices behind those commands.

## Overview

The Kiali repository (`kiali/kiali`) produces several artifacts:

- The **Kiali server binary** — a single CGO-disabled Go executable.
- The **React frontend build** — static assets embedded via the frontend `build/` directory.
- **Container images** — four Dockerfiles for different runtime targets.
- The **Kiali operator** — lives in a sibling repo, accessed through a symlink.

All build, test, and deployment operations are orchestrated through `make`. The root `Makefile` defines global variables and includes nine topic-specific `.mk` files from the `make/` directory.

## Makefile Structure

The root `Makefile` sets global variables (versions, image names, architecture lists, tool detection) and delegates all targets to included files:

```
Makefile
├── make/Makefile.build.mk       # go build, yarn build, test targets
├── make/Makefile.cluster.mk     # cluster-type registry configuration
├── make/Makefile.container.mk   # docker/podman build and push to quay.io
├── make/Makefile.helm.mk        # helm chart targets (requires helm-charts sibling repo)
├── make/Makefile.mcp.mk         # MCP (Model Context Protocol) server targets
├── make/Makefile.molecule.mk    # Ansible Molecule operator tests
├── make/Makefile.olm.mk         # OLM (Operator Lifecycle Manager) packaging
├── make/Makefile.operator.mk    # operator deploy/undeploy to live clusters
└── make/Makefile.ui.mk          # frontend dev server and Cypress targets
```

Global variables of note in the root `Makefile`:
- `VERSION` — the Kiali semantic version (e.g., `v2.27.0-SNAPSHOT`). Embedded in the binary at link time.
- `TARGET_ARCHS` — `amd64 arm64 s390x ppc64le` — the multi-arch matrix for published images.
- `DORP` — `docker` or `podman`. All build targets branch on this variable.
- `CLUSTER_TYPE` — `openshift`, `minikube`, `kind`, or `local`. Selects the registry path in `Makefile.cluster.mk`.
- `KIALI_DOCKER_FILE` — defaults to `Dockerfile-distroless`; controls which image is built locally.
- `GO_BUILD_FLAGS` — appended to every `go build` invocation (used by CI to inject `-race`).
- `CGO_ENABLED` — defaults to `0`; set to `1` only when building with `-race`.

## Go Binary Build

The primary build target (`make build`) in `Makefile.build.mk`:

1. Runs `go-check` — validates that the installed Go version matches `go.mod`.
2. Runs `check-ui` — aborts if `frontend/build/` is absent. The `//go:embed all:build` directive in `frontend/frontend.go` genuinely embeds the React build into the binary at compile time (via Go's `embed.FS`). If `frontend/build/` does not exist when `go build` runs, the build fails. The check-ui step catches this early with a clear error message.
3. Compiles with:

```bash
${GO_BUILD_ENVVARS} go build \
    -o ${GOPATH}/bin/kiali \
    -ldflags "-X github.com/kiali/kiali/cmd.version=${VERSION} \
              -X github.com/kiali/kiali/cmd.commitHash=${COMMIT_HASH} \
              -X github.com/kiali/kiali/cmd.goVersion=${GO_ACTUAL_VERSION}" \
    ${GO_BUILD_FLAGS}
```

Key properties:
- `CGO_ENABLED=0` — produces a fully static binary with no C runtime dependency, essential for the distroless container image.
- `GOOS` and `GOARCH` default to the host platform but are overridden for cross-compilation.
- Version, commit hash, and Go version are injected via `ldflags -X` into package-level variables in `github.com/kiali/kiali/cmd`.
- No build tags are used for the main binary — the `exclude_frontend` build tag is only used in `make test` to exclude frontend-related test files from the Go unit test run.

**Multi-arch build** (`make build-linux-multi-arch`): loops over `TARGET_ARCHS` and produces one binary per arch with a `-<arch>` suffix in `$GOPATH/bin/`. These arch-suffixed binaries are what `Dockerfile-multi-arch` copies into the image via `COPY kiali-${TARGETARCH} $KIALI_HOME/kiali`.

**System-test binary** (`make build-system-test`): compiles with `go test -c -covermode=count -coverpkg ...` to produce a coverage-instrumented binary. This is used for integration tests that measure code coverage across the entire server.

**Hot reload** (`make run-backend`): uses `air` (installed automatically if absent) with `.air.toml` for automatic recompilation on Go file changes during development.

## Frontend Build

The frontend is a React/TypeScript application in `frontend/`. The build is managed by Yarn 4, activated via Node.js Corepack.

The `Makefile.build.mk` `.ensure-yarn-version` prerequisite enforces Yarn 4+ by checking `yarn --version`. If Yarn is absent or old, it instructs the developer to run `corepack enable`.

```bash
# Production build
make build-ui
# → cd frontend && yarn install --immutable && yarn run build

# Development server (with proxy to backend)
make run-frontend
# → injects "proxy": "${KIALI_PROXY_URL}" into package.json, then yarn start
# → cleans up the proxy field on exit via trap
```

The `--immutable` flag prevents `yarn install` from modifying `yarn.lock`, enforcing reproducible builds in CI.

`yarn run build` invokes the React scripts build, writing output to `frontend/build/`. Kiali's Go server serves this directory as static assets on its configured web root.

Frontend integration tests are run via Cypress:
- `make cypress-run` — headless Cypress run.
- `make cypress-gui` — interactive Cypress GUI.
- `make cypress-selected` — subset of tests.

## Container Image Variants

Four Dockerfiles live in `deploy/docker/`:

| Dockerfile | Base | Use |
|---|---|---|
| `Dockerfile-distroless` | `scratch` (UBI rootfs via multi-stage) | **Default** production image. Minimal attack surface. Includes openssl + certs layer built from UBI 9. |
| `Dockerfile-multi-arch` | `ubi9-minimal` (per-arch base via `FROM base-${TARGETARCH}` stage selector) | Multi-arch manifest publishing. Copies arch-specific binary (`kiali-${TARGETARCH}`). |
| `Dockerfile-multi-arch-distroless` | Same scratch approach, multi-arch | Distroless variant for multi-arch publishing. |
| `Dockerfile-cypress` | (separate) | Container for Cypress test execution. |

The distroless image uses a two-stage build: a UBI base installs `bash coreutils-single glibc-minimal-langpack openssl` into `/mnt/rootfs`, then `FROM scratch` copies only that rootfs. The result is a minimal image with openssl for TLS but no shell or package manager.

All images run as UID 1000 (`kiali` user), created either via `/etc/passwd` injection (distroless) or `adduser` (UBI minimal).

`ENTRYPOINT` is always `["/opt/kiali/kiali"]` — no CMD; all configuration is via environment variables or a mounted config file.

**Building and tagging:**

```bash
# Build for quay.io (local arch only)
make container-build-kiali     # builds QUAY_TAG = quay.io/kiali/kiali:dev

# Push to quay.io
make container-push-kiali-quay

# Multi-arch manifest (uses docker buildx)
make container-multi-arch-push-kiali-quay   # builds and pushes for all TARGET_ARCHS
```

## Cluster-Specific Image Push

`Makefile.cluster.mk` implements the unified `cluster-push` target by abstracting over the three supported cluster types. The `CLUSTER_TYPE` variable selects a `.prepare-cluster` prerequisite:

| `CLUSTER_TYPE` | Registry resolution | Push mechanism |
|---|---|---|
| `openshift` | Reads external hostname from `oc get image.config.openshift.io/cluster` | `docker/podman push` to the external OCP registry; image is then accessible internally |
| `minikube` | Uses `minikube ip`:5000 (registry addon required) | `docker/podman push` |
| `kind` | Reads the `kind-registry` Docker container's exposed port | `docker/podman push` to `localhost:<port>` |
| `local` | No push; image stays in local daemon | Image loaded directly or cluster configured to pull from local daemon |

For OpenShift, the Makefile also patches the `imageregistry.operator.openshift.io` cluster object to ensure the registry is managed and its external route is enabled before attempting to push.

The `cluster-push` target is defined as `cluster-push: cluster-push-operator cluster-push-kiali` — it simply runs both image-push sub-targets in sequence. It does not include `build-ui`, `build`, or `operator-create`; those are separate targets that developers chain manually (e.g. `make build-ui build test cluster-push`).

## The Operator Symlink Pattern

The operator (`kiali-operator`) is a separate git repository. The Kiali server repo references it through a filesystem symlink:

```
kiali/operator → ../kiali-operator   # (absolute path to sibling repo)
```

This symlink is set up manually by each developer:
```bash
ln -s $PWD/kiali-operator kiali/operator
```

Targets that operate on the operator (`container-build-operator`, `operator-create`, `molecule-test`, helm chart targets) all use `${ROOTDIR}/operator` — they transparently reach into the operator repo through the symlink.

The `Makefile.helm.mk` is particularly aware of this symlink: it resolves `$(readlink "${ROOTDIR}/operator")` to find the physical operator directory, then looks for `helm-charts` as a sibling of that physical directory. This means `helm-charts` must also be cloned as a peer of `kiali-operator`, not a peer of the symlink.

Why a symlink rather than a Git submodule? Kiali's repos version and release independently. A symlink lets each developer point to any local checkout (a feature branch, a fork, a different version) without modifying any tracked file.

## Test Infrastructure

### Unit Tests (`make test`)

Runs `go test` across all packages except `vendor/`, `frontend/`, and `tests/integration/`:

```bash
go test -tags exclude_frontend ${GO_TEST_FLAGS} \
    $(go list -tags exclude_frontend ./... | grep -v -e /vendor/ -e /frontend/ -e /tests/integration/)
```

The `exclude_frontend` build tag gates files that import Node/browser dependencies or generate frontend-specific test fixtures — these are skipped in plain unit tests.

The `test` target requires `setup-envtest` (from `sigs.k8s.io/controller-runtime/tools/setup-envtest`) for controller tests that need a real API server. The envtest binaries are downloaded to `${OUTDIR}/k8s` on first use.

### Integration Tests (`make test-integration`)

Full end-to-end API tests against a live cluster, in `tests/integration/tests/`. They use `go test` with a 30-minute timeout and generate JUnit XML output via `go-junit-report`.

The `hack/run-integration-tests.sh` script is the canonical entry point for both CI and local runs. It accepts a `--test-suite` flag selecting from: `backend`, `frontend`, `frontend-core-1`, `frontend-core-2`, `frontend-ambient`, `frontend-primary-remote`, `frontend-multi-primary`, `frontend-multi-mesh`, `frontend-external-kiali`, `frontend-tempo`, `backend-external-controlplane`, `local`, `offline`, `ai-chatbot`, and several others. The default suite is `backend`.

The script handles setup (cluster provisioning, Kiali install, Istio install) and teardown, with flags like `--setup-only` and `--tests-only` for split execution.

Before each Cypress suite is launched, the `ensureCypressReady()` helper verifies the Cypress binary is available and runs `yarn lint:gherkin` from `frontend/` to validate all Gherkin `.feature` files. The build fails fast if any feature file is malformed, before the cluster is provisioned.

### Controller Integration Tests (`make test-integration-controller`)

Tests in `tests/integration/controller/` use envtest (no live cluster required) to test Kubernetes controller logic. These require Istio CRD YAML files in `tests/integration/controller/testdata/istio-crds/<minor-version>.yaml`. Download them with `make download-istio-crds`.

### Molecule Tests (`make molecule-test`)

Ansible Molecule tests in `operator/molecule/` validate the Kiali Operator's Ansible playbooks end-to-end on a live OpenShift, Minikube, or KinD cluster. They run in a Docker/Podman container with the Ansible Operator SDK.

The `MOLECULE_SCENARIO` variable selects the test scenario (default: `default`). CI runs molecule tests via `hack/ci-kind-molecule-tests.sh`, `hack/ci-minikube-molecule-tests.sh`, and `hack/ci-openshift-molecule-tests.sh`.

`MOLECULE_USE_DEV_IMAGES=true` instructs molecule to pull images from the cluster's internal registry (where `make cluster-push` put them) rather than from quay.io.

## hack/ Script Ecosystem

The `hack/` directory contains categorized shell scripts:

**Cluster provisioning:**
- `k8s-minikube.sh` — full minikube lifecycle (start, configure, addons).
- `start-kind.sh` — KinD cluster with local registry.
- `crc-openshift.sh` — CodeReady Containers (OpenShift local dev).
- `aws-openshift.sh`, `ibmcloud-openshift.sh` — cloud OpenShift provisioning.

**CI orchestration:**
- `setup-kind-in-ci.sh`, `setup-minikube-in-ci.sh` — CI-specific cluster setup.
- `ci-kind-molecule-tests.sh`, `ci-minikube-molecule-tests.sh`, `ci-openshift-molecule-tests.sh` — molecule test runners for CI.
- `test-pull-request.sh` — runs the full test pipeline for a PR.

**Kiali lifecycle:**
- `run-kiali.sh` — run Kiali server locally against a live cluster.
- `kiali-port-forward.sh` — port-forward to a cluster-deployed Kiali.
- `configure-operator.sh` — apply operator configuration changes.
- `purge-kiali-from-cluster.sh` — full cleanup of Kiali resources.

**Auxiliary services:**
- `run-prometheus.sh` — local Prometheus for development.
- `install-hydra-kind.sh`, `keycloak.sh` — OIDC provider setup for auth testing.
- `install-acm.sh` — Advanced Cluster Management (multi-cluster testing).

**Code tools:**
- `fix_imports.sh` — runs `goimports` to sort Go imports according to style guide.
- `check_go_version.sh` — validates installed Go version against `go.mod`.
- `build-cross-platform.sh` — builds Kiali for `linux/amd64` and `linux/arm64` to `_output/cross-platform/`.

**JWT utilities** (`jwt-encode.sh`, `jwt-decode.sh`): developer helpers for inspecting JWT tokens during auth debugging.

## CI/CD Pipeline

Kiali uses GitHub Actions. Workflows are in `.github/workflows/`:

**Core build workflows** (called by other workflows via `workflow_call`):
- `build-backend.yml` — checks out, sets up Go from `go.mod`, downloads the frontend build artifact, runs `make clean build`, uploads the `kiali` binary. PR builds add `-race` flag and `CGO_ENABLED=1`.
- `build-frontend.yml` — builds the React app and uploads `frontend/build/` as a GitHub Actions artifact.

**Integration test workflows** — a family of `integration-tests-*.yml` files, each corresponding to a test suite from `hack/run-integration-tests.sh`:
- `integration-tests-backend.yml`, `integration-tests-backend-mcp.yml`, `integration-tests-backend-multicluster-external-controlplane.yml`
- `integration-tests-frontend-core-1.yml`, `integration-tests-frontend-core-2.yml`, `integration-tests-frontend-core-optional.yml`
- `integration-tests-frontend-ambient.yml`, `integration-tests-frontend-ambient-multi-primary.yml`
- `integration-tests-frontend-multicluster-multi-primary.yml`, `integration-tests-frontend-multicluster-primary-remote.yml`, `integration-tests-frontend-multicluster-external-kiali.yml`, `integration-tests-frontend-multi-mesh.yml`
- `integration-tests-frontend-tempo.yml`, `integration-tests-frontend-chat.yml`, `integration-tests-frontend-local-offline.yml`
- `integration-tests-frontend.yml` — umbrella workflow

The pipeline architecture separates backend and frontend builds into reusable called workflows, then fans them into multiple parallel integration test runs. This allows the backend binary and frontend artifact to be built once and reused across all integration test jobs.

**Lint config:** `.github/workflows/config/.golangci.yml` — the golangci-lint configuration used by `make lint`. The lint binary version (`v2.7.2`) is pinned in `Makefile.build.mk`.

## Code Conventions

This section summarises conventions from `STYLE_GUIDE.adoc` that affect how code is structured — see the full style guide for detailed examples.

### Go Conventions

**Import ordering** (enforced by `hack/fix_imports.sh` + `goimports`):
```go
import (
    // 1. Standard library
    "errors"
    "fmt"

    // 2. Third-party (blank line separator)
    "k8s.io/client-go/tools/clientcmd/api"

    // 3. Kiali packages (blank line separator)
    "github.com/kiali/kiali/log"
)
```

**Struct field ordering**: all fields in struct type definitions must be in alphabetical order (both public and private).

**Error types**: use `AuthenticationFailureError` (with `HttpStatus`) for expected authentication failures vs. plain `error` for unexpected internal failures. Callers type-assert to distinguish the two.

**Interface guards**: implementation files end with a compile-time interface check:
```go
var _ AuthController = &tokenAuthController{}
```

### Frontend Conventions

The frontend follows React/TypeScript conventions documented in `frontend/README.adoc`. Cypress tests live in `frontend/cypress/`. The `frontend/` directory is excluded from Go linting and Go test runs via the `exclude_frontend` build tag and grep filters.

### File Protection

Certain files must not be modified without understanding their role:
- `operator/` — a symlink, not a directory. Modifying files here modifies the operator repo.
- `frontend/package.json` — the `proxy` field is dynamically written by `make run-frontend` and cleaned up on exit; do not add a persistent `proxy` field.
- `go.mod` / `go.sum` — always run `go mod tidy` after dependency changes; never edit manually.
- `make/*.mk` — changes here affect all developers and CI; test across all `CLUSTER_TYPE` values.
