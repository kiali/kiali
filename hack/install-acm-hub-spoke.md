# Install an ACM hub and spoke with MCOA federation

This guide describes a two-cluster OpenShift topology:

- The hub runs Advanced Cluster Management (ACM), Observatorium/Thanos, and
  optionally centralized Kiali.
- The spoke runs Istio workloads and User Workload Monitoring (UWM).
- ACM's multicluster observability add-on (MCOA) collects selected metrics from
  the spoke and stores them in the hub.
- Kiali on the hub queries the hub's Observatorium endpoint and uses the spoke
  as its remote Kubernetes cluster.

The hub is not part of the Istio mesh. The spoke is the edge cluster: its UWM
Prometheus scrapes Istio metrics, records high-cardinality traffic metrics, and
federates the resulting series to the hub.

This is a development and test installation. The example object store uses a
single SeaweedFS pod with emptyDir storage, development credentials, and a
fourteen-day retention period. Use durable, secured object storage and review
the retention and resource settings before using this topology for anything
other than a lab.

## Variables and prerequisites

Set these variables to existing kubeconfig contexts:

```bash
export HUB_CONTEXT="<hub-kubecontext>"
export SPOKE_CONTEXT="<spoke-kubecontext>"
export MANAGED_CLUSTER_NAME="<spoke-managed-cluster-name>"
export ACM_NAMESPACE="open-cluster-management"
export OBSERVABILITY_NAMESPACE="open-cluster-management-observability"
export RULE_NAMESPACE="mesh-observability"
export KIALI_NAMESPACE="istio-system"
```

MANAGED_CLUSTER_NAME is the ACM ManagedCluster name and must be a valid
Kubernetes namespace name. It is also used as the Istio multi-cluster name and
the Kiali remote-cluster name. It does not have to match the spoke context.

You need two reachable OpenShift clusters, cluster-admin access to both,
oc and jq, the ACM release-2.17+ catalog in the hub's redhat-operators source,
and network connectivity from the spoke to the hub. Install helm, kubectl,
yq, curl, and openssl when installing Istio or Kiali.

```bash
oc --context="$HUB_CONTEXT" whoami
oc --context="$SPOKE_CONTEXT" whoami
oc --context="$HUB_CONTEXT" auth can-i create namespaces --all-namespaces
oc --context="$SPOKE_CONTEXT" auth can-i create namespaces --all-namespaces
```

## 1. Enable User Workload Monitoring

Enable UWM on both clusters. If cluster-monitoring-config already exists,
merge enableUserWorkload: true into its existing config.yaml; do not replace
unrelated monitoring settings. For a cluster without that ConfigMap, apply
this manifest once to each cluster:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-monitoring-config
  namespace: openshift-monitoring
data:
  config.yaml: |
    enableUserWorkload: true
```

```bash
oc --context="$HUB_CONTEXT" apply -f cluster-monitoring-config.yaml
oc --context="$SPOKE_CONTEXT" apply -f cluster-monitoring-config.yaml
for context in "$HUB_CONTEXT" "$SPOKE_CONTEXT"; do
  oc --context="$context" wait --for=condition=ready pod \
    -l app.kubernetes.io/name=prometheus \
    -n openshift-user-workload-monitoring --timeout=10m
done
```

The spoke needs a namespace in which a cross-namespace recording rule can be
evaluated without OpenShift adding a namespace selector:

```bash
oc --context="$SPOKE_CONTEXT" create namespace "$RULE_NAMESPACE" \
  --dry-run=client -o yaml | oc --context="$SPOKE_CONTEXT" apply -f -
```

Add this entry to the spoke's existing user-workload-monitoring-config,
preserving any other keys and namespace exemptions:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: user-workload-monitoring-config
  namespace: openshift-user-workload-monitoring
data:
  config.yaml: |
    namespacesWithoutLabelEnforcement:
    - mesh-observability
```

## 2. Install ACM on the hub

Create the ACM namespace, operator group, and subscription:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: open-cluster-management
---
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: acm-operator-group
  namespace: open-cluster-management
spec:
  targetNamespaces:
  - open-cluster-management
---
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: advanced-cluster-management
  namespace: open-cluster-management
spec:
  channel: release-2.17
  installPlanApproval: Automatic
  name: advanced-cluster-management
  source: redhat-operators
  sourceNamespace: openshift-marketplace
```

```bash
oc --context="$HUB_CONTEXT" apply -f acm-subscription.yaml
oc --context="$HUB_CONTEXT" get csv -n "$ACM_NAMESPACE" -w
```

After the ACM CSV reaches Succeeded, create the hub:

```yaml
apiVersion: operator.open-cluster-management.io/v1
kind: MultiClusterHub
metadata:
  name: multiclusterhub
  namespace: open-cluster-management
spec: {}
```

```bash
oc --context="$HUB_CONTEXT" apply -f multiclusterhub.yaml
oc --context="$HUB_CONTEXT" get mch multiclusterhub \
  -n "$ACM_NAMESPACE" -w
```

Continue when the MultiClusterHub phase is Running. ACM creates the
local-cluster ManagedCluster for the hub.

## 3. Configure development object storage and Observatorium

Create the observability namespace and a lab
[SeaweedFS](https://github.com/seaweedfs/seaweedfs) instance. SeaweedFS `mini`
mode runs its S3-compatible gateway and storage services in one process and
creates the `thanos` bucket at startup:

```bash
oc --context="$HUB_CONTEXT" create namespace "$OBSERVABILITY_NAMESPACE" \
  --dry-run=client -o yaml | oc --context="$HUB_CONTEXT" apply -f -
