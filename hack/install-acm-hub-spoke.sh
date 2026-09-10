#!/usr/bin/env bash

# Install a two-cluster ACM lab environment for centralized Kiali metrics. (requires ACM 2.17 or later)
#
# Topology:
#   - Spoke: Istio mesh workloads and UWM scrape raw istio_* into edge Prometheus.
#   - Hub: ACM Observatorium/Thanos stores federated metrics; optional Kiali UI.
#
# MCOA on the spoke edge aggregates traffic with namespace-scoped recording
# rules, federates selected metrics to the hub, and Kiali (when installed)
# queries Observatorium there.
# The caller's current kubeconfig context is never changed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

COMMAND="install"
HUB_CONTEXT=""
SPOKE_CONTEXT=""
SPOKE_NAME=""
ACM_CHANNEL="release-2.17"
ACM_NAMESPACE="open-cluster-management"
OBSERVABILITY_NAMESPACE="open-cluster-management-observability"
COO_CHANNEL="stable"
COO_NAMESPACE="openshift-cluster-observability-operator"
TARGET_NAMESPACES="istio-system"
RULE_NAMESPACE="istio-system"
PLACEMENT_NAME=""
PLACEMENT_NAMESPACE=""
MINIO_ACCESS_KEY="minio"
MINIO_SECRET_KEY="minio123"
WITH_DASHBOARDS=false
INSTALL_ISTIO=false
INSTALL_KIALI=false
INSTALL_DEMO_APPS=false
AMBIENT=true
SIDECAR_APP_NAMESPACE="test-sidecar-app"
AMBIENT_APP_NAMESPACE="test-ambient-app"
KIALI_NAMESPACE="istio-system"
KIALI_INSTALL_TYPE="helm-server"
KIALI_CLUSTER_NAME="kiali-management"
KIALI_REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
KIALI_OPERATOR_REPO_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)/kiali-operator"
HELM_CHARTS_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)/helm-charts"
SKIP_BUILD=false
REMOTE_VIEW_ONLY=false
ALLOW_SKIP_TLS_VERIFY=false
TRAFFIC_COUNT=10
TRAFFIC_INTERVAL=1
TRAFFIC_CONTINUOUS=false
TIMEOUT=1200
VERBOSE=false
REMOVE_UWM_CONFIG=false
TMP_DIR=""
HUB_KUBECONFIG=""
SPOKE_KUBECONFIG=""
MULTICLUSTER_KUBECONFIG=""

usage() {
  cat <<'EOF'
Usage:
  install-acm-hub-spoke.sh [COMMAND] --hub-context CONTEXT --spoke-context CONTEXT [options]

Commands:
  install        Reconcile ACM and federation infrastructure (default).
  install-istio  Reconcile infrastructure and install Istio on the spoke.
  install-kiali  Reconcile infrastructure and install Kiali on the hub;
                 requires Istio to exist on the spoke.
  install-demo-apps
                 Install the sidecar and, in Ambient mode, Ambient demo apps.
  install-all    Reconcile infrastructure, Istio, Kiali, and demo apps.
  traffic-sidecar
                 Send additional traffic through the sidecar demo.
  traffic-ambient
                 Send additional traffic through the Ambient demo.
  verify         Verify the selected setup without changing either cluster.
  status         Show component status without changing either cluster.
  uninstall      Remove the complete environment from both clusters.

Required options:
  --hub-context CONTEXT          Existing kubeconfig context for the ACM hub.
  --spoke-context CONTEXT        Existing kubeconfig context for the managed cluster.

Options:
  --spoke-name NAME              ACM ManagedCluster, Kiali remote-cluster, and Istio
                                 multi-cluster name (default: spoke context name).
  --acm-channel CHANNEL          ACM subscription channel (default: release-2.17).
  --acm-namespace NS             ACM operator namespace.
  --observability-namespace NS   ACM observability namespace.
  --coo-channel CHANNEL          Cluster Observability Operator channel (default: stable).
  --coo-namespace NS             Cluster Observability Operator namespace.
  --target-namespaces NS[,NS...] Namespaces for platform CPU/memory federation.
                                 List every mesh/control-plane namespace whose
                                 CPU/memory Kiali must show. Must include
                                 --rule-namespace. Ambient Istio installation
                                 automatically adds ztunnel.
  --rule-namespace NS            Compatibility/default recording-rule namespace
                                 that must be in the target set (default: istio-system).
  --placement-name NAME          MCOA placement to configure. Required if MCOA has
                                 more than one placement.
  --placement-namespace NS       Namespace of --placement-name.
  --minio-access-key KEY         Development MinIO access key (default: minio).
  --minio-secret-key KEY         Development MinIO secret key (default: minio123).
  --with-dashboards              Include the optional Istio dashboard metric tier.
  --install-istio                Install Istio and its metrics monitors on the spoke.
  --install-kiali                Install Kiali on the hub and grant it spoke access.
  --install-demo-apps            Install sidecar and Ambient demo applications.
  --full                         Install Istio, Kiali, and the demo applications.
  --ambient true|false           Enable Istio ambient mode (default: true).
  --sidecar-app-namespace NS     Sidecar demo namespace (default: test-sidecar-app).
  --ambient-app-namespace NS     Ambient demo namespace (default: test-ambient-app).
  --traffic-count COUNT          Requests for a traffic command (default: 10).
  --traffic-interval SECONDS     Delay between requests (default: 1).
  --traffic-continuous           Generate traffic until interrupted.
  --kiali-namespace NS           Kiali namespace on the hub (default: istio-system).
  --kiali-install-type TYPE      helm-server, olm-operator, or helm-operator.
  --kiali-cluster-name NAME      Kiali's external home-cluster name (default:
                                 kiali-management). This is a Kiali identity,
                                 not an ACM ManagedCluster or Istio cluster name.
  --kiali-repo-dir PATH          Kiali source repository path.
  --kiali-operator-repo-dir PATH Kiali operator source repository path.
  --helm-charts-dir PATH         Kiali Helm charts repository path.
  --skip-build                   Reuse existing local Kiali build artifacts.
  --remote-view-only true|false  Kiali spoke permissions (default: false).
  --allow-skip-tls-verify        Allow the Kiali spoke connection to skip TLS
                                 verification if its kubeconfig does so.
  --timeout SECONDS              Timeout for each readiness boundary (default: 1200).
  --remove-uwm-config            On uninstall, remove cluster-monitoring-config even
                                 when it predates or is not labeled by this wrapper.
  -v, --verbose                  Print additional progress details.
  -h, --help                     Show this help.

The base install is idempotent: it enables UWM, ACM/Observatorium, COO, and the
MCOA federation path so raw Istio metrics stay on the spoke UWM Prometheus while
Kiali (when installed) reads federated series from hub Observatorium. Add --full
for an Istio spoke, centralized Kiali, and continuously generating demo apps.

For a standalone verify command, repeat the installation's --full/component,
--target-namespaces, --rule-namespace, placement, and --with-dashboards options.
EOF
}

info() {
  echo "[INFO] $*"
}

debug() {
  if [ "${VERBOSE}" = true ]; then
    echo "[DEBUG] $*"
  fi
}

die() {
  echo "[ERROR] $*" >&2
  exit 1
}

cleanup() {
  if [ -n "${TMP_DIR}" ] && [ -d "${TMP_DIR}" ]; then
    rm -rf -- "${TMP_DIR}"
  fi
}
trap cleanup EXIT

oc_hub() {
  command oc --context="${HUB_CONTEXT}" "$@"
}

oc_spoke() {
  command oc --context="${SPOKE_CONTEXT}" "$@"
}

wait_until() {
  local description=$1
  shift
  local started=${SECONDS}

  info "Waiting for ${description}..."
  until "$@"; do
    if [ $((SECONDS - started)) -ge "${TIMEOUT}" ]; then
      die "Timed out after ${TIMEOUT}s waiting for ${description}"
    fi
    sleep 10
  done
  info "${description} is ready"
}

