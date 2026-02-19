#!/bin/bash

##############################################################################
# install-ambient-multicluster-openshift.sh
#
# Installs/configures Kiali Ambient for OpenShift multi-cluster.
#
# This script automates the manual steps described in:
# - Enable user workload monitoring (both clusters)
# - Enable telemetry scraping (both clusters)
# - Create ServiceMonitor for istiod (both clusters)
# - Create PodMonitor for Istio proxy metrics (selected namespaces, both clusters)
# - Install Kiali CR in cluster1 (full Kiali)
# - Install Kiali CR in cluster2 (remote cluster resources only + OAuth redirect URI)
# - Create SA token secret in cluster2 for Kiali remote access
# - Create the remote cluster secret in cluster1 (using kiali-prepare-remote-cluster.sh)
# - Restart Kiali deployment in cluster1
#
# Prerequisites:
# - Istio Ambient already installed on both clusters
# - Kiali Operator already installed on both clusters (Kiali CRD must exist)
# - You are logged in and have kube contexts for both clusters in your kubeconfig
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

info() {
  echo "[INFO] $*"
}

error() {
  echo "[ERROR] $*" >&2
  exit 1
}

require_bin() {
  command -v "$1" &>/dev/null || error "Missing required executable in PATH: $1"
}

usage() {
  cat <<'EOF'
Usage:
  ./hack/istio/multicluster/install-ambient-multicluster-openshift.sh \
    --cluster1-context <ctx> \
    --cluster2-context <ctx> \
    [--remote-cluster-name <name>] \
    [--mesh-id <mesh_id>] \
    [--istio-namespace <ns>] \
    [--kiali-name <name>] \
    [--kiali-service-account <sa_name>] \
    [--monitored-namespaces <csv>] \
    [--prometheus-thanos-url <url>] \
    [--allow-skip-tls-verify <true|false>] \
    [--restart-kiali <true|false>] \
    [--global-metrics <true|false>] \
    [--deploy-thanos <true|false>] \
    [--thanos-namespace <ns>] \
    [--thanos-receive-route-host <host>] \
    [--remote-write-filter-regex <regex>] \
    [--disable-cluster-monitoring-remote-write <true|false>] \
    [--restart-prometheus <true|false>] \
    [--label-namespaces-for-uwm <true|false>]

Required:
  --cluster1-context         Kube context of the "home" cluster (where Kiali UI runs)
  --cluster2-context         Kube context of the remote cluster

Optional:
  --remote-cluster-name      Name for the remote cluster inside Kiali (default: cluster2)
  --mesh-id                  mesh_id label to attach to scraped metrics (default: mesh1)
  --istio-namespace          Namespace where Istio is installed (default: istio-system)
  --kiali-name               Kiali CR name (default: kiali)
  --kiali-service-account    ServiceAccount to use for remote access on cluster2 (default: kiali-service-account)
  --monitored-namespaces     CSV namespaces where PodMonitor will be created (default: bookinfo,istio-system,sample,ztunnel)
  --prometheus-thanos-url    Thanos Querier URL (default: https://thanos-querier.openshift-monitoring.svc.cluster.local:9091)
  --allow-skip-tls-verify    Passed to kiali-prepare-remote-cluster.sh if needed (default: false)
  --restart-kiali            Restart Kiali deployment on cluster1 at the end (default: true)
  --global-metrics           Configure a "global metrics" setup using Thanos Receive+Query in cluster1 and remote_write
                            from both clusters. This helps Kiali see metrics from multiple clusters from a single endpoint.
                            Default: false
  --deploy-thanos            If true (and --global-metrics true), deploy a minimal Thanos Receive+Query stack in cluster1.
                            Default: false
  --thanos-namespace         Namespace where Thanos is (or will be) deployed in cluster1. Default: thanos
  --thanos-receive-route-host If set, use this host for remote_write from cluster2 (https://<host>/api/v1/receive).
                            If empty, the script will look up Route 'thanos-receive' in the Thanos namespace.
                            Default: <auto>
  --remote-write-filter-regex Regex used to reduce what is exported via remote_write (avoid MemoryPressure/evictions).
                            Default: istio_.*|envoy_.*|up
  --disable-cluster-monitoring-remote-write If true, remove/avoid remote_write on prometheus-k8s (cluster monitoring) in both clusters
                            to prevent exporting the whole platform metrics set. Default: true
  --restart-prometheus       If true, restart Prometheus statefulsets after config changes. Default: true
  --label-namespaces-for-uwm If true, label monitored namespaces with openshift.io/user-monitoring=true in both clusters. Default: true

Example:
  CTX_CLUSTER1='default/api-...:6443/kube:admin'
  CTX_CLUSTER2='default/api-...:6443/kube:admin'
  ./hack/istio/multicluster/install-ambient-multicluster-openshift.sh \
    --cluster1-context "${CTX_CLUSTER1}" \
    --cluster2-context "${CTX_CLUSTER2}" \
    --remote-cluster-name cluster2 \
    --mesh-id mesh1
EOF
}

CTX_CLUSTER1=""
CTX_CLUSTER2=""
REMOTE_CLUSTER_NAME="cluster2"
MESH_ID="mesh1"
ISTIO_NAMESPACE="istio-system"
KIALI_NAME="kiali"
KIALI_SERVICE_ACCOUNT="kiali-service-account"
MONITORED_NAMESPACES_CSV="bookinfo,istio-system,sample,ztunnel"
PROM_THANO_URL="https://thanos-querier.openshift-monitoring.svc.cluster.local:9091"
PROM_THANO_URL_EXPLICIT="false"
ALLOW_SKIP_TLS_VERIFY="false"
RESTART_KIALI="true"

GLOBAL_METRICS="false"
DEPLOY_THANOS="false"
THANOS_NAMESPACE="thanos"
THANOS_RECEIVE_ROUTE_HOST=""
REMOTE_WRITE_FILTER_REGEX='istio_.*|envoy_.*|up'
DISABLE_CLUSTER_MONITORING_REMOTE_WRITE="true"
RESTART_PROMETHEUS="true"
LABEL_NAMESPACES_FOR_UWM="true"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cluster1-context) CTX_CLUSTER1="$2"; shift 2 ;;
    --cluster2-context) CTX_CLUSTER2="$2"; shift 2 ;;
    --remote-cluster-name) REMOTE_CLUSTER_NAME="$2"; shift 2 ;;
    --mesh-id) MESH_ID="$2"; shift 2 ;;
    --istio-namespace) ISTIO_NAMESPACE="$2"; shift 2 ;;
    --kiali-name) KIALI_NAME="$2"; shift 2 ;;
    --kiali-service-account) KIALI_SERVICE_ACCOUNT="$2"; shift 2 ;;
    --monitored-namespaces) MONITORED_NAMESPACES_CSV="$2"; shift 2 ;;
    --prometheus-thanos-url) PROM_THANO_URL="$2"; PROM_THANO_URL_EXPLICIT="true"; shift 2 ;;
    --allow-skip-tls-verify) ALLOW_SKIP_TLS_VERIFY="$2"; shift 2 ;;
    --restart-kiali) RESTART_KIALI="$2"; shift 2 ;;
    --global-metrics) GLOBAL_METRICS="$2"; shift 2 ;;
    --deploy-thanos) DEPLOY_THANOS="$2"; shift 2 ;;
    --thanos-namespace) THANOS_NAMESPACE="$2"; shift 2 ;;
    --thanos-receive-route-host) THANOS_RECEIVE_ROUTE_HOST="$2"; shift 2 ;;
    --remote-write-filter-regex) REMOTE_WRITE_FILTER_REGEX="$2"; shift 2 ;;
    --disable-cluster-monitoring-remote-write) DISABLE_CLUSTER_MONITORING_REMOTE_WRITE="$2"; shift 2 ;;
    --restart-prometheus) RESTART_PROMETHEUS="$2"; shift 2 ;;
    --label-namespaces-for-uwm) LABEL_NAMESPACES_FOR_UWM="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) error "Unknown option: $1 (use --help)" ;;
  esac