```

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: seaweedfs
  namespace: open-cluster-management-observability
spec:
  replicas: 1
  selector:
    matchLabels:
      app: seaweedfs
  template:
    metadata:
      labels:
        app: seaweedfs
    spec:
      containers:
      - name: seaweedfs
        image: ghcr.io/chrislusf/seaweedfs:4.47
        args: [mini, -dir=/data, -admin.port=12646, -master.telemetry=false]
        env:
        - name: AWS_ACCESS_KEY_ID
          value: seaweedfs
        - name: AWS_SECRET_ACCESS_KEY
          value: seaweedfs123
        - name: S3_BUCKET
          value: thanos
        ports:
        - name: s3
          containerPort: 8333
        readinessProbe:
          tcpSocket:
            port: 8333
          initialDelaySeconds: 10
          periodSeconds: 5
        volumeMounts:
        - name: data
          mountPath: /data
      volumes:
      - name: data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: seaweedfs
  namespace: open-cluster-management-observability
spec:
  selector:
    app: seaweedfs
  ports:
  - name: s3
    port: 8333
    targetPort: 8333
```

```bash
oc --context="$HUB_CONTEXT" apply -f seaweedfs.yaml
oc --context="$HUB_CONTEXT" rollout status deployment/seaweedfs \
  -n "$OBSERVABILITY_NAMESPACE" --timeout=10m
```

Create the object-store Secret:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: thanos-object-storage
  namespace: open-cluster-management-observability
type: Opaque
stringData:
  thanos.yaml: |
    type: s3
    config:
      bucket: thanos
      endpoint: seaweedfs.open-cluster-management-observability.svc:8333
      insecure: true
      access_key: seaweedfs
      secret_key: seaweedfs123
```

Create MultiClusterObservability. The fourteen-day 5m retention is above
Thanos's ten-day minimum for downsampling:

```yaml
apiVersion: observability.open-cluster-management.io/v1beta2
kind: MultiClusterObservability
metadata:
  name: observability
spec:
  observabilityAddonSpec: {}
  storageConfig:
    metricObjectStorage:
      name: thanos-object-storage
      key: thanos.yaml
    alertmanagerStorageSize: 1Gi
    compactStorageSize: 10Gi
    receiveStorageSize: 10Gi
    ruleStorageSize: 1Gi
    storeStorageSize: 10Gi
  advanced:
    retentionConfig:
      retentionResolution1h: 14d
      retentionResolution5m: 14d
      retentionResolutionRaw: 14d
    query:
      replicas: 1
    queryFrontend:
      replicas: 1
    receive:
      replicas: 1
    rule:
      replicas: 1
    store:
      replicas: 1
```

```bash
oc --context="$HUB_CONTEXT" apply -f thanos-object-storage.yaml
oc --context="$HUB_CONTEXT" apply -f multiclusterobservability.yaml
oc --context="$HUB_CONTEXT" get mco observability -w
```

Continue when MultiClusterObservability/observability reports Ready=True.
The observability namespace should contain observability-grafana-certs,
observability-server-ca-certs, and observability-client-ca-certs.

## 4. Import the spoke into ACM

Create the managed-cluster namespace, ManagedCluster, and KlusterletAddonConfig
on the hub. Replace the placeholder in all three resources:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: <spoke-managed-cluster-name>
---
apiVersion: cluster.open-cluster-management.io/v1
kind: ManagedCluster
metadata:
  name: <spoke-managed-cluster-name>
  labels:
    cloud: auto-detect
    vendor: auto-detect
spec:
  hubAcceptsClient: true
---
apiVersion: agent.open-cluster-management.io/v1
kind: KlusterletAddonConfig
metadata:
  name: <spoke-managed-cluster-name>
  namespace: <spoke-managed-cluster-name>
spec:
  applicationManager:
    enabled: true
  certPolicyController:
    enabled: true
  clusterName: <spoke-managed-cluster-name>
  clusterNamespace: <spoke-managed-cluster-name>
  policyController:
    enabled: true
  searchCollector:
    enabled: true
```

```bash
sed "s/<spoke-managed-cluster-name>/${MANAGED_CLUSTER_NAME}/g" \
  managed-cluster.yaml | oc --context="$HUB_CONTEXT" apply -f -
```

Export a private, flattened kubeconfig containing only the spoke context and
create ACM's auto-import Secret:

```bash
umask 077
oc config view --raw --context="$SPOKE_CONTEXT" --minify --flatten \
  > /tmp/acm-spoke-kubeconfig.yaml
oc --context="$HUB_CONTEXT" create secret generic auto-import-secret \
  -n "$MANAGED_CLUSTER_NAME" \
  --from-file=kubeconfig=/tmp/acm-spoke-kubeconfig.yaml \
  --dry-run=client -o yaml | oc --context="$HUB_CONTEXT" apply -f -
rm -f /tmp/acm-spoke-kubeconfig.yaml
oc --context="$HUB_CONTEXT" get managedcluster "$MANAGED_CLUSTER_NAME" -w
```

The spoke is ready when ManagedClusterJoined=True and
ManagedClusterConditionAvailable=True.