require_value() {
  local option=$1 value=${2-}
  [ -n "${value}" ] || die "${option} requires a value"
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      install|verify|status|traffic-sidecar|traffic-ambient) COMMAND="$1"; shift ;;
      uninstall)
        COMMAND=uninstall
        INSTALL_ISTIO=true
        INSTALL_KIALI=true
        INSTALL_DEMO_APPS=true
        shift
        ;;
      install-istio) COMMAND=install; INSTALL_ISTIO=true; shift ;;
      install-kiali) COMMAND=install; INSTALL_KIALI=true; shift ;;
      install-demo-apps) COMMAND=install-demo-apps; INSTALL_DEMO_APPS=true; shift ;;
      install-all)
        COMMAND=install
        INSTALL_ISTIO=true
        INSTALL_KIALI=true
        INSTALL_DEMO_APPS=true
        shift
        ;;
      --hub-context) require_value "$1" "${2-}"; HUB_CONTEXT=$2; shift 2 ;;
      --spoke-context) require_value "$1" "${2-}"; SPOKE_CONTEXT=$2; shift 2 ;;
      --spoke-name) require_value "$1" "${2-}"; SPOKE_NAME=$2; shift 2 ;;
      --acm-channel) require_value "$1" "${2-}"; ACM_CHANNEL=$2; shift 2 ;;
      --acm-namespace) require_value "$1" "${2-}"; ACM_NAMESPACE=$2; shift 2 ;;
      --observability-namespace) require_value "$1" "${2-}"; OBSERVABILITY_NAMESPACE=$2; shift 2 ;;
      --coo-channel) require_value "$1" "${2-}"; COO_CHANNEL=$2; shift 2 ;;
      --coo-namespace) require_value "$1" "${2-}"; COO_NAMESPACE=$2; shift 2 ;;
      --target-namespaces) require_value "$1" "${2-}"; TARGET_NAMESPACES=$2; shift 2 ;;
      --rule-namespace) require_value "$1" "${2-}"; RULE_NAMESPACE=$2; shift 2 ;;
      --placement-name) require_value "$1" "${2-}"; PLACEMENT_NAME=$2; shift 2 ;;
      --placement-namespace) require_value "$1" "${2-}"; PLACEMENT_NAMESPACE=$2; shift 2 ;;
      --minio-access-key) require_value "$1" "${2-}"; MINIO_ACCESS_KEY=$2; shift 2 ;;
      --minio-secret-key) require_value "$1" "${2-}"; MINIO_SECRET_KEY=$2; shift 2 ;;
      --with-dashboards) WITH_DASHBOARDS=true; shift ;;
      --install-istio) INSTALL_ISTIO=true; shift ;;
      --install-kiali) INSTALL_KIALI=true; shift ;;
      --install-demo-apps) INSTALL_DEMO_APPS=true; shift ;;
      --full) INSTALL_ISTIO=true; INSTALL_KIALI=true; INSTALL_DEMO_APPS=true; shift ;;
      --ambient) require_value "$1" "${2-}"; AMBIENT=$2; shift 2 ;;
      --sidecar-app-namespace) require_value "$1" "${2-}"; SIDECAR_APP_NAMESPACE=$2; shift 2 ;;
      --ambient-app-namespace) require_value "$1" "${2-}"; AMBIENT_APP_NAMESPACE=$2; shift 2 ;;
      --traffic-count) require_value "$1" "${2-}"; TRAFFIC_COUNT=$2; shift 2 ;;
      --traffic-interval) require_value "$1" "${2-}"; TRAFFIC_INTERVAL=$2; shift 2 ;;
      --traffic-continuous) TRAFFIC_CONTINUOUS=true; shift ;;
      --kiali-namespace) require_value "$1" "${2-}"; KIALI_NAMESPACE=$2; shift 2 ;;
      --kiali-install-type) require_value "$1" "${2-}"; KIALI_INSTALL_TYPE=$2; shift 2 ;;
      --kiali-cluster-name) require_value "$1" "${2-}"; KIALI_CLUSTER_NAME=$2; shift 2 ;;
      --kiali-repo-dir) require_value "$1" "${2-}"; KIALI_REPO_DIR=$2; shift 2 ;;
      --kiali-operator-repo-dir) require_value "$1" "${2-}"; KIALI_OPERATOR_REPO_DIR=$2; shift 2 ;;
      --helm-charts-dir) require_value "$1" "${2-}"; HELM_CHARTS_DIR=$2; shift 2 ;;
      --skip-build) SKIP_BUILD=true; shift ;;
      --remote-view-only) require_value "$1" "${2-}"; REMOTE_VIEW_ONLY=$2; shift 2 ;;
      --allow-skip-tls-verify) ALLOW_SKIP_TLS_VERIFY=true; shift ;;
      --timeout) require_value "$1" "${2-}"; TIMEOUT=$2; shift 2 ;;
      --remove-uwm-config) REMOVE_UWM_CONFIG=true; shift ;;
      -v|--verbose) VERBOSE=true; shift ;;
      -h|--help) usage; exit 0 ;;
      *) die "Unknown argument: $1" ;;
    esac
  done
}

validate_namespace() {
  local namespace=$1
  [ "${#namespace}" -le 63 ] || die "Kubernetes namespace is longer than 63 characters: ${namespace}"
  [[ "${namespace}" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]] || \
    die "Invalid Kubernetes namespace: ${namespace}"
}

target_namespace_list_contains() {
  local needle=$1 namespace
  local -a namespaces
  IFS=',' read -ra namespaces <<< "${TARGET_NAMESPACES}"
  for namespace in "${namespaces[@]}"; do
    [ "${namespace}" = "${needle}" ] && return 0
  done
  return 1
}

append_target_namespace() {
  local namespace=$1
  target_namespace_list_contains "${namespace}" || \
    TARGET_NAMESPACES="${TARGET_NAMESPACES:+${TARGET_NAMESPACES},}${namespace}"
}

discover_ztunnel_namespace() {
  if oc_spoke get daemonset ztunnel -n ztunnel >/dev/null 2>&1; then
    printf 'ztunnel'
  elif oc_spoke get daemonset ztunnel -n istio-system >/dev/null 2>&1; then
    printf 'istio-system'
  else
    return 1
  fi
}

normalize_target_namespaces() {
  local namespace result="" ztunnel_namespace
  local -a namespaces
  declare -A seen=()

  IFS=',' read -ra namespaces <<< "${TARGET_NAMESPACES}"
  [ "${#namespaces[@]}" -gt 0 ] || die "--target-namespaces cannot be empty"
  for namespace in "${namespaces[@]}"; do
    namespace=${namespace// /}
    [ -n "${namespace}" ] || die "--target-namespaces contains an empty namespace"
    validate_namespace "${namespace}"
    [ -z "${seen[${namespace}]:-}" ] || continue
    seen[${namespace}]=1
    result="${result:+${result},}${namespace}"
  done
  TARGET_NAMESPACES=${result}

  # Platform CPU/memory federation is namespace-filtered. Include the namespace
  # that the Ambient installation will create on the first MCOA pass.
  if [ "${INSTALL_DEMO_APPS}" = true ]; then
    append_target_namespace "${SIDECAR_APP_NAMESPACE}"
    if [ "${AMBIENT}" = true ]; then
      append_target_namespace "${AMBIENT_APP_NAMESPACE}"
    fi
  fi
  if [ "${AMBIENT}" = true ] && \
    { [ "${INSTALL_ISTIO}" = true ] || [ "${INSTALL_DEMO_APPS}" = true ]; }; then
    ztunnel_namespace=$(discover_ztunnel_namespace || true)
    if [ -n "${ztunnel_namespace}" ] && \
      ! target_namespace_list_contains "${ztunnel_namespace}"; then
      append_target_namespace "${ztunnel_namespace}"
      info "Adding ${ztunnel_namespace} to platform metrics target namespaces for Ambient Istio"
    elif [ -z "${ztunnel_namespace}" ] && [ "${INSTALL_ISTIO}" = true ]; then
      debug "Deferring ztunnel namespace federation until Istio is installed"
    fi
  fi
}

validate_args() {
  command -v oc >/dev/null || die "oc is required"
  command -v jq >/dev/null || die "jq is required"
  [ -x "${SCRIPT_DIR}/install-acm.sh" ] || die "Missing executable: ${SCRIPT_DIR}/install-acm.sh"
  [ -x "${SCRIPT_DIR}/configure-acm-mcoa.sh" ] || die "Missing executable: ${SCRIPT_DIR}/configure-acm-mcoa.sh"
  [ -n "${HUB_CONTEXT}" ] || die "--hub-context is required"
  [ -n "${SPOKE_CONTEXT}" ] || die "--spoke-context is required"
  [ "${HUB_CONTEXT}" != "${SPOKE_CONTEXT}" ] || die "Hub and spoke contexts must be different"
  [ -n "${KIALI_CLUSTER_NAME}" ] || die "--kiali-cluster-name is required"
  [ "${KIALI_CLUSTER_NAME}" != "${SPOKE_NAME}" ] || \
    die "--kiali-cluster-name must differ from the spoke's Kiali cluster name (${SPOKE_NAME})"
  [[ "${TIMEOUT}" =~ ^[1-9][0-9]*$ ]] || die "--timeout must be a positive integer"
  [[ "${TRAFFIC_COUNT}" =~ ^[1-9][0-9]*$ ]] || die "--traffic-count must be a positive integer"
  [[ "${TRAFFIC_INTERVAL}" =~ ^[0-9]+([.][0-9]+)?$ ]] || die "--traffic-interval must be a non-negative number"
  case "${AMBIENT}" in true|false) ;; *) die "--ambient must be true or false" ;; esac
  case "${REMOTE_VIEW_ONLY}" in true|false) ;; *) die "--remote-view-only must be true or false" ;; esac
  case "${KIALI_INSTALL_TYPE}" in
    helm-server|olm-operator|helm-operator) ;;
    *) die "--kiali-install-type must be helm-server, olm-operator, or helm-operator" ;;
  esac
  if { [ "${COMMAND}" = install ] || [ "${COMMAND}" = uninstall ]; } && \
    { [ "${INSTALL_ISTIO}" = true ] || [ "${INSTALL_KIALI}" = true ]; }; then
    command -v helm >/dev/null || die "helm is required for the optional Istio/Kiali installation"
  fi
  if [ "${COMMAND}" = install ] && [ "${INSTALL_ISTIO}" = true ]; then
    command -v kubectl >/dev/null || die "kubectl is required by the Istio installer"
    command -v yq >/dev/null || die "yq is required by the Istio installer"
    command -v curl >/dev/null || die "curl is required by the Istio installer"
  fi
  if [ "${COMMAND}" = install ] && [ "${INSTALL_KIALI}" = true ]; then
    command -v openssl >/dev/null || die "openssl is required by the Kiali ACM authentication setup"
    [ -x "${SCRIPT_DIR}/istio/multicluster/kiali-prepare-remote-cluster.sh" ] || \
      die "Missing Kiali remote-cluster helper"
    case "${KIALI_INSTALL_TYPE}" in
      helm-server)
        command -v make >/dev/null || die "make is required for --kiali-install-type helm-server"
        command -v podman >/dev/null || die "podman is required for --kiali-install-type helm-server"
        [ -d "${KIALI_REPO_DIR}" ] || die "Kiali repository not found: ${KIALI_REPO_DIR}"
        [ -d "${HELM_CHARTS_DIR}" ] || die "Helm charts repository not found: ${HELM_CHARTS_DIR}"
        ;;
      helm-operator)
        command -v make >/dev/null || die "make is required for --kiali-install-type helm-operator"
        command -v podman >/dev/null || die "podman is required for --kiali-install-type helm-operator"
        [ -d "${KIALI_REPO_DIR}" ] || die "Kiali repository not found: ${KIALI_REPO_DIR}"
        [ -d "${KIALI_OPERATOR_REPO_DIR}" ] || die "Kiali operator repository not found: ${KIALI_OPERATOR_REPO_DIR}"
        [ -d "${HELM_CHARTS_DIR}" ] || die "Helm charts repository not found: ${HELM_CHARTS_DIR}"
        ;;
    esac
  fi
  [ -z "${PLACEMENT_NAMESPACE}" ] || [ -n "${PLACEMENT_NAME}" ] || \
    die "--placement-namespace requires --placement-name"

  if [ -z "${SPOKE_NAME}" ]; then
    SPOKE_NAME=${SPOKE_CONTEXT}
  fi

  if [ "${SPOKE_NAME}" = "${SPOKE_CONTEXT}" ] && \
    { [ "${#SPOKE_NAME}" -gt 63 ] || ! [[ "${SPOKE_NAME}" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]]; }; then
    die "Spoke context '${SPOKE_CONTEXT}' is not a valid Kubernetes namespace; pass --spoke-name with a valid ACM ManagedCluster name"
  fi
  validate_namespace "${SPOKE_NAME}"
  validate_namespace "${ACM_NAMESPACE}"
  validate_namespace "${OBSERVABILITY_NAMESPACE}"
  validate_namespace "${COO_NAMESPACE}"
  validate_namespace "${KIALI_NAMESPACE}"
  validate_namespace "${RULE_NAMESPACE}"
  validate_namespace "${SIDECAR_APP_NAMESPACE}"
  validate_namespace "${AMBIENT_APP_NAMESPACE}"
  normalize_target_namespaces
  target_namespace_list_contains "${RULE_NAMESPACE}" || \
    die "--rule-namespace (${RULE_NAMESPACE}) must appear in --target-namespaces"

  oc config get-contexts "${HUB_CONTEXT}" -o name 2>/dev/null | grep -Fxq "${HUB_CONTEXT}" || \
    die "Kubeconfig context not found: ${HUB_CONTEXT}"
  oc config get-contexts "${SPOKE_CONTEXT}" -o name 2>/dev/null | grep -Fxq "${SPOKE_CONTEXT}" || \
    die "Kubeconfig context not found: ${SPOKE_CONTEXT}"
}

