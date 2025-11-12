# AI Agent Development Guide for Kiali

This guide provides coding standards, development workflows, and common commands for AI agents and developers contributing to the Kiali project. It complements the existing [CONTRIBUTING.md](./CONTRIBUTING.md) and [STYLE_GUIDE.adoc](./STYLE_GUIDE.adoc).

## Table of Contents

- [Quick Reference](#quick-reference)
- [Code Quality Standards](#code-quality-standards)
- [Building and Testing](#building-and-testing)
- [Development Workflows](#development-workflows)
  - [Local Development with Hot Reload](#local-development-with-hot-reload)
- [Cluster-Specific Development Workflows](#cluster-specific-development-workflows)
  - [Working with Minikube](#working-with-minikube)
  - [Working with KinD](#working-with-kind-kubernetes-in-docker)
  - [Working with OpenShift (CRC)](#working-with-openshift-crc)
- [Operator Development](#operator-development)
- [File Protection Rules](#file-protection-rules)
- [Common Patterns and Best Practices](#common-patterns-and-best-practices)
- [Troubleshooting](#troubleshooting)
- [Quick Command Reference](#quick-command-reference)

---

## Quick Reference

### Essential Commands

```bash
# Build everything
make build-ui build test

# Run Kiali locally with hot-reload
make build-ui
make run-backend    # In one terminal
make run-frontend   # In another terminal

# Build and push dev images to cluster (example for minikube with profile "ci")
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=ci build-ui build test cluster-push

# Deploy to cluster (ensure CLUSTER_TYPE is set - see cluster-specific sections below)
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=minikube cluster-push         # Example for minikube
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=minikube operator-create      # Example for minikube
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=minikube kiali-create        # Example for minikube

# Format and lint
make format lint

# Run tests
make test                       # Unit tests
make cypress-gui               # Frontend integration tests (GUI)
make cypress-run               # Frontend integration tests (headless)
```

### Repository Structure

The Kiali project consists of multiple repositories that should be cloned together:

```
kiali_sources/
├── kiali/              # Main server and UI repo
├── kiali-operator/     # Operator repo (link as kiali/operator)
└── helm-charts/        # Helm charts repo
```

Setup commands:
```bash
mkdir kiali_sources && cd kiali_sources
git clone https://github.com/kiali/kiali.git
git clone https://github.com/kiali/kiali-operator.git
git clone https://github.com/kiali/helm-charts.git
ln -s $PWD/kiali-operator kiali/operator
```

---

## Code Quality Standards

### Go Backend Standards

#### General Rules

1. **Use `any` instead of `interface{}`** - Always prefer `any` for empty interfaces
2. **No end-of-line spaces** - Remove all trailing whitespace from any line you add or modify
3. **Sort struct fields alphabetically** - When adding or modifying Go structs, sort field names alphabetically
4. **Sort YAML keys alphabetically** - When adding or modifying YAML schemas or files, sort keys alphabetically
5. **Meaningful comments** - Write comments that explain "why", not "what". Focus on the purpose and usage of abstractions.

#### Import Formatting

Organize imports in three groups separated by blank lines:

```go
import (
    // Standard library imports
    "errors"
    "fmt"
    "time"

    // Third-party imports
    "k8s.io/client-go/tools/clientcmd/api"

    // Kiali imports
    "github.com/kiali/kiali/log"
)
```

#### Code Formatting

- Use `gofmt` for formatting (automatically applied by `make format`)
- Use `golangci-lint` for linting (run via `make lint`)
- Install linting tools: `make lint-install`
- The project requires a specific Go version defined in `go.mod` - check with `make go-check`

### TypeScript Frontend Standards

#### Naming Conventions

**Files:**
- Most files: `PascalCase` (e.g., `ServiceList.ts`)
- General purpose files: `camelCase` (e.g., `routes.ts`)

**Variables and Functions:**
- Generally: `camelCase`
- Redux actions: `PascalCase` (e.g., `GraphActions`)
- Global constants: `UPPER_SNAKE_CASE` (e.g., `TIMER_REQUEST_PER_SECOND_MIN`)
- Local constants: `camelCase`

**Enums:**
```typescript
enum DisplayMode {
  LARGE,    // Values in UPPER_SNAKE_CASE
  SMALL
}
```

#### Event Handlers

Use consistent naming:
- Handler methods: `handle` + event name (e.g., `handleClick`, `handleChange`)
- Props: `on` + event name (e.g., `onSelect`, `onChange`)
- Use present tense
- Avoid clashing with native events

Example:
```typescript
<Item
  onClick={() => handleClick(item.name)}
  onSelect={() => handleSelect(item.id)}
/>
```

#### Arrow Functions

Prefer arrow functions:
```typescript
createItem = () => {
  return (
    <ul>
      {props.items.map((item, index) => (
        <Item key={item.key} onClick={() => doSomethingWith(item.name, index)} />
      ))}
    </ul>
  );
}
```

#### Redux Patterns

**Type-safe Redux:**
- Use `typesafe-actions` library
- Separate `ReduxProps` from component props

```typescript
type ReduxProps = {
  // Redux props only, alphabetically sorted
};

type MyComponentProps = ReduxProps & {
  // Component-specific props, alphabetically sorted
};

class MyComponent extends React.Component<MyComponentProps> {
  // ...
}
```

**URL Consistency:**
- Store page state in Redux
- Make pages bookmarkable via URL parameters
- On construction: URL params override Redux state
- After construction: Update URL to reflect Redux state changes

#### Internationalization (i18n)

Always use the `t` function for translatable strings:

```typescript
import { t } from 'utils/I18nUtils';  // NOT from 'i18next'!

title = t('Traffic Graph');
```

For components that don't re-render on language change, add language to Redux props.

---

## Building and Testing

### Building

```bash
# Build UI (must be done before building backend)
make build-ui

# Build backend
make build

# Build for specific architecture
make build-linux-multi-arch

# Clean builds
make clean        # Clean backend build artifacts
make clean-ui     # Clean UI build artifacts
make clean-all    # Clean everything including _output dir
```

### Testing

#### Backend Tests

```bash
# Run all backend tests
make test

# Run specific tests with flags
make -e GO_TEST_FLAGS="-race -v -run=\"TestName\"" test

# Run integration tests
make test-integration

# Run controller integration tests
make test-integration-controller
```

#### Frontend Tests

```bash
# Build UI and run tests
make build-ui-test

# Run Cypress tests in GUI mode
make cypress-gui

# Run Cypress tests headlessly
make cypress-run

# Run performance tests
make perf-tests-gui
make perf-tests-run
```

**Test Requirements:**
- Istio installed
- Kiali deployed
- Bookinfo demo app deployed
- Error rates demo app deployed

Install demo apps:
```bash
./hack/istio/install-testing-demos.sh -c kubectl
```

### Running Tests Against Local Environment

```bash
# Start Kiali backend (in terminal 1)
make run-backend

# Start frontend dev server (in terminal 2)
make -e YARN_START_URL=http://localhost:20001/kiali yarn-start

# Run Cypress tests (in terminal 3)
make cypress-gui
```

---

## Development Workflows

### Local Development with Hot Reload

This is the fastest way to develop and doesn't require a cluster:

**Terminal 1 - Backend:**
```bash
make build-ui  # Only needed once or when UI changes
make run-backend

# Pass additional arguments:
# make KIALI_RUN_ARGS="--log-level debug" run-backend

# Multi-cluster:
# make KIALI_RUN_ARGS="--remote-cluster-contexts kind-mesh --cluster-name-overrides kind-mesh=mesh" run-backend
```

**Terminal 2 - Frontend:**
```bash
make run-frontend
# Opens browser automatically at http://localhost:3000
```

Both backend and frontend will hot-reload on code changes.

---

## Cluster-Specific Development Workflows

The following sections provide complete workflows for developing Kiali on different cluster types. Each cluster type has specific requirements and commands.

### Working with Minikube

Minikube is the most commonly used development environment for Kiali.

#### Required Environment Variables

```bash
export CLUSTER_TYPE=minikube
export MINIKUBE_PROFILE=minikube  # use any profile name you want; "ci" is used in examples
export DORP=docker                # or "podman"
export CLIENT_EXE=kubectl         # or 'oc' for OpenShift clusters
```

#### Optional Environment Variables

```bash
# Set to false if your local helm-charts repo has a branch with no remote
export HELM_CHARTS_REPO_PULL=false
```

#### Starting Minikube Cluster

```bash
# Start basic minikube cluster
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} start

# Start with Hydra enabled (for auth testing - this is required for some molecule tests)
./hack/k8s-minikube.sh --hydra-enabled true -mp ${MINIKUBE_PROFILE} start

# For all available options, run:
./hack/k8s-minikube.sh --help

# Install Istio after cluster is ready
./hack/istio/install-istio-via-istioctl.sh --client-exe ${CLIENT_EXE}
```

#### Check Cluster Status

```bash
# Check cluster status
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} cluster-status

# Open Kubernetes dashboard
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} dashboard
```

#### Building and Deploying to Minikube

```bash
# Build UI and backend, then push images to cluster
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} build-ui build test cluster-push

# Deploy operator
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} operator-create

# Deploy Kiali
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} kiali-create
```

#### Quick Iteration After Code Changes

```bash
# Rebuild and reload just Kiali (faster)
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} \
  build cluster-push-kiali kiali-reload-image

# Rebuild and reload operator
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} \
  cluster-push-operator operator-reload-image
```

#### Installing Demo Applications

```bash
# Install Bookinfo demo
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} bookinfo

# Or use dedicated script:
./hack/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE}

# Install error rates demo (for testing)
./hack/istio/install-testing-demos.sh -c ${CLIENT_EXE}
```

#### Accessing Kiali

```bash
# Port forward to Kiali
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} port-forward

# Or get ingress URL
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} ingress

# Direct port forward:
kubectl port-forward -n istio-system svc/kiali 20001:20001
```

#### Cleanup

```bash
# Delete Kiali
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} kiali-delete

# Delete operator
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} operator-delete

# Purge everything
./hack/purge-kiali-from-cluster.sh -c ${CLIENT_EXE}

# Stop minikube (preserves cluster)
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} stop

# Delete minikube cluster completely
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} delete
```

---

### Working with KinD (Kubernetes in Docker)

KinD is useful for testing in a lightweight, disposable Kubernetes environment.

#### Required Environment Variables

```bash
export CLUSTER_TYPE=kind
export KIND_NAME=kiali-testing  # cluster name
export DORP=docker              # podman not fully supported for kind yet
export CLIENT_EXE=kubectl
```

#### Optional Environment Variables

```bash
# Set to false if your local helm-charts repo has a branch with no remote
export HELM_CHARTS_REPO_PULL=false
```

#### Starting KinD Cluster

```bash
# Start basic KinD cluster with MetalLB
./hack/start-kind.sh -n ${KIND_NAME}

# Start with custom load balancer IP range
./hack/start-kind.sh -n ${KIND_NAME} --load-balancer-range "255.70-255.84"

# Start with image registry enabled
./hack/start-kind.sh -n ${KIND_NAME} --enable-image-registry true

# Start with Hydra for auth testing
./hack/start-kind.sh -n ${KIND_NAME} --enable-hydra true

# For all available options, run:
./hack/start-kind.sh --help

# Install Istio after cluster is ready
./hack/istio/install-istio-via-istioctl.sh --client-exe ${CLIENT_EXE}
```

#### Check Cluster Status

```bash
# List KinD clusters
kind get clusters

# Check cluster is accessible
kubectl cluster-info --context kind-${KIND_NAME}

# Check if cluster is ready for Kiali
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} cluster-status
```

#### Building and Deploying to KinD

```bash
# Build UI and backend, then push images to cluster
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} build-ui build test cluster-push

# Deploy operator
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} operator-create

# Deploy Kiali
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} kiali-create
```

#### Quick Iteration After Code Changes

```bash
# Rebuild and reload just Kiali (faster)
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} \
  build cluster-push-kiali kiali-reload-image

# Rebuild and reload operator
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} \
  cluster-push-operator operator-reload-image
```

#### Installing Demo Applications

```bash
# Install Bookinfo
./hack/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE}

# Install testing demos
./hack/istio/install-testing-demos.sh -c ${CLIENT_EXE}
```

#### Accessing Kiali

```bash
# Port forward to Kiali
kubectl port-forward -n istio-system svc/kiali 20001:20001

# Access at: http://localhost:20001/kiali
```

#### Cleanup

```bash
# Delete Kiali
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} kiali-delete

# Delete operator
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} operator-delete

# Purge everything
./hack/purge-kiali-from-cluster.sh -c ${CLIENT_EXE}

# Delete entire KinD cluster
kind delete cluster --name ${KIND_NAME}
```

---

### Working with OpenShift (CRC)

OpenShift can be run locally using CodeReady Containers (CRC) or on a remote cluster.

#### Required Environment Variables

```bash
export CLUSTER_TYPE=openshift
export DORP=podman    # or docker, depending on your setup
export CLIENT_EXE=oc
```

#### Optional Environment Variables

```bash
# Set to false if your local helm-charts repo has a branch with no remote
export HELM_CHARTS_REPO_PULL=false
```

#### Starting CRC (Local OpenShift)

```bash
# Start CRC cluster (downloads CRC if not present)
./hack/crc-openshift.sh start

# Check CRC status
./hack/crc-openshift.sh status

# Install Istio after cluster is ready
./hack/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE}

# Optional: Install OpenShift Service Mesh (OSSM) instead of upstream Istio
# ./hack/istio/sail/install-ossm-release.sh install-operators
# ./hack/istio/sail/install-ossm-release.sh install-istio

# Get all routes
./hack/crc-openshift.sh routes

# Get all service endpoints
./hack/crc-openshift.sh services
```

#### Check Cluster Status

```bash
# Check CRC status
./hack/crc-openshift.sh status

# ... or use make target
make CLUSTER_TYPE=openshift cluster-status
```

#### Building and Deploying to OpenShift

```bash
# Get CRC status and credentials
./hack/crc-openshift.sh status

# Login to OpenShift using kubeadmin credentials shown in status output
# oc login -u kubeadmin -p <password-from-status> https://api.crc.testing:6443

# Build UI and backend, then push images to cluster
make CLUSTER_TYPE=openshift build-ui build test cluster-push

# Deploy operator (uses OLM on OpenShift by default)
make CLUSTER_TYPE=openshift olm-operator-create

# Or deploy without OLM:
make CLUSTER_TYPE=openshift operator-create

# Deploy Kiali
make CLUSTER_TYPE=openshift kiali-create

# Or deploy with specific version from OperatorHub
make CLUSTER_TYPE=openshift operator-install
```

#### Quick Iteration After Code Changes

```bash
# For OpenShift, typically build and push to registry
make CLUSTER_TYPE=openshift build cluster-push-kiali

# Reload Kiali
make CLUSTER_TYPE=openshift kiali-reload-image

# For operator changes:
make CLUSTER_TYPE=openshift cluster-push-operator
make CLUSTER_TYPE=openshift operator-reload-image
```

#### Installing Demo Applications

```bash
# Install Bookinfo
./hack/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE}

# Install testing demos
./hack/istio/install-testing-demos.sh -c ${CLIENT_EXE}
```

#### Accessing Kiali

```bash
# Get Kiali route URL
oc get route kiali -n istio-system -o jsonpath='{.spec.host}'

# Or use the CRC routes command
./hack/crc-openshift.sh routes | grep kiali

# Open in browser
xdg-open https://$(oc get route kiali -n istio-system -o jsonpath='{.spec.host}')
```

#### CRC-Specific Operations

```bash
# Expose cluster to remote clients (adds firewall rules)
./hack/crc-openshift.sh expose

# Remove remote access
./hack/crc-openshift.sh unexpose

# SSH into CRC VM
./hack/crc-openshift.sh ssh

# Debug in CRC VM
./hack/crc-openshift.sh sshoc

# Change domain from crc.testing to nip.io
./hack/crc-openshift.sh changedomain
```

#### Cleanup

```bash
# Delete Kiali
make CLUSTER_TYPE=openshift kiali-delete

# Delete operator
make CLUSTER_TYPE=openshift operator-delete
# Or if using OLM:
make CLUSTER_TYPE=openshift olm-operator-delete

# Purge everything
./hack/purge-kiali-from-cluster.sh -c ${CLIENT_EXE}

# Stop CRC (preserves cluster)
./hack/crc-openshift.sh stop

# Delete CRC cluster completely
./hack/crc-openshift.sh delete

# Complete cleanup including CRC cache
./hack/crc-openshift.sh cleanup
```

---

### General Cleanup Commands (All Clusters)

These commands work across all cluster types. Ensure CLUSTER_TYPE and CLIENT_EXE are set appropriately.

```bash
# Delete Kiali CR (operator removes Kiali)
make CLUSTER_TYPE=<your-cluster-type> kiali-delete

# Force remove if operator fails
make CLUSTER_TYPE=<your-cluster-type> kiali-purge

# Remove operator
make CLUSTER_TYPE=<your-cluster-type> operator-delete

# Purge everything (works with all cluster types)
./hack/purge-kiali-from-cluster.sh -c ${CLIENT_EXE}
```

---

## Operator Development

### Setting Up Operator Repository

The operator repository should be linked into the main Kiali repository:

```bash
# Clone operator separately
cd ~/source
git clone git@github.com:kiali/kiali-operator.git

# Link into kiali repo
cd ~/source/kiali/kiali
ln -s ~/source/kiali-operator operator
```

**Why use a symlink?** If you clone directly into `kiali/operator`, checking out old Kiali branches can delete your operator changes. A symlink preserves your work.

### Building and Deploying Operator

These commands require CLUSTER_TYPE to be set. Examples shown for minikube:

```bash
# Build and push operator image
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=minikube cluster-push-operator

# Deploy operator via Helm
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=minikube operator-create

# Deploy operator via OLM (if OLM is installed, typically on OpenShift)
make CLUSTER_TYPE=openshift olm-operator-create

# Delete operator
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=minikube operator-delete
make CLUSTER_TYPE=openshift olm-operator-delete  # If using OLM on OpenShift
```

### Running Operator Locally

#### Run Playbook Only (Fast Testing)

For quick testing of Ansible playbook changes:

```bash
# Test Kiali playbooks
make run-operator-playbook-kiali

# Test OSSMConsole playbooks
make run-operator-playbook-ossmconsole
```

Configuration files are in `kiali-operator/dev-playbook-config/`.

**Requirements:**
- Python3 in PATH
- Ansible collections installed: `ansible-galaxy collection install -r operator/requirements.yml --force-with-deps`
- Python libraries: `python -m pip install --user --upgrade -r operator/molecule/requirements.txt`

#### Run Full Operator (With Ansible Operator)

To run the operator locally with full infrastructure:

```bash
make run-operator
```

This runs the `ansible-operator` process locally, watching for Kiali and OSSMConsole CRs in the cluster.

### Operator Configuration

Configure operator behavior:

```bash
# Allow ad-hoc namespaces
make operator-set-config-allow-ad-hoc-kiali-namespace

# Allow ad-hoc images
make operator-set-config-allow-ad-hoc-kiali-image

# Enable debug logging
make operator-set-config-ansible-debug-logs

# Set verbosity (0-7)
make operator-set-config-ansible-verbosity

# Enable profiler
make operator-set-config-ansible-profiler-on
```

### Operator Profiling

To enable profiling, set `ANSIBLE_CONFIG=/opt/ansible/ansible-profiler.cfg` in the operator deployment.

The profiler report shows task execution times. For cumulative results on looped tasks, save the report and pipe through this script:

```bash
awk -F~ '
{
  val=$2;
  $2="@";
  a[$0]+=val
}
!b[$0]++{
  c[++count]=$0}
END{
  for(i=1;i<=count;i++){
     sub("@",a[c[i]],c[i]);
     print c[i]}
}' OFS=\~ <(cat - | sed 's/\(.*\) -\+ \(.*\)s/\1~\2/') | sort -n -t '~' -k 2 -r | column -s~ -t
```

### Molecule Tests

Molecule tests validate operator functionality end-to-end.

#### Running Molecule Tests

Molecule tests work on minikube, KinD, and OpenShift. The workflow is similar for all three.

**Step 1: Ensure cluster is ready**

For **Minikube**:
```bash
export CLUSTER_TYPE=minikube
export MINIKUBE_PROFILE=ci
export DORP=podman
export CLIENT_EXE=kubectl

# Start cluster with Hydra (required for some molecule tests)
./hack/k8s-minikube.sh --hydra-enabled true -mp ci start

# Install Istio
./hack/istio/install-istio-via-istioctl.sh --client-exe ${CLIENT_EXE}
```

For **KinD**:
```bash
export CLUSTER_TYPE=kind
export KIND_NAME=ci
export DORP=docker  # podman will likely not work, using only docker
export CLIENT_EXE=kubectl

# Start cluster with Hydra (required for some molecule tests)
./hack/start-kind.sh --name ${KIND_NAME} --enable-hydra true

# Install Istio
./hack/istio/install-istio-via-istioctl.sh --client-exe ${CLIENT_EXE}
```

For **OpenShift**:
```bash
export CLUSTER_TYPE=openshift
export DORP=podman
export CLIENT_EXE=oc

# Start cluster
./hack/crc-openshift.sh start

# Install Istio
./hack/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE}
```

**Step 2: Verify Kiali is not already deployed**
```bash
${CLIENT_EXE} get deployments -A -l app.kubernetes.io/name=kiali
${CLIENT_EXE} get deployments -A -l app.kubernetes.io/name=kiali-operator

# If Kiali is deployed, purge it
./hack/purge-kiali-from-cluster.sh -c ${CLIENT_EXE}

# Wait for CRDs to be removed
timeout 60 bash -c "until ! ${CLIENT_EXE} get crd | grep kiali; do sleep 2; done"
```

**Step 3: Build and push dev images**
```bash
# For Minikube:
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=ci build-ui build test cluster-push

# For KinD:
make CLUSTER_TYPE=kind KIND_NAME=ci  build-ui build test cluster-push

# For OpenShift:
make CLUSTER_TYPE=openshift build-ui build test cluster-push
```

**Step 4: Run molecule tests**

The `-udi` (`--use-dev-images`) flag controls whether to use dev images:
- Set to `true` to test your local code changes (requires Step 3: build and push dev images first)
- Set to `false` to test with latest images published on quay.io

The `-hcrp` (`--helm-charts-repo-pull`) flag controls whether to pull the helm-charts repository:
- Set to `true` to pull the latest helm-charts from the remote repository
- Set to `false` if your local helm-charts repo has a branch with no remote (avoids git pull errors)

```bash
# For Minikube:
./hack/run-molecule-tests.sh \
  --client-exe "$(which kubectl)" \
  --cluster-type minikube \
  --minikube-profile ci \
  -udi true \
  -hcrp false \
  -at "token-test"

# For KinD:
./hack/run-molecule-tests.sh \
  --client-exe "$(which kubectl)" \
  --cluster-type kind \
  -udi true \
  -hcrp false \
  -at "token-test"

# For OpenShift:
./hack/run-molecule-tests.sh \
  --client-exe "$(which oc)" \
  --cluster-type openshift \
  -udi true \
  -hcrp false \
  -at "token-test"
```

#### Molecule Test Locations

Tests are in `kiali-operator/molecule/`. Each subdirectory is a test scenario (e.g., `config-values-test`, `token-test`).

---

## File Protection Rules

### Never Modify These Files

**Versioned Operator Roles:**
- `kiali-operator/roles/v1.73/`, `roles/v2.4/`, etc. - Only modify the `default` role

**Old CSV Versions:**
- `kiali-operator/manifests/*/[version]/` - Only modify the LATEST version

**CRD Copies:**
- Any CRD file that is not in `kiali-operator/crd-docs/crd/`
- Golden copies are in `crd-docs/crd/` - these are the source of truth
- Sync changes using: `make sync-crds` in kiali-operator repo (this can make changes to your helm-charts repo as well as the kiali-operator repo)

**Generated Documentation:**
- `kiali.io/content/en/docs/Configuration/kialis.kiali.io.md`
- `kiali.io/content/en/docs/Configuration/ossmconsoles.kiali.io.md`

**Output Directories:**
- Never modify `_output/` directories or subdirectories
- These contain build artifacts and generated files

### Backward Compatibility

**CRITICAL:** When modifying operator resources (roles, permissions, CSVs), check if changes break older supported versions in `kiali-operator/roles/` (e.g., `v1.24`).

If changes break old versions that are still supported, only make breaking changes after old versions are no longer supported.

---

## Common Patterns and Best Practices

### Making Changes to Resources or Configuration

When modifying Kubernetes resources or Kiali configuration, you must update multiple locations to support all installation methods.

#### Checklist: Altering Kiali Operator Resources

- [ ] Update golden copy: `kiali-operator/manifests/kiali-upstream/`
- [ ] Update golden copy: `kiali-operator/manifests/kiali-ossm/manifests/kiali.clusterserviceversion.yaml`
- [ ] Update Helm chart: `helm-charts/kiali-operator/templates/`
- [ ] If modifying CRD schema: Run `make sync-crds` in kiali-operator repo (requires helm-charts PR)

#### Checklist: Altering Kiali Server Resources

- [ ] Update Kubernetes templates: `kiali-operator/roles/default/kiali-deploy/templates/kubernetes/`
- [ ] Update OpenShift templates: `kiali-operator/roles/default/kiali-deploy/templates/openshift/`
- [ ] Check if removal needed: `kiali-operator/roles/default/kiali-remove/`
- [ ] Update Helm chart: `helm-charts/kiali-server/templates/`

#### Checklist: Altering Kiali Server Permissions (All Namespaces)

- [ ] Update: `kiali-operator/manifests/kiali-upstream/` CSVs
- [ ] Update: `kiali-operator/manifests/kiali-ossm/manifests/kiali.clusterserviceversion.yaml`
- [ ] Update: `kiali-operator/roles/default/kiali-deploy/templates/kubernetes/role.yaml`
- [ ] Update: `kiali-operator/roles/default/kiali-deploy/templates/kubernetes/role-viewer.yaml`
- [ ] Update: `kiali-operator/roles/default/kiali-deploy/templates/openshift/role.yaml`
- [ ] Update: `kiali-operator/roles/default/kiali-deploy/templates/openshift/role-viewer.yaml`
- [ ] Update: `helm-charts/kiali-operator/templates/clusterrole.yaml`
- [ ] Update: `helm-charts/kiali-server/templates/role.yaml`
- [ ] Update: `helm-charts/kiali-server/templates/role-viewer.yaml`

#### Checklist: Altering Kiali Server Permissions (Control Plane Only)

- [ ] Update: `kiali-operator/manifests/kiali-upstream/` CSVs
- [ ] Update: `kiali-operator/manifests/kiali-ossm/manifests/kiali.clusterserviceversion.yaml`
- [ ] Update: `helm-charts/kiali-operator/templates/clusterrole.yaml`

#### Checklist: Altering Configuration Settings

- [ ] Set default: `kiali-operator/roles/default/kiali-deploy/defaults/main.yml`
- [ ] If new top-level setting: Add to `kiali-operator/roles/default/kiali-deploy/vars/main.yml`
- [ ] Document in CRD: `kiali-operator/crd-docs/crd/kiali.io_kialis.yaml`
- [ ] Add example to: `kiali-operator/crd-docs/cr/kiali.io_v1alpha1_kiali.yaml`
- [ ] Validate CR: `make validate-cr` in kiali-operator repo
- [ ] If modified CRD: Run `make sync-crds` in kiali-operator repo
- [ ] Set default: `helm-charts/kiali-server/values.yaml`
- [ ] Sort alphabetically in all files where added
- [ ] If appropriate: Add test to `kiali-operator/molecule/config-values-test/converge.yml`

#### Checklist: Backporting to Older Versions

- [ ] Duplicate changes from `roles/default/` to versioned roles (e.g., `roles/v1.24/`)
- [ ] Cherry-pick changes to appropriate git branches

### Working with CRDs

#### Modifying CRD Schemas

1. Edit golden copy: `kiali-operator/crd-docs/crd/kiali.io_kialis.yaml` or `ossmconsoles.yaml`
2. Validate: `make validate-cr` in kiali-operator repo
3. Sync to all locations: `make sync-crds` in kiali-operator repo
4. Verify sync: `make validate-crd-sync` in kiali-operator repo
5. Create PR for kiali-operator repo
6. Create separate PR for helm-charts repo with synced files

#### CRD File Locations

**Golden Copies (source of truth):**
- `kiali-operator/crd-docs/crd/kiali.io_kialis.yaml`
- `kiali-operator/crd-docs/crd/kiali.io_ossmconsoles.yaml`

**Synchronized Copies (do not edit directly):**
- `kiali-operator/manifests/kiali-ossm/manifests/kiali.crd.yaml`
- `kiali-operator/manifests/kiali-ossm/manifests/ossmconsole.crd.yaml`
- `kiali-operator/manifests/kiali-upstream/[version]/manifests/kiali.crd.yaml`
- `helm-charts/kiali-operator/crds/crds.yaml`
- `helm-charts/kiali-operator/templates/ossmconsole-crd.yaml`

### Upgrading Dependencies

#### Upgrading Go

```bash
# Update go.mod
go mod edit -go=x.y

# Update dependencies
go mod tidy -v

# Verify everything builds
make clean build build-ui test

# Commit and create PR
```

#### Upgrading PatternFly

```bash
# Check for updates
npx npm-check-updates -t latest -f '/^@patternfly/'

# Update yarn.lock
yarn install

# Commit package.json and yarn.lock
```

### Hack Scripts

The `hack/` directory contains many useful scripts:

**Cluster Setup:**
- `hack/k8s-minikube.sh` - Start minikube cluster
- `hack/crc-openshift.sh` - Start local OpenShift cluster
- `hack/start-kind.sh` - Start KinD cluster
- `hack/istio/install-istio-via-istioctl.sh` - Install Istio
- `hack/istio/install-bookinfo-demo.sh` - Install Bookinfo demo

**Development:**
- `hack/run-kiali.sh` - Run Kiali standalone
- `hack/run-integration-tests.sh` - Run full integration test suite
- `hack/run-molecule-tests.sh` - Run Molecule tests
- `hack/purge-kiali-from-cluster.sh` - Remove all Kiali resources

**Configuration:**
- `hack/configure-operator.sh` - Configure operator settings

All scripts support `--help` for detailed usage information.

---

## Troubleshooting

### Common Issues

**Build Failures:**
```bash
# Ensure correct Go version
make go-check

# Clean everything and rebuild
make clean-all
make build-ui build test
```

**Cluster Push Failures:**
```bash
# Verify cluster is accessible (specify your cluster type)
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} cluster-status

# For minikube, ensure profile is set
export MINIKUBE_PROFILE=ci
minikube status -p ci

# For kind
export KIND_NAME=kiali-testing
kind get clusters
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} cluster-status
```

**Operator Not Working:**
```bash
# Check operator logs
kubectl logs -n kiali-operator deployment/kiali-operator -f

# Check Kiali CR status
kubectl get kiali -A -o yaml

# Verify operator has correct image
kubectl get deployment kiali-operator -n kiali-operator -o yaml | grep image:
```

**Molecule Test Failures:**
```bash
# Ensure cluster is clean
./hack/purge-kiali-from-cluster.sh -c kubectl
kubectl get crd | grep kiali  # Should return nothing

# Rebuild images
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=ci build-ui build test cluster-push

# Run with debug
export MOLECULE_DEBUG=true
./hack/run-molecule-tests.sh ...
```

**Frontend Not Loading:**
```bash
# Check backend is running
curl http://localhost:20001/kiali/api

# Verify proxy setting in package.json
grep proxy frontend/package.json

# Restart frontend dev server
make run-frontend
```

### Getting Debug Information

```bash
# Run debug info collection script
./hack/ci-get-debug-info.sh

# Get operator logs
kubectl logs -n kiali-operator deployment/kiali-operator --tail=100

# Get Kiali server logs
kubectl logs -n istio-system deployment/kiali --tail=100

# Check all Kiali-related resources
kubectl get all,kiali,ossmconsole -A | grep kiali
```

### SELinux Issues

If you encounter permission errors with molecule tests:

```bash
# Temporarily disable SELinux
sudo setenforce 0

# Re-enable after testing
sudo setenforce 1
```

---

## Additional Resources

- **Main Documentation:** https://kiali.io/docs
- **Contributing Guide:** [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Style Guide:** [STYLE_GUIDE.adoc](./STYLE_GUIDE.adoc)
- **README:** [README.adoc](./README.adoc)
- **Frontend README:** [frontend/README.adoc](./frontend/README.adoc)
- **Operator Development:** [operator/DEVELOPING.adoc](./operator/DEVELOPING.adoc)
- **Release Process:** [RELEASING.adoc](./RELEASING.adoc)

**Makefile Help:**
```bash
make help # Show all available targets
```

**Community:**
- GitHub Discussions: https://github.com/kiali/kiali/discussions
- GitHub Issues: https://github.com/kiali/kiali/issues
- Community Page: https://kiali.io/community/

---

## Quick Command Reference

### Local Development (No Cluster)

```bash
# Development cycle with hot reload
make build-ui && make run-backend  # Terminal 1
make run-frontend                  # Terminal 2
```

### Minikube Quick Reference

```bash
# Setup
export CLUSTER_TYPE=minikube
export MINIKUBE_PROFILE=minikube  # use any profile name; examples below use "ci"
export DORP=docker
export CLIENT_EXE=kubectl

# Start cluster and install Istio
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} start
./hack/istio/install-istio-via-istioctl.sh --client-exe ${CLIENT_EXE}

# Build and deploy
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} build-ui build test cluster-push
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} operator-create
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} kiali-create

# Quick iteration
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} \
  build cluster-push-kiali kiali-reload-image

# Access
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} port-forward

# Cleanup
make CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${MINIKUBE_PROFILE} kiali-delete operator-delete
./hack/k8s-minikube.sh -mp ${MINIKUBE_PROFILE} stop
```

### KinD Quick Reference

```bash
# Setup
export CLUSTER_TYPE=kind
export KIND_NAME=kiali-testing
export DORP=docker
export CLIENT_EXE=kubectl

# Start cluster and install Istio
./hack/start-kind.sh -n ${KIND_NAME}
./hack/istio/install-istio-via-istioctl.sh --client-exe ${CLIENT_EXE}

# Build and deploy
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} build-ui build test cluster-push
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} operator-create
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} kiali-create

# Quick iteration
make CLUSTER_TYPE=kind KIND_NAME=${KIND_NAME} \
  build cluster-push-kiali kiali-reload-image

# Access
kubectl port-forward -n istio-system svc/kiali 20001:20001

# Cleanup
kind delete cluster --name ${KIND_NAME}
```

### OpenShift Quick Reference

```bash
# Setup
export CLUSTER_TYPE=openshift
export DORP=podman
export CLIENT_EXE=oc

# Start cluster and install Istio
./hack/crc-openshift.sh start
./hack/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE}

# Get credentials and login
./hack/crc-openshift.sh status
# oc login -u kubeadmin -p <password-from-status> https://api.crc.testing:6443

# Build and deploy
make CLUSTER_TYPE=openshift build-ui build test cluster-push
make CLUSTER_TYPE=openshift operator-create  # or make CLUSTER_TYPE=openshift olm-operator-create
make CLUSTER_TYPE=openshift kiali-create

# Quick iteration
make CLUSTER_TYPE=openshift build cluster-push-kiali kiali-reload-image

# Access
./hack/crc-openshift.sh routes | grep kiali

# Cleanup
make CLUSTER_TYPE=openshift kiali-delete operator-delete # or olm-operator-delete
./hack/crc-openshift.sh stop
```

### Testing

```bash
# Backend tests
make test

# Frontend tests
make cypress-gui            # Interactive
make cypress-run            # Headless

# Molecule tests (example uses minikube with profile "ci")
./hack/run-molecule-tests.sh --client-exe "$(which kubectl)" \
  --cluster-type minikube --minikube-profile ci -udi true -hcrp false
```

### Code Quality

```bash
# Format and lint
make format lint

# Check Go version
make go-check

# Clean builds
make clean-all
```

### Operator Development

```bash
# Test playbook locally (fastest)
make run-operator-playbook-kiali

# Run full operator locally
make run-operator

# Build and push operator
make cluster-push-operator
```

### Get Help

```bash
make help
./hack/k8s-minikube.sh --help
./hack/start-kind.sh --help
./hack/crc-openshift.sh --help
```

---

## Important Reminders

**Build Order:**
- Always build UI before backend: `make build-ui` then `make build`

**Environment Variables:**
- Set `CLUSTER_TYPE` (minikube, kind, or openshift)
- Set `MINIKUBE_PROFILE` for minikube
- Set `KIND_NAME` for KinD
- Set `DORP` (docker or podman)
- Set `CLIENT_EXE` (kubectl for minikube/KinD, oc for OpenShift)

**Before Committing:**
- Format and lint: `make format lint`
- Run tests: `make test`
- Remove trailing whitespace
- Sort struct fields and YAML keys alphabetically

**Operator Changes:**
- Ask to run molecule tests after operator changes
- Update all installation methods (Helm, OLM, Operator templates)
- Check backward compatibility with versioned roles

**Protected Files:**
- Never modify versioned operator roles (`roles/v1.*/`, `roles/v2.*/`)
- Never modify old CSV versions (only modify LATEST version)
- Never modify CRD copies (only golden copies in `crd-docs/crd/`)
- Never modify generated documentation files
- Never modify `_output/` directories

