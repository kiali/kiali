# Install an ACM hub and spoke with MCOA federation

Use `install-acm-hub-spoke.sh` to configure two existing OpenShift clusters in
one operation. One becomes the ACM hub and the other is imported as a managed
cluster. The script then configures the ACM multicluster observability
add-on (MCOA) path that federates Kiali metrics from edge User Workload
Monitoring (UWM) Prometheus instances to Observatorium on the hub.

The script never changes the current context in the caller's kubeconfig.
Direct cluster operations receive an explicit context; helpers that require a
current context use a temporary kubeconfig that is deleted on exit.

## Scope

The script installs and configures:

- UWM on the hub and spoke.
- The ACM 2.17 operator and `MultiClusterHub` on the hub.
- Development MinIO storage and `MultiClusterObservability` on the hub.
- The spoke `ManagedCluster`, auto-import secret, and `KlusterletAddonConfig`.
- MCOA platform and user-workload metrics capabilities.
- Kiali's MCOA `ScrapeConfig` resources, one shared edge `PrometheusRule` in
  `mesh-observability`, and their placement references.

With `--full`, it also installs Istio and the Istio metrics monitors on the
spoke, installs continuously generating sidecar and Ambient demo applications,
installs centralized Kiali on the hub, and grants Kiali API access to the
spoke.

The included MinIO deployment uses `emptyDir`, development credentials, small
component requests, and 14-day retention. It is not a production object-store
configuration.

## Prerequisites

- Two existing OpenShift clusters with contexts in the active kubeconfig.
- Cluster-admin access through both contexts.
- `oc` and `jq` in `PATH`.
- For `--full`, `helm`, `kubectl`, `yq`, `curl`, and `openssl` in `PATH`, plus
  the source repositories and build tools (`make`, `podman`) needed by the
  selected Kiali installation method.
- Red Hat catalogs containing ACM `release-2.17`.
- Network connectivity from the spoke to the ACM hub.

Context names and the ACM `ManagedCluster` name are independent. Because ACM
also creates a namespace with that managed-cluster name, it must be a valid
Kubernetes namespace. If the context name is not, pass `--spoke-name`.

## One-command installation

Run this from the Kiali repository:

```bash
./hack/install-acm-hub-spoke.sh \
  --hub-context "<hub-kubecontext>" \
  --spoke-context "<spoke-kubecontext>" \
  --full \
  --target-namespaces "istio-system,<application-namespace-1>,<application-namespace-2>" \
  --rule-namespace "mesh-observability"
```

`install` is the default command. This is equivalent:

```bash
./hack/install-acm-hub-spoke.sh install \
  --hub-context "<hub-kubecontext>" \
  --spoke-context "<spoke-kubecontext>" \
  --full
```

If `--spoke-name` is omitted, it defaults to `--spoke-context`. The default rule
namespace is `mesh-observability`; it is exempted from UWM label enforcement so
one cross-namespace recording rule can aggregate all scraped mesh namespaces.
List application and control-plane namespaces in `--target-namespaces` only so
the wrapper can create the required monitors. Platform CPU and memory metrics
are collected cluster-wide. For Ambient Istio, the wrapper discovers whether
the ztunnel daemon set runs in `ztunnel` or `istio-system` and configures its
monitor there.

Use `--with-dashboards` to add the full Istio dashboard metric tier. Run the
script with `--help` for all channel, namespace, MinIO, placement, and timeout
options.

The component choices are independent:

- Omit both flags to install only ACM and metrics-federation infrastructure.
- Use `--install-istio` to add Istio and its monitors to the spoke.
- Use `--install-kiali` to add Kiali to the hub when Istio already exists on
  the spoke.
- Use `--install-demo-apps` to add the sidecar demo and, when Ambient is
  enabled, the Ambient demo.
- Use `--full` to install Istio, Kiali, and both applicable demos.

For parity with `install-acm.sh`, command aliases are also available:
`install-istio`, `install-kiali`, `install-demo-apps`, and `install-all`.
The component commands reconcile their prerequisites; `install-demo-apps`
intentionally skips already-installed infrastructure and only extends
federation and installs the demos. For example:

```bash
./hack/install-acm-hub-spoke.sh install-all \
  --hub-context "<hub-kubecontext>" \
  --spoke-context "<spoke-kubecontext>"
```

Istio defaults to Ambient mode. Pass `--ambient false` for sidecar-only mode.
Kiali defaults to `helm-server`; `--kiali-install-type` also accepts
`olm-operator` and `helm-operator`. The `--kiali-repo-dir`,
`--kiali-operator-repo-dir`, `--helm-charts-dir`, and `--skip-build` options
are passed to the existing Kiali installer.
The demo namespaces default to `test-sidecar-app` and `test-ambient-app`; use
`--sidecar-app-namespace` and `--ambient-app-namespace` to change them. Demo
namespaces are added automatically to the effective MCOA target list.
The demos continuously generate baseline traffic. Use the wrapper's
`traffic-sidecar` or `traffic-ambient` command with `--traffic-count` and
`--traffic-interval` for an additional burst, or add `--traffic-continuous`.

The lower-level `install-acm.sh install-istio` command remains useful for local
single-cluster development, but it does not install ACM observability. In its
default `mcoa` mode it reconciles federation only when an existing
`MultiClusterObservability/observability` is reachable through
`--mcoa-hub-context`; otherwise it warns and leaves federation for a later
`install-mcoa-federation` command. This hub-spoke wrapper and
`install-acm.sh create-all` perform the required observability setup first.

## Installation phases

The script follows these phases and does not start a dependent phase until its
prerequisite reports ready.

### 1. Validate the clusters and start UWM

The script verifies both contexts and cluster-admin access. It enables UWM on
each cluster and waits for all desired `prometheus-user-workload` replicas.

If `cluster-monitoring-config` already exists, the script preserves it. It
continues if the existing YAML contains `enableUserWorkload: true`; otherwise
it stops and asks the administrator to merge that setting manually. It never
replaces an existing monitoring configuration.

### 2. Install the hub and Observatorium

The script creates a temporary kubeconfig containing the hub and spoke and
selects the hub only inside that temporary file before invoking
`install-acm.sh install-acm`. This retains the single-cluster development
installer's implementation while preventing it from targeting the spoke or
changing the caller's current context. The second context remains available
for later MCOA and Kiali multicluster operations.

That helper reconciles the ACM operator, `MultiClusterHub`, MinIO, the Thanos
object-storage secret, and `MultiClusterObservability`. It waits for each
component before returning. The temporary kubeconfig is always removed.

### 3. Import the spoke

The script creates or reconciles the spoke `ManagedCluster` and
`KlusterletAddonConfig`. If it is not already joined and available, the script
creates `auto-import-secret` from a temporary kubeconfig containing only the
spoke context. It waits for `ManagedClusterJoined=True` and
`ManagedClusterConditionAvailable=True`.

On a repeated run, an available managed cluster does not receive a new import
secret.

### 4. Prepare MCOA aggregation namespace and mesh monitor namespaces

The script creates the dedicated `mesh-observability` namespace and adds it to
UWM's `namespacesWithoutLabelEnforcement` configuration. It also ensures the
application and control-plane namespaces listed in `--target-namespaces` exist
so their `ServiceMonitor`/`PodMonitor` resources can be installed. Application
namespaces are not MCOA rule destinations.

MCOA supplies the `ScrapeConfig` API and its managed-cluster metrics component;
the full Cluster Observability Operator is not required for federation.

### 5. Configure federation

The script invokes `configure-acm-mcoa.sh` internally. The helper:

1. Enables MCOA platform and user-workload metrics capabilities.
2. Waits for the MCOA `ClusterManagementAddOn` placement.
3. Creates a UWM `/federate` `ScrapeConfig` for aggregated
   `workload:istio_*` series.
4. Creates one cluster-wide platform `ScrapeConfig` for Kiali's pod CPU and
   memory queries. It federates those metrics from all namespaces.
5. Creates one edge `PrometheusRule` in `mesh-observability` to aggregate
   high-cardinality Istio traffic series from all scraped namespaces in spoke
   UWM Prometheus, including optional Kiali self-metrics.