prepare_temporary_kubeconfigs() {
  umask 077
  TMP_DIR=$(mktemp -d)
  HUB_KUBECONFIG="${TMP_DIR}/hub.yaml"
  SPOKE_KUBECONFIG="${TMP_DIR}/spoke.yaml"
  MULTICLUSTER_KUBECONFIG="${TMP_DIR}/hub-spoke.yaml"
  oc config view --raw --context="${HUB_CONTEXT}" --minify --flatten > "${HUB_KUBECONFIG}"
  oc config view --raw --context="${SPOKE_CONTEXT}" --minify --flatten > "${SPOKE_KUBECONFIG}"
  KUBECONFIG="${HUB_KUBECONFIG}:${SPOKE_KUBECONFIG}" \
    oc config view --raw --flatten > "${MULTICLUSTER_KUBECONFIG}"
}

select_temporary_context() {
  local context=$1
  KUBECONFIG="${MULTICLUSTER_KUBECONFIG}" oc config use-context "${context}" >/dev/null
}

check_cluster_access() {
  local role=$1 context=$2 identity allowed
  identity=$(oc --context="${context}" whoami) || die "Cannot connect to ${role} context '${context}'"
  allowed=$(oc --context="${context}" auth can-i create namespaces --all-namespaces) || \
    die "Cannot check permissions on ${role} context '${context}'"
  [ "${allowed}" = yes ] || die "Cluster-admin privileges are required on ${role} context '${context}'"
  info "${role^}: ${context} (${identity})"
}

uwm_ready() {
  local context=$1
  local desired ready
  desired=$(oc --context="${context}" get statefulset prometheus-user-workload \
    -n openshift-user-workload-monitoring -o jsonpath='{.spec.replicas}' 2>/dev/null) || return 1
  ready=$(oc --context="${context}" get statefulset prometheus-user-workload \
    -n openshift-user-workload-monitoring -o jsonpath='{.status.readyReplicas}' 2>/dev/null) || return 1
  [ -n "${desired}" ] && [ "${ready:-0}" = "${desired}" ]
}

enable_uwm() {
  local role=$1 context=$2 config
  if uwm_ready "${context}"; then
    info "UWM is already ready on ${role}"
    return
  fi

  if oc --context="${context}" get configmap cluster-monitoring-config \
    -n openshift-monitoring >/dev/null 2>&1; then
    config=$(oc --context="${context}" get configmap cluster-monitoring-config \
      -n openshift-monitoring -o jsonpath='{.data.config\.yaml}')
    printf '%s\n' "${config}" | grep -Eq '^[[:space:]]*enableUserWorkload:[[:space:]]*true([[:space:]]|$)' || \
      die "cluster-monitoring-config already exists on ${role} without enableUserWorkload: true; enable it without discarding the existing monitoring configuration, then rerun"
  else
    info "Enabling User Workload Monitoring on ${role}"
    cat <<'EOF' | oc --context="${context}" apply -f -
apiVersion: v1
data:
  config.yaml: |
    enableUserWorkload: true
kind: ConfigMap
metadata:
  labels:
    app.kubernetes.io/managed-by: kiali-acm-hub-spoke
  name: cluster-monitoring-config
  namespace: openshift-monitoring
EOF
  fi
  wait_until "UWM on ${role}" uwm_ready "${context}"
}

install_hub() {
  local -a args

  info "Reconciling ACM ${ACM_CHANNEL} and development Observatorium storage on the hub"
  select_temporary_context "${HUB_CONTEXT}"
  args=(
    --channel "${ACM_CHANNEL}"
    --namespace "${ACM_NAMESPACE}"
    --observability-namespace "${OBSERVABILITY_NAMESPACE}"
    --minio-access-key "${MINIO_ACCESS_KEY}"
    --minio-secret-key "${MINIO_SECRET_KEY}"
    --timeout "${TIMEOUT}"
    install-acm
  )
  if [ "${VERBOSE}" = true ]; then
    args=(--verbose "${args[@]}")
  fi
  KUBECONFIG="${MULTICLUSTER_KUBECONFIG}" "${SCRIPT_DIR}/install-acm.sh" "${args[@]}"
}

managed_cluster_ready() {
  local name=$1 joined available
  joined=$(oc_hub get managedcluster "${name}" \
    -o jsonpath='{.status.conditions[?(@.type=="ManagedClusterJoined")].status}' 2>/dev/null) || return 1
  available=$(oc_hub get managedcluster "${name}" \
    -o jsonpath='{.status.conditions[?(@.type=="ManagedClusterConditionAvailable")].status}' 2>/dev/null) || return 1
  [ "${joined}" = True ] && [ "${available}" = True ]
}