done

[[ -n "${CTX_CLUSTER1}" ]] || { usage; error "--cluster1-context is required"; }
[[ -n "${CTX_CLUSTER2}" ]] || { usage; error "--cluster2-context is required"; }

if [[ "${ALLOW_SKIP_TLS_VERIFY}" != "true" && "${ALLOW_SKIP_TLS_VERIFY}" != "false" ]]; then
  error "--allow-skip-tls-verify must be true or false"
fi
if [[ "${RESTART_KIALI}" != "true" && "${RESTART_KIALI}" != "false" ]]; then
  error "--restart-kiali must be true or false"
fi
if [[ "${GLOBAL_METRICS}" != "true" && "${GLOBAL_METRICS}" != "false" ]]; then
  error "--global-metrics must be true or false"
fi
if [[ "${DEPLOY_THANOS}" != "true" && "${DEPLOY_THANOS}" != "false" ]]; then
  error "--deploy-thanos must be true or false"
fi
if [[ "${DISABLE_CLUSTER_MONITORING_REMOTE_WRITE}" != "true" && "${DISABLE_CLUSTER_MONITORING_REMOTE_WRITE}" != "false" ]]; then
  error "--disable-cluster-monitoring-remote-write must be true or false"
fi
if [[ "${RESTART_PROMETHEUS}" != "true" && "${RESTART_PROMETHEUS}" != "false" ]]; then
  error "--restart-prometheus must be true or false"