6. Adds those objects to the selected placement.

The generated interval fields are explicit rather than inherited from defaults:
the Istio `ServiceMonitor` and `PodMonitor` endpoints use `30s`, the propagated
`PrometheusRule` group uses `30s`, and both MCOA `ScrapeConfig` jobs use `5m`.
When Kiali is configured for hub Observatorium, its
`thanos_proxy.scrape_interval` is also set to `5m`. The UWM ConfigMap is used
only for the namespace exemption here; this setup does not set its global
`prometheus.scrapeInterval` or `prometheus.evaluationInterval` values.

For the relationship between these intervals, expected hub latency, and the
query-window requirements, see the [Scrape Intervals](https://kiali.io/docs/configuration/multi-cluster/acm-observability/#scrape-intervals)
guidance.

The dedicated aggregation namespace is deliberately exempt from UWM label
enforcement. Without that exemption, OpenShift would inject the rule namespace
into selectors and recorded output, preventing a single rule from aggregating
application telemetry across namespaces.

If MCOA has exactly one placement, it is selected automatically. If it has
more than one, the script aborts and lists the choices. Rerun with:

```bash
--placement-name "<placement-name>" \
--placement-namespace "<placement-namespace>"
```

This avoids sending namespace-specific resources to an unrelated cluster set.

### 6. Verify propagation

The script waits for the MCOA managed-cluster add-on on the named spoke and for
the shared Kiali recording rule in `mesh-observability`. It then checks MCOA
capabilities, hub source resources, and every selected placement reference.
Any failed check exits nonzero. The management hub is not required to receive
the edge rule or run the managed-cluster add-on because it does not host the
mesh in this topology.

### 7. Optionally install Istio on the spoke

With `--install-istio` or `--full`, the script invokes the existing
`install-acm.sh install-istio` implementation against a temporary kubeconfig
whose current context is the spoke. The wrapper keeps MCOA mode enabled so the
lower installer does not create legacy allowlists, but disables its independent
federation pass because the wrapper owns hub reconciliation. If Ambient Istio
is already present, the wrapper adds its discovered ztunnel namespace before
configuring MCOA. During a fresh install it defers that addition until the
daemon set exists, then extends federation for the actual namespace and waits
for its rule.

This phase installs the Sail Operator, Istio control plane, and, by default,
the Ambient CNI and ztunnel. It also creates the istiod `ServiceMonitor` and
the applicable proxy and ztunnel `PodMonitor` resources. The wrapper then
waits for istiod and, in Ambient mode, every desired ztunnel pod to be ready.

Istio is intentionally installed only on the spoke. In this architecture the
spoke is the mesh and edge-Prometheus cluster; the hub is the ACM and Kiali
management cluster.

### 8. Optionally install the demo applications

With `--install-demo-apps` or `--full`, the script reuses the existing
`install-acm.sh` demo installers on the spoke. It installs the sidecar
frontend-to-backend demo and, when Ambient mode is enabled, the Ambient demo
with a waypoint. Both generate continuous traffic and create the required
application `PodMonitor` objects. The wrapper waits for both frontend and
backend deployments before continuing.

### 9. Optionally install Kiali on the hub

With `--install-kiali` or `--full`, the script verifies that spoke Istio is
ready and invokes the existing `install-acm.sh install-kiali` implementation
on the hub. All three existing installation methods remain available:

- `helm-server` builds and installs the Kiali server from source.
- `olm-operator` installs the published operator and server.
- `helm-operator` builds and installs the operator and server from source.

Kiali is configured with `clustering.ignore_home_cluster: true` because the
hub is external to the mesh, and its Prometheus backend is the hub
Observatorium route with ACM mTLS credentials. The script then uses
`kiali-prepare-remote-cluster.sh` to declaratively create Kiali RBAC and a
service-account token on the spoke and the corresponding
`kiali-remote-cluster-secret-<spoke-name>` on the hub.

The Kiali Helm chart discovers labeled remote-cluster Secrets while rendering
the Deployment's Secret volumes. The wrapper therefore creates the remote
access resources and Secret before it installs or upgrades Kiali. The first
Kiali pod consequently mounts the spoke Secret and initializes a spoke client.

The wrapper sets `kubernetes_config.cluster_name` to `kiali-management` by
default. This is Kiali's external home-cluster identity; it is neither the ACM
`ManagedCluster` name nor the Istio cluster name. It only needs to be unique
among the Kiali clusters being configured. Use `--kiali-cluster-name` to set a
different unique value.

The remote cluster uses `--spoke-name`, matching the `cluster` label that ACM
adds to the spoke's centralized metrics. The wrapper also passes this value to
Sail as Istio's `global.multiCluster.clusterName`; therefore, it is the one
identity used for the ACM `ManagedCluster`, the Kiali remote-cluster Secret,
and Istio. By default it is the spoke kubeconfig context name.

`--kiali-cluster-name` is deliberately different. It is Kiali's external hub
identity and defaults to `kiali-management`; do not set it to the spoke name.

For an OpenShift spoke, the wrapper determines the hub's public Kiali route and
passes it to `kiali-prepare-remote-cluster.sh`. The remote-resource Helm render
then creates `OAuthClient/kiali-<kiali-namespace>` on the spoke with a
cluster-specific callback URI such as
`https://kiali-istio-system.apps.example.com/api/auth/callback/my-spoke`.
This is required by Kiali's normal per-cluster OpenShift OAuth client and does
not enable Kubernetes API impersonation. Kiali is restarted after remote access
is reconciled only when the Kiali Helm install or upgrade did not already roll
out its Deployment, so it reloads the OAuth client configuration without an
unnecessary second restart.

After opening Kiali, sign in to the spoke once: open the user menu in the
upper-right corner and select **Login to `<spoke-name>`**. Kiali redirects the
browser through the spoke's OpenShift OAuth server and returns to the hub Kiali
route. Until that per-cluster browser session exists, Kiali can use its service
account to discover the spoke but cannot make user-authorized API requests; UI
pages can then report that the spoke client is not accessible. This is expected
with normal per-cluster OAuth and is the deliberate alternative to API
impersonation.

Remote access is read-write by default, matching the local development
installer. Pass `--remote-view-only true` for read-only Kiali access. TLS
verification remains required unless `--allow-skip-tls-verify` is explicitly
specified.

## Idempotence and failures

Persistent objects are reconciled with `oc apply` or existence checks.
Placement references are added only when absent. Repeating the same command is
supported and converges on the same setup.

The optional Sail and Kiali Helm paths use upgrade-or-install semantics. The
remote Kiali RBAC, token Secret, and hub remote-cluster Secret are applied with
stable names. Repeating `--full` reconciles them rather than creating another
environment.

Unexpected command failures abort the run. Expected asynchronous installation
uses bounded polling. `--timeout` is the maximum for each readiness boundary,
not one timeout for the entire installation.

## Status and uninstallation

Inspect the complete topology without changing it:

```bash
./hack/install-acm-hub-spoke.sh status \
  --hub-context "<hub-kubecontext>" \
  --spoke-context "<spoke-kubecontext>"
```

Status and uninstall commands perform only non-mutating client, connectivity,
and permission checks. They do not enable User Workload Monitoring or install
any other prerequisite when it is absent.

Remove the complete environment:

```bash
./hack/install-acm-hub-spoke.sh uninstall \
  --hub-context "<hub-kubecontext>" \
  --spoke-context "<spoke-kubecontext>"
```

Uninstall runs in dependency-safe reverse order: demo applications, Kiali
remote access and Kiali, Istio, Kiali MCOA resources, the managed-cluster
import and its spoke namespaces, ACM/Observatorium, and wrapper-owned UWM
configuration. It also removes residual
`AppliedManifestWork` objects on the spoke and ACM/MCE CRDs, cluster RBAC,
admission registrations, APIService registrations, and ACM platform recording
rules that can remain after the operators and Klusterlet have stopped. This
includes ACM-installed Hive and Observatorium CRDs and their APIService
registrations. If an ACM `ConfigurationPolicy` is already terminating after
its policy controller has stopped, the script deletes its ACM-created related
rules and releases its orphaned `delete-related-objects` finalizer before
waiting for the managed cluster namespace. An empty ACM-created `hive`
namespace and its APIs are removed; a Hive namespace with live workloads and
its APIs are preserved. It uses the same namespace and placement options as
installation.

Federation cleanup removes the specifically named Kiali `ScrapeConfig` and
`PrometheusRule` objects. It preserves the shared CRDs that provide those APIs.

Pre-existing UWM configuration is preserved by default. To explicitly remove
`cluster-monitoring-config` from both clusters even when the wrapper did not
create or label it, add `--remove-uwm-config`:

```bash
./hack/install-acm-hub-spoke.sh uninstall \
  --hub-context "<hub-kubecontext>" \
  --spoke-context "<spoke-kubecontext>" \
  --remove-uwm-config
```

This option deletes the entire ConfigMap, including unrelated monitoring
customizations, so use it only when the clusters are dedicated to this lab or
you have preserved those settings elsewhere. Pre-existing namespaces used for
image storage or other work are also preserved unless they carry ownership
metadata from this wrapper or ACM.

The command is idempotent, including when UWM is already disabled or an
operator API has already disappeared; missing resources and APIs are treated
as already removed and uninstall does not re-enable installation prerequisites.
If installation used custom demo namespaces, target namespaces, or MCOA
placement options, pass those same options to `uninstall`.

## Read-only verification

Run this after installation or while diagnosing a partial setup:

```bash
./hack/install-acm-hub-spoke.sh verify \
  --hub-context "<hub-kubecontext>" \
  --spoke-context "<spoke-kubecontext>" \
  --full \
  --target-namespaces "istio-system,<application-namespace-1>,<application-namespace-2>" \
  --rule-namespace "mesh-observability" \
  --placement-name "<placement-name>" \
  --placement-namespace "<placement-namespace>"
```

Pass `--full` or the same component flags, placement options, and
`--target-namespaces`, `--rule-namespace`, and `--with-dashboards` values used
for installation. Omit the placement options only when the installation also
used automatic single-placement selection. Without `--full` (or matching
component flags), the standalone command intentionally verifies only the base
infrastructure. Verification does not modify either cluster. Verification run
automatically at the end of an install already receives the install's in-memory
options.

## Next steps for live metrics

If you ran the base infrastructure-only command without `--full`:

1. Install the mesh and applications on the spoke.
2. Create the Istio control-plane `ServiceMonitor` and required workload
   `PodMonitor` objects so UWM obtains raw `istio_*` samples.
3. Generate traffic and wait for rule evaluation plus the MCOA federation
   interval.
4. Configure Kiali to query the hub Observatorium endpoint, then verify graph,
   control-plane, and workload resource metrics.

With `--full`, Istio, the demo applications and their monitors, continuous
traffic, and Kiali are already installed. Review the [Scrape Intervals](https://kiali.io/docs/configuration/multi-cluster/acm-observability/#scrape-intervals)
guidance before expecting the graphs to populate. If you add other applications
later, create their monitors and rerun the wrapper with their namespaces in
`--target-namespaces`; the shared aggregation rule does not change.

The following will validate each stage of the traffic-metrics pipeline
directly. The first query confirms that spoke UWM scrapes raw Istio counters.
The second confirms that the recording rules produce the lower-cardinality
`workload:*` series. The final query confirms that MCOA federates those series
to hub Thanos and removes the `workload:` prefix. Generate traffic before
running these commands and replace the placeholder values:

```bash
HUB_CONTEXT="<hub-kubecontext>"
SPOKE_CONTEXT="<spoke-kubecontext>"
MANAGED_CLUSTER_NAME="<acm-managed-cluster-name>" # get list from: oc --context=${HUB_CONTEXT} get managedcluster -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'

PROM_POD=$(oc --context="${SPOKE_CONTEXT}" \
  -n openshift-user-workload-monitoring \
  get pods -l app.kubernetes.io/name=prometheus \
  -o jsonpath='{.items[0].metadata.name}')

# Edge UWM: raw counters scraped from Istio proxies
oc --context="${SPOKE_CONTEXT}" \
  -n openshift-user-workload-monitoring \
  exec -c prometheus "${PROM_POD}" -- \
  wget -qO- \
  'http://localhost:9090/api/v1/query?query=sum%28istio_requests_total%29' \
  | jq '.data.result'

# Edge UWM: aggregates produced by the recording rules
oc --context="${SPOKE_CONTEXT}" \
  -n openshift-user-workload-monitoring \
  exec -c prometheus "${PROM_POD}" -- \
  wget -qO- \
  'http://localhost:9090/api/v1/query?query=sum%28workload%3Aistio_requests_total%29' \
  | jq '.data.result'

# Hub Thanos: federated aggregates, relabeled back to istio_requests_total
oc --context="${HUB_CONTEXT}" get --raw \
  "/api/v1/namespaces/open-cluster-management-observability/services/http:observability-thanos-query-frontend:9090/proxy/api/v1/query?query=sum%28istio_requests_total%7Bcluster%3D%22${MANAGED_CLUSTER_NAME}%22%7D%29" \
  | jq '.data.result'
```

All three queries should return a non-empty result. Hub Thanos is updated on
the MCOA collection interval. Review the [Scrape Intervals](https://kiali.io/docs/configuration/multi-cluster/acm-observability/#scrape-intervals)
guidance for the expected delay, and compare presence and approximately
corresponding counter values rather than expecting exact point-in-time equality.

You can see the metrics in the edge Prometheus, which include the "workload:" metrics:

```bash
oc --context="${SPOKE_CONTEXT}" \
  -n openshift-user-workload-monitoring \
  exec -c prometheus "${PROM_POD}" -- \
  wget -qO- \
  'http://localhost:9090/api/v1/label/__name__/values' \
  | jq -r '
  [.data[] | select(test("istio|envoy"; "i"))] | unique
  | .[] ,
  "===\nTOTAL COUNT OF istio_ AND envoy_ METRICS: \(length)"'
```

and the metrics aggregated in the hub Thanos (notice there are no "workload:" metrics
and the number of metrics are much less):

```bash
oc --context="${HUB_CONTEXT}" get --raw \
  "/api/v1/namespaces/open-cluster-management-observability/services/http:observability-thanos-query-frontend:9090/proxy/api/v1/label/__name__/values" \
  | jq -r '
  [.data[] | select(test("istio|envoy|pilot"; "i"))] | unique
  | .[] ,
  "===\nTOTAL COUNT OF istio_ AND envoy_ METRICS: \(length)"'
```

The MCOA path does not use the legacy
`observability-metrics-custom-allowlist` ConfigMap. The hub allowlist remains
valid for ACM's legacy collectors, but MCOA replaces those collectors here.

## Troubleshooting

Use `--verbose` for more progress output. The phase printed immediately before
an error identifies the component that did not become ready.

For a spoke that does not join, inspect:

```bash
oc --context="<hub-kubecontext>" get managedcluster "<acm-managed-cluster-name>" -o yaml
oc --context="<hub-kubecontext>" get secret auto-import-secret \
  -n "<acm-managed-cluster-name>"
oc --context="<spoke-kubecontext>" get klusterlet
oc --context="<spoke-kubecontext>" get pods -n open-cluster-management-agent
```

For observability or MCOA readiness, inspect:

```bash
oc --context="<hub-kubecontext>" get mco observability -o yaml
oc --context="<hub-kubecontext>" get clustermanagementaddon \
  multicluster-observability-addon -o yaml
oc --context="<hub-kubecontext>" get managedclusteraddon \
  multicluster-observability-addon -n local-cluster -o yaml
oc --context="<hub-kubecontext>" get managedclusteraddon \
  multicluster-observability-addon -n "<acm-managed-cluster-name>" -o yaml
```

## Additional resources

- [ACM 2.17 observability documentation](https://docs.redhat.com/en/documentation/red_hat_advanced_cluster_management_for_kubernetes/2.17/html/observability/index)
