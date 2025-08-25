# Installer Design

This tool replaces the collection of bash scripts in `hack/` that set up KinD
clusters for Kiali development and testing. It is a single Go binary that
creates clusters, installs Istio, deploys Keycloak, Bookinfo, and Kiali, and
wires everything together.

Four principles guide every decision in the codebase.

## 1. Idempotent

Running the installer twice produces the same result as running it once. A
developer can re-run it after a partial failure or after changing a flag without
tearing the environment down first.

**How this shows up in the code:**

- **Cluster creation checks for existence first.** `kind.Cluster.Create` lists
  existing clusters and skips creation when the cluster already exists, then
  unconditionally applies post-creation config (image registry) so the
  cluster converges to the desired state either way. MetalLB is deployed
  separately in `main.go` after cluster creation.

- **Kubernetes resources use server-side apply.** `command.ServerSideApply`
  applies manifests with `--server-side --field-manager=kiali-installer
--force-conflicts`. This is a declarative write: the resource is created if
  missing and updated if it already exists, with no "already exists" errors and
  no need for create-or-update branching.

- **Helm uses `upgrade --install`.** The Istio Sail Operator and Kiali chart
  installs use `helm upgrade --install` so the same command works for both
  initial install and subsequent runs.

- **Certificates are generated once.** CA certs for both Keycloak and Istio
  multicluster are written to stable paths under `/tmp/kiali/` and reused on
  subsequent runs. Regenerating would break the OIDC trust chain since the kind
  API server mounts the CA at cluster creation time.

- **The container network is created idempotently.** `EnsureKindNetwork` runs
  `docker network create kind` and ignores the error if the network already
  exists, then inspects the result.

## 2. Fast

The installer exploits parallelism wherever dependencies allow and defers
blocking waits as long as possible.

**How this shows up in the code:**

- **Clusters are created in parallel.** In multi-primary mode, the east and
  west KinD clusters are created concurrently via `errgroup`. Each cluster
  creation is fully independent (own config, own LB prefix).

- **Istio is installed on both clusters in parallel.** `runMultiPrimary`
  launches `istio.Install` on east and west concurrently via `errgroup`. Each
  install handles its own Sail Operator helm install, Istio CR creation, addon
  installation, and telemetry configuration independently.

- **CA secrets are pushed to both clusters in parallel.** After cert generation
  (which is sequential and fast), the namespace creation and secret apply for
  each zone run concurrently.

- **Bookinfo deploys to both clusters in parallel.** The initial deployment
  runs in parallel, then the east/west-specific scaling and traffic rules also
  run in parallel.

- **East-west gateways deploy in parallel.** Gateway YAML and expose-services
  are applied to both clusters concurrently.

- **Keycloak runs in the background during Istio setup.** `keycloak.Deploy`
  launches in a background goroutine while CA secret application and Istio
  installation proceed in the foreground. The result channel is collected
  later, after Kiali is deployed.

- **Gateways and remote secrets run in parallel.** Gateways set up
  east-west network plumbing while remote secrets enable cross-cluster
  service discovery — independent operations.

- **Prometheus federation, tracing, and Bookinfo run in parallel.** They
  operate on different resources and namespaces.

- **Waits are deferred.** Keycloak is deployed and waited on in a
  background goroutine, but the main flow does not block on the result
  channel until after Kiali has been deployed. This lets Keycloak's pods
  start up during the time spent on unrelated work. Similarly,
  `istio.Install` applies the Istio CR, installs addons, and enables
  tracing, then returns; the `WaitReady` call is a separate step that
  runs only after both clusters have been fully configured.

- **`errgroup` is the primary concurrency primitive.** It provides
  structured cancellation on first error and a simple `Wait()` barrier.
  Background tasks that outlive a single errgroup scope (Keycloak,
  MetalLB) use goroutines with error channels instead.

## 3. Clean output

The log output, by default, should be clear and comprehensible. Only when an
error occurs or if verbose logging is enabled should the underlying tools log
their output. Log output should come from the configured app logger.

**How this shows up in the code:**

- **The `command` package suppresses stdout and stderr.** `Command()` does not
  wire subprocess output to the terminal. `Run()` captures stderr in a buffer
  and includes it in the error message only when the command fails. On success,
  all subprocess output is discarded.

- **`Output()` captures, never prints.** When callers need a command's stdout
  they call `Output()`, which returns it as a string. Nothing is written to the
  terminal.

- **No direct `exec.Command` with `os.Stdout`/`os.Stderr`.** All command
  execution goes through the `command` package so output behavior is consistent.
  Direct `exec.Command` is only used when the output is captured via
  `CombinedOutput()` or `Output()`, never piped to the terminal.

- **Progress comes from the logger.** Each high-level step logs a message via
  zerolog before it starts. The user sees what the installer is doing without
  seeing the raw output of every kubectl, helm, or curl invocation.

## 4. Simple

The tool has few flags, reuses code across environments, and avoids
abstractions that don't pay for themselves.

**How this shows up in the code:**

- **Minimal flags.** The root command exposes only what varies between runs:
  cluster name, image, IP family, LB prefix, container runtime, and registry
  toggle. The multi-primary subcommand adds only an optional helm chart path.
  Everything else is a sensible default.

- **One package per concern.** Each external system gets its own package
  (`kind`, `istio`, `keycloak`, `kiali`, `bookinfo`, `certs`, `command`,
  `metallb`, `client`) with a small public API. The main function reads as a
  linear sequence of high-level steps.

- **Shared `command` package.** A thin wrapper around `os/exec` that runs
  commands quietly, captures output, and wraps errors. `ServerSideApply`
  codifies the SSA pattern used throughout. No framework, just a small helper
  that earns its keep.

- **Inline YAML over template files.** Most Kubernetes manifests are
  constructed inline with `fmt.Sprintf`. This keeps the resource definition
  next to the code that applies it, avoids a template language, and makes it
  obvious what values are being substituted. External YAML files are only used
  when the manifest already exists in the repo (e.g., `hack/istio/` files).

- **Controller-runtime client for typed resources.** The Istio package uses the
  controller-runtime client with server-side apply for the Istio and Telemetry
  CRs. This gives compile-time type safety for complex resources where
  `fmt.Sprintf` YAML would be error-prone. kubectl is used for everything else.

- **Deterministic network allocation.** `AllocateLoadBalancerPrefixes`
  subdivides the kind network's last /24 into equal CIDR blocks, one per
  cluster. The first address in the first prefix is reserved for Keycloak. This
  eliminates the need for flags or manual IP coordination.

- **No configuration file.** The tool is configured entirely through CLI flags
  and sensible defaults. There is no YAML/JSON config file to maintain or
  document.