fi
if [[ "${LABEL_NAMESPACES_FOR_UWM}" != "true" && "${LABEL_NAMESPACES_FOR_UWM}" != "false" ]]; then
  error "--label-namespaces-for-uwm must be true or false"
fi

require_bin oc
require_bin base64

if ! oc config get-contexts "${CTX_CLUSTER1}" &>/dev/null; then
  error "Cluster1 context not found in kubeconfig: ${CTX_CLUSTER1}"
fi
if ! oc config get-contexts "${CTX_CLUSTER2}" &>/dev/null; then
  error "Cluster2 context not found in kubeconfig: ${CTX_CLUSTER2}"
fi

if ! oc --context "${CTX_CLUSTER1}" get crd kialis.kiali.io &>/dev/null; then
  error "Kiali CRD not found in cluster1. Install Kiali Operator first (missing CRD kialis.kiali.io)."
fi
if ! oc --context "${CTX_CLUSTER2}" get crd kialis.kiali.io &>/dev/null; then
  error "Kiali CRD not found in cluster2. Install Kiali Operator first (missing CRD kialis.kiali.io)."
fi

# If global metrics is enabled and user didn't explicitly set the Prometheus URL,
# point Kiali to the global Thanos Query service deployed in cluster1.
if [[ "${GLOBAL_METRICS}" == "true" && "${PROM_THANO_URL_EXPLICIT}" == "false" ]]; then
  PROM_THANO_URL="http://thanos-query.${THANOS_NAMESPACE}.svc.cluster.local:9090"
fi

apply_yaml() {
  local context="$1"
  local yaml="$2"
  echo "${yaml}" | oc --context "${context}" apply -f -
}

label_namespaces_for_uwm() {
  local context="$1"
  shift
  local namespaces=("$@")

  for ns in "${namespaces[@]}"; do
    if [[ -z "${ns}" ]]; then
      continue
    fi
    oc --context "${context}" label namespace "${ns}" openshift.io/user-monitoring=true --overwrite >/dev/null 2>&1 || true
  done
}

deploy_thanos_global_cluster1() {
  info "Deploying minimal Thanos Receive+Query in cluster1 (namespace: ${THANOS_NAMESPACE})"

  oc --context "${CTX_CLUSTER1}" create namespace "${THANOS_NAMESPACE}" --dry-run=client -o yaml | oc --context "${CTX_CLUSTER1}" apply -f -

  # Minimal Receive+Query. IMPORTANT: Receive requires external labels (see Thanos docs).
  # This is intentionally minimal/hack-oriented; production setups should use a proper Helm chart and storage backend.
  cat <<EOF | oc --context "${CTX_CLUSTER1}" -n "${THANOS_NAMESPACE}" apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: thanos-receive-data
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: thanos-receive
spec:
  replicas: 1
  selector:
    matchLabels:
      app: thanos-receive
  template:
    metadata:
      labels:
        app: thanos-receive
    spec:
      containers:
      - name: thanos-receive
        image: quay.io/thanos/thanos:v0.37.2
        args:
        - receive
        - --log.level=info
        - --label=receive_cluster="cluster1"
        - --label=receive_replica="0"
        - --tsdb.path=/var/thanos/receive
        - --grpc-address=0.0.0.0:10901
        - --http-address=0.0.0.0:10902
        - --remote-write.address=0.0.0.0:19291
        ports:
        - name: grpc
          containerPort: 10901
        - name: http
          containerPort: 10902
        - name: remote
          containerPort: 19291
        volumeMounts:
        - name: data
          mountPath: /var/thanos/receive
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: thanos-receive-data
---
apiVersion: v1
kind: Service
metadata:
  name: thanos-receive
spec:
  selector:
    app: thanos-receive
  ports:
  - name: grpc
    port: 10901
    targetPort: grpc
  - name: http
    port: 10902
    targetPort: http
  - name: remote
    port: 19291
    targetPort: remote
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: thanos-query
spec:
  replicas: 1
  selector:
    matchLabels:
      app: thanos-query
  template:
    metadata:
      labels:
        app: thanos-query
    spec:
      containers:
      - name: thanos-query
        image: quay.io/thanos/thanos:v0.37.2
        args:
        - query
        - --log.level=info
        - --http-address=0.0.0.0:9090
        - --grpc-address=0.0.0.0:10901
        - --store=thanos-receive.${THANOS_NAMESPACE}.svc.cluster.local:10901
        ports:
        - name: http
          containerPort: 9090
        - name: grpc
          containerPort: 10901
---
apiVersion: v1
kind: Service
metadata:
  name: thanos-query
spec:
  selector:
    app: thanos-query
  ports:
  - name: http
    port: 9090
    targetPort: http
EOF

  oc --context "${CTX_CLUSTER1}" -n "${THANOS_NAMESPACE}" rollout status deployment/thanos-receive --timeout=10m || true
  oc --context "${CTX_CLUSTER1}" -n "${THANOS_NAMESPACE}" rollout status deployment/thanos-query --timeout=10m || true

  oc --context "${CTX_CLUSTER1}" -n "${THANOS_NAMESPACE}" create route edge thanos-receive --service=thanos-receive --port=remote --insecure-policy=Redirect >/dev/null 2>&1 || true
}