import_spoke() {
  info "Reconciling ManagedCluster ${SPOKE_NAME}"
  oc_hub create namespace "${SPOKE_NAME}" --dry-run=client -o yaml | oc_hub apply -f -
  cat <<EOF | oc_hub apply -f -
apiVersion: cluster.open-cluster-management.io/v1
kind: ManagedCluster
metadata:
  labels:
    cloud: auto-detect
    vendor: auto-detect
  name: ${SPOKE_NAME}
spec:
  hubAcceptsClient: true
EOF

  cat <<EOF | oc_hub apply -f -
apiVersion: agent.open-cluster-management.io/v1
kind: KlusterletAddonConfig
metadata:
  name: ${SPOKE_NAME}
  namespace: ${SPOKE_NAME}
spec:
  applicationManager:
    enabled: true
  certPolicyController:
    enabled: true
  clusterName: ${SPOKE_NAME}
  clusterNamespace: ${SPOKE_NAME}
  policyController:
    enabled: true
  searchCollector:
    enabled: true
EOF

  if managed_cluster_ready "${SPOKE_NAME}"; then
    info "ManagedCluster ${SPOKE_NAME} is already joined and available"
    return
  fi

  oc_hub create secret generic auto-import-secret -n "${SPOKE_NAME}" \
    --from-file=kubeconfig="${SPOKE_KUBECONFIG}" --dry-run=client -o yaml | oc_hub apply -f -
  wait_until "ManagedCluster ${SPOKE_NAME} to join and become available" managed_cluster_ready "${SPOKE_NAME}"
}