## 5. Configure MCOA federation

On the hub, enable the platform and user-workload metrics capabilities in
MultiClusterObservability. This changes only the hub's
MultiClusterObservability resource; the spoke's MCOA components are installed
and configured through ACM after the spoke is selected by a placement:

```bash
oc --context="$HUB_CONTEXT" patch mco observability --type=merge -p \
  '{"spec":{"capabilities":{"platform":{"metrics":{"default":{"enabled":true}}},"userWorkloads":{"metrics":{"default":{"enabled":true}}}}}}'
```

Verify that the MCOA API is available and inspect its placements. The CRD
check confirms that ScrapeConfig resources can be created; the add-on output
identifies the placement that selects the spoke.

```bash
oc --context="$HUB_CONTEXT" get crd scrapeconfigs.monitoring.rhobs
oc --context="$HUB_CONTEXT" get clustermanagementaddon \
  multicluster-observability-addon -o yaml
```

Choose a MCOA placement that contains the spoke. The three source resources
referenced below will be created later in this section. Add their references
to the placement's existing configs list now, preserving unrelated entries:

```yaml
configs:
- group: monitoring.rhobs
  resource: scrapeconfigs
  name: kiali-istio-federation
  namespace: open-cluster-management-observability
- group: monitoring.rhobs
  resource: scrapeconfigs
  name: kiali-istio-platform-federation
  namespace: open-cluster-management-observability
- group: monitoring.coreos.com
  resource: prometheusrules
  name: kiali-istio-aggregation
  namespace: open-cluster-management-observability
```

Edit the add-on on the hub and place these entries under the selected
placement. For example:

```bash
oc --context="$HUB_CONTEXT" edit clustermanagementaddon \
  multicluster-observability-addon
```

If the add-on has more than one placement, match both its name and namespace;
do not add the resources to a placement that does not select the spoke.

The configs entries refer to source resources on the hub. MCOA propagates them
to managed clusters selected by the placement. Do not apply these source
objects directly to the spoke.

Create the edge recording rule on the hub. It targets mesh-observability on
each selected managed cluster:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: kiali-istio-aggregation
  namespace: open-cluster-management-observability
  annotations:
    observability.open-cluster-management.io/target-namespace: mesh-observability
  labels:
    app.kubernetes.io/component: user-workload-metrics-collector
    app.kubernetes.io/managed-by: kiali-mcoa-federation
    openshift.io/prometheus-rule-evaluation-scope: leaf-prometheus
spec:
  groups:
  - name: istio.workload-aggregation
    interval: 30s
    rules:
    - record: workload:istio_requests_total
      expr: sum without (pod, pod_template_hash, instance, job, node) (istio_requests_total)
    - record: workload:istio_request_duration_milliseconds_bucket
      expr: sum without (pod, pod_template_hash, instance, job, node) (istio_request_duration_milliseconds_bucket)
    - record: workload:istio_request_duration_milliseconds_sum
      expr: sum without (pod, pod_template_hash, instance, job, node) (istio_request_duration_milliseconds_sum)
    - record: workload:istio_request_duration_milliseconds_count
      expr: sum without (pod, pod_template_hash, instance, job, node) (istio_request_duration_milliseconds_count)
    - record: workload:istio_tcp_sent_bytes_total
      expr: sum without (pod, pod_template_hash, instance, job, node) (istio_tcp_sent_bytes_total)
    - record: workload:istio_tcp_received_bytes_total
      expr: sum without (pod, pod_template_hash, instance, job, node) (istio_tcp_received_bytes_total)
    - record: workload:istio_tcp_connections_opened_total
      expr: sum without (pod, pod_template_hash, instance, job, node) (istio_tcp_connections_opened_total)
    - record: workload:istio_tcp_connections_closed_total
      expr: sum without (pod, pod_template_hash, instance, job, node) (istio_tcp_connections_closed_total)
```

Add the remaining request/response byte and message histogram rules from
prometheus/federation/core-recording-rules.yml. If Kiali is installed on a
selected managed cluster, add the rules from
prometheus/federation/kiali-metrics-recording-rules.yml to this edge rule as
well. For centralized Kiali on the hub, create the namespace-local rule in
section 8 instead. The workload: prefix prevents raw per-pod series from
being federated and keeps edge cardinality manageable.

Create the user-workload ScrapeConfig:

```yaml
apiVersion: monitoring.rhobs/v1alpha1
kind: ScrapeConfig
metadata:
  name: kiali-istio-federation
  namespace: open-cluster-management-observability
  labels:
    app.kubernetes.io/component: user-workload-metrics-collector
    app.kubernetes.io/managed-by: kiali-mcoa-federation