configure_global_metrics_remote_write() {
  info "Configuring remote_write to Thanos Receive (global metrics) (filter: ${REMOTE_WRITE_FILTER_REGEX})"

  local receive_url_cluster1="http://thanos-receive.${THANOS_NAMESPACE}.svc.cluster.local:19291/api/v1/receive"

  local receive_host="${THANOS_RECEIVE_ROUTE_HOST}"
  if [[ -z "${receive_host}" ]]; then
    receive_host="$(oc --context "${CTX_CLUSTER1}" -n "${THANOS_NAMESPACE}" get route thanos-receive -o jsonpath='{.spec.host}' 2>/dev/null || true)"
  fi
  if [[ -z "${receive_host}" ]]; then
    error "Unable to determine Thanos Receive Route host in cluster1. Create it first or pass --thanos-receive-route-host."
  fi
  local receive_url_cluster2="https://${receive_host}/api/v1/receive"

  info "Thanos Receive URL for cluster1 (in-cluster): ${receive_url_cluster1}"
  info "Thanos Receive URL for cluster2 (route): ${receive_url_cluster2}"

  # Reduce cardinality to avoid MemoryPressure/evictions: keep only Istio/Envoy and basic 'up'.
  # NOTE: these patches overwrite the full config.yaml content in their respective ConfigMaps.

  if [[ "${DISABLE_CLUSTER_MONITORING_REMOTE_WRITE}" == "true" ]]; then
    info "Disabling cluster-monitoring remote_write (prometheus-k8s) in both clusters to avoid exporting platform metrics"
    oc --context "${CTX_CLUSTER1}" -n openshift-monitoring patch cm cluster-monitoring-config --type=merge -p "$(cat <<EOF
{"data":{"config.yaml":"enableUserWorkload: true\nprometheusK8s:\n  externalLabels:\n    cluster_name: cluster1\n"}}
EOF
)"
    oc --context "${CTX_CLUSTER2}" -n openshift-monitoring patch cm cluster-monitoring-config --type=merge -p "$(cat <<EOF
{"data":{"config.yaml":"enableUserWorkload: true\nprometheusK8s:\n  externalLabels:\n    cluster_name: cluster2\n"}}
EOF
)"
  fi

  info "Configuring UWM remote_write in both clusters"
  oc --context "${CTX_CLUSTER1}" -n openshift-user-workload-monitoring patch cm user-workload-monitoring-config --type=merge -p "$(cat <<EOF
{"data":{"config.yaml":"prometheus:\n  externalLabels:\n    cluster_name: cluster1\n  remoteWrite:\n  - url: ${receive_url_cluster1}\n    writeRelabelConfigs:\n    - sourceLabels: [__name__]\n      regex: \"${REMOTE_WRITE_FILTER_REGEX}\"\n      action: keep\n"}}
EOF
)"

  oc --context "${CTX_CLUSTER2}" -n openshift-user-workload-monitoring patch cm user-workload-monitoring-config --type=merge -p "$(cat <<EOF
{"data":{"config.yaml":"prometheus:\n  externalLabels:\n    cluster_name: cluster2\n  remoteWrite:\n  - url: ${receive_url_cluster2}\n    tlsConfig:\n      insecureSkipVerify: true\n    writeRelabelConfigs:\n    - sourceLabels: [__name__]\n      regex: \"${REMOTE_WRITE_FILTER_REGEX}\"\n      action: keep\n"}}
EOF
)"

  if [[ "${RESTART_PROMETHEUS}" == "true" ]]; then
    info "Restarting Prometheus statefulsets to apply remote_write configuration"
    oc --context "${CTX_CLUSTER1}" -n openshift-user-workload-monitoring rollout restart sts/prometheus-user-workload || true
    oc --context "${CTX_CLUSTER2}" -n openshift-user-workload-monitoring rollout restart sts/prometheus-user-workload || true

    if [[ "${DISABLE_CLUSTER_MONITORING_REMOTE_WRITE}" == "true" ]]; then
      oc --context "${CTX_CLUSTER1}" -n openshift-monitoring rollout restart sts/prometheus-k8s || true
      oc --context "${CTX_CLUSTER2}" -n openshift-monitoring rollout restart sts/prometheus-k8s || true
    fi
  fi
}