coo_ready() {
  local context=$1 subscription csv namespace deployment deployments desired ready
  oc --context="${context}" get crd scrapeconfigs.monitoring.rhobs >/dev/null 2>&1 || return 1
  subscription=$(oc --context="${context}" get subscriptions.operators.coreos.com -A -o json 2>/dev/null | \
    jq -r '[.items[] | select(.spec.name == "cluster-observability-operator")][0] |
      select(. != null) | [.metadata.namespace, .status.installedCSV] | @tsv')
  [ -n "${subscription}" ] || return 1
  IFS=$'\t' read -r namespace csv <<< "${subscription}"
  [ -n "${namespace}" ] && [ -n "${csv}" ] || return 1
  [ "$(oc --context="${context}" get csv "${csv}" -n "${namespace}" \
    -o jsonpath='{.status.phase}' 2>/dev/null)" = Succeeded ] || return 1

  deployments=$(oc --context="${context}" get csv "${csv}" -n "${namespace}" -o json 2>/dev/null | \
    jq -r '.spec.install.spec.deployments[]?.name') || return 1
  [ -n "${deployments}" ] || return 1
  while read -r deployment; do
    desired=$(oc --context="${context}" get deployment "${deployment}" -n "${namespace}" \
      -o jsonpath='{.spec.replicas}' 2>/dev/null) || return 1
    ready=$(oc --context="${context}" get deployment "${deployment}" -n "${namespace}" \
      -o jsonpath='{.status.readyReplicas}' 2>/dev/null) || return 1
    [ "${ready:-0}" = "${desired}" ] || return 1
  done <<< "${deployments}"
}

coo_subscription_ready() {
  local context=$1 namespace=$2 name=$3 csv phase
  csv=$(oc --context="${context}" get subscription.operators.coreos.com "${name}" -n "${namespace}" \
    -o jsonpath='{.status.installedCSV}' 2>/dev/null) || return 1
  [ -n "${csv}" ] || return 1
  phase=$(oc --context="${context}" get csv "${csv}" -n "${namespace}" \
    -o jsonpath='{.status.phase}' 2>/dev/null) || return 1
  [ "${phase}" = Succeeded ]
}

coo_channel_available() {
  local context=$1
  oc --context="${context}" get packagemanifest cluster-observability-operator \
    -n openshift-marketplace -o json 2>/dev/null | jq -e \
    --arg channel "${COO_CHANNEL}" '.status.channels[]? | select(.name == $channel)' >/dev/null
}

install_coo() {
  local role=$1 context=$2 subscription subscription_namespace subscription_name
  if coo_ready "${context}"; then
    info "Cluster Observability Operator is already ready on ${role}"
    return
  fi

  subscription=$(oc --context="${context}" get subscriptions.operators.coreos.com -A -o json 2>/dev/null | \
    jq -r '[.items[] | select(.spec.name == "cluster-observability-operator")][0] |
      select(. != null) | [.metadata.namespace, .metadata.name] | @tsv')
  if [ -n "${subscription}" ]; then
    IFS=$'\t' read -r subscription_namespace subscription_name <<< "${subscription}"
    info "Using existing COO subscription ${subscription_namespace}/${subscription_name} on ${role}"
  else
    wait_until "COO ${COO_CHANNEL} catalog channel on ${role}" coo_channel_available "${context}"
    cat <<EOF | oc --context="${context}" apply -f -
apiVersion: v1
kind: Namespace
metadata:
  labels:
    openshift.io/cluster-monitoring: "true"
  name: ${COO_NAMESPACE}
---
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: cluster-observability-operator
  namespace: ${COO_NAMESPACE}
spec: {}
---
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: cluster-observability-operator
  namespace: ${COO_NAMESPACE}
spec:
  channel: ${COO_CHANNEL}
  installPlanApproval: Automatic
  name: cluster-observability-operator
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF
    subscription_namespace=${COO_NAMESPACE}
    subscription_name="cluster-observability-operator"
  fi

  wait_until "COO CSV on ${role}" coo_subscription_ready \
    "${context}" "${subscription_namespace}" "${subscription_name}"
  wait_until "COO and ScrapeConfig API on ${role}" coo_ready "${context}"
}

ensure_target_namespaces() {
  local namespace
  local -a namespaces
  IFS=',' read -ra namespaces <<< "${TARGET_NAMESPACES}"
  for namespace in "${namespaces[@]}"; do
    # MCOA needs each target namespace to exist before it can propagate the
    # OpenShift-scoped recording rule. This does not configure the mesh.
    info "Ensuring metrics target namespace ${namespace} exists on the spoke"
    oc_spoke create namespace "${namespace}" --dry-run=client -o yaml | oc_spoke apply -f -
  done
}

configure_federation() {
  local -a args
  args=(
    install
    --hub-context "${HUB_CONTEXT}"
    --observability-namespace "${OBSERVABILITY_NAMESPACE}"
    --target-namespaces "${TARGET_NAMESPACES}"
    --rule-namespace "${RULE_NAMESPACE}"
    --timeout "${TIMEOUT}"
  )
  if [ -n "${PLACEMENT_NAME}" ]; then
    args+=(--placement-name "${PLACEMENT_NAME}")
  fi
  if [ -n "${PLACEMENT_NAMESPACE}" ]; then
    args+=(--placement-namespace "${PLACEMENT_NAMESPACE}")
  fi
  if [ "${WITH_DASHBOARDS}" = true ]; then
    args+=(--with-dashboards)
  fi
  "${SCRIPT_DIR}/configure-acm-mcoa.sh" "${args[@]}"
}

verify_federation_config() {
  local -a args
  args=(
    verify
    --hub-context "${HUB_CONTEXT}"
    --observability-namespace "${OBSERVABILITY_NAMESPACE}"
    --target-namespaces "${TARGET_NAMESPACES}"
    --rule-namespace "${RULE_NAMESPACE}"
    --timeout "${TIMEOUT}"
  )
  if [ -n "${PLACEMENT_NAME}" ]; then
    args+=(--placement-name "${PLACEMENT_NAME}")
  fi
  if [ -n "${PLACEMENT_NAMESPACE}" ]; then
    args+=(--placement-namespace "${PLACEMENT_NAMESPACE}")
  fi
  if [ "${WITH_DASHBOARDS}" = true ]; then
    args+=(--with-dashboards)
  fi
  "${SCRIPT_DIR}/configure-acm-mcoa.sh" "${args[@]}"
}

mcoa_addon_ready() {
  local cluster=$1
  [ "$(oc_hub get managedclusteraddon multicluster-observability-addon -n "${cluster}" \
    -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' 2>/dev/null)" = True ]
}

mco_ready() {
  [ "$(oc_hub get mco observability \
    -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)" = True ]
}

rule_name() {
  printf 'kiali-istio-aggregation-%s' "$1" | tr -c 'a-z0-9-' '-'
}

propagated_rule_ready() {
  local context=$1 namespace=$2
  oc --context="${context}" get prometheusrule "$(rule_name "${namespace}")" \
    -n "${namespace}" >/dev/null 2>&1
}

propagated_rules_ready() {
  local context=$1 namespace
  local -a namespaces
  IFS=',' read -ra namespaces <<< "${TARGET_NAMESPACES}"
  for namespace in "${namespaces[@]}"; do
    propagated_rule_ready "${context}" "${namespace}" || return 1
  done
}

istiod_ready() {
  local desired ready
  desired=$(oc_spoke get deployment istiod -n istio-system \
    -o jsonpath='{.spec.replicas}' 2>/dev/null) || return 1
  ready=$(oc_spoke get deployment istiod -n istio-system \
    -o jsonpath='{.status.readyReplicas}' 2>/dev/null) || return 1
  [ "${ready:-0}" = "${desired}" ]
}

istio_ready() {
  local desired ready ztunnel_namespace
  istiod_ready || return 1

  if [ "${AMBIENT}" = true ]; then
    ztunnel_namespace=$(discover_ztunnel_namespace) || return 1
    desired=$(oc_spoke get daemonset ztunnel -n "${ztunnel_namespace}" \
      -o jsonpath='{.status.desiredNumberScheduled}' 2>/dev/null) || return 1
    ready=$(oc_spoke get daemonset ztunnel -n "${ztunnel_namespace}" \
      -o jsonpath='{.status.numberReady}' 2>/dev/null) || return 1
    [ "${desired}" -gt 0 ] && [ "${ready:-0}" = "${desired}" ]
  fi
}

install_spoke_istio() {
  local ztunnel_namespace
  local -a args
  info "Installing Istio and metrics monitors on the spoke; reconciling MCOA if needed"
  select_temporary_context "${SPOKE_CONTEXT}"
  args=(
    --ambient "${AMBIENT}"
    --istio-cluster-name "${SPOKE_NAME}"
    --metrics-collection-mode mcoa
    --mcoa-hub-context "${HUB_CONTEXT}"
    --mcoa-target-namespaces "${TARGET_NAMESPACES}"
    --mcoa-rule-namespace "${RULE_NAMESPACE}"
    --observability-namespace "${OBSERVABILITY_NAMESPACE}"
    --skip-mcoa-reconcile
    --timeout "${TIMEOUT}"
  )
  [ -z "${PLACEMENT_NAME}" ] || args+=(--mcoa-placement-name "${PLACEMENT_NAME}")
  [ -z "${PLACEMENT_NAMESPACE}" ] || args+=(--mcoa-placement-namespace "${PLACEMENT_NAMESPACE}")
  [ "${WITH_DASHBOARDS}" != true ] || args+=(--mcoa-with-dashboards)
  [ "${VERBOSE}" != true ] || args+=(--verbose)
  args+=(install-istio)
  KUBECONFIG="${MULTICLUSTER_KUBECONFIG}" "${SCRIPT_DIR}/install-acm.sh" "${args[@]}"
  wait_until "Istio on the spoke" istio_ready

  if [ "${AMBIENT}" = true ]; then
    ztunnel_namespace=$(discover_ztunnel_namespace) || \
      die "Istio is ready but its ztunnel namespace could not be discovered"
    if ! target_namespace_list_contains "${ztunnel_namespace}"; then
      append_target_namespace "${ztunnel_namespace}"
      info "Extending MCOA federation for ztunnel in ${ztunnel_namespace}"
      configure_federation
      wait_until "${ztunnel_namespace} recording rule propagation to the spoke" \
        propagated_rule_ready "${SPOKE_CONTEXT}" "${ztunnel_namespace}"
    fi
  fi
}

demo_deployment_ready() {
  local namespace=$1 deployment=$2 desired ready
  desired=$(oc_spoke get deployment "${deployment}" -n "${namespace}" \
    -o jsonpath='{.spec.replicas}' 2>/dev/null) || return 1
  ready=$(oc_spoke get deployment "${deployment}" -n "${namespace}" \
    -o jsonpath='{.status.readyReplicas}' 2>/dev/null) || return 1
  [ "${ready:-0}" = "${desired}" ]
}

sidecar_demo_ready() {
  demo_deployment_ready "${SIDECAR_APP_NAMESPACE}" test-sidecar-frontend && \
    demo_deployment_ready "${SIDECAR_APP_NAMESPACE}" test-sidecar-backend
}

ambient_demo_ready() {
  demo_deployment_ready "${AMBIENT_APP_NAMESPACE}" test-ambient-frontend && \
    demo_deployment_ready "${AMBIENT_APP_NAMESPACE}" test-ambient-backend
}

run_spoke_acm_command() {
  local command=$1
  shift
  select_temporary_context "${SPOKE_CONTEXT}"
  KUBECONFIG="${MULTICLUSTER_KUBECONFIG}" \
    "${SCRIPT_DIR}/install-acm.sh" --timeout "${TIMEOUT}" "$@" "${command}"
}

install_demo_apps() {
  istio_ready || die "The demo applications require ready Istio on the spoke"

  # The wrapper already reconciled every demo namespace on the hub. Keep MCOA
  # mode to avoid legacy allowlists while suppressing lower-level hub updates.
  info "Installing the sidecar demo application on the spoke"
  run_spoke_acm_command install-sidecar-app \
    --metrics-collection-mode mcoa \
    --skip-mcoa-reconcile \
    --sidecar-app-namespace "${SIDECAR_APP_NAMESPACE}"
  wait_until "sidecar demo application" sidecar_demo_ready

  if [ "${AMBIENT}" = true ]; then
    info "Installing the Ambient demo application on the spoke"
    run_spoke_acm_command install-ambient-app \
      --ambient true \
      --ambient-app-namespace "${AMBIENT_APP_NAMESPACE}" \
      --metrics-collection-mode mcoa \
      --skip-mcoa-reconcile
    wait_until "Ambient demo application" ambient_demo_ready
  fi
}

uninstall_demo_apps() {
  info "Removing demo applications from the spoke"
  run_spoke_acm_command uninstall-sidecar-app \
    --sidecar-app-namespace "${SIDECAR_APP_NAMESPACE}"
  run_spoke_acm_command uninstall-ambient-app \
    --ambient-app-namespace "${AMBIENT_APP_NAMESPACE}"
}

kiali_ready() {
  local desired ready
  desired=$(oc_hub get deployment kiali -n "${KIALI_NAMESPACE}" \
    -o jsonpath='{.spec.replicas}' 2>/dev/null) || return 1
  ready=$(oc_hub get deployment kiali -n "${KIALI_NAMESPACE}" \
    -o jsonpath='{.status.readyReplicas}' 2>/dev/null) || return 1
  [ "${ready:-0}" = "${desired}" ]
}

kiali_external_configured() {
  local config
  config=$(oc_hub get configmap kiali -n "${KIALI_NAMESPACE}" \
    -o jsonpath='{.data.config\.yaml}' 2>/dev/null) || return 1
  printf '%s\n' "${config}" | \
    grep -Eq '^[[:space:]]*ignore_home_cluster:[[:space:]]*true([[:space:]]|$)' && \
    printf '%s\n' "${config}" | \
      grep -Eq "^[[:space:]]*cluster_name:[[:space:]]*${KIALI_CLUSTER_NAME}([[:space:]]|$)"
}

kiali_remote_secret_mounted() {
  oc_hub get deployment kiali -n "${KIALI_NAMESPACE}" -o json 2>/dev/null | \
    jq -e --arg secret "kiali-remote-cluster-secret-${SPOKE_NAME}" \
      '[.spec.template.spec.volumes[]? | select(.secret.secretName == $secret)] | length == 1' \
      >/dev/null
}

kiali_spoke_oauth_client_exists() {
  oc_spoke get oauthclient "kiali-${KIALI_NAMESPACE}" >/dev/null 2>&1
}

prepare_kiali_spoke_access() {
  local delete=${1:-false}
  local chart=""
  local apps_domain=""
  local -a args
  if [ "${KIALI_INSTALL_TYPE}" != olm-operator ]; then
    chart=$(find "${HELM_CHARTS_DIR}/_output/charts" -maxdepth 1 \
      -name 'kiali-server-*.tgz' -print -quit 2>/dev/null || true)
    if [ -z "${chart}" ] && [ -d "${HELM_CHARTS_DIR}/kiali-server" ]; then
      chart="${HELM_CHARTS_DIR}/kiali-server"
    fi
  fi
  args=(
    --client oc
    --kiali-cluster-context "${HUB_CONTEXT}"
    --kiali-cluster-namespace "${KIALI_NAMESPACE}"
    --remote-cluster-context "${SPOKE_CONTEXT}"
    --remote-cluster-name "${SPOKE_NAME}"
    --remote-cluster-namespace "${KIALI_NAMESPACE}"
    --view-only "${REMOTE_VIEW_ONLY}"
    --allow-skip-tls-verify "${ALLOW_SKIP_TLS_VERIFY}"
    --delete "${delete}"
  )
  [ -z "${chart}" ] || args+=(--kiali-server-helm-charts "${chart}")
  if [ "${delete}" != true ]; then
    apps_domain=$(oc_hub get ingresses.config.openshift.io cluster \
      -o jsonpath='{.spec.domain}') || die "Unable to determine the hub OpenShift apps domain for Kiali OAuth"
    [ -n "${apps_domain}" ] || die "The hub OpenShift apps domain is empty; cannot create the spoke OAuthClient"
    args+=(--kiali-route-url "https://kiali-${KIALI_NAMESPACE}.${apps_domain}")
  fi
  KUBECONFIG="${MULTICLUSTER_KUBECONFIG}" \
    "${SCRIPT_DIR}/istio/multicluster/kiali-prepare-remote-cluster.sh" "${args[@]}"
}

install_hub_kiali() {
  local deployment_generation_before
  local deployment_generation_after
  local -a args
  if ! istiod_ready; then
    die "Kiali requires a ready Istio installation on the spoke; use --install-istio or install it first"
  fi

  info "Installing centralized Kiali on the hub"
  if ! oc_hub get namespace "${KIALI_NAMESPACE}" >/dev/null 2>&1; then
    info "Creating wrapper-owned Kiali namespace ${KIALI_NAMESPACE}"
    cat <<EOF | oc_hub apply -f -
apiVersion: v1
kind: Namespace
metadata:
  labels:
    app.kubernetes.io/managed-by: kiali-acm-hub-spoke
  name: ${KIALI_NAMESPACE}
EOF
  fi
  # Helm discovers labeled remote-cluster Secrets while rendering Kiali's pod
  # volumes. The Secret must exist before the Kiali install or upgrade.
  info "Creating Kiali access resources for managed cluster ${SPOKE_NAME}"
  prepare_kiali_spoke_access false
  oc_hub get secret "kiali-remote-cluster-secret-${SPOKE_NAME}" \
    -n "${KIALI_NAMESPACE}" >/dev/null

  select_temporary_context "${HUB_CONTEXT}"
  args=(
    --kiali-namespace "${KIALI_NAMESPACE}"
    --kiali-install-type "${KIALI_INSTALL_TYPE}"
    --kiali-external true
    --kiali-cluster-name "${KIALI_CLUSTER_NAME}"
    --kiali-repo-dir "${KIALI_REPO_DIR}"
    --kiali-operator-repo-dir "${KIALI_OPERATOR_REPO_DIR}"
    --helm-charts-dir "${HELM_CHARTS_DIR}"
    --observability-namespace "${OBSERVABILITY_NAMESPACE}"
    --timeout "${TIMEOUT}"
  )
  [ "${SKIP_BUILD}" != true ] || args+=(--skip-build)
  [ "${VERBOSE}" != true ] || args+=(--verbose)
  args+=(install-kiali)
  deployment_generation_before=$(oc_hub get deployment kiali -n "${KIALI_NAMESPACE}" \
    -o jsonpath='{.metadata.generation}' 2>/dev/null || true)
  KUBECONFIG="${MULTICLUSTER_KUBECONFIG}" "${SCRIPT_DIR}/install-acm.sh" "${args[@]}"
  deployment_generation_after=$(oc_hub get deployment kiali -n "${KIALI_NAMESPACE}" \
    -o jsonpath='{.metadata.generation}')
  if [ "${deployment_generation_before}" = "${deployment_generation_after}" ]; then
    info "Restarting Kiali to load the reconciled remote-cluster access configuration"
    oc_hub rollout restart deployment/kiali -n "${KIALI_NAMESPACE}"
  else
    info "Kiali was rolled out by the Helm install/upgrade; no additional restart is needed"
  fi
  wait_until "Kiali on the hub" kiali_ready
}

verify_all() {
  info "Verifying hub, spoke, and federation"
  managed_cluster_ready local-cluster || die "Hub managed cluster local-cluster is not joined and available"
  managed_cluster_ready "${SPOKE_NAME}" || die "ManagedCluster ${SPOKE_NAME} is not joined and available"
  mco_ready || die "MultiClusterObservability/observability is not Ready"
  uwm_ready "${HUB_CONTEXT}" || die "UWM is not ready on the hub"
  uwm_ready "${SPOKE_CONTEXT}" || die "UWM is not ready on the spoke"
  coo_ready "${HUB_CONTEXT}" || die "COO or the ScrapeConfig API is not ready on the hub"
  coo_ready "${SPOKE_CONTEXT}" || die "COO or the ScrapeConfig API is not ready on the spoke"
  verify_federation_config
  mcoa_addon_ready "${SPOKE_NAME}" || die "MCOA is not Available on ${SPOKE_NAME}"
  propagated_rules_ready "${SPOKE_CONTEXT}" || die "Not all Kiali recording rules have propagated to the spoke"
  if [ "${INSTALL_ISTIO}" = true ]; then
    istio_ready || die "Istio is not ready on the spoke"
  fi
  if [ "${INSTALL_KIALI}" = true ]; then
    kiali_ready || die "Kiali is not ready on the hub"
    kiali_external_configured || die "Kiali is not configured to ignore its non-mesh hub cluster"
    oc_hub get secret "kiali-remote-cluster-secret-${SPOKE_NAME}" \
      -n "${KIALI_NAMESPACE}" >/dev/null 2>&1 || \
      die "Kiali remote-cluster secret for ${SPOKE_NAME} is missing"
    kiali_remote_secret_mounted || \
      die "Kiali does not mount the remote-cluster Secret for ${SPOKE_NAME}"
    kiali_spoke_oauth_client_exists || \
      die "Kiali spoke OAuthClient kiali-${KIALI_NAMESPACE} is missing"
  fi
  if [ "${INSTALL_DEMO_APPS}" = true ]; then
    sidecar_demo_ready || die "The sidecar demo application is not ready"
    if [ "${AMBIENT}" = true ]; then
      ambient_demo_ready || die "The Ambient demo application is not ready"
    fi
  fi
  info "ACM hub/spoke MCOA federation verification passed"
}

install_all() {
  check_cluster_access hub "${HUB_CONTEXT}"
  check_cluster_access spoke "${SPOKE_CONTEXT}"
  prepare_temporary_kubeconfigs
  enable_uwm hub "${HUB_CONTEXT}"
  enable_uwm spoke "${SPOKE_CONTEXT}"
  install_hub
  wait_until "hub self-management" managed_cluster_ready local-cluster
  import_spoke
  install_coo hub "${HUB_CONTEXT}"
  install_coo spoke "${SPOKE_CONTEXT}"
  ensure_target_namespaces
  configure_federation
  wait_until "MCOA on ${SPOKE_NAME}" mcoa_addon_ready "${SPOKE_NAME}"
  wait_until "recording rule propagation to the spoke" propagated_rules_ready "${SPOKE_CONTEXT}"
  if [ "${INSTALL_ISTIO}" = true ]; then
    install_spoke_istio
  fi
  if [ "${INSTALL_DEMO_APPS}" = true ]; then
    install_demo_apps
  fi
  if [ "${INSTALL_KIALI}" = true ]; then
    install_hub_kiali
  fi
  verify_all
}

install_demo_apps_only() {
  check_cluster_access hub "${HUB_CONTEXT}"
  check_cluster_access spoke "${SPOKE_CONTEXT}"
  prepare_temporary_kubeconfigs
  ensure_target_namespaces
  configure_federation
  wait_until "MCOA on ${SPOKE_NAME}" mcoa_addon_ready "${SPOKE_NAME}"
  wait_until "recording rule propagation to the spoke" propagated_rules_ready "${SPOKE_CONTEXT}"
  install_demo_apps
  verify_all
}

generate_demo_traffic() {
  local command=$1
  check_cluster_access spoke "${SPOKE_CONTEXT}"
  prepare_temporary_kubeconfigs
  local -a args=(
    --traffic-count "${TRAFFIC_COUNT}"
    --traffic-interval "${TRAFFIC_INTERVAL}"
  )
  [ "${TRAFFIC_CONTINUOUS}" != true ] || args+=(--traffic-continuous)
  case "${command}" in
    traffic-sidecar) args+=(--sidecar-app-namespace "${SIDECAR_APP_NAMESPACE}") ;;
    traffic-ambient) args+=(--ambient-app-namespace "${AMBIENT_APP_NAMESPACE}") ;;
  esac
  run_spoke_acm_command "${command}" "${args[@]}"
}

