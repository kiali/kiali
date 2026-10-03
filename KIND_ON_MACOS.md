# Running kind inside Colima on macOS (Apple Silicon)

This guide documents the setup required to run `kind`-based integration tests locally on a Mac with Apple Silicon (M1/M2/M3/M4). The Kiali integration test scripts (`hack/run-integration-tests.sh`) use kind to provision a local Kubernetes cluster, install Istio, and run Playwright or Cypress tests against a locally-running Kiali binary.

## Prerequisites

Install the following tools before starting:

```bash
# Homebrew
brew install colima docker kind kubectl helm go node corepack

# Verify versions
colima version      # >= 0.8
kind version        # >= 0.27
docker version
kubectl version --client
go version
node --version
```

> **Note:** `corepack` is required because the frontend uses Yarn via corepack. Enable it once with `corepack enable`.

---

## Why Colima and not Docker Desktop?

Colima is a lightweight, open-source alternative to Docker Desktop. It runs Docker (or containerd) inside a Lima VM on macOS. For x86_64 development (testing against amd64 images that match production CI), Colima is the recommended approach.

---

## Step 1 — Create the Colima profile

Create a dedicated `default` Colima profile configured for x86_64 development. On Apple Silicon, Colima runs an arm64 VM (using the Apple Virtualization Framework) and uses Rosetta 2 to translate x86_64 binaries.

```bash
colima start \
  --arch x86_64 \
  --vm-type vz \
  --vz-rosetta \
  --runtime docker \
  --cpu 6 \
  --memory 20 \
  --disk 100
```

| Flag | Reason |
|------|--------|
| `--arch x86_64` | Docker daemon defaults to amd64 images (matches CI) |
| `--vm-type vz` | Apple Virtualization Framework (faster than QEMU) |
| `--vz-rosetta` | Enables Rosetta 2 for x86_64 binary translation inside the VM |
| `--runtime docker` | Use Docker (not containerd) |
| `--cpu 6` | kind + Istio + workloads need headroom |
| `--memory 20` | Istio control plane is memory-hungry |
| `--disk 100` | Container images and cluster state |

> **Important:** On Apple Silicon, `--arch x86_64` with `--vm-type vz` falls back to QEMU internally for the VM itself (VZ framework only supports native arm64 VMs). Despite this, Rosetta 2 provides fast x86_64 translation inside the VM. The startup log will say `"internal VM driver: qemu"` — this is expected.

---

## Step 2 — Configure the Docker daemon

Out of the box, Colima's Docker daemon uses the `cgroupfs` cgroup driver with the default seccomp profile. Both settings prevent kind from working:

| Problem | Root cause | Symptom |
|---------|-----------|---------|
| Wrong cgroup driver | kind node containers run systemd; systemd requires `systemd` cgroup driver when cgroup v2 is active | `could not find a log line that matches "Reached target .*Multi-User System.*"` |
| Restricted seccomp | QEMU x86_64 VM blocks certain syscalls that systemd needs; CI runners (GitHub Actions Ubuntu) run with unconfined seccomp by default | Same error — systemd starts but never reaches multi-user target |

Edit `~/.colima/default/colima.yaml` and set:

```yaml
docker:
  exec-opts:
    - native.cgroupdriver=systemd
  seccomp-profile: unconfined
```

Then restart Colima:

```bash
colima stop
colima start
```

Verify both settings applied:

```bash
docker info | grep -E "Cgroup|seccomp|Profile"
# Expected output:
# Cgroup Driver: systemd
# Cgroup Version: 2
#  Profile: unconfined
```

---

## Step 3 — Pre-pull the correct kind node image (amd64)

This is the most subtle issue. The `kind` CLI binary on macOS Apple Silicon is compiled for **arm64**. When kind resolves a multi-arch image like `kindest/node:v1.32.2` from the registry manifest, it picks the **arm64** variant (matching the host OS architecture). However, the Docker daemon running inside the Colima x86_64 VM expects and runs **amd64** containers.

The result: kind creates the cluster container from an arm64 image inside an amd64 Docker daemon. Docker runs it via binfmt emulation, but the arm64 systemd binary does not write boot progress to the container's stdout — so kind's startup detector times out with the same `"Reached target .*Multi-User System.*"` error.

**Fix:** Pull the amd64 image explicitly before running kind. Docker caches it locally under the same tag, and kind then skips the registry resolution step and uses what is already present.

```bash
docker pull --platform linux/amd64 kindest/node:v1.32.2
```

Verify the cached image is amd64:

```bash
docker inspect kindest/node:v1.32.2 --format '{{.Architecture}}'
# Expected: amd64
```