enable_user_workload_monitoring() {
  local context="$1"
  info "Enabling user workload monitoring on context: ${context}"
  apply_yaml "${context}" "$(cat <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-monitoring-config
  namespace: openshift-monitoring
data:
  config.yaml: |
    enableUserWorkload: true
EOF
)"
}

apply_telemetry_prometheus() {
  local context="$1"
  info "Applying Telemetry resource (prometheus metrics) on context: ${context}"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: telemetry.istio.io/v1
kind: Telemetry
metadata:
  name: enable-prometheus-metrics
  namespace: ${ISTIO_NAMESPACE}
spec:
  metrics:
  - providers:
    - name: prometheus
EOF
)"
}

apply_istiod_service_monitor() {
  local context="$1"
  info "Applying ServiceMonitor (istiod) on context: ${context}"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: istiod-monitor
  namespace: ${ISTIO_NAMESPACE}
spec:
  targetLabels:
  - app
  selector:
    matchLabels:
      istio: pilot
  endpoints:
  - port: http-monitoring
    path: /metrics
    interval: 30s
    relabelings:
    - action: replace
      replacement: "${MESH_ID}"
      targetLabel: mesh_id
EOF
)"
}

apply_istio_proxies_pod_monitor() {
  local context="$1"
  local ns="$2"
  info "Applying PodMonitor (istio-proxy) in namespace [${ns}] on context: ${context}"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: istio-proxies-monitor
  namespace: ${ns}
spec:
  selector:
    matchExpressions:
    - key: istio-prometheus-ignore
      operator: DoesNotExist
  podMetricsEndpoints:
  - path: /stats/prometheus
    interval: 30s
    relabelings:
    - action: keep
      sourceLabels: [__meta_kubernetes_pod_container_name]
      regex: "istio-proxy"
    - action: keep
      sourceLabels: [__meta_kubernetes_pod_annotationpresent_prometheus_io_scrape]
    - action: replace
      regex: (\\d+);(([A-Fa-f0-9]{1,4}::?){1,7}[A-Fa-f0-9]{1,4})
      replacement: '[\$2]:\$1'
      sourceLabels: [__meta_kubernetes_pod_annotation_prometheus_io_port, __meta_kubernetes_pod_ip]
      targetLabel: __address__
    - action: replace
      regex: (\\d+);((([0-9]+?)(\\.|$)){4})
      replacement: \$2:\$1
      sourceLabels: [__meta_kubernetes_pod_annotation_prometheus_io_port, __meta_kubernetes_pod_ip]
      targetLabel: __address__
    - sourceLabels: ["__meta_kubernetes_pod_label_app_kubernetes_io_name", "__meta_kubernetes_pod_label_app"]
      separator: ";"
      targetLabel: "app"
      action: replace
      regex: "(.+);.*|.*;(.+)"
      replacement: \${1}\${2}
    - sourceLabels: ["__meta_kubernetes_pod_label_app_kubernetes_io_version", "__meta_kubernetes_pod_label_version"]
      separator: ";"
      targetLabel: "version"
      action: replace
      regex: "(.+);.*|.*;(.+)"
      replacement: \${1}\${2}
    - sourceLabels: [__meta_kubernetes_namespace]
      action: replace
      targetLabel: namespace
    - action: replace
      replacement: "${MESH_ID}"
      targetLabel: mesh_id
EOF
)"
}