spec:
  honorLabels: true
  jobName: kiali-istio-federation
  metricsPath: /federate
  params:
    match[]:
    - '{__name__=~"workload:istio_requests_total"}'
    - '{__name__=~"workload:istio_request_bytes_(bucket|count|sum)"}'
    - '{__name__=~"workload:istio_request_duration_milliseconds_(bucket|count|sum)"}'
    - '{__name__=~"workload:istio_request_messages_total"}'
    - '{__name__=~"workload:istio_response_bytes_(bucket|count|sum)"}'
    - '{__name__=~"workload:istio_response_messages_total"}'
    - '{__name__=~"workload:istio_tcp_(connections_(opened|closed)|received_bytes|sent_bytes)_total"}'
    - '{__name__=~"istio_build|pilot_info|pilot_services|pilot_xds|pilot_xds_pushes"}'
    - '{__name__=~"workload_manager_active_proxy_count"}'
    - '{__name__=~"envoy_cluster_upstream_cx_active|envoy_cluster_upstream_rq_total"}'
    - '{__name__=~"envoy_listener_downstream_cx_active|envoy_listener_http_downstream_rq"}'
    - '{__name__=~"envoy_server_memory_allocated|envoy_server_memory_heap_size|envoy_server_uptime"}'
    - '{__name__=~"kiali:.*"}'
  metricRelabelings:
  - action: replace
    regex: 'workload:(.*)'
    replacement: '$1'
    sourceLabels: [__name__]
    targetLabel: __name__
  - action: replace
    regex: 'kiali:(.*)'
    replacement: '$1'
    sourceLabels: [__name__]
    targetLabel: __name__
  scrapeInterval: 5m
```

The relabelings remove the edge-only workload: and kiali: prefixes after
federation. Add the optional selectors from
prometheus/federation/istio-dashboard-federation-match.yml for full Istio
dashboard coverage.

Create a second ScrapeConfig for platform metrics:

```yaml
apiVersion: monitoring.rhobs/v1alpha1
kind: ScrapeConfig
metadata:
  name: kiali-istio-platform-federation
  namespace: open-cluster-management-observability
  labels:
    app.kubernetes.io/component: platform-metrics-collector
    app.kubernetes.io/managed-by: kiali-mcoa-federation
spec:
  jobName: kiali-istio-platform-federation
  metricsPath: /federate
  params:
    match[]:
    - '{__name__=~"container_cpu_usage_seconds_total|container_memory_working_set_bytes"}'
  scrapeInterval: 5m
```

Apply the three source objects on the hub and verify propagation:

```bash
oc --context="$HUB_CONTEXT" apply -f kiali-istio-aggregation.yaml
oc --context="$HUB_CONTEXT" apply -f kiali-istio-federation.yaml
oc --context="$HUB_CONTEXT" apply -f kiali-istio-platform-federation.yaml
oc --context="$HUB_CONTEXT" get managedclusteraddon \
  multicluster-observability-addon -n "$MANAGED_CLUSTER_NAME" -o yaml
oc --context="$SPOKE_CONTEXT" get prometheusrule \
  kiali-istio-aggregation -n "$RULE_NAMESPACE"
```

## 6. Install Istio and expose its metrics on the spoke

Install Istio only on the spoke and set its multi-cluster name to
MANAGED_CLUSTER_NAME. Ambient mode is recommended:

```bash
oc config use-context "$SPOKE_CONTEXT"
./hack/istio/install-istio-via-sail.sh \
  --config-profile ambient \
  --cluster-name "$MANAGED_CLUSTER_NAME"
```

For sidecar-only mode, omit --config-profile ambient. Wait for istiod and,
when using Ambient, the ztunnel DaemonSet to be ready.

Create the Istio control-plane monitor on the spoke:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: istiod-monitor
  namespace: istio-system
spec:
  targetLabels: [app]
  selector:
    matchLabels:
      istio: pilot
  endpoints:
  - port: http-monitoring
    interval: 30s
```

Create a PodMonitor in every namespace containing sidecar workloads. A
namespace-local object is required because OpenShift UWM does not apply a
namespaceSelector to this use of PodMonitor:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: istio-proxies-monitor
  namespace: <workload-namespace>
spec:
  selector:
    matchExpressions:
    - key: istio-prometheus-ignore
      operator: DoesNotExist
  podMetricsEndpoints:
  - interval: 30s
    path: /stats/prometheus
    relabelings:
    - action: keep
      sourceLabels: [__meta_kubernetes_pod_container_name]
      regex: istio-proxy
    - action: keep
      sourceLabels: [__meta_kubernetes_pod_annotationpresent_prometheus_io_scrape]
    - action: replace
      regex: (\d+);(([A-Fa-f0-9]{1,4}::?){1,7}[A-Fa-f0-9]{1,4})
      replacement: '[$2]:$1'
      sourceLabels: [__meta_kubernetes_pod_annotation_prometheus_io_port, __meta_kubernetes_pod_ip]
      targetLabel: __address__
    - action: replace
      regex: (\d+);((([0-9]+?)(\.|$)){4})
      replacement: '$2:$1'
      sourceLabels: [__meta_kubernetes_pod_annotation_prometheus_io_port, __meta_kubernetes_pod_ip]
      targetLabel: __address__
    - sourceLabels: [__meta_kubernetes_pod_label_app_kubernetes_io_name, __meta_kubernetes_pod_label_app]
      separator: ";"
      targetLabel: app
      action: replace
      regex: "(.+);.*|.*;(.+)"
      replacement: "${1}${2}"
    - sourceLabels: [__meta_kubernetes_pod_label_app_kubernetes_io_version, __meta_kubernetes_pod_label_version]
      separator: ";"
      targetLabel: version
      action: replace
      regex: "(.+);.*|.*;(.+)"
      replacement: "${1}${2}"
    - action: replace
      regex: "(.+)"
      replacement: "${1}"
      sourceLabels: [__meta_kubernetes_pod_label_app_kubernetes_io_name]
      targetLabel: app_kubernetes_io_name
    - action: replace
      regex: "(.+)"
      replacement: "${1}"
      sourceLabels: [__meta_kubernetes_pod_label_app_kubernetes_io_version]
      targetLabel: app_kubernetes_io_version
    - action: replace
      sourceLabels: [__meta_kubernetes_namespace]
      targetLabel: namespace
    - action: replace
      replacement: <mesh-id>
      targetLabel: mesh_id
