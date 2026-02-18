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
    [--restart-kiali <true|false>]

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
ALLOW_SKIP_TLS_VERIFY="false"
RESTART_KIALI="true"

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
    --prometheus-thanos-url) PROM_THANO_URL="$2"; shift 2 ;;
    --allow-skip-tls-verify) ALLOW_SKIP_TLS_VERIFY="$2"; shift 2 ;;
    --restart-kiali) RESTART_KIALI="$2"; shift 2 ;;
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

apply_yaml() {
  local context="$1"
  local yaml="$2"
  echo "${yaml}" | oc --context "${context}" apply -f -
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

info "=== Step 1: Enable user workload monitoring in both clusters ==="
enable_user_workload_monitoring "${CTX_CLUSTER1}"
enable_user_workload_monitoring "${CTX_CLUSTER2}"

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