apply_kiali_cluster1() {
  local context="$1"
  info "Installing Kiali CR in cluster1 (context: ${context})"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: kiali.io/v1alpha1
kind: Kiali
metadata:
  name: ${KIALI_NAME}
  namespace: ${ISTIO_NAMESPACE}
spec:
  version: default
  external_services:
    prometheus:
      auth:
        type: bearer
        use_kiali_token: true
      thanos_proxy:
        enabled: true
      url: ${PROM_THANO_URL}
EOF
)"
}

wait_for_kiali_route_host() {
  local context="$1"
  local ns="$2"
  local route_name="$3"
  local host=""

  # IMPORTANT: this function is used inside command substitution ($( ... )).
  # It must print ONLY the route host to stdout. Any logs must go to stderr.
  echo "[INFO] Waiting for route [${route_name}] in namespace [${ns}] on context [${context}]" >&2
  for i in {1..60}; do
    host="$(oc --context "${context}" -n "${ns}" get route "${route_name}" -o jsonpath='{.spec.host}' 2>/dev/null || true)"
    if [[ -n "${host}" ]]; then
      echo -n "${host}"
      return 0
    fi
    sleep 5
  done
  return 1
}

apply_kiali_cluster2_remote_only() {
  local context="$1"
  local redirect_route_host="$2"
  info "Installing Kiali CR in cluster2 (remote resources only) (context: ${context})"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: kiali.io/v1alpha1
kind: Kiali
metadata:
  name: ${KIALI_NAME}
  namespace: ${ISTIO_NAMESPACE}
spec:
  version: default
  auth:
    openshift:
      redirect_uris:
      - "https://${redirect_route_host}/api/auth/callback/${REMOTE_CLUSTER_NAME}"
  deployment:
    remote_cluster_resources_only: true
EOF
)"
}

apply_cluster1_monitoring_rbac() {
  local context="$1"
  info "Applying cluster monitoring RBAC for Kiali in cluster1 (context: ${context})"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: kiali-monitoring-rbac
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-monitoring-view
subjects:
- kind: ServiceAccount
  name: ${KIALI_SERVICE_ACCOUNT}
  namespace: ${ISTIO_NAMESPACE}
EOF
)"
}

create_cluster2_sa_token_secret() {
  local context="$1"
  info "Ensuring ServiceAccount [${ISTIO_NAMESPACE}/${KIALI_SERVICE_ACCOUNT}] exists in cluster2 (context: ${context})"
  if ! oc --context "${context}" -n "${ISTIO_NAMESPACE}" get sa "${KIALI_SERVICE_ACCOUNT}" &>/dev/null; then
    info "ServiceAccount not found - creating it: ${ISTIO_NAMESPACE}/${KIALI_SERVICE_ACCOUNT}"
    apply_yaml "${context}" "$(cat <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${KIALI_SERVICE_ACCOUNT}
  namespace: ${ISTIO_NAMESPACE}
EOF
)"
  fi

  info "Creating ServiceAccount token secret [${ISTIO_NAMESPACE}/${KIALI_SERVICE_ACCOUNT}] in cluster2 (context: ${context})"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: "${KIALI_SERVICE_ACCOUNT}"
  namespace: "${ISTIO_NAMESPACE}"
  annotations:
    kubernetes.io/service-account.name: "${KIALI_SERVICE_ACCOUNT}"