```

Use the actual mesh ID for `<mesh-id>`. The `app` and `version` relabelings
fall back to the legacy pod labels when the Kubernetes-style labels are not
present. The `app_kubernetes_io_name` and `app_kubernetes_io_version`
relabelings copy only the corresponding Kubernetes pod labels; they do not
derive those labels from `app` or `version`.

In Ambient mode, create the same PodMonitor in the namespace containing
ztunnel; that namespace is usually ztunnel or istio-system.

## 7. Optionally deploy traffic-generating applications

Deploy any two workloads that generate requests through the mesh. Label their
namespace for the selected data plane:

```bash
# Sidecar mode
oc --context="$SPOKE_CONTEXT" create namespace test-sidecar-app
oc --context="$SPOKE_CONTEXT" label namespace test-sidecar-app \
  istio-injection=enabled --overwrite

# Ambient mode
oc --context="$SPOKE_CONTEXT" create namespace test-ambient-app
oc --context="$SPOKE_CONTEXT" label namespace test-ambient-app \
  istio.io/dataplane-mode=ambient --overwrite
```

Deploy the applications, add their namespaces to the set of monitored
namespaces, and wait for traffic. Raw counters should appear first in spoke
UWM Prometheus, then workload: recording series, and finally unprefixed series
in hub Thanos.

## 8. Install centralized Kiali on the hub

Kiali needs an ACM Observatorium client certificate and the CA that signed the
Observatorium API route. Create its namespace and copy the client credentials:

```bash
oc --context="$HUB_CONTEXT" create namespace "$KIALI_NAMESPACE" \
  --dry-run=client -o yaml | oc --context="$HUB_CONTEXT" apply -f -
umask 077
oc --context="$HUB_CONTEXT" get secret observability-grafana-certs \
  -n "$OBSERVABILITY_NAMESPACE" \
  -o jsonpath='{.data.tls\.crt}' | base64 -d > /tmp/acm-tls.crt
oc --context="$HUB_CONTEXT" get secret observability-grafana-certs \
  -n "$OBSERVABILITY_NAMESPACE" \
  -o jsonpath='{.data.tls\.key}' | base64 -d > /tmp/acm-tls.key
oc --context="$HUB_CONTEXT" create secret generic acm-observability-certs \
  -n "$KIALI_NAMESPACE" --from-file=tls.crt=/tmp/acm-tls.crt \
  --from-file=tls.key=/tmp/acm-tls.key --dry-run=client -o yaml | \
  oc --context="$HUB_CONTEXT" apply -f -
rm -f /tmp/acm-tls.crt /tmp/acm-tls.key
```

Inspect the Observatorium route certificate to choose the matching CA:

```bash
OBS_HOST=$(oc --context="$HUB_CONTEXT" get route observatorium-api \
  -n "$OBSERVABILITY_NAMESPACE" -o jsonpath='{.spec.host}')
echo | openssl s_client -connect "${OBS_HOST}:443" -servername "${OBS_HOST}" \
  -showcerts 2>/dev/null | openssl x509 -noout -issuer
```

Use observability-server-ca-certs when the issuer contains
observability-server-ca-certificate; otherwise use
observability-client-ca-certs when it contains
observability-client-ca-certificate:

```bash
oc --context="$HUB_CONTEXT" get secret observability-server-ca-certs \
  -n "$OBSERVABILITY_NAMESPACE" -o jsonpath='{.data.ca\.crt}' | base64 -d \
  > /tmp/acm-ca.pem
oc --context="$HUB_CONTEXT" create configmap kiali-cabundle \
  -n "$KIALI_NAMESPACE" --from-file=additional-ca-bundle.pem=/tmp/acm-ca.pem \
  --dry-run=client -o yaml | oc --context="$HUB_CONTEXT" apply -f -
rm -f /tmp/acm-ca.pem
```

Install Kiali using the Kiali Helm chart or operator available in the
environment. Its configuration must contain these values:

```bash
APPS_DOMAIN=$(oc --context="$HUB_CONTEXT" get ingresses.config.openshift.io cluster \
  -o jsonpath='{.spec.domain}')
export OBSERVATORIUM_URL="https://observatorium-api-${OBSERVABILITY_NAMESPACE}.${APPS_DOMAIN}/api/metrics/v1/default"
```

For an operator-managed Kiali resource:

```yaml
apiVersion: kiali.io/v1alpha1
kind: Kiali
metadata:
  name: kiali
  namespace: istio-system
spec:
  clustering:
    ignore_home_cluster: true
  external_services:
    prometheus:
      url: <observatorium-url>
      auth:
        type: none
        cert_file: secret:acm-observability-certs:tls.crt
        key_file: secret:acm-observability-certs:tls.key
      thanos_proxy:
        enabled: true
        retention_period: 14d
        scrape_interval: 5m
  kubernetes_config:
    cluster_name: kiali-management