> **Re-run this pull step whenever:** you upgrade kind (which may use a newer default node image), or when the integration test scripts pin a specific Kubernetes version for a new Istio release. Check `hack/setup-kind-in-ci.sh` for the `KIND_NODE_IMAGE` values used per Istio version.

If you accidentally end up with both architectures cached (you can check with `docker images kindest/node`), remove the arm64 one:

```bash
# Find and remove the arm64 digest (the untagged one)
docker images kindest/node
docker rmi kindest/node@sha256:<arm64-digest>
```

---

## Step 4 — Build the Kiali binary

The playwright-smoke test suite starts Kiali as a local binary (not deployed into the cluster). Build it first:

```bash
# From the kiali repo root
make build

# Alternatively, just build the binary:
go build -o "$(go env GOPATH)/bin/kiali" ./cmd/kiali/main.go
```

Verify:

```bash
ls -la "$(go env GOPATH)/bin/kiali"
```

---

## Step 5 — Run the integration tests

```bash
hack/run-integration-tests.sh --test-suite playwright-smoke
```

The script will:

1. Clone `kiali/helm-charts` (master branch)
2. Create a kind cluster named `ci`
3. Install MetalLB as a LoadBalancer
4. Install the Sail operator and Istio (latest stable)
5. Deploy the Bookinfo demo application
6. Start the Kiali binary locally on `http://localhost:20001`
7. Run `yarn run playwright:run:smoke` from `frontend/`

Total setup time: approximately 10–15 minutes on a first run (image pulls included). Subsequent runs are faster because images are cached.

---

## Complete colima.yaml reference

The final `~/.colima/default/colima.yaml` that works with kind:

```yaml
cpu: 6
disk: 100
memory: 20
arch: x86_64
runtime: docker
vmType: vz
rosetta: true
binfmt: true
mountType: virtiofs
mountInotify: true

docker:
  exec-opts:
    - native.cgroupdriver=systemd
  seccomp-profile: unconfined

network:
  address: false
  mode: shared

autoActivate: true
sshConfig: true
```

---

## Troubleshooting

### `could not find a log line that matches "Reached target .*Multi-User System.*|detected cgroup v1"`

This error from `kind create cluster` means the kind node container's systemd never reported startup completion. Work through this checklist:

1. **Check cgroup driver:**
   ```bash
   docker info | grep "Cgroup Driver"
   # Must be: Cgroup Driver: systemd
   ```
   If it shows `cgroupfs`, edit `colima.yaml` (add `exec-opts: [native.cgroupdriver=systemd]`) and restart Colima.

2. **Check seccomp profile:**
   ```bash
   docker info | grep -A2 "Security Options"
   # Must include: Profile: unconfined
   ```
   If it shows a path to a seccomp profile, add `seccomp-profile: unconfined` to `colima.yaml` and restart Colima.

3. **Check node image architecture:**
   ```bash
   docker inspect kindest/node:v1.32.2 --format '{{.Architecture}}'
   # Must be: amd64
   ```
   If it shows `arm64`, run:
   ```bash
   docker rmi kindest/node:v1.32.2
   docker pull --platform linux/amd64 kindest/node:v1.32.2
   ```

### `ERROR: Kiali binary not found at $GOPATH/bin/kiali`

Build the binary first: `make build` (see Step 4).

### kind cluster creation fails with `node(s) already exist for a cluster with the name "ci"`

A leftover cluster from a previous run:
```bash
kind delete cluster --name ci
```

### `docker: Error response from daemon: ... OCI runtime create failed`

Usually a file-mount issue. Avoid using `extraMounts` in kind configs on this setup for file (non-directory) paths — bind-mounting individual files into containers is unreliable with QEMU + overlayfs.

### Playwright tests fail but setup succeeded

Run the tests directly to get the browser trace:
```bash
cd frontend
yarn run playwright:run:smoke --reporter=list
```

The `--tests-only` flag skips cluster setup if the `ci` kind cluster already exists:
```bash
hack/run-integration-tests.sh --test-suite playwright-smoke --tests-only
```

---

## How CI differs from local

| Aspect | GitHub Actions (CI) | Local (Colima) |
|--------|--------------------|-----------------|
| OS | Ubuntu 24.04 x86_64 (bare metal) | macOS with x86_64 QEMU VM |
| Docker cgroup driver | `cgroupfs` (cgroup v1 on older runners) or `systemd` | Must set `systemd` manually |
| Seccomp | `unconfined` (GitHub Actions default) | Must set `unconfined` manually |
| kind node image | Resolves amd64 natively | kind CLI resolves arm64; must pre-pull amd64 |
| Kiali image | Built and loaded into cluster | Local binary (`$GOPATH/bin/kiali`) runs on host |

The playwright-smoke suite specifically runs Kiali as a local binary rather than deploying it into the cluster, so no image push is required for this test suite.