type: kubernetes.io/service-account-token
EOF
)"

  info "Waiting for token data to be populated in secret [${ISTIO_NAMESPACE}/${KIALI_SERVICE_ACCOUNT}] on cluster2"
  for i in {1..150}; do
    local token
    token="$(oc --context "${context}" -n "${ISTIO_NAMESPACE}" get secret "${KIALI_SERVICE_ACCOUNT}" -o jsonpath='{.data.token}' 2>/dev/null || true)"
    if [[ -n "${token}" ]]; then
      return 0
    fi
    sleep 2
  done

  info "Token was not generated automatically. Attempting to generate token via 'oc create token' and patch the secret."
  local created_token=""
  created_token="$(oc --context "${context}" -n "${ISTIO_NAMESPACE}" create token "${KIALI_SERVICE_ACCOUNT}" 2>/dev/null || true)"
  if [[ -z "${created_token}" ]]; then
    created_token="$(oc --context "${context}" -n "${ISTIO_NAMESPACE}" create token "${KIALI_SERVICE_ACCOUNT}" --duration=24h 2>/dev/null || true)"
  fi

  if [[ -n "${created_token}" ]]; then
    local encoded
    encoded="$(printf '%s' "${created_token}" | base64 --wrap=0)"
    oc --context "${context}" -n "${ISTIO_NAMESPACE}" patch secret "${KIALI_SERVICE_ACCOUNT}" --type merge -p "{\"data\":{\"token\":\"${encoded}\"}}" >/dev/null
  fi

  local final_token
  final_token="$(oc --context "${context}" -n "${ISTIO_NAMESPACE}" get secret "${KIALI_SERVICE_ACCOUNT}" -o jsonpath='{.data.token}' 2>/dev/null || true)"
  if [[ -n "${final_token}" ]]; then
    info "Token is now present in secret [${ISTIO_NAMESPACE}/${KIALI_SERVICE_ACCOUNT}]"
    return 0
  fi

  info "Debug: ServiceAccount and Secret status (cluster2)"
  oc --context "${context}" -n "${ISTIO_NAMESPACE}" get sa "${KIALI_SERVICE_ACCOUNT}" -o yaml || true
  oc --context "${context}" -n "${ISTIO_NAMESPACE}" get secret "${KIALI_SERVICE_ACCOUNT}" -o yaml || true
  error "Token was not generated for secret [${ISTIO_NAMESPACE}/${KIALI_SERVICE_ACCOUNT}] in cluster2"
}

prepare_remote_cluster_secret_in_cluster1() {
  local script="${SCRIPT_DIR}/kiali-prepare-remote-cluster.sh"
  [[ -f "${script}" ]] || error "Missing script: ${script}"

  info "Creating remote cluster secret in cluster1 using kiali-prepare-remote-cluster.sh"
  "${script}" \
    -c oc \
    --kiali-cluster-context "${CTX_CLUSTER1}" \
    --remote-cluster-context "${CTX_CLUSTER2}" \
    --view-only false \
    --kiali-resource-name "${KIALI_SERVICE_ACCOUNT}" \
    --remote-cluster-namespace "${ISTIO_NAMESPACE}" \
    --process-kiali-secret true \
    --process-remote-resources false \
    --remote-cluster-name "${REMOTE_CLUSTER_NAME}" \
    --allow-skip-tls-verify "${ALLOW_SKIP_TLS_VERIFY}"
}

restart_kiali_cluster1() {
  local context="$1"
  info "Restarting Kiali deployment in cluster1 (context: ${context})"
  oc --context "${context}" -n "${ISTIO_NAMESPACE}" rollout restart deployment/kiali
  oc --context "${context}" -n "${ISTIO_NAMESPACE}" rollout status deployment/kiali --timeout=5m
}

info "=== SETTINGS ==="
info "CTX_CLUSTER1=${CTX_CLUSTER1}"
info "CTX_CLUSTER2=${CTX_CLUSTER2}"
info "REMOTE_CLUSTER_NAME=${REMOTE_CLUSTER_NAME}"
info "MESH_ID=${MESH_ID}"
info "ISTIO_NAMESPACE=${ISTIO_NAMESPACE}"
info "KIALI_NAME=${KIALI_NAME}"
info "KIALI_SERVICE_ACCOUNT=${KIALI_SERVICE_ACCOUNT}"
info "MONITORED_NAMESPACES=${MONITORED_NAMESPACES_CSV}"
info "PROM_THANO_URL=${PROM_THANO_URL}"
info "ALLOW_SKIP_TLS_VERIFY=${ALLOW_SKIP_TLS_VERIFY}"
info "RESTART_KIALI=${RESTART_KIALI}"
info "GLOBAL_METRICS=${GLOBAL_METRICS}"
info "DEPLOY_THANOS=${DEPLOY_THANOS}"
info "THANOS_NAMESPACE=${THANOS_NAMESPACE}"
info "THANOS_RECEIVE_ROUTE_HOST=${THANOS_RECEIVE_ROUTE_HOST}"
info "REMOTE_WRITE_FILTER_REGEX=${REMOTE_WRITE_FILTER_REGEX}"
info "DISABLE_CLUSTER_MONITORING_REMOTE_WRITE=${DISABLE_CLUSTER_MONITORING_REMOTE_WRITE}"
info "RESTART_PROMETHEUS=${RESTART_PROMETHEUS}"
info "LABEL_NAMESPACES_FOR_UWM=${LABEL_NAMESPACES_FOR_UWM}"