```

`kiali-management` is Kiali's home-cluster identity. Keep it different from
MANAGED_CLUSTER_NAME. `ignore_home_cluster` prevents Kiali from treating the
hub, which is outside the mesh, as an Istio cluster.

Create remote-cluster access on the spoke before opening Kiali. The remote
access needs a service account, ClusterRole/ClusterRoleBinding, and a
service-account token Secret. Read-only access is preferable. For OpenShift
authentication, create an OAuth client with this callback URI:

```text
https://kiali-<kiali-namespace>.<hub-apps-domain>/api/auth/callback/<spoke-managed-cluster-name>
```

The Kiali server chart can render these spoke-side resources without deploying
another Kiali server. Render it with the `remote_cluster_resources_only` setting and
apply the result to the spoke. Use `view_only_mode=false` only when write access
is intentional:

```bash
KIALI_ROUTE="https://kiali-${KIALI_NAMESPACE}.${APPS_DOMAIN}"
helm template kiali-remote kiali-server --repo https://kiali.org/helm-charts \
  --namespace "$KIALI_NAMESPACE" \
  --set isOpenShift=true \
  --set deployment.remote_cluster_resources_only=true \
  --set deployment.instance_name=kiali \
  --set deployment.cluster_wide_access=true \
  --set deployment.view_only_mode=true \
  --set auth.strategy=openshift \
  --set-string "auth.openshift.redirect_uris[0]=${KIALI_ROUTE}/api/auth/callback/${MANAGED_CLUSTER_NAME}" \
  | oc --context="$SPOKE_CONTEXT" apply -f -
```

Create a token Secret for the rendered service account. Kubernetes fills in
the token and CA data after the Secret is created:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kiali
  namespace: istio-system
  annotations:
    kubernetes.io/service-account.name: kiali
type: kubernetes.io/service-account-token
```

```bash
oc --context="$SPOKE_CONTEXT" apply -f kiali-service-account-token.yaml
oc --context="$SPOKE_CONTEXT" get secret kiali -n "$KIALI_NAMESPACE" -w
```

Create a labeled Secret in the Kiali namespace on the hub containing a
kubeconfig for that service account:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: kiali-remote-cluster-secret-<spoke-managed-cluster-name>
  namespace: istio-system
  labels:
    kiali.io/multiCluster: "true"
  annotations:
    kiali.io/cluster: <spoke-managed-cluster-name>
data:
  <spoke-managed-cluster-name>: <base64-encoded-kubeconfig>
```

The kubeconfig must contain the spoke API server URL, its CA data, and the
service-account token. Restart Kiali if its deployment did not reload the
new volume. Sign in to the spoke once from Kiali's user menu using
Login to `<spoke-managed-cluster-name>` so the normal OpenShift OAuth session is
established.

To expose Kiali's own metrics, create a hub ServiceMonitor for its HTTPS
tcp-metrics endpoint. Use the OpenShift service CA:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: kiali
  namespace: istio-system
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: kiali
  namespaceSelector:
    matchNames: [istio-system]
  endpoints:
  - port: tcp-metrics
    scheme: https
    interval: 30s
    relabelings:
    - action: replace
      regex: "(.+);.*|.*;(.+)"
      replacement: "${1}${2}"
      separator: ";"
      sourceLabels:
      - __meta_kubernetes_service_label_app_kubernetes_io_name
      - __meta_kubernetes_service_label_app
      targetLabel: app
    - action: replace
      regex: "(.+)"
      replacement: "${1}"
      sourceLabels:
      - __meta_kubernetes_service_label_app_kubernetes_io_name
      targetLabel: app_kubernetes_io_name
    - action: replace
      regex: "(.+);.*|.*;(.+)"
      replacement: "${1}${2}"
      separator: ";"
      sourceLabels:
      - __meta_kubernetes_service_label_app_kubernetes_io_version
      - __meta_kubernetes_service_label_version
      targetLabel: version
    - action: replace
      regex: "(.+)"
      replacement: "${1}"
      sourceLabels:
      - __meta_kubernetes_service_label_app_kubernetes_io_version
      targetLabel: app_kubernetes_io_version
    tlsConfig:
      ca:
        configMap:
          name: kiali-cabundle-openshift
          key: service-ca.crt
      serverName: kiali.istio-system.svc
```

The `app` and `version` relabelings use the legacy service labels as a
fallback. The `app_kubernetes_io_name` and `app_kubernetes_io_version`
relabelings copy only the corresponding Kubernetes service labels.

Create a namespace-local recording rule on the hub for Kiali's self-metrics.
The ServiceMonitor stores raw `kiali_*` samples in hub UWM Prometheus, but the
MCOA federation ScrapeConfig selects the prefixed `kiali:kiali_*` recording
series. The recording rule is therefore the bridge between the Kiali scrape
and the existing federation path.

Use the Kiali namespace for the rule so that its namespace selector matches
the namespace where the Kiali ServiceMonitor discovers the service. The
`leaf-prometheus` label is required by the hub UWM Prometheus rule selector;
without it, Kubernetes accepts the object but UWM does not load the rule.
The `kiali:` prefix is an edge-only name. The federation ScrapeConfig removes
that prefix before storing the series in Thanos, where Kiali queries names
such as `kiali_graph_nodes`.