uninstall_federation() {
  local -a args=(
    uninstall
    --hub-context "${HUB_CONTEXT}"
    --observability-namespace "${OBSERVABILITY_NAMESPACE}"
    --target-namespaces "${TARGET_NAMESPACES}"
    --rule-namespace "${RULE_NAMESPACE}"
    --timeout "${TIMEOUT}"
  )
  [ -z "${PLACEMENT_NAME}" ] || args+=(--placement-name "${PLACEMENT_NAME}")
  [ -z "${PLACEMENT_NAMESPACE}" ] || args+=(--placement-namespace "${PLACEMENT_NAMESPACE}")
  "${SCRIPT_DIR}/configure-acm-mcoa.sh" "${args[@]}"
}

uninstall_hub_kiali() {
  local managed_by
  info "Removing Kiali remote-cluster access resources"
  prepare_kiali_spoke_access true
  oc_spoke delete clusterrolebinding \
    -l app.kubernetes.io/instance=kiali --ignore-not-found 2>/dev/null || true
  select_temporary_context "${HUB_CONTEXT}"
  KUBECONFIG="${MULTICLUSTER_KUBECONFIG}" \
    "${SCRIPT_DIR}/install-acm.sh" \
      --kiali-namespace "${KIALI_NAMESPACE}" \
      --timeout "${TIMEOUT}" \
      uninstall-kiali
  managed_by=$(oc_hub get namespace "${KIALI_NAMESPACE}" \
    -o jsonpath='{.metadata.labels.app\.kubernetes\.io/managed-by}' 2>/dev/null || true)
  if [ "${managed_by}" = kiali-acm-hub-spoke ]; then
    info "Removing wrapper-owned Kiali namespace ${KIALI_NAMESPACE}"
    oc_hub delete namespace "${KIALI_NAMESPACE}" --ignore-not-found --wait=false
    wait_until "Kiali namespace removal" \
      namespace_absent "${HUB_CONTEXT}" "${KIALI_NAMESPACE}"
  else
    info "Preserving pre-existing Kiali namespace ${KIALI_NAMESPACE}"
  fi
}