info "=== Step 1: Enable user workload monitoring in both clusters ==="
enable_user_workload_monitoring "${CTX_CLUSTER1}"
enable_user_workload_monitoring "${CTX_CLUSTER2}"

if [[ "${LABEL_NAMESPACES_FOR_UWM}" == "true" ]]; then
  info "Labeling monitored namespaces for User Workload Monitoring in both clusters"
  IFS=',' read -r -a monitored_ns_arr_for_labels <<< "${MONITORED_NAMESPACES_CSV}"
  label_namespaces_for_uwm "${CTX_CLUSTER1}" "${monitored_ns_arr_for_labels[@]}"
  label_namespaces_for_uwm "${CTX_CLUSTER2}" "${monitored_ns_arr_for_labels[@]}"
fi

if [[ "${GLOBAL_METRICS}" == "true" ]]; then
  info "=== Step 1b: Global metrics (optional) ==="
  if [[ "${DEPLOY_THANOS}" == "true" ]]; then
    deploy_thanos_global_cluster1
  fi
  configure_global_metrics_remote_write
fi

info "=== Step 2: Apply Telemetry (enable Prometheus metrics) in both clusters ==="
apply_telemetry_prometheus "${CTX_CLUSTER1}"
apply_telemetry_prometheus "${CTX_CLUSTER2}"

info "=== Step 3: Create istiod ServiceMonitor in both clusters (mesh_id=${MESH_ID}) ==="
apply_istiod_service_monitor "${CTX_CLUSTER1}"
apply_istiod_service_monitor "${CTX_CLUSTER2}"

info "=== Step 4: Create istio-proxy PodMonitors in both clusters ==="
IFS=',' read -r -a monitored_ns_arr <<< "${MONITORED_NAMESPACES_CSV}"
for ns in "${monitored_ns_arr[@]}"; do
  if [[ -z "${ns}" ]]; then
    continue
  fi
  apply_istio_proxies_pod_monitor "${CTX_CLUSTER1}" "${ns}"
  apply_istio_proxies_pod_monitor "${CTX_CLUSTER2}" "${ns}"
done

info "=== Step 5: Install Kiali in cluster1 (full) ==="
apply_kiali_cluster1 "${CTX_CLUSTER1}"

info "Waiting for Kiali deployment to become ready on cluster1 (best effort)"
oc --context "${CTX_CLUSTER1}" -n "${ISTIO_NAMESPACE}" rollout status deployment/kiali --timeout=10m || \
  info "Kiali deployment rollout status did not complete (operator may still be reconciling)"

info "=== Step 6: Determine cluster1 Kiali route hostname ==="
KIALI_ROUTE_HOST="$(wait_for_kiali_route_host "${CTX_CLUSTER1}" "${ISTIO_NAMESPACE}" "kiali" || true)"
if [[ -z "${KIALI_ROUTE_HOST}" ]]; then
  error "Could not determine Kiali route host on cluster1. Ensure the operator created Route 'kiali' in ${ISTIO_NAMESPACE}."
fi
info "Cluster1 Kiali route host: ${KIALI_ROUTE_HOST}"

info "=== Step 7: Install Kiali in cluster2 (remote resources only) with redirect URI ==="
apply_kiali_cluster2_remote_only "${CTX_CLUSTER2}" "${KIALI_ROUTE_HOST}"

info "=== Step 8: Apply monitoring RBAC in cluster1 for Kiali SA ==="
apply_cluster1_monitoring_rbac "${CTX_CLUSTER1}"

info "=== Step 9: Enable remote access (cluster2 SA token secret + cluster1 remote secret) ==="
create_cluster2_sa_token_secret "${CTX_CLUSTER2}"
prepare_remote_cluster_secret_in_cluster1

if [[ "${RESTART_KIALI}" == "true" ]]; then
  info "=== Step 10: Restart Kiali in cluster1 ==="
  restart_kiali_cluster1 "${CTX_CLUSTER1}"
fi

info "=== DONE ==="
info "Kiali home cluster route: https://${KIALI_ROUTE_HOST}"
info "Remote cluster name configured as: ${REMOTE_CLUSTER_NAME}"