Create `kiali-hub-aggregation.yaml` with the Kiali self-metric rules. Include
the complete set of rules from
`prometheus/federation/kiali-metrics-recording-rules.yml`; these examples show
the aggregation shape for counters, gauges, and histogram components:

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: kiali-hub-aggregation
  namespace: <kiali-namespace>
  labels:
    app.kubernetes.io/component: user-workload-metrics-collector
    openshift.io/prometheus-rule-evaluation-scope: leaf-prometheus
spec:
  groups:
  - name: kiali.aggregation
    interval: 30s
    rules:
    # Counters are additive when Kiali has multiple replicas.
    - record: kiali:kiali_api_failures_total
      expr: sum without (pod, pod_template_hash, instance, job, node) (kiali_api_failures_total)
    - record: kiali:kiali_cache_hits_total
      expr: sum without (pod, pod_template_hash, instance, job, node) (kiali_cache_hits_total)
    # Gauges are deduplicated across Kiali replicas.
    - record: kiali:kiali_graph_nodes
      expr: max without (pod, pod_template_hash, instance, job, node) (kiali_graph_nodes)
    - record: kiali:kiali_health_status
      expr: max without (pod, pod_template_hash, instance, job, node) (kiali_health_status)
    # Keep all histogram bucket, sum, and count components.
    - record: kiali:kiali_api_processing_duration_seconds_bucket
      expr: sum without (pod, pod_template_hash, instance, job, node) (kiali_api_processing_duration_seconds_bucket)
    - record: kiali:kiali_api_processing_duration_seconds_sum
      expr: sum without (pod, pod_template_hash, instance, job, node) (kiali_api_processing_duration_seconds_sum)
    - record: kiali:kiali_api_processing_duration_seconds_count
      expr: sum without (pod, pod_template_hash, instance, job, node) (kiali_api_processing_duration_seconds_count)
```

For each additional Kiali counter or gauge, preserve the same recording-name
prefix and aggregation labels. For histogram metrics, record `_bucket`,
`_sum`, and `_count` separately. Use `sum without (...)` for counters and
histogram components, and `max without (...)` for gauges that represent one
current Kiali state. The full rule file contains the remaining Kiali metrics.

Apply the rule on the hub and confirm that UWM has loaded it:

```bash
oc --context="$HUB_CONTEXT" apply -f kiali-hub-aggregation.yaml
oc --context="$HUB_CONTEXT" get prometheusrule kiali-hub-aggregation \
  -n "$KIALI_NAMESPACE"

PROM_POD=$(oc --context="$HUB_CONTEXT" \
  -n openshift-user-workload-monitoring get pods \
  -l app.kubernetes.io/name=prometheus -o jsonpath='{.items[0].metadata.name}')
oc --context="$HUB_CONTEXT" -n openshift-user-workload-monitoring \
  exec -c prometheus "$PROM_POD" -- curl -sG \
  --data-urlencode 'query=count({__name__=~"kiali:kiali_.*"})' \
  http://localhost:9090/api/v1/query | jq '.data.result'
```

The count should be non-zero. If it is zero, check that the rule has the
`openshift.io/prometheus-rule-evaluation-scope: leaf-prometheus` label and
that the raw Kiali metrics are present:

```bash
oc --context="$HUB_CONTEXT" -n openshift-user-workload-monitoring \
  exec -c prometheus "$PROM_POD" -- curl -sG \
  --data-urlencode 'query=kiali_graph_nodes' \
  http://localhost:9090/api/v1/query | jq '.data.result'
```

After the next MCOA collection interval, verify the unprefixed series in
Thanos:

```bash
oc --context="$HUB_CONTEXT" get --raw \
  "/api/v1/namespaces/${OBSERVABILITY_NAMESPACE}/services/http:observability-thanos-query-frontend:9090/proxy/api/v1/query?query=kiali_graph_nodes%7Bcluster%3D%22local-cluster%22%7D" \
  | jq '.data.result'
```

## 9. Validate the metrics path

```bash
oc --context="$HUB_CONTEXT" get mch -n "$ACM_NAMESPACE"
oc --context="$HUB_CONTEXT" get mco observability
oc --context="$HUB_CONTEXT" get managedcluster "$MANAGED_CLUSTER_NAME"
oc --context="$HUB_CONTEXT" get managedclusteraddon \
  multicluster-observability-addon -n "$MANAGED_CLUSTER_NAME"
oc --context="$SPOKE_CONTEXT" get prometheusrule \
  kiali-istio-aggregation -n "$RULE_NAMESPACE"
```

Generate traffic before querying. Each query should return a non-empty result:

```bash
PROM_POD=$(oc --context="$SPOKE_CONTEXT" \
  -n openshift-user-workload-monitoring get pods \
  -l app.kubernetes.io/name=prometheus -o jsonpath='{.items[0].metadata.name}')

# Raw Istio counters on the spoke.
oc --context="$SPOKE_CONTEXT" -n openshift-user-workload-monitoring \
  exec -c prometheus "$PROM_POD" -- wget -qO- \
  'http://localhost:9090/api/v1/query?query=istio_requests_total' | jq '.data.result'

# Edge recording rules on the spoke.
oc --context="$SPOKE_CONTEXT" -n openshift-user-workload-monitoring \
  exec -c prometheus "$PROM_POD" -- wget -qO- \
  'http://localhost:9090/api/v1/query?query=workload%3Aistio_requests_total' | jq '.data.result'