uninstall_spoke_istio() {
  info "Removing Istio from the spoke"
  run_spoke_acm_command uninstall-istio --ambient "${AMBIENT}"
}

namespace_absent() {
  local context=$1 namespace=$2
  ! oc --context="${context}" get namespace "${namespace}" >/dev/null 2>&1
}

context_has_live_hive_workloads() {
  local context=$1
  oc --context="${context}" get namespace hive >/dev/null 2>&1 && \
    [ -n "$(oc --context="${context}" get deploy,statefulset,daemonset,pod \
      -n hive -o name 2>/dev/null || true)" ]
}

uninstall_coo() {
  local role=$1 context=$2 subscription namespace name csv residual_crds
  subscription=$(oc --context="${context}" get subscriptions.operators.coreos.com -A -o json 2>/dev/null | \
    jq -r '[.items[] | select(.spec.name == "cluster-observability-operator")][0] |
      select(. != null) | [.metadata.namespace, .metadata.name, .status.installedCSV] | @tsv')
  if [ -z "${subscription}" ]; then
    info "COO is already absent on ${role}"
  else
    IFS=$'\t' read -r namespace name csv <<< "${subscription}"
    info "Removing COO from ${role}"
    oc --context="${context}" delete subscription.operators.coreos.com "${name}" \
      -n "${namespace}" --ignore-not-found
    [ -z "${csv}" ] || oc --context="${context}" delete csv "${csv}" \
      -n "${namespace}" --ignore-not-found
    oc --context="${context}" delete namespace "${namespace}" --ignore-not-found --wait=false
    wait_until "COO namespace removal on ${role}" namespace_absent "${context}" "${namespace}"
  fi

  # OLM intentionally leaves operator-owned CRDs behind.
  oc --context="${context}" delete crd \
    -l operators.coreos.com/cluster-observability-operator.openshift-cluster-observability \
    --ignore-not-found >/dev/null 2>&1 || true
  residual_crds=$(oc --context="${context}" get crd -o name 2>/dev/null | \
    grep -E '\.monitoring\.rhobs$' || true)
  if [ -n "${residual_crds}" ]; then
    info "Removing residual COO ScrapeConfig APIs from ${role}"
    echo "${residual_crds}" | xargs oc --context="${context}" delete --ignore-not-found
  fi
}

managed_cluster_absent() {
  ! oc_hub get managedcluster "${SPOKE_NAME}" >/dev/null 2>&1
}

klusterlet_absent() {
  ! oc_spoke get klusterlet klusterlet >/dev/null 2>&1
}

remove_spoke_import() {
  info "Detaching managed cluster ${SPOKE_NAME}"
  oc_spoke delete klusterlet klusterlet --ignore-not-found --wait=false 2>/dev/null || true
  wait_until "spoke Klusterlet removal" klusterlet_absent
  oc_spoke delete namespace open-cluster-management-agent \
    open-cluster-management-agent-addon open-cluster-management-policies \
    --ignore-not-found --wait=false 2>/dev/null || true
  wait_until "spoke ACM agent namespace removal" \
    namespace_absent "${SPOKE_CONTEXT}" open-cluster-management-agent
  wait_until "spoke ACM policy namespace removal" \
    namespace_absent "${SPOKE_CONTEXT}" open-cluster-management-policies

  if oc_hub get crd managedclusters.cluster.open-cluster-management.io >/dev/null 2>&1; then
    oc_hub delete managedcluster "${SPOKE_NAME}" --ignore-not-found --wait=false
    wait_until "ManagedCluster ${SPOKE_NAME} removal" managed_cluster_absent
  else
    info "ManagedCluster API is already absent on the hub"
  fi
  oc_hub delete namespace "${SPOKE_NAME}" --ignore-not-found --wait=false
  wait_until "managed-cluster namespace ${SPOKE_NAME} removal" \
    namespace_absent "${HUB_CONTEXT}" "${SPOKE_NAME}"
}

spoke_applied_manifestworks_absent() {
  [ -z "$(oc_spoke get appliedmanifestwork -o name 2>/dev/null || true)" ]
}

cleanup_spoke_acm_residue() {
  local policy resources spoke_namespace_owned=false

  # If the hub-side deletion completed after the Klusterlet stopped, its
  # AppliedManifestWork inventory can remain on the spoke along with every
  # cluster-scoped object represented by that inventory. Drain it explicitly.
  if oc_spoke get namespace "${SPOKE_NAME}" -o json 2>/dev/null | \
    jq -e '[.metadata.ownerReferences[]? | select(.kind == "AppliedManifestWork")] | length > 0' \
      >/dev/null 2>&1; then
    spoke_namespace_owned=true
  fi
  if oc_spoke get crd appliedmanifestworks.work.open-cluster-management.io >/dev/null 2>&1; then
    resources=$(oc_spoke get appliedmanifestwork -o name 2>/dev/null || true)
    if [ -n "${resources}" ]; then
      info "Removing residual AppliedManifestWork objects from the spoke"
      echo "${resources}" | xargs oc --context="${SPOKE_CONTEXT}" delete --ignore-not-found
      wait_until "spoke AppliedManifestWork removal" spoke_applied_manifestworks_absent
    fi
  fi

  # Right-sizing ConfigurationPolicies use a finalizer that asks the policy
  # controller to delete these related rules. The controller may already be
  # gone after Klusterlet teardown, so remove the related objects explicitly
  # before releasing only this managed cluster's orphaned policy finalizers.
  resources=$(oc_spoke get prometheusrule -n openshift-monitoring -o name 2>/dev/null | \
    grep -E '/acm-rs-' || true)
  if [ -n "${resources}" ]; then
    info "Removing residual ACM platform recording rules from the spoke"
    echo "${resources}" | xargs oc --context="${SPOKE_CONTEXT}" \
      -n openshift-monitoring delete --ignore-not-found
  fi
  if oc_spoke get crd configurationpolicies.policy.open-cluster-management.io \
    >/dev/null 2>&1; then
    resources=$(oc_spoke get configurationpolicy -n "${SPOKE_NAME}" -o json 2>/dev/null | \
      jq -r --arg cluster "${SPOKE_NAME}" '.items[] |
        select(.metadata.deletionTimestamp != null) |
        select(.metadata.labels["policy.open-cluster-management.io/cluster-name"] == $cluster) |
        select(any(.metadata.finalizers[]?;
          . == "policy.open-cluster-management.io/delete-related-objects")) |
        .metadata.name' || true)
    for policy in ${resources}; do
      info "Releasing orphaned ConfigurationPolicy finalizer: ${SPOKE_NAME}/${policy}"
      oc_spoke patch configurationpolicy "${policy}" -n "${SPOKE_NAME}" \
        --type=merge -p '{"metadata":{"finalizers":[]}}'
    done
  fi

  if [ "${spoke_namespace_owned}" = true ]; then
    oc_spoke delete namespace "${SPOKE_NAME}" --ignore-not-found --wait=false
    wait_until "spoke namespace ${SPOKE_NAME} removal" \
      namespace_absent "${SPOKE_CONTEXT}" "${SPOKE_NAME}"
  fi

  resources=$(oc_spoke get clusterrole,clusterrolebinding -o name 2>/dev/null | grep -E \
    '/(ocm:|.*open-cluster-management|.*multicluster-observability|.*observability.*mco)' || true)
  if [ -n "${resources}" ]; then
    info "Removing residual ACM cluster RBAC from the spoke"
    echo "${resources}" | xargs oc --context="${SPOKE_CONTEXT}" delete --ignore-not-found
  fi

  resources=$(oc_spoke get validatingwebhookconfiguration,mutatingwebhookconfiguration \
    -o name 2>/dev/null | grep -E '/.*(open-cluster-management|multicluster|observability)' || true)
  if [ -n "${resources}" ]; then
    info "Removing residual ACM admission registrations from the spoke"
    echo "${resources}" | xargs oc --context="${SPOKE_CONTEXT}" delete --ignore-not-found
  fi

  resources=$(oc_spoke get apiservice -o name 2>/dev/null | grep -E \
    '\.(open-cluster-management\.io|multicluster\.openshift\.io|multicluster\.x-k8s\.io|observatorium\.io)$' || true)
  if [ -n "${resources}" ]; then
    info "Removing residual ACM APIService registrations from the spoke"
    echo "${resources}" | xargs oc --context="${SPOKE_CONTEXT}" delete --ignore-not-found
  fi

  if ! context_has_live_hive_workloads "${SPOKE_CONTEXT}"; then
    resources=$(oc_spoke get apiservice -o name 2>/dev/null | grep -E \
      '\.(hive\.openshift\.io|hiveinternal\.openshift\.io)$' || true)
    if [ -n "${resources}" ]; then
      info "Removing residual ACM-installed Hive APIService registrations from the spoke"
      echo "${resources}" | xargs oc --context="${SPOKE_CONTEXT}" delete --ignore-not-found
    fi
  fi

  # Delete CRDs last; the cleanup above still needs their APIs.
  resources=$(oc_spoke get crd -o name 2>/dev/null | grep -E \
    '\.(open-cluster-management\.io|multicluster\.openshift\.io|multicluster\.x-k8s\.io|observatorium\.io)$' || true)
  if [ -n "${resources}" ]; then
    info "Removing residual ACM CRDs from the spoke"
    echo "${resources}" | xargs oc --context="${SPOKE_CONTEXT}" delete --ignore-not-found
  fi
  if ! context_has_live_hive_workloads "${SPOKE_CONTEXT}"; then
    resources=$(oc_spoke get crd -o name 2>/dev/null | grep -E \
      '\.(hive\.openshift\.io|hiveinternal\.openshift\.io)$' || true)
    if [ -n "${resources}" ]; then
      info "Removing residual ACM-installed Hive CRDs from the spoke"
      echo "${resources}" | xargs oc --context="${SPOKE_CONTEXT}" delete --ignore-not-found
    fi
  fi
}

uninstall_hub_acm() {
  info "Removing ACM and Observatorium from the hub"
  select_temporary_context "${HUB_CONTEXT}"
  KUBECONFIG="${MULTICLUSTER_KUBECONFIG}" \
    "${SCRIPT_DIR}/install-acm.sh" \
      --namespace "${ACM_NAMESPACE}" \
      --observability-namespace "${OBSERVABILITY_NAMESPACE}" \
      --timeout "${TIMEOUT}" \
      uninstall-acm
}

remove_owned_uwm_config() {
  local role=$1 context=$2 managed_by
  oc --context="${context}" get configmap cluster-monitoring-config \
    -n openshift-monitoring >/dev/null 2>&1 || return 0
  managed_by=$(oc --context="${context}" get configmap cluster-monitoring-config \
    -n openshift-monitoring -o jsonpath='{.metadata.labels.app\.kubernetes\.io/managed-by}' 2>/dev/null || true)
  if [ "${managed_by}" = kiali-acm-hub-spoke ] || [ "${REMOVE_UWM_CONFIG}" = true ]; then
    if [ "${managed_by}" = kiali-acm-hub-spoke ]; then
      info "Removing wrapper-owned UWM configuration from ${role}"
    else
      info "Removing pre-existing UWM configuration from ${role} by explicit request"
    fi
    oc --context="${context}" delete configmap cluster-monitoring-config \
      -n openshift-monitoring --ignore-not-found
  else
    info "Preserving pre-existing UWM configuration on ${role}"
  fi
}

uninstall_residue_for_context() {
  local context=$1 role=$2 namespace

  oc --context="${context}" get crd -o name 2>/dev/null | grep -E \
    '\.(open-cluster-management\.io|multicluster\.openshift\.io|multicluster\.x-k8s\.io|monitoring\.rhobs|observatorium\.io)$' || true
  if ! context_has_live_hive_workloads "${context}"; then
    oc --context="${context}" get crd -o name 2>/dev/null | grep -E \
      '\.(hive\.openshift\.io|hiveinternal\.openshift\.io)$' || true
  fi
  oc --context="${context}" get clusterrole,clusterrolebinding -o name 2>/dev/null | grep -E \
    '/(ocm:|.*open-cluster-management|.*multiclusterengine|.*multicluster-observability|.*observability.*mco)' || true
  oc --context="${context}" get validatingwebhookconfiguration,mutatingwebhookconfiguration \
    -o name 2>/dev/null | grep -E '/.*(open-cluster-management|multicluster|observability)' || true
  oc --context="${context}" get apiservice -o name 2>/dev/null | grep -E \
    '\.(open-cluster-management\.io|multicluster\.openshift\.io|multicluster\.x-k8s\.io|observatorium\.io)$' || true
  if ! context_has_live_hive_workloads "${context}"; then
    oc --context="${context}" get apiservice -o name 2>/dev/null | grep -E \
      '\.(hive\.openshift\.io|hiveinternal\.openshift\.io)$' || true
  fi

  for namespace in "${ACM_NAMESPACE}" "${OBSERVABILITY_NAMESPACE}" "${COO_NAMESPACE}" \
    open-cluster-management-agent open-cluster-management-agent-addon \
    open-cluster-management-policies; do
    if oc --context="${context}" get namespace "${namespace}" >/dev/null 2>&1; then
      echo "namespace/${namespace}"
    fi
  done

  if [ "${role}" = spoke ]; then
    oc --context="${context}" get appliedmanifestwork -o name 2>/dev/null || true
    oc --context="${context}" get prometheusrule -n openshift-monitoring \
      -o name 2>/dev/null | grep -E '/acm-rs-' || true
    if oc --context="${context}" get namespace "${SPOKE_NAME}" -o json 2>/dev/null | \
      jq -e '[.metadata.ownerReferences[]? | select(.kind == "AppliedManifestWork")] | length > 0' \
        >/dev/null 2>&1; then
      echo "namespace/${SPOKE_NAME}"
    fi
  fi

  if [ "${REMOVE_UWM_CONFIG}" = true ] && oc --context="${context}" \
    get configmap cluster-monitoring-config -n openshift-monitoring >/dev/null 2>&1; then
    echo "configmap/openshift-monitoring/cluster-monitoring-config"
  fi
}

verify_complete_uninstall() {
  local residue failed=false
  for role in hub spoke; do
    local context=${HUB_CONTEXT}
    [ "${role}" = hub ] || context=${SPOKE_CONTEXT}
    residue=$(uninstall_residue_for_context "${context}" "${role}")
    if [ -n "${residue}" ]; then
      failed=true
      echo "[ERROR] Residual ${role} resources:" >&2
      echo "${residue}" | sed 's/^/  /' >&2
    fi
  done
  [ "${failed}" = false ] || die "ACM hub/spoke uninstall left managed resources behind"
  info "Verified that ACM, MCOA, COO, and managed-cluster resources are absent"
}

uninstall_all() {
  check_cluster_access hub "${HUB_CONTEXT}"
  check_cluster_access spoke "${SPOKE_CONTEXT}"
  prepare_temporary_kubeconfigs
  uninstall_demo_apps
  uninstall_hub_kiali
  uninstall_spoke_istio
  uninstall_federation
  remove_spoke_import
  cleanup_spoke_acm_residue
  uninstall_hub_acm
  uninstall_coo spoke "${SPOKE_CONTEXT}"
  uninstall_coo hub "${HUB_CONTEXT}"
  remove_owned_uwm_config spoke "${SPOKE_CONTEXT}"
  remove_owned_uwm_config hub "${HUB_CONTEXT}"
  verify_complete_uninstall
  info "ACM hub/spoke environment uninstallation completed"
}

resource_state() {
  local context=$1 description=$2
  shift 2
  if oc --context="${context}" get "$@" >/dev/null 2>&1; then
    printf '%-48s PRESENT\n' "${description}"
  else
    printf '%-48s absent\n' "${description}"
  fi
}

status_all() {
  resource_state "${HUB_CONTEXT}" "Hub ACM MultiClusterHub" mch multiclusterhub -n "${ACM_NAMESPACE}"
  resource_state "${HUB_CONTEXT}" "Hub Observatorium" mco observability
  resource_state "${HUB_CONTEXT}" "Hub MCOA add-on" clustermanagementaddon multicluster-observability-addon
  resource_state "${HUB_CONTEXT}" "Hub Kiali federation" scrapeconfig kiali-istio-federation -n "${OBSERVABILITY_NAMESPACE}"
  resource_state "${HUB_CONTEXT}" "Hub Kiali" deployment kiali -n "${KIALI_NAMESPACE}"
  resource_state "${HUB_CONTEXT}" "Managed spoke ${SPOKE_NAME}" managedcluster "${SPOKE_NAME}"
  resource_state "${SPOKE_CONTEXT}" "Spoke Istio" deployment istiod -n istio-system
  resource_state "${SPOKE_CONTEXT}" "Spoke sidecar demo" deployment test-sidecar-frontend -n "${SIDECAR_APP_NAMESPACE}"
  resource_state "${SPOKE_CONTEXT}" "Spoke Ambient demo" deployment test-ambient-frontend -n "${AMBIENT_APP_NAMESPACE}"
  resource_state "${HUB_CONTEXT}" "Hub COO" subscription.operators.coreos.com cluster-observability-operator -n "${COO_NAMESPACE}"
  resource_state "${SPOKE_CONTEXT}" "Spoke COO" subscription.operators.coreos.com cluster-observability-operator -n "${COO_NAMESPACE}"
}

parse_args "$@"
validate_args

debug "command=${COMMAND} hub=${HUB_CONTEXT} spoke=${SPOKE_CONTEXT} managedCluster=${SPOKE_NAME}"
case "${COMMAND}" in
  install) install_all ;;
  install-demo-apps) install_demo_apps_only ;;
  traffic-sidecar|traffic-ambient) generate_demo_traffic "${COMMAND}" ;;
  uninstall) uninstall_all ;;
  status)
    check_cluster_access hub "${HUB_CONTEXT}"
    check_cluster_access spoke "${SPOKE_CONTEXT}"
    status_all
    ;;
  verify)
    check_cluster_access hub "${HUB_CONTEXT}"
    check_cluster_access spoke "${SPOKE_CONTEXT}"
    verify_all
    ;;
esac