# Federated series in hub Thanos.
oc --context="$HUB_CONTEXT" get --raw \
  "/api/v1/namespaces/${OBSERVABILITY_NAMESPACE}/services/http:observability-thanos-query-frontend:9090/proxy/api/v1/query?query=istio_requests_total%7Bcluster%3D%22${MANAGED_CLUSTER_NAME}%22%7D" \
  | jq '.data.result'
```

The hub collection interval is five minutes. New workloads commonly need two
collection intervals before rate-based panels become useful. Compare presence
and approximate values rather than exact point-in-time equality.

### Verify Waypoint Metrics in Kiali

For ambient traffic that is routed through a waypoint, Kiali displays the
waypoint's HTTP/L7 metrics on the application workloads and services involved
in the request. It does not generally display application traffic on the
waypoint workload's own inbound and outbound metric tabs. Those tabs are mainly
useful for checking the waypoint status, enrolled services and workloads, and
Envoy details.

After generating traffic through the waypoint, use these Kiali views:

1. **Destination workload → Inbound Metrics**: shows HTTP/L7 traffic received
   by the destination workload through the waypoint. For example, open
   `test-ambient-backend` → **Inbound Metrics**.
2. **Source workload → Outbound Metrics**: shows HTTP/L7 traffic sent from the
   source workload through the waypoint. For example, open
   `test-ambient-frontend` → **Outbound Metrics**.
3. **Destination service → Inbound Metrics**: shows inbound traffic for the
   destination Service, for example `test-ambient-backend` → **Inbound Metrics**.
4. **Traffic Graph → Traffic → Waypoint**: filters the graph to the waypoint's
   L7 HTTP edges. Select **Ztunnel** to see the separate L4/TCP edges, or
   **Total** to see both.

Seeing both a waypoint edge and a ztunnel edge is expected in ambient mode.
The waypoint provides HTTP details such as response codes and latency, while
ztunnel provides L4/TCP telemetry. If the Kiali views are empty, confirm that
the hub query for `istio_requests_total{reporter="waypoint"}` returns a result,
then allow another ACM collection cycle for the metrics to reach hub Thanos.

## Troubleshooting

For a spoke that does not join:

```bash
oc --context="$HUB_CONTEXT" get managedcluster "$MANAGED_CLUSTER_NAME" -o yaml
oc --context="$HUB_CONTEXT" get secret auto-import-secret \
  -n "$MANAGED_CLUSTER_NAME"
oc --context="$SPOKE_CONTEXT" get klusterlet
oc --context="$SPOKE_CONTEXT" get pods -n open-cluster-management-agent
```

For observability and MCOA readiness:

```bash
oc --context="$HUB_CONTEXT" get mco observability -o yaml
oc --context="$HUB_CONTEXT" get clustermanagementaddon \
  multicluster-observability-addon -o yaml
oc --context="$HUB_CONTEXT" get managedclusteraddon \
  multicluster-observability-addon -n "$MANAGED_CLUSTER_NAME" -o yaml
```

If raw Istio metrics are absent, check that the ServiceMonitor and every
namespace-local PodMonitor selects the intended targets. If raw metrics are
present but workload: series are absent, inspect the propagated PrometheusRule
and verify that mesh-observability is exempt from UWM label enforcement. If
edge recording series are present but hub series are absent, check the MCOA
placement references and both ScrapeConfig resources.

## Removing the installation

Remove components in reverse dependency order:

1. Stop traffic and remove demo applications.
2. Remove Kiali's remote-cluster Secret, spoke permissions,
   `OAuthClient/kiali-<kiali-namespace>` on the spoke, Kiali, its hub
   ServiceMonitor, and the hub Kiali PrometheusRule.
3. Remove Istio monitors and Istio from the spoke.
4. Remove the three MCOA source objects and their placement configs entries.
5. Delete the spoke Klusterlet, wait for ACM agent namespaces to disappear,
   then delete the hub ManagedCluster and its namespace.
6. Delete MultiClusterObservability, the Thanos Secret, SeaweedFS, and the
   observability namespace.
7. Delete MultiClusterHub and the ACM subscription after dependents terminate.

Do not delete a pre-existing cluster-monitoring-config or
user-workload-monitoring-config wholesale. Remove only settings and namespaces
added for this topology, preserving unrelated monitoring configuration.

The spoke OAuthClient is cluster-scoped. The remote-access helper uses
`helm template` to generate the Kiali chart's remote-cluster YAML and then
applies that YAML with `oc`; it does not create a Helm release on the spoke.
Therefore, `helm uninstall kiali -n <kiali-namespace>` does not remove the
OAuthClient. The wrapper's `uninstall` command deletes it explicitly. If
cleanup is performed manually, run:

```bash
oc --context="$SPOKE_CONTEXT" delete oauthclient \
  "kiali-${KIALI_NAMESPACE}" --ignore-not-found
```

## Additional resources

- [ACM 2.17 observability documentation](https://docs.redhat.com/en/documentation/red_hat_advanced_cluster_management_for_kubernetes/2.17/html/observability/index)
- [Kiali ACM observability guidance](https://kiali.io/docs/configuration/multi-cluster/acm-observability/)
- [Core MCOA recording rules](prometheus/federation/core-recording-rules.yml)
- [Kiali recording rules](prometheus/federation/kiali-metrics-recording-rules.yml)
