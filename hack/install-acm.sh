#!/bin/bash

##############################################################################
# install-acm.sh
#
# This script installs Red Hat Advanced Cluster Management (ACM) with
# observability on an OpenShift cluster for development and testing purposes.
# It can also build and install Kiali configured to use ACM's observability
# backend (Thanos Querier) with mTLS certificate-based authentication.
#
# Kiali Authentication to ACM Observability:
#   This script configures Kiali to use mTLS (mutual TLS) with long-lived
#   client certificates for authentication to ACM's Observatorium API.
#   This approach provides:
#     - HTTPS with TLS for secure communication
#     - Long-lived credentials without frequent rotation
#     - Proper CA trust (no insecure_skip_verify)
#     - Certificate-based authentication at the TLS layer
#
#   Kiali connects to ACM via the Observatorium API route:
#     - URL: https://observatorium-api-<namespace>.apps.<domain>/api/metrics/v1/default
#     - The Observatorium API proxies requests to internal Thanos services
#     - TLS termination happens at the Observatorium API layer
#
#   ACM Observability automatically creates trusted certificates that the script uses:
#     - observability-grafana-certs: Contains tls.crt and tls.key for client authentication
#     - CA bundle is extracted by inspecting the Observatorium API server certificate issuer,
#       then extracting from the matching secret in the observability namespace:
#       - observability-server-ca-certs (if server cert issued by observability-server-ca-certificate)
#       - observability-client-ca-certs (if server cert issued by observability-client-ca-certificate)
#     The exact CA used varies by ACM version and deployment configuration
#
#   The install-kiali command copies these certificates to Kiali's namespace:
#     - Secret 'acm-observability-certs' with tls.crt and tls.key (client auth)
#     - ConfigMap 'kiali-cabundle' with the server CA (server trust)
#
#   This approach uses ACM's pre-trusted certificates, so no additional
#   ACM configuration is required for mTLS to work.
#
# Metrics Pipeline Latency:
#   ACM collects metrics from Prometheus and pushes to Thanos every 5 minutes.
#   Expect a 5-6 minute delay before new metrics appear in Kiali. To see data in
#   Kiali's graph or metrics views, query time ranges that include data older than
#   5-6 minutes (e.g., "Last 10 minutes" or "Last 30 minutes").
#
# References:
#   - Red Hat blog on connecting Grafana to ACM Observability (mTLS setup):
#     https://www.redhat.com/en/blog/how-your-grafana-can-fetch-metrics-from-red-hat-advanced-cluster-management-observability-observatorium-and-thanos
#   - Red Hat documentation on configuring User Workload Monitoring:
#     https://docs.redhat.com/en/documentation/monitoring_stack_for_red_hat_openshift/4.20/html-single/configuring_user_workload_monitoring/index
#
# Istio Ambient Mode:
#   Sidecar injection is always supported. Optionally, you can also enable Ambient mode
#   using the --ambient flag with install-istio or create-all commands.
#
#   When Ambient mode is enabled, you get additional capabilities:
#     - L4 traffic: Handled by ztunnel daemonset (TCP metrics: istio_tcp_*)
#     - L7 traffic: Handled by waypoint proxies (HTTP metrics: istio_requests_total with reporter=waypoint)
#     - Ambient namespaces use label: istio.io/dataplane-mode=ambient (instead of sidecar injection)
#     - Separate PodMonitor is created for ztunnel (sidecar PodMonitor does not capture ztunnel)
#
# The script supports:
#   create-all           - "Uber command" to install everything (OpenShift+Istio+ACM+Kiali+apps+sends initial traffic)
#   init-openshift       - Create/start CRC OpenShift cluster and enable User Workload Monitoring
#   install-istio        - Install Istio (use --ambient for Ambient mode)
#   uninstall-istio      - Remove Istio installation
#   status-istio         - Check the status of Istio installation
#   install-acm          - Install ACM operator, MultiClusterHub, MinIO, and observability
#   uninstall-acm        - Remove all ACM components cleanly
#   status-acm           - Check the status of ACM installation
#   install-kiali        - Build and install Kiali configured for ACM observability
#   uninstall-kiali      - Remove Kiali installation
#   status-kiali         - Check the status of Kiali installation
#   install-app          - Install a simple sidecar test mesh application
#   uninstall-app        - Remove the sidecar test application
#   status-app           - Check the status of the sidecar test application
#   traffic              - Generate HTTP traffic to the sidecar test application
#   install-ambient-app  - Install an Ambient mode test application (requires Ambient Istio)
#   uninstall-ambient-app - Remove the Ambient test application
#   status-ambient-app   - Check the status of the Ambient test application
#   traffic-ambient      - Generate HTTP traffic to the Ambient test application
#
# Prerequisites:
#   - OpenShift cluster accessible via 'oc' CLI
#   - Cluster-admin privileges
#   - OpenShift cluster monitoring MUST be enabled (prometheus-k8s service)
#   - User Workload Monitoring (UWM) - automatically enabled by init-openshift command
#   - Istio - install via install-istio command (use --ambient for Ambient mode)
#   - For install-kiali: helm, make, and access to Kiali git repositories
#   - For install-kiali: ACM Observability must be installed first (run install-acm)
#
# Setting up a CRC cluster for this script:
#   If you want to use CRC (CodeReady Containers) for local development, you can
#   create a suitable cluster with the following command (from the kiali repo):
#
#     ./hack/crc-openshift.sh \
#       --enable-cluster-monitoring true \
#       --crc-cpus 12 \
#       --crc-virtual-disk-size 100 \
#       -p <path-to-your-pull-secret-file> \
#       start
#
#   The --enable-cluster-monitoring option is REQUIRED for ACM observability to work.
#   It enables cluster monitoring (prometheus-k8s). User Workload Monitoring is enabled
#   separately by the init-openshift command after the cluster starts.
#   The --crc-cpus 12 is recommended because ACM + Istio + monitoring is resource-intensive.
#   The --crc-virtual-disk-size 100 sets the VM disk to 100GB (minimum recommended for
#   ACM observability which requires ~30GB for Thanos metrics storage). The default of
#   48GB is insufficient and will cause disk pressure issues during installation.
#
# Installing Istio and Enabling User Workload Monitoring:
#   The init-openshift command automatically enables User Workload Monitoring
#   (required for Istio metrics collection).
#
#   After init-openshift, install Istio using:
#     ./install-acm.sh install-istio              # Sidecar mode
#     ./install-acm.sh --ambient install-istio    # Ambient mode
#
#   Or install Istio manually on an existing cluster:
#     ./hack/istio/install-istio-via-istioctl.sh -c oc
#
##############################################################################

set -e

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

# Default values
DEFAULT_ACM_NAMESPACE="open-cluster-management"
DEFAULT_ACM_CHANNEL="release-2.15"
DEFAULT_OBSERVABILITY_NAMESPACE="open-cluster-management-observability"
DEFAULT_MINIO_ACCESS_KEY="minio"
DEFAULT_MINIO_SECRET_KEY="minio123"
DEFAULT_CLIENT_EXE="oc"
DEFAULT_TIMEOUT="1200"

# Kiali defaults
DEFAULT_KIALI_NAMESPACE="istio-system"
DEFAULT_KIALI_REPO_DIR="$(cd "${SCRIPT_DIR}/.." &> /dev/null && pwd)"
DEFAULT_HELM_CHARTS_DIR="$(cd "${SCRIPT_DIR}/../../helm-charts" &> /dev/null && pwd)"

# Test app defaults
DEFAULT_APP_NAMESPACE="test-app"
DEFAULT_AMBIENT_APP_NAMESPACE="test-app-ambient"
DEFAULT_TRAFFIC_COUNT="10"
DEFAULT_TRAFFIC_INTERVAL="1"

# Istio mode defaults
DEFAULT_AMBIENT_MODE="false"

# CRC initialization defaults
DEFAULT_CRC_CPUS="12"
DEFAULT_CRC_DISK_SIZE="100"
DEFAULT_CRC_PULL_SECRET_FILE=""

# Runtime variables
_VERBOSE="false"

##############################################################################
# Helper Functions
##############################################################################

infomsg() {
  echo "[INFO] ${1}"
}

errormsg() {
  echo "[ERROR] ${1}" >&2
}

debug() {
  if [ "${_VERBOSE}" == "true" ]; then
    echo "[DEBUG] ${1}"
  fi
}

warnmsg() {
  echo "[WARN] ${1}" >&2
}

# Wait for a resource condition with timeout
wait_for_condition() {
  local resource_type=$1
  local resource_name=$2
  local namespace=$3
  local condition=$4
  local timeout=$5
  local message=$6

  infomsg "${message}"
  if ! ${CLIENT_EXE} wait --for=${condition} ${resource_type}/${resource_name} -n ${namespace} --timeout=${timeout}s 2>/dev/null; then
    errormsg "Timeout waiting for ${resource_type}/${resource_name} to meet condition: ${condition}"
    return 1
  fi
  return 0
}

# Wait for a resource to be deleted
wait_for_deletion() {
  local resource_type=$1
  local resource_name=$2
  local namespace=$3
  local timeout=$4
  local message=$5

  infomsg "${message}"
  local start_time=$(date +%s)
  while ${CLIENT_EXE} get ${resource_type} ${resource_name} -n ${namespace} &>/dev/null; do
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))
    if [ ${elapsed} -ge ${timeout} ]; then
      errormsg "Timeout waiting for ${resource_type}/${resource_name} to be deleted"
      return 1
    fi
    debug "Waiting for ${resource_type}/${resource_name} to be deleted... (${elapsed}s)"
    sleep 5
  done
  return 0
}

##############################################################################
# Prerequisite Checking
##############################################################################

check_prerequisites() {
  debug "Checking prerequisites..."

  # Check if client executable exists
  if ! which ${CLIENT_EXE} &>/dev/null; then
    errormsg "${CLIENT_EXE} command not found. Please install it or specify with --client-exe."
    return 1
  fi
  debug "Found ${CLIENT_EXE} at $(which ${CLIENT_EXE})"

  # Check cluster connectivity
  if ! ${CLIENT_EXE} whoami &>/dev/null; then
    errormsg "Cannot connect to cluster. Please log in with '${CLIENT_EXE} login'."
    return 1
  fi
  debug "Connected to cluster as $(${CLIENT_EXE} whoami)"

  # Check for cluster-admin privileges (try to list nodes as a proxy check)
  if ! ${CLIENT_EXE} auth can-i create namespaces --all-namespaces &>/dev/null; then
    errormsg "Insufficient privileges. Cluster-admin access is required."
    return 1
  fi
  debug "Cluster-admin privileges confirmed"

  # Check for OpenShift cluster monitoring Prometheus (required for ACM observability)
  if ! ${CLIENT_EXE} get service prometheus-k8s -n openshift-monitoring &>/dev/null 2>&1; then
    errormsg "OpenShift cluster monitoring is not enabled (prometheus-k8s service not found in openshift-monitoring namespace)."
    errormsg "ACM observability requires OpenShift cluster monitoring to collect metrics."
    errormsg "Please enable cluster monitoring before running this script."
    errormsg "See: https://docs.openshift.com/container-platform/latest/monitoring/enabling-monitoring-for-user-defined-projects.html"
    return 1
  fi
  debug "OpenShift cluster monitoring (prometheus-k8s) is available"

  # Check for User Workload Monitoring (required for PodMonitor/ServiceMonitor in user namespaces)
  if ! ${CLIENT_EXE} get statefulset prometheus-user-workload -n openshift-user-workload-monitoring &>/dev/null 2>&1; then
    errormsg "User Workload Monitoring (UWM) is not enabled."
    errormsg "UWM is required for Istio metrics collection via PodMonitor/ServiceMonitor."
    errormsg "Please enable UWM by setting 'enableUserWorkload: true' in the cluster-monitoring-config ConfigMap."
    errormsg "See: https://docs.openshift.com/container-platform/latest/monitoring/enabling-monitoring-for-user-defined-projects.html"
    return 1
  fi
  debug "User Workload Monitoring (prometheus-user-workload) is available"

  return 0
}

check_acm_installed() {
  if ${CLIENT_EXE} get namespace ${ACM_NAMESPACE} &>/dev/null; then
    if ${CLIENT_EXE} get mch -n ${ACM_NAMESPACE} &>/dev/null 2>&1; then
      return 0  # ACM is installed
    fi
  fi
  return 1  # ACM is not installed
}

##############################################################################
# Installation Functions
##############################################################################

create_acm_namespace() {
  infomsg "Creating ACM namespace: ${ACM_NAMESPACE}"
  if ${CLIENT_EXE} get namespace ${ACM_NAMESPACE} &>/dev/null; then
    debug "Namespace ${ACM_NAMESPACE} already exists"
  else
    ${CLIENT_EXE} create namespace ${ACM_NAMESPACE}
  fi
}

create_operator_group() {
  infomsg "Creating OperatorGroup in ${ACM_NAMESPACE}"
  cat <<EOF | ${CLIENT_EXE} apply -f -
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: acm-operator-group
  namespace: ${ACM_NAMESPACE}
spec:
  targetNamespaces:
  - ${ACM_NAMESPACE}
EOF
}

create_subscription() {
  infomsg "Creating ACM Subscription with channel: ${ACM_CHANNEL}"
  cat <<EOF | ${CLIENT_EXE} apply -f -
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: advanced-cluster-management
  namespace: ${ACM_NAMESPACE}
spec:
  channel: ${ACM_CHANNEL}
  installPlanApproval: Automatic
  name: advanced-cluster-management
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF
}

wait_for_operator() {
  infomsg "Waiting for ACM operator to be installed (this may take several minutes)..."

  # Wait for the CSV to appear and succeed
  local start_time=$(date +%s)
  local csv_name=""
  while [ -z "${csv_name}" ] || [ "${csv_name}" == "" ]; do
    csv_name=$(${CLIENT_EXE} get csv -n ${ACM_NAMESPACE} -o jsonpath='{.items[?(@.spec.displayName=="Advanced Cluster Management for Kubernetes")].metadata.name}' 2>/dev/null || true)
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))
    if [ ${elapsed} -ge ${TIMEOUT} ]; then
      errormsg "Timeout waiting for ACM CSV to appear"
      return 1
    fi
    if [ -z "${csv_name}" ]; then
      debug "Waiting for ACM CSV to appear... (${elapsed}s)"
      sleep 10
    fi
  done

  infomsg "Found CSV: ${csv_name}"
  wait_for_condition "csv" "${csv_name}" "${ACM_NAMESPACE}" "jsonpath={.status.phase}=Succeeded" "${TIMEOUT}" "Waiting for CSV to reach Succeeded phase..."
}

create_multiclusterhub() {
  infomsg "Creating MultiClusterHub resource"
  cat <<EOF | ${CLIENT_EXE} apply -f -
apiVersion: operator.open-cluster-management.io/v1
kind: MultiClusterHub
metadata:
  name: multiclusterhub
  namespace: ${ACM_NAMESPACE}
spec: {}
EOF
}

wait_for_multiclusterhub() {
  infomsg "Waiting for MultiClusterHub to reach Running status (this could take 15 minutes or more)..."

  local start_time=$(date +%s)
  while true; do
    local phase=$(${CLIENT_EXE} get mch multiclusterhub -n ${ACM_NAMESPACE} -o jsonpath='{.status.phase}' 2>/dev/null || echo "Unknown")
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))

    if [ "${phase}" == "Running" ]; then
      infomsg "MultiClusterHub is Running"
      return 0
    fi

    if [ ${elapsed} -ge ${TIMEOUT} ]; then
      errormsg "Timeout waiting for MultiClusterHub. Current phase: ${phase}"
      return 1
    fi

    debug "MultiClusterHub phase: ${phase} (${elapsed}s elapsed)"
    sleep 15
  done
}

create_observability_namespace() {
  infomsg "Creating observability namespace: ${OBSERVABILITY_NAMESPACE}"
  if ${CLIENT_EXE} get namespace ${OBSERVABILITY_NAMESPACE} &>/dev/null; then
    debug "Namespace ${OBSERVABILITY_NAMESPACE} already exists"
  else
    ${CLIENT_EXE} create namespace ${OBSERVABILITY_NAMESPACE}
  fi
}

install_minio() {
  infomsg "Installing MinIO for object storage"

  # Create MinIO Deployment
  cat <<EOF | ${CLIENT_EXE} apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio
  namespace: ${OBSERVABILITY_NAMESPACE}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minio
  template:
    metadata:
      labels:
        app: minio
    spec:
      containers:
      - name: minio
        image: quay.io/minio/minio:latest
        args:
        - server
        - /data
        - --console-address
        - ":9001"
        env:
        - name: MINIO_ROOT_USER
          value: "${MINIO_ACCESS_KEY}"
        - name: MINIO_ROOT_PASSWORD
          value: "${MINIO_SECRET_KEY}"
        ports:
        - containerPort: 9000
          name: api
        - containerPort: 9001
          name: console
        volumeMounts:
        - name: data
          mountPath: /data
        readinessProbe:
          httpGet:
            path: /minio/health/ready
            port: 9000
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /minio/health/live
            port: 9000
          initialDelaySeconds: 10
          periodSeconds: 5
      volumes:
      - name: data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: minio
  namespace: ${OBSERVABILITY_NAMESPACE}
spec:
  ports:
  - port: 9000
    name: api
    targetPort: 9000
  - port: 9001
    name: console
    targetPort: 9001
  selector:
    app: minio
EOF

  # Wait for MinIO to be ready
  infomsg "Waiting for MinIO to be ready..."
  ${CLIENT_EXE} rollout status deployment/minio -n ${OBSERVABILITY_NAMESPACE} --timeout=${TIMEOUT}s

  # Create the thanos bucket
  infomsg "Creating thanos bucket in MinIO..."
  local minio_pod=$(${CLIENT_EXE} get pods -n ${OBSERVABILITY_NAMESPACE} -l app=minio -o jsonpath='{.items[0].metadata.name}')
  ${CLIENT_EXE} exec -n ${OBSERVABILITY_NAMESPACE} ${minio_pod} -- mkdir -p /data/thanos
}

create_thanos_secret() {
  infomsg "Creating Thanos object storage secret"
  cat <<EOF | ${CLIENT_EXE} apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: thanos-object-storage
  namespace: ${OBSERVABILITY_NAMESPACE}
type: Opaque
stringData:
  thanos.yaml: |
    type: s3
    config:
      bucket: thanos
      endpoint: minio.${OBSERVABILITY_NAMESPACE}.svc:9000
      insecure: true
      access_key: ${MINIO_ACCESS_KEY}
      secret_key: ${MINIO_SECRET_KEY}
EOF
}

configure_istio_metrics_for_acm() {
  # Configure Istio metric collection so ACM can scrape and federate Istio metrics.
  # Based on Red Hat OpenShift Service Mesh 3.0 documentation:
  # https://docs.redhat.com/en/documentation/red_hat_openshift_service_mesh/3.0/html-single/observability/index
  #
  # IMPORTANT: OpenShift monitoring ignores namespaceSelector in PodMonitor/ServiceMonitor.
  # Therefore, PodMonitor must be created in EACH namespace that has Istio sidecars.
  # This function only creates monitors in istio-system. For application namespaces,
  # the install-app command creates the PodMonitor in that namespace.

  if ! ${CLIENT_EXE} get namespace istio-system &>/dev/null 2>&1; then
    warnmsg "istio-system namespace not found. Skipping Istio metrics configuration."
    warnmsg "Install Istio first, then re-run install-acm to configure metrics."
    return 0
  fi

  infomsg "Configuring Istio metrics collection for ACM..."

  # Create ServiceMonitor for istiod control plane (per Red Hat docs)
  infomsg "Creating ServiceMonitor for istiod..."
  cat <<EOF | ${CLIENT_EXE} apply -f -
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: istiod-monitor
  namespace: istio-system
spec:
  targetLabels:
  - app
  selector:
    matchLabels:
      istio: pilot
  endpoints:
  - port: http-monitoring
    interval: 30s
EOF

  # Create PodMonitor for Istio proxies in istio-system namespace
  # This monitors any sidecars in istio-system (e.g., ingress/egress gateways)
  create_istio_podmonitor "istio-system"

  # Create PodMonitor for ztunnel if Ambient mode is detected
  # The sidecar PodMonitor filters by container_name=istio-proxy which does NOT match ztunnel
  create_ztunnel_podmonitor

  infomsg "Istio metrics collection configured for ACM"
}

# Creates a PodMonitor for Istio proxies in the specified namespace.
# Must be called for EACH namespace that has Istio sidecars because
# OpenShift monitoring ignores namespaceSelector in PodMonitor objects.
# Based on Red Hat OpenShift Service Mesh 3.0 documentation.
create_istio_podmonitor() {
  local namespace="$1"
  local mesh_id=""

  if ! ${CLIENT_EXE} get namespace "${namespace}" &>/dev/null 2>&1; then
    debug "Namespace ${namespace} not found, skipping PodMonitor creation"
    return 0
  fi

  # Use the actual Istio mesh ID for the mesh_id metric label. This aligns with how Kiali
  # identifies meshes: MeshId when set, otherwise TrustDomain.
  #
  # Kiali reference: kiali/handlers/mesh.go (MeshId falls back to TrustDomain).
  # Istio reference: Istio multi-cluster docs use values.global.meshID (mesh identifier).
  #
  # Detection order:
  # 1) defaultConfig.meshId (if present in mesh config)
  # 2) defaultConfig.proxyMetadata.ISTIO_META_MESH_ID (if present)
  # 3) trustDomain (Istio default when meshId is not set)
  local mesh_cfg="$(${CLIENT_EXE} -n istio-system get configmap istio -o jsonpath='{.data.mesh}' 2>/dev/null || true)"
  if [ -n "${mesh_cfg}" ]; then
    mesh_id="$(printf '%s\n' "${mesh_cfg}" | sed -n -E 's/^[[:space:]]*meshId:[[:space:]]*"?([^"]+)"?$/\1/p' | head -n 1)"
    if [ -z "${mesh_id}" ]; then
      mesh_id="$(printf '%s\n' "${mesh_cfg}" | sed -n -E 's/^[[:space:]]*ISTIO_META_MESH_ID:[[:space:]]*"?([^"]+)"?$/\1/p' | head -n 1)"
    fi
    if [ -z "${mesh_id}" ]; then
      mesh_id="$(printf '%s\n' "${mesh_cfg}" | sed -n -E 's/^trustDomain:[[:space:]]*"?([^"]+)"?$/\1/p' | head -n 1)"
    fi
  fi
  if [ -z "${mesh_id}" ]; then
    mesh_id="cluster.local"
  fi

  infomsg "Creating PodMonitor for Istio proxies in namespace: ${namespace}"
  cat <<EOF | ${CLIENT_EXE} apply -f -
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: istio-proxies-monitor
  namespace: ${namespace}
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
      sourceLabels: ["__meta_kubernetes_pod_container_name"]
      regex: "istio-proxy"
    - action: keep
      sourceLabels: ["__meta_kubernetes_pod_annotationpresent_prometheus_io_scrape"]
    - action: replace
      regex: (\d+);(([A-Fa-f0-9]{1,4}::?){1,7}[A-Fa-f0-9]{1,4})
      replacement: '[\$2]:\$1'
      sourceLabels: ["__meta_kubernetes_pod_annotation_prometheus_io_port","__meta_kubernetes_pod_ip"]
      targetLabel: "__address__"
    - action: replace
      regex: (\d+);((([0-9]+?)(\.|$)){4})
      replacement: '\$2:\$1'
      sourceLabels: ["__meta_kubernetes_pod_annotation_prometheus_io_port","__meta_kubernetes_pod_ip"]
      targetLabel: "__address__"
    - sourceLabels: ["__meta_kubernetes_pod_label_app_kubernetes_io_name","__meta_kubernetes_pod_label_app"]
      separator: ";"
      targetLabel: "app"
      action: replace
      regex: "(.+);.*|.*;(.+)"
      replacement: "\${1}\${2}"
    - sourceLabels: ["__meta_kubernetes_pod_label_app_kubernetes_io_version","__meta_kubernetes_pod_label_version"]
      separator: ";"
      targetLabel: "version"
      action: replace
      regex: "(.+);.*|.*;(.+)"
      replacement: "\${1}\${2}"
    - sourceLabels: ["__meta_kubernetes_namespace"]
      action: replace
      targetLabel: namespace
    - action: replace
      replacement: "${mesh_id}"
      targetLabel: mesh_id
EOF
}

# Creates a PodMonitor for ztunnel pods in istio-system namespace.
# Ztunnel is the L4 proxy component in Istio Ambient mode.
# Unlike sidecar proxies which run as containers named 'istio-proxy',
# ztunnel pods have label 'app=ztunnel' and expose metrics at :15020/stats/prometheus.
# This monitor is REQUIRED for Ambient mode - the sidecar PodMonitor does NOT capture ztunnel.
create_ztunnel_podmonitor() {
  if ! ${CLIENT_EXE} get namespace istio-system &>/dev/null 2>&1; then
    debug "istio-system namespace not found, skipping ztunnel PodMonitor creation"
    return 0
  fi

  # Check if ztunnel daemonset exists (indicates Ambient mode)
  if ! ${CLIENT_EXE} get daemonset ztunnel -n istio-system &>/dev/null 2>&1; then
    debug "ztunnel daemonset not found in istio-system, skipping ztunnel PodMonitor"
    return 0
  fi

  infomsg "Creating PodMonitor for ztunnel (Ambient L4 proxy)..."
  cat <<EOF | ${CLIENT_EXE} apply -f -
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: ztunnel-monitor
  namespace: istio-system
spec:
  selector:
    matchLabels:
      app: ztunnel
  podMetricsEndpoints:
  - path: /stats/prometheus
    port: "15020"
    interval: 30s
    relabelings:
    - sourceLabels: ["__meta_kubernetes_namespace"]
      action: replace
      targetLabel: namespace
    - sourceLabels: ["__meta_kubernetes_pod_name"]
      action: replace
      targetLabel: pod
    - sourceLabels: ["__meta_kubernetes_pod_node_name"]
      action: replace
      targetLabel: node
EOF

  infomsg "Ztunnel PodMonitor created in istio-system"
}

# Helper function to create metrics allowlist ConfigMap in a namespace for user workload metrics.
# Per ACM docs, user workload metrics need ConfigMaps in the SOURCE namespace with key "uwl_metrics_list.yaml"
create_namespace_metrics_allowlist() {
  local namespace="$1"

  if [ -z "${namespace}" ]; then
    errormsg "Namespace parameter required for create_namespace_metrics_allowlist"
    return 1
  fi

  # Check if already exists
  if ${CLIENT_EXE} get configmap observability-metrics-custom-allowlist -n ${namespace} &>/dev/null 2>&1; then
    local existing_list=$(${CLIENT_EXE} get configmap observability-metrics-custom-allowlist -n ${namespace} -o jsonpath='{.data.uwl_metrics_list\.yaml}' 2>/dev/null)
    if echo "${existing_list}" | grep -q "istio_"; then
      debug "Istio metrics allowlist already exists in namespace ${namespace}"
      return 0
    fi
  fi

  infomsg "Creating ACM metrics allowlist for namespace ${namespace}..."

  cat <<EOF | ${CLIENT_EXE} apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: observability-metrics-custom-allowlist
  namespace: ${namespace}
data:
  uwl_metrics_list.yaml: |
    names:
    # Istio HTTP/gRPC metrics (required for traffic, health, topology)
    - istio_requests_total
    - istio_request_bytes_bucket
    - istio_request_bytes_count
    - istio_request_bytes_sum
    - istio_request_duration_milliseconds_bucket
    - istio_request_duration_milliseconds_count
    - istio_request_duration_milliseconds_sum
    - istio_request_messages_total
    - istio_response_bytes_bucket
    - istio_response_bytes_count
    - istio_response_bytes_sum
    - istio_response_messages_total
    # Istio TCP metrics (required for TCP services and Ambient ztunnel)
    - istio_tcp_connections_closed_total
    - istio_tcp_connections_opened_total
    - istio_tcp_received_bytes_total
    - istio_tcp_sent_bytes_total
    # Ztunnel-specific metrics (Ambient L4 proxy)
    - workload_manager_active_proxy_count
    - istio_build
    # Pilot/control plane metrics (required for control plane monitoring)
    - pilot_proxy_convergence_time_sum
    - pilot_proxy_convergence_time_count
    - pilot_services
    - pilot_xds
    - pilot_xds_pushes
    # Envoy proxy metrics (required for workload details)
    - envoy_cluster_upstream_cx_active
    - envoy_cluster_upstream_rq_total
    - envoy_listener_downstream_cx_active
    - envoy_listener_http_downstream_rq
    - envoy_server_memory_allocated
    - envoy_server_memory_heap_size
    - envoy_server_uptime
    # Container/process metrics (required for control plane overview)
    - container_cpu_usage_seconds_total
    - container_memory_working_set_bytes
    - process_cpu_seconds_total
    - process_resident_memory_bytes
EOF

  debug "Metrics allowlist created in namespace ${namespace}"
}

configure_istio_metrics_allowlist() {
  infomsg "Configuring ACM observability to collect Istio metrics for Kiali..."

  # Wait for the default allowlist ConfigMap to be created by ACM
  local max_wait=60
  local waited=0
  while ! ${CLIENT_EXE} get configmap observability-metrics-allowlist -n ${OBSERVABILITY_NAMESPACE} &>/dev/null 2>&1; do
    if [ ${waited} -ge ${max_wait} ]; then
      warnmsg "Timeout waiting for observability-metrics-allowlist ConfigMap"
      warnmsg "Istio metrics may not be collected by ACM"
      return 0
    fi
    debug "Waiting for observability-metrics-allowlist ConfigMap... (${waited}s)"
    sleep 5
    waited=$((waited + 5))
  done

  # For USER WORKLOAD metrics (Istio), ACM requires ConfigMaps in the SOURCE namespaces
  # with key "uwl_metrics_list.yaml" (not "metrics_list.yaml")
  # Per ACM docs: https://docs.redhat.com/en/documentation/red_hat_advanced_cluster_management_for_kubernetes/2.9/html/observability/customizing-observability#adding-user-workload-metrics
  # Complete list from Kiali FAQ: https://kiali.io/docs/faq/general/#requiredmetrics

  # Create allowlist in istio-system namespace (for istiod and gateway metrics)
  create_namespace_metrics_allowlist "istio-system"

  infomsg "Istio metrics allowlist configured in istio-system"
  infomsg "Metrics collector will include Istio metrics in next scrape cycle (~5 minutes)"

  # Restart metrics collectors to pick up the new allowlist immediately
  infomsg "Restarting metrics collectors to apply new allowlist..."
  ${CLIENT_EXE} rollout restart deployment/uwl-metrics-collector-deployment -n ${OBSERVABILITY_NAMESPACE} || true
  ${CLIENT_EXE} rollout restart deployment/metrics-collector-deployment -n ${OBSERVABILITY_NAMESPACE} || true
}

create_multiclusterobservability() {
  infomsg "Creating MultiClusterObservability resource"
  cat <<EOF | ${CLIENT_EXE} apply -f -
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
    # Explicitly configure retention periods for Thanos compactor. All three resolutions
    # (raw, 5m, 1h) are set to 14d for the following reasons:
    #
    # 1. MINIMUM REQUIREMENT: Thanos requires retentionResolution5m >= 10d because that's
    #    when downsampling from 5m to 1h resolution begins. Setting it lower causes the
    #    thanos-compact pod to crash with error:
    #    "5m resolution retention must be higher than the minimum block size after which
    #    1h resolution downsampling will occur (10 days)"
    #    We use 14d to provide a buffer above this minimum threshold.
    #
    # 2. THANOS BEST PRACTICE: Per Thanos documentation, "ideally, you will have an equal
    #    retention set (or no retention at all) to all resolutions which allow both 'zoom
    #    in' capabilities as well as performant long ranges queries." If raw data expires
    #    before downsampled data, you lose the ability to view detailed metrics for older
    #    time periods.
    #
    # 3. OPERATOR DEFAULT: Without explicit retentionConfig, the ACM operator applies a
    #    hardcoded internal default of 365d (despite CRD schema defaults of 5d/14d/30d),
    #    which wastes storage for most use cases.
    #
    # 4. KIALI ALIGNMENT: This value must match Kiali's thanos_proxy.retention_period
    #    setting so Kiali doesn't attempt to query data outside the available retention
    #    window.
    retentionConfig:
      retentionResolution1h: 14d
      retentionResolution5m: 14d
      retentionResolutionRaw: 14d
    compact:
      resources:
        requests:
          cpu: 50m
          memory: 128Mi
    query:
      replicas: 1
      resources:
        requests:
          cpu: 50m
          memory: 128Mi
    queryFrontend:
      replicas: 1
      resources:
        requests:
          cpu: 50m
          memory: 64Mi
    receive:
      resources:
        requests:
          cpu: 50m
          memory: 128Mi
    rule:
      replicas: 1
      resources:
        requests:
          cpu: 50m
          memory: 128Mi
    store:
      replicas: 1
      resources:
        requests:
          cpu: 50m
          memory: 128Mi
    alertmanager:
      replicas: 1
      resources:
        requests:
          cpu: 20m
          memory: 64Mi
    grafana:
      replicas: 1
      resources:
        requests:
          cpu: 20m
          memory: 64Mi
    observatoriumAPI:
      replicas: 1
      resources:
        requests:
          cpu: 20m
          memory: 64Mi
    rbacQueryProxy:
      replicas: 1
      resources:
        requests:
          cpu: 20m
          memory: 64Mi
    storeMemcached:
      replicas: 1
      resources:
        requests:
          cpu: 20m
          memory: 64Mi
    queryFrontendMemcached:
      replicas: 1
      resources:
        requests:
          cpu: 20m
          memory: 64Mi
EOF
}

wait_for_observability() {
  infomsg "Waiting for MultiClusterObservability to be ready (this may take several minutes)..."

  local start_time=$(date +%s)
  while true; do
    local ready=$(${CLIENT_EXE} get mco observability -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Unknown")
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))

    if [ "${ready}" == "True" ]; then
      infomsg "MultiClusterObservability is Ready"
      return 0
    fi

    if [ ${elapsed} -ge ${TIMEOUT} ]; then
      errormsg "Timeout waiting for MultiClusterObservability. Ready status: ${ready}"
      return 1
    fi

    debug "MultiClusterObservability ready: ${ready} (${elapsed}s elapsed)"
    sleep 15
  done
}

install_acm() {
  infomsg "Starting ACM installation..."

  # Check if already installed
  if check_acm_installed; then
    infomsg "ACM is already installed in namespace ${ACM_NAMESPACE}"
    infomsg "Run 'uninstall' first if you want to reinstall."
    return 0
  fi

  # Install ACM operator
  create_acm_namespace
  create_operator_group
  create_subscription
  wait_for_operator

  # Create MultiClusterHub
  create_multiclusterhub
  wait_for_multiclusterhub

  # Install observability
  create_observability_namespace
  install_minio
  create_thanos_secret
  create_multiclusterobservability
  wait_for_observability
  configure_istio_metrics_for_acm
  configure_istio_metrics_allowlist

  infomsg "======================================"
  infomsg "ACM installation complete!"
  infomsg "======================================"
  infomsg "ACM Namespace: ${ACM_NAMESPACE}"
  infomsg "Observability Namespace: ${OBSERVABILITY_NAMESPACE}"
  infomsg ""
  infomsg "To check status: $0 status"
  infomsg "To uninstall: $0 uninstall-acm"
  infomsg ""
  infomsg "ACM Observability endpoint for Kiali (HTTPS with mTLS):"
  local apps_domain=$(${CLIENT_EXE} get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}')
  infomsg "  Observatorium API: https://observatorium-api-${OBSERVABILITY_NAMESPACE}.${apps_domain}/api/metrics/v1/default"
  infomsg ""
  infomsg "Internal endpoints (HTTP only, for reference):"
  infomsg "  Thanos Query Frontend: http://observability-thanos-query-frontend.${OBSERVABILITY_NAMESPACE}.svc:9090"
  infomsg "  Thanos Query:          http://observability-thanos-query.${OBSERVABILITY_NAMESPACE}.svc:9090"
  infomsg "  RBAC Query Proxy:      https://rbac-query-proxy.${OBSERVABILITY_NAMESPACE}.svc:8443"
  infomsg ""
  infomsg "To install Kiali with mTLS authentication to ACM Observability:"
  infomsg "  $0 install-kiali"
}

##############################################################################
# Uninstallation Functions
##############################################################################

delete_istio_metrics_monitors() {
  if ${CLIENT_EXE} get podmonitor istio-proxies-monitor -n istio-system &>/dev/null 2>&1; then
    infomsg "Deleting Istio proxies PodMonitor from istio-system..."
    ${CLIENT_EXE} delete podmonitor istio-proxies-monitor -n istio-system || true
  fi
  if ${CLIENT_EXE} get servicemonitor istiod-monitor -n istio-system &>/dev/null 2>&1; then
    infomsg "Deleting istiod ServiceMonitor..."
    ${CLIENT_EXE} delete servicemonitor istiod-monitor -n istio-system || true
  fi
}

delete_multiclusterobservability() {
  if ${CLIENT_EXE} get mco observability &>/dev/null 2>&1; then
    infomsg "Deleting MultiClusterObservability..."
    ${CLIENT_EXE} delete mco observability --timeout=${TIMEOUT}s || true
    wait_for_deletion "mco" "observability" "" "${TIMEOUT}" "Waiting for MultiClusterObservability deletion..."
  else
    debug "MultiClusterObservability not found, skipping"
  fi
}

delete_minio() {
  if ${CLIENT_EXE} get deployment minio -n ${OBSERVABILITY_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Deleting MinIO..."
    ${CLIENT_EXE} delete deployment minio -n ${OBSERVABILITY_NAMESPACE} || true
    ${CLIENT_EXE} delete service minio -n ${OBSERVABILITY_NAMESPACE} || true
    ${CLIENT_EXE} delete secret thanos-object-storage -n ${OBSERVABILITY_NAMESPACE} || true
  else
    debug "MinIO not found, skipping"
  fi
}

delete_observability_namespace() {
  if ${CLIENT_EXE} get namespace ${OBSERVABILITY_NAMESPACE} &>/dev/null; then
    infomsg "Deleting observability namespace: ${OBSERVABILITY_NAMESPACE}"
    ${CLIENT_EXE} delete namespace ${OBSERVABILITY_NAMESPACE} --timeout=${TIMEOUT}s || true
  else
    debug "Observability namespace not found, skipping"
  fi
}

delete_multiclusterhub() {
  if ${CLIENT_EXE} get mch multiclusterhub -n ${ACM_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Deleting MultiClusterHub (this may take several minutes)..."
    ${CLIENT_EXE} delete mch multiclusterhub -n ${ACM_NAMESPACE} --timeout=${TIMEOUT}s || true
    wait_for_deletion "mch" "multiclusterhub" "${ACM_NAMESPACE}" "${TIMEOUT}" "Waiting for MultiClusterHub deletion..."
  else
    debug "MultiClusterHub not found, skipping"
  fi
}

delete_acm_operator() {
  # Delete Subscription
  if ${CLIENT_EXE} get subscription advanced-cluster-management -n ${ACM_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Deleting ACM Subscription..."
    ${CLIENT_EXE} delete subscription advanced-cluster-management -n ${ACM_NAMESPACE} || true
  fi

  # Delete CSV
  local csv_name=$(${CLIENT_EXE} get csv -n ${ACM_NAMESPACE} -o jsonpath='{.items[?(@.spec.displayName=="Advanced Cluster Management for Kubernetes")].metadata.name}' 2>/dev/null || true)
  if [ -n "${csv_name}" ]; then
    infomsg "Deleting ACM ClusterServiceVersion: ${csv_name}"
    ${CLIENT_EXE} delete csv ${csv_name} -n ${ACM_NAMESPACE} || true
  fi

  # Delete OperatorGroup
  if ${CLIENT_EXE} get operatorgroup acm-operator-group -n ${ACM_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Deleting OperatorGroup..."
    ${CLIENT_EXE} delete operatorgroup acm-operator-group -n ${ACM_NAMESPACE} || true
  fi
}

delete_acm_namespace() {
  if ${CLIENT_EXE} get namespace ${ACM_NAMESPACE} &>/dev/null; then
    infomsg "Deleting ACM namespace: ${ACM_NAMESPACE}"
    ${CLIENT_EXE} delete namespace ${ACM_NAMESPACE} --timeout=${TIMEOUT}s || true
  else
    debug "ACM namespace not found, skipping"
  fi
}

delete_acm_crds() {
  infomsg "Deleting ACM CRDs..."
  local crds=$(${CLIENT_EXE} get crd -l operators.coreos.com/advanced-cluster-management.${ACM_NAMESPACE} -o name 2>/dev/null || true)
  if [ -n "${crds}" ]; then
    ${CLIENT_EXE} delete crd -l operators.coreos.com/advanced-cluster-management.${ACM_NAMESPACE} --timeout=${TIMEOUT}s || true
  else
    debug "No ACM CRDs found, skipping"
  fi

  # Also delete observability CRDs which may have a different label
  local obs_crds=$(${CLIENT_EXE} get crd -o name 2>/dev/null | grep -E "observ.*open-cluster-management" || true)
  if [ -n "${obs_crds}" ]; then
    infomsg "Deleting ACM Observability CRDs..."
    echo "${obs_crds}" | xargs ${CLIENT_EXE} delete --timeout=${TIMEOUT}s || true
  fi
}

uninstall_acm() {
  infomsg "Starting ACM uninstallation..."

  # Delete in reverse order of installation
  delete_istio_metrics_monitors
  delete_multiclusterobservability
  delete_minio
  delete_observability_namespace
  delete_multiclusterhub
  delete_acm_operator
  delete_acm_namespace
  delete_acm_crds

  infomsg "======================================"
  infomsg "ACM uninstallation complete!"
  infomsg "======================================"
}

##############################################################################
# Status Function
##############################################################################

check_status() {
  infomsg "Checking ACM status..."
  echo ""

  # Check ACM namespace
  if ${CLIENT_EXE} get namespace ${ACM_NAMESPACE} &>/dev/null; then
    echo "ACM Namespace: ${ACM_NAMESPACE} [EXISTS]"
  else
    echo "ACM Namespace: ${ACM_NAMESPACE} [NOT FOUND]"
    echo ""
    echo "ACM does not appear to be installed."
    return 0
  fi

  # Check Subscription
  local sub_state=$(${CLIENT_EXE} get subscription advanced-cluster-management -n ${ACM_NAMESPACE} -o jsonpath='{.status.state}' 2>/dev/null || echo "Not Found")
  echo "ACM Subscription: ${sub_state}"

  # Check CSV
  local csv_phase=$(${CLIENT_EXE} get csv -n ${ACM_NAMESPACE} -o jsonpath='{.items[?(@.spec.displayName=="Advanced Cluster Management for Kubernetes")].status.phase}' 2>/dev/null || echo "Not Found")
  echo "ACM Operator (CSV): ${csv_phase}"

  # Check MultiClusterHub
  local mch_phase=$(${CLIENT_EXE} get mch multiclusterhub -n ${ACM_NAMESPACE} -o jsonpath='{.status.phase}' 2>/dev/null || echo "Not Found")
  echo "MultiClusterHub: ${mch_phase}"

  # Check local-cluster
  local local_cluster=$(${CLIENT_EXE} get managedcluster local-cluster -o jsonpath='{.status.conditions[?(@.type=="ManagedClusterConditionAvailable")].status}' 2>/dev/null || echo "Not Found")
  echo "local-cluster (self-managed): ${local_cluster}"

  # Check Observability namespace
  echo ""
  if ${CLIENT_EXE} get namespace ${OBSERVABILITY_NAMESPACE} &>/dev/null; then
    echo "Observability Namespace: ${OBSERVABILITY_NAMESPACE} [EXISTS]"

    # Check MinIO
    local minio_ready=$(${CLIENT_EXE} get deployment minio -n ${OBSERVABILITY_NAMESPACE} -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    echo "MinIO: ${minio_ready}/1 ready"

    # Check MultiClusterObservability
    local mco_ready=$(${CLIENT_EXE} get mco observability -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "Not Found")
    echo "MultiClusterObservability: Ready=${mco_ready}"

    # Check observability endpoints (same order as install_kiali uses)
    echo "Observability Endpoints:"
    if ${CLIENT_EXE} get service observability-thanos-query-frontend -n ${OBSERVABILITY_NAMESPACE} &>/dev/null 2>&1; then
      echo "  Thanos Query Frontend: [EXISTS] https://observability-thanos-query-frontend.${OBSERVABILITY_NAMESPACE}.svc:9090"
    else
      echo "  Thanos Query Frontend: [NOT FOUND]"
    fi

    if ${CLIENT_EXE} get service observability-thanos-query -n ${OBSERVABILITY_NAMESPACE} &>/dev/null 2>&1; then
      echo "  Thanos Query:          [EXISTS] https://observability-thanos-query.${OBSERVABILITY_NAMESPACE}.svc:9090"
    else
      echo "  Thanos Query:          [NOT FOUND]"
    fi

    if ${CLIENT_EXE} get service rbac-query-proxy -n ${OBSERVABILITY_NAMESPACE} &>/dev/null 2>&1; then
      echo "  RBAC Query Proxy:      [EXISTS] https://rbac-query-proxy.${OBSERVABILITY_NAMESPACE}.svc:8443"
    else
      echo "  RBAC Query Proxy:      [NOT FOUND]"
    fi
  else
    echo "Observability Namespace: ${OBSERVABILITY_NAMESPACE} [NOT FOUND]"
  fi

  # Check User Workload Monitoring
  echo ""
  if ${CLIENT_EXE} get statefulset prometheus-user-workload -n openshift-user-workload-monitoring &>/dev/null 2>&1; then
    local uwm_ready=$(${CLIENT_EXE} get statefulset prometheus-user-workload -n openshift-user-workload-monitoring -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
    local uwm_desired=$(${CLIENT_EXE} get statefulset prometheus-user-workload -n openshift-user-workload-monitoring -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
    echo "User Workload Monitoring: ${uwm_ready}/${uwm_desired} ready"
  else
    echo "User Workload Monitoring: [NOT ENABLED]"
  fi

  # Check Istio metrics monitors
  echo ""
  echo "Istio Metrics Monitors:"

  # Check istiod ServiceMonitor (only in istio-system)
  if ${CLIENT_EXE} get servicemonitor istiod-monitor -n istio-system &>/dev/null 2>&1; then
    echo "  ServiceMonitor istiod-monitor: istio-system"
  else
    echo "  ServiceMonitor istiod-monitor: [NOT FOUND]"
  fi

  # Check istio-proxies-monitor PodMonitors across all namespaces
  local podmonitors=$(${CLIENT_EXE} get podmonitor --all-namespaces -o json 2>/dev/null | jq -r '.items[] | select(.metadata.name == "istio-proxies-monitor") | .metadata.namespace' 2>/dev/null || true)
  if [ -n "${podmonitors}" ]; then
    echo "  PodMonitor istio-proxies-monitor:"
    echo "${podmonitors}" | while read ns; do
      if [ -n "${ns}" ]; then
        echo "    - ${ns}"
      fi
    done
  else
    echo "  PodMonitor istio-proxies-monitor: [NOT FOUND in any namespace]"
  fi

  echo ""
}

##############################################################################
# Kiali Installation Functions
##############################################################################

# Copy mTLS client certificates from ACM Observability secrets.
# ACM creates the observability-grafana-certs secret automatically when
# MultiClusterObservability is deployed. This secret contains:
#   - tls.crt: Client certificate for mTLS authentication
#   - tls.key: Client private key for mTLS authentication
# These certificates are already trusted by ACM's Observatorium/Thanos components.
# The CA bundle for server trust is extracted separately by setup_kiali_ca_bundle().
copy_acm_mtls_certs() {
  local cert_dir="$1"

  infomsg "Copying mTLS client certificates from ACM Observability..."

  # Create temporary directory
  mkdir -p "${cert_dir}"

  # Check if the ACM grafana certs secret exists
  if ! ${CLIENT_EXE} get secret observability-grafana-certs -n ${OBSERVABILITY_NAMESPACE} &>/dev/null 2>&1; then
    errormsg "ACM observability-grafana-certs secret not found in ${OBSERVABILITY_NAMESPACE}"
    errormsg "Make sure MultiClusterObservability is fully deployed and ready."
    return 1
  fi

  # Extract tls.crt from ACM's grafana certs secret
  infomsg "Extracting client certificate from observability-grafana-certs..."
  ${CLIENT_EXE} get secret observability-grafana-certs -n ${OBSERVABILITY_NAMESPACE} \
    -o jsonpath='{.data.tls\.crt}' | base64 -d > "${cert_dir}/tls.crt"

  # Extract tls.key from ACM's grafana certs secret
  infomsg "Extracting client key from observability-grafana-certs..."
  ${CLIENT_EXE} get secret observability-grafana-certs -n ${OBSERVABILITY_NAMESPACE} \
    -o jsonpath='{.data.tls\.key}' | base64 -d > "${cert_dir}/tls.key"

  # Verify the certificates were extracted
  if [ ! -s "${cert_dir}/tls.crt" ] || [ ! -s "${cert_dir}/tls.key" ]; then
    errormsg "Failed to extract certificates from ACM secrets"
    return 1
  fi

  debug "Certificate files extracted successfully to ${cert_dir}"
  debug "Client certificate: ${cert_dir}/tls.crt"
  debug "Client key: ${cert_dir}/tls.key"
  return 0
}

# Set up the CA bundle ConfigMap for Kiali to trust the ACM Observability server certificate.
# The Kiali Helm chart creates kiali-cabundle-openshift (for OpenShift service CA) and
# uses a projected volume to automatically combine it with kiali-cabundle (custom CAs).
# This function creates kiali-cabundle with only the ACM CA - the projected volume will
# merge it with OpenShift's service CA automatically.
# Per Kiali docs: https://kiali.io/docs/configuration/p8s-jaeger-grafana/tls-configuration/
# Per Red Hat blog: https://www.redhat.com/en/blog/how-your-grafana-can-fetch-metrics-from-red-hat-advanced-cluster-management-observability-observatorium-and-thanos
setup_kiali_ca_bundle() {
  local configmap_name="kiali-cabundle"

  infomsg "Setting up CA bundle for ACM Observability server trust..."

  local acm_ca=""

  # Deterministically identify which CA to extract by inspecting the Observatorium API server certificate.
  # This approach works across ACM versions by checking the actual certificate issuer.
  infomsg "Identifying CA certificate by inspecting Observatorium API server certificate..."

  # Get the Observatorium API route hostname
  local obs_route_host=$(${CLIENT_EXE} get route observatorium-api -n ${OBSERVABILITY_NAMESPACE} -o jsonpath='{.spec.host}' 2>/dev/null)
  if [ -z "${obs_route_host}" ]; then
    errormsg "Could not get Observatorium API route hostname"
    return 1
  fi
  debug "Observatorium API hostname: ${obs_route_host}"

  # Inspect the server certificate to determine which CA issued it
  local issuer_cn=$(echo | openssl s_client -connect "${obs_route_host}:443" -servername "${obs_route_host}" -showcerts 2>/dev/null | openssl x509 -noout -issuer 2>/dev/null | grep -o 'CN=[^,]*' | cut -d= -f2)

  if [ -z "${issuer_cn}" ]; then
    warnmsg "Could not determine server certificate issuer via openssl inspection"
    warnmsg "Falling back to trying observability-server-ca-certs..."
    issuer_cn="observability-server-ca-certificate"
  else
    infomsg "Server certificate issued by: ${issuer_cn}"
  fi

  # Extract the matching CA certificate based on the issuer CN
  if [[ "${issuer_cn}" == *"observability-server-ca-certificate"* ]]; then
    infomsg "Extracting CA from observability-server-ca-certs (ca.crt key)..."
    acm_ca=$(${CLIENT_EXE} get secret observability-server-ca-certs -n ${OBSERVABILITY_NAMESPACE} \
      -o jsonpath='{.data.ca\.crt}' 2>/dev/null | base64 -d)
  elif [[ "${issuer_cn}" == *"observability-client-ca-certificate"* ]]; then
    infomsg "Extracting CA from observability-client-ca-certs (ca.crt key)..."
    acm_ca=$(${CLIENT_EXE} get secret observability-client-ca-certs -n ${OBSERVABILITY_NAMESPACE} \
      -o jsonpath='{.data.ca\.crt}' 2>/dev/null | base64 -d)
  else
    warnmsg "Unknown issuer CN: ${issuer_cn}. Trying observability-server-ca-certs as default..."
    acm_ca=$(${CLIENT_EXE} get secret observability-server-ca-certs -n ${OBSERVABILITY_NAMESPACE} \
      -o jsonpath='{.data.ca\.crt}' 2>/dev/null | base64 -d)
  fi

  if [ -z "${acm_ca}" ]; then
    errormsg "Could not retrieve ACM observability CA certificate."
    errormsg "Kiali will not be able to verify the Observatorium API server certificate."
    return 1
  fi

  # Create or update the kiali-cabundle ConfigMap with the ACM CA only.
  # The Helm chart will create kiali-cabundle-openshift for the OpenShift service CA,
  # and use a projected volume to automatically combine both ConfigMaps.
  # Key MUST be 'additional-ca-bundle.pem' as per Kiali documentation.
  if ${CLIENT_EXE} get configmap "${configmap_name}" -n ${KIALI_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Updating existing ${configmap_name} ConfigMap..."
    ${CLIENT_EXE} delete configmap "${configmap_name}" -n ${KIALI_NAMESPACE}
  fi

  infomsg "Creating ${configmap_name} ConfigMap with ACM observability CA..."
  cat <<EOF | ${CLIENT_EXE} apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${configmap_name}
  namespace: ${KIALI_NAMESPACE}
  labels:
    app.kubernetes.io/managed-by: Helm
  annotations:
    meta.helm.sh/release-name: kiali
    meta.helm.sh/release-namespace: ${KIALI_NAMESPACE}
data:
  additional-ca-bundle.pem: |
$(echo "${acm_ca}" | sed 's/^/    /')
EOF

  debug "CA bundle ConfigMap created. Helm chart will merge with OpenShift service CA via projected volume."
}

# Create the Kubernetes secret containing mTLS client certificates for Kiali.
# Per the ACM Observability documentation, only tls.crt and tls.key are needed.
# The CA bundle for server trust is provided separately via kiali-cabundle ConfigMap.
create_kiali_mtls_secret() {
  local cert_dir="$1"
  local secret_name="acm-observability-certs"

  infomsg "Creating mTLS certificate secret for Kiali..."

  # Verify certificate files exist
  if [ ! -f "${cert_dir}/tls.crt" ] || [ ! -f "${cert_dir}/tls.key" ]; then
    errormsg "Certificate files not found in ${cert_dir}"
    return 1
  fi

  # Create or update the secret
  # Only include tls.crt and tls.key - the CA bundle is in a separate ConfigMap
  if ${CLIENT_EXE} get secret "${secret_name}" -n ${KIALI_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Updating existing ${secret_name} secret..."
    ${CLIENT_EXE} delete secret "${secret_name}" -n ${KIALI_NAMESPACE}
  fi

  ${CLIENT_EXE} create secret generic "${secret_name}" \
    -n ${KIALI_NAMESPACE} \
    --from-file=tls.crt="${cert_dir}/tls.crt" \
    --from-file=tls.key="${cert_dir}/tls.key"

  debug "mTLS secret created: ${secret_name}"
}

install_kiali() {
  infomsg "Installing Kiali with ACM observability integration (mTLS)..."

  # Verify ACM observability is installed
  if ! ${CLIENT_EXE} get mco observability &>/dev/null 2>&1; then
    errormsg "ACM observability is not installed (MultiClusterObservability not found)."
    errormsg "Please run '$0 install-acm' first to install ACM with observability."
    return 1
  fi

  # Get cluster apps domain for constructing the Observatorium API route URL
  local apps_domain=$(${CLIENT_EXE} get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}')
  if [ -z "${apps_domain}" ]; then
    errormsg "Could not determine cluster apps domain"
    return 1
  fi

  # Use the Observatorium API route with HTTPS and mTLS authentication.
  # This is the proper way to access ACM observability externally with client certificates.
  # Per Red Hat blog: https://www.redhat.com/en/blog/how-your-grafana-can-fetch-metrics-from-red-hat-advanced-cluster-management-observability-observatorium-and-thanos
  # The Observatorium API proxies requests to internal Thanos services and handles TLS termination.
  local prometheus_url="https://observatorium-api-${OBSERVABILITY_NAMESPACE}.${apps_domain}/api/metrics/v1/default"
  infomsg "Using ACM observability endpoint: observatorium-api (HTTPS/mTLS)"
  debug "Prometheus URL: ${prometheus_url}"

  # Check if helm is available
  if ! command -v helm &>/dev/null; then
    errormsg "helm is not installed or not in PATH"
    return 1
  fi


  # Verify directories exist
  if [ ! -d "${KIALI_REPO_DIR}" ]; then
    errormsg "Kiali repository directory not found: ${KIALI_REPO_DIR}"
    return 1
  fi

  if [ ! -d "${HELM_CHARTS_DIR}" ]; then
    errormsg "Helm charts directory not found: ${HELM_CHARTS_DIR}"
    return 1
  fi

  # Build helm charts if the tgz doesn't exist
  local helm_chart_tgz=$(ls ${HELM_CHARTS_DIR}/_output/charts/kiali-server-*.tgz 2>/dev/null | head -1)
  if [ -z "${helm_chart_tgz}" ]; then
    infomsg "Building helm charts..."
    pushd "${HELM_CHARTS_DIR}" > /dev/null
    make build-helm-charts
    popd > /dev/null
    helm_chart_tgz=$(ls ${HELM_CHARTS_DIR}/_output/charts/kiali-server-*.tgz 2>/dev/null | head -1)
    if [ -z "${helm_chart_tgz}" ]; then
      errormsg "Failed to build kiali-server helm chart"
      return 1
    fi
  fi
  infomsg "Using helm chart: ${helm_chart_tgz}"

  # Create Kiali namespace if it doesn't exist
  if ! ${CLIENT_EXE} get namespace ${KIALI_NAMESPACE} &>/dev/null; then
    infomsg "Creating namespace: ${KIALI_NAMESPACE}"
    ${CLIENT_EXE} create namespace ${KIALI_NAMESPACE}
  fi

  # Copy mTLS certificates from ACM Observability
  # ACM creates trusted client certificates that we use for Kiali's authentication.
  # These are long-lived certificates (typically 1 year) from observability-grafana-certs.
  local cert_dir="/tmp/kiali-mtls-certs-$$"
  if ! copy_acm_mtls_certs "${cert_dir}"; then
    errormsg "Failed to copy mTLS certificates from ACM"
    errormsg "Ensure MultiClusterObservability is fully deployed and the"
    errormsg "observability-grafana-certs secret exists in ${OBSERVABILITY_NAMESPACE}"
    rm -rf "${cert_dir}"
    return 1
  fi

  # Create the mTLS secret in Kiali's namespace
  if ! create_kiali_mtls_secret "${cert_dir}"; then
    errormsg "Failed to create mTLS secret"
    rm -rf "${cert_dir}"
    return 1
  fi

  # Set up CA bundle for trusting the Thanos server certificate
  setup_kiali_ca_bundle

  # Clean up temporary certificate files
  rm -rf "${cert_dir}"

  # Build and push Kiali image
  infomsg "Building and pushing Kiali image to cluster..."
  pushd "${KIALI_REPO_DIR}" > /dev/null
  make cluster-push-kiali
  popd > /dev/null

  # Get dynamic values from cluster
  local internal_registry=$(${CLIENT_EXE} get image.config.openshift.io/cluster -o jsonpath='{.status.internalRegistryHostname}')

  if [ -z "${internal_registry}" ]; then
    errormsg "Could not determine internal registry hostname"
    return 1
  fi

  local kiali_image="${internal_registry}/kiali/kiali"
  local kiali_route_url="https://kiali-${KIALI_NAMESPACE}.${apps_domain}"

  debug "Internal registry: ${internal_registry}"
  debug "Apps domain: ${apps_domain}"
  debug "Kiali image: ${kiali_image}"
  debug "Kiali route URL: ${kiali_route_url}"
  debug "Prometheus URL: ${prometheus_url}"

  # Helm install/upgrade Kiali with mTLS authentication to ACM Observability
  local helm_cmd="install"
  if helm status kiali -n ${KIALI_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Kiali is already installed. Upgrading..."
    helm_cmd="upgrade"
  else
    infomsg "Installing Kiali via Helm..."
  fi

  # Helm install/upgrade with mTLS configuration
  # Using 'type: none' means no Authorization header - authentication is via mTLS client certificates.
  # The cert_file and key_file reference the acm-observability-certs secret for client authentication.
  # CA trust is configured via the kiali-cabundle ConfigMap (not via deprecated ca_file parameter).
  # On OpenShift, the projected volume automatically combines:
  #   - kiali-cabundle-openshift: OpenShift service CA (auto-created)
  #   - kiali-cabundle: ACM observability CA (we create this above)
  helm ${helm_cmd} kiali "${helm_chart_tgz}" \
    --namespace ${KIALI_NAMESPACE} \
    --set deployment.image_name="${kiali_image}" \
    --set deployment.image_version="dev" \
    --set deployment.image_pull_policy="Always" \
    --set auth.strategy="openshift" \
    --set kiali_route_url="${kiali_route_url}" \
    --set external_services.prometheus.url="${prometheus_url}" \
    --set external_services.prometheus.auth.type="none" \
    --set external_services.prometheus.auth.cert_file="secret:acm-observability-certs:tls.crt" \
    --set external_services.prometheus.auth.key_file="secret:acm-observability-certs:tls.key" \
    --set external_services.prometheus.thanos_proxy.enabled="true" \
    --set external_services.prometheus.thanos_proxy.retention_period="14d" \
    --set external_services.prometheus.thanos_proxy.scrape_interval="30s" \
    --set deployment.logger.log_level="debug"

  # Wait for Kiali to be ready
  infomsg "Waiting for Kiali deployment to be ready..."
  ${CLIENT_EXE} rollout status deployment/kiali -n ${KIALI_NAMESPACE} --timeout=${TIMEOUT}s

  # Create RBAC for ACM observability access
  # Even with mTLS, Kiali needs cluster-wide read permissions to query metrics
  # for workloads across namespaces.
  infomsg "Configuring RBAC for ACM observability access..."
  if ! ${CLIENT_EXE} get clusterrolebinding kiali-acm-observability &>/dev/null 2>&1; then
    ${CLIENT_EXE} create clusterrolebinding kiali-acm-observability \
      --clusterrole=view \
      --serviceaccount=${KIALI_NAMESPACE}:kiali || true
  fi

  infomsg "======================================"
  infomsg "Kiali installation complete!"
  infomsg "======================================"
  infomsg "Kiali Namespace: ${KIALI_NAMESPACE}"
  infomsg "Kiali URL: ${kiali_route_url}"
  infomsg "Prometheus Backend: ${prometheus_url}"
  infomsg "Authentication: mTLS (long-lived client certificates from ACM)"
  infomsg ""
  infomsg "mTLS configuration:"
  infomsg "  Client certificates: secret/acm-observability-certs (copied from ACM)"
  infomsg "  Server CA trust:     Projected volume combining:"
  infomsg "    - configmap/kiali-cabundle-openshift (OpenShift service CA, auto-injected)"
  infomsg "    - configmap/kiali-cabundle (ACM observability CA)"
  infomsg "  Note: Helm chart automatically combines both CAs via projected volume"
  infomsg ""
  infomsg "To access Kiali, open: ${kiali_route_url}"
}

uninstall_kiali() {
  infomsg "Uninstalling Kiali..."

  # Delete Helm release
  if helm status kiali -n ${KIALI_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Removing Kiali Helm release..."
    helm uninstall kiali -n ${KIALI_NAMESPACE}
  else
    debug "Kiali Helm release not found, skipping"
  fi

  # Delete mTLS certificate secret
  if ${CLIENT_EXE} get secret acm-observability-certs -n ${KIALI_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Removing mTLS certificate secret..."
    ${CLIENT_EXE} delete secret acm-observability-certs -n ${KIALI_NAMESPACE} || true
  fi

  # Delete CA bundle ConfigMap
  if ${CLIENT_EXE} get configmap kiali-cabundle -n ${KIALI_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Removing CA bundle ConfigMap..."
    ${CLIENT_EXE} delete configmap kiali-cabundle -n ${KIALI_NAMESPACE} || true
  fi

  # Delete RBAC
  if ${CLIENT_EXE} get clusterrolebinding kiali-acm-observability &>/dev/null 2>&1; then
    infomsg "Removing Kiali ACM RBAC..."
    ${CLIENT_EXE} delete clusterrolebinding kiali-acm-observability || true
  fi

  infomsg "Kiali uninstallation complete!"
}

status_kiali() {
  infomsg "Checking Kiali status..."
  echo ""

  # Check Kiali namespace
  if ${CLIENT_EXE} get namespace ${KIALI_NAMESPACE} &>/dev/null; then
    echo "Kiali Namespace: ${KIALI_NAMESPACE} [EXISTS]"
  else
    echo "Kiali Namespace: ${KIALI_NAMESPACE} [NOT FOUND]"
    echo ""
    echo "Kiali does not appear to be installed."
    return
  fi

  # Check Helm release
  if helm status kiali -n ${KIALI_NAMESPACE} &>/dev/null 2>&1; then
    local helm_status=$(helm status kiali -n ${KIALI_NAMESPACE} -o json 2>/dev/null | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    echo "Helm Release: ${helm_status:-deployed}"
  else
    echo "Helm Release: [NOT FOUND]"
    echo ""
    echo "Kiali does not appear to be installed via Helm."
    return
  fi

  # Check deployment
  local deployment_ready=$(${CLIENT_EXE} get deployment kiali -n ${KIALI_NAMESPACE} -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
  local deployment_desired=$(${CLIENT_EXE} get deployment kiali -n ${KIALI_NAMESPACE} -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
  echo "Deployment: ${deployment_ready}/${deployment_desired} ready"

  # Check route
  local route_host=$(${CLIENT_EXE} get route kiali -n ${KIALI_NAMESPACE} -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
  if [ -n "${route_host}" ]; then
    echo "Route: https://${route_host}"
  else
    echo "Route: [NOT FOUND]"
  fi

  # Check Prometheus configuration
  local prometheus_url=$(${CLIENT_EXE} get configmap kiali -n ${KIALI_NAMESPACE} -o jsonpath='{.data.config\.yaml}' 2>/dev/null | grep -A1 "prometheus:" | grep "url:" | awk '{print $2}' || echo "")
  if [ -n "${prometheus_url}" ]; then
    echo "Prometheus URL: ${prometheus_url}"
  fi

  # Check mTLS certificate secret
  if ${CLIENT_EXE} get secret acm-observability-certs -n ${KIALI_NAMESPACE} &>/dev/null 2>&1; then
    echo "mTLS Certificate Secret: [EXISTS]"
    # Show certificate expiration if possible
    local cert_data=$(${CLIENT_EXE} get secret acm-observability-certs -n ${KIALI_NAMESPACE} -o jsonpath='{.data.tls\.crt}' 2>/dev/null)
    if [ -n "${cert_data}" ]; then
      local cert_expiry=$(echo "${cert_data}" | base64 -d 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
      if [ -n "${cert_expiry}" ]; then
        echo "  Certificate Expiry: ${cert_expiry}"
      fi
    fi
  else
    echo "mTLS Certificate Secret: [NOT FOUND]"
  fi

  # Check CA bundle ConfigMaps (projected volume combines both)
  if ${CLIENT_EXE} get configmap kiali-cabundle-openshift -n ${KIALI_NAMESPACE} &>/dev/null 2>&1; then
    echo "CA Bundle ConfigMap (OpenShift service CA): [EXISTS]"
  else
    echo "CA Bundle ConfigMap (OpenShift service CA): [NOT FOUND]"
  fi

  if ${CLIENT_EXE} get configmap kiali-cabundle -n ${KIALI_NAMESPACE} &>/dev/null 2>&1; then
    echo "CA Bundle ConfigMap (ACM observability CA): [EXISTS]"
    # Check if it has the ACM CA
    local has_acm_ca=$(${CLIENT_EXE} get configmap kiali-cabundle -n ${KIALI_NAMESPACE} -o jsonpath='{.data.additional-ca-bundle\.pem}' 2>/dev/null)
    if [ -n "${has_acm_ca}" ]; then
      echo "  ACM CA in additional-ca-bundle.pem: [EXISTS]"
    fi
  else
    echo "CA Bundle ConfigMap (ACM observability CA): [NOT FOUND]"
  fi

  # Check ACM RBAC
  if ${CLIENT_EXE} get clusterrolebinding kiali-acm-observability &>/dev/null 2>&1; then
    echo "ACM Observability RBAC: [EXISTS]"
  else
    echo "ACM Observability RBAC: [NOT FOUND]"
  fi

  echo ""
}

##############################################################################
# OpenShift Initialization Functions
##############################################################################

enable_user_workload_monitoring() {
  # Enable User Workload Monitoring (UWM) for the cluster.
  # UWM is required for Istio metrics collection via PodMonitor/ServiceMonitor resources.
  # Per Red Hat docs: https://docs.redhat.com/en/documentation/monitoring_stack_for_red_hat_openshift/4.20/html-single/configuring_user_workload_monitoring/index
  infomsg "Enabling User Workload Monitoring..."

  # Check if already enabled
  if ${CLIENT_EXE} get statefulset prometheus-user-workload -n openshift-user-workload-monitoring &>/dev/null 2>&1; then
    infomsg "User Workload Monitoring is already enabled"
    return 0
  fi

  # Check if cluster-monitoring-config ConfigMap exists
  if ! ${CLIENT_EXE} get configmap cluster-monitoring-config -n openshift-monitoring &>/dev/null 2>&1; then
    infomsg "Creating cluster-monitoring-config ConfigMap..."
    cat <<EOF | ${CLIENT_EXE} apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: cluster-monitoring-config
  namespace: openshift-monitoring
data:
  config.yaml: |
    enableUserWorkload: true
EOF
  else
    infomsg "Updating cluster-monitoring-config ConfigMap..."
    # Get existing config, add enableUserWorkload if not present
    local existing_config=$(${CLIENT_EXE} get configmap cluster-monitoring-config -n openshift-monitoring -o jsonpath='{.data.config\.yaml}' 2>/dev/null)

    if echo "${existing_config}" | grep -q "enableUserWorkload"; then
      # Already has the setting, just update it to true
      ${CLIENT_EXE} patch configmap cluster-monitoring-config -n openshift-monitoring --type merge -p '{"data":{"config.yaml":"enableUserWorkload: true\n"}}'
    else
      # Doesn't have the setting, add it
      ${CLIENT_EXE} patch configmap cluster-monitoring-config -n openshift-monitoring --type merge -p '{"data":{"config.yaml":"enableUserWorkload: true\n"}}'
    fi
  fi

  # Wait for User Workload Monitoring pods to be created
  infomsg "Waiting for User Workload Monitoring pods to be created (this may take 1-2 minutes)..."
  local max_wait=180
  local waited=0
  while ! ${CLIENT_EXE} get statefulset prometheus-user-workload -n openshift-user-workload-monitoring &>/dev/null 2>&1; do
    if [ ${waited} -ge ${max_wait} ]; then
      errormsg "Timeout waiting for User Workload Monitoring to be enabled"
      return 1
    fi
    debug "Waiting for prometheus-user-workload statefulset... (${waited}s)"
    sleep 5
    waited=$((waited + 5))
  done

  # Wait for pods to be ready
  infomsg "Waiting for User Workload Monitoring pods to be ready..."
  ${CLIENT_EXE} wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus -n openshift-user-workload-monitoring --timeout=300s || true

  infomsg "User Workload Monitoring enabled successfully"
  return 0
}

##############################################################################
# Istio Functions
##############################################################################

install_istio() {
  if [ "${AMBIENT_MODE}" == "true" ]; then
    infomsg "Installing Istio via Sail Operator with Ambient mode enabled..."
  else
    infomsg "Installing Istio via Sail Operator..."
  fi

  if [ ! -f "${SCRIPT_DIR}/istio/install-istio-via-sail.sh" ]; then
    errormsg "Istio installation script not found at ${SCRIPT_DIR}/istio/install-istio-via-sail.sh"
    return 1
  fi

  local istio_args=""
  if [ "${AMBIENT_MODE}" == "true" ]; then
    istio_args="${istio_args} --config-profile ambient"
  fi

  "${SCRIPT_DIR}/istio/install-istio-via-sail.sh" ${istio_args}
  if [ $? -ne 0 ]; then
    errormsg "Istio installation failed"
    return 1
  fi

  infomsg "Istio installed successfully"

  infomsg "======================================"
  infomsg "Istio installation complete!"
  infomsg "======================================"
  infomsg "Mode: $([ "${AMBIENT_MODE}" == "true" ] && echo "Ambient (sidecar + ztunnel/waypoint)" || echo "Sidecar")"
  infomsg ""
  infomsg "Next steps:"
  infomsg "  1. Run: $0 install-acm"
  infomsg "  2. Run: $0 install-kiali"
  infomsg "  3. Run: $0 install-app"
}

uninstall_istio() {
  infomsg "Uninstalling Istio (Sail Operator)..."

  # Delete Telemetry CR first (before namespace deletion)
  infomsg "Deleting Telemetry CR..."
  ${CLIENT_EXE} delete telemetry otel-tracing -n istio-system --ignore-not-found 2>/dev/null || true

  # Delete Sail Operator CRs (these control the Istio components)
  infomsg "Deleting Istio CR..."
  ${CLIENT_EXE} delete istio default --ignore-not-found 2>/dev/null || true

  infomsg "Deleting IstioCNI CR..."
  ${CLIENT_EXE} delete istiocni default --ignore-not-found 2>/dev/null || true

  infomsg "Deleting ZTunnel CR..."
  ${CLIENT_EXE} delete ztunnel default --ignore-not-found 2>/dev/null || true

  # Wait for Sail Operator to clean up resources
  infomsg "Waiting for Sail Operator to clean up resources..."
  sleep 15

  # Uninstall Sail Operator via Helm
  infomsg "Uninstalling Sail Operator..."
  helm uninstall sail-operator -n sail-operator 2>/dev/null || true

  # Delete namespaces created by the Sail script
  infomsg "Deleting Istio namespaces..."
  ${CLIENT_EXE} delete namespace istio-system --ignore-not-found --wait=false 2>/dev/null || true
  ${CLIENT_EXE} delete namespace istio-cni --ignore-not-found --wait=false 2>/dev/null || true
  ${CLIENT_EXE} delete namespace ztunnel --ignore-not-found --wait=false 2>/dev/null || true
  ${CLIENT_EXE} delete namespace sail-operator --ignore-not-found --wait=false 2>/dev/null || true

  # Clean up OpenTelemetry Operator if it was installed (for tempo addon)
  if ${CLIENT_EXE} get namespace opentelemetry-operator-system &>/dev/null 2>&1; then
    infomsg "Cleaning up OpenTelemetry Operator..."
    ${CLIENT_EXE} delete -f https://github.com/open-telemetry/opentelemetry-operator/releases/latest/download/opentelemetry-operator.yaml --ignore-not-found 2>/dev/null || true
    ${CLIENT_EXE} delete namespace opentelemetry-operator-system --ignore-not-found --wait=false 2>/dev/null || true
  fi

  # Clean up Sail Operator CRDs explicitly
  infomsg "Cleaning up Sail Operator CRDs..."
  ${CLIENT_EXE} delete crd istios.sailoperator.io --ignore-not-found 2>/dev/null || true
  ${CLIENT_EXE} delete crd istiocnis.sailoperator.io --ignore-not-found 2>/dev/null || true
  ${CLIENT_EXE} delete crd ztunnels.sailoperator.io --ignore-not-found 2>/dev/null || true
  ${CLIENT_EXE} delete crd istiorevisions.sailoperator.io --ignore-not-found 2>/dev/null || true
  ${CLIENT_EXE} delete crd istiorevisiontags.sailoperator.io --ignore-not-found 2>/dev/null || true

  # Clean up any remaining Istio CRDs
  infomsg "Cleaning up Istio CRDs..."
  ${CLIENT_EXE} get crd -o name 2>/dev/null | grep -E "\.istio\.io" | xargs -r ${CLIENT_EXE} delete --ignore-not-found 2>/dev/null || true

  # Clean up GatewayClasses created by Istio
  infomsg "Cleaning up GatewayClasses..."
  ${CLIENT_EXE} delete gatewayclass istio istio-remote istio-waypoint --ignore-not-found 2>/dev/null || true

  # Clean up istio-ca ConfigMaps that get distributed to all namespaces
  infomsg "Cleaning up istio-ca ConfigMaps..."
  for ns in $(${CLIENT_EXE} get cm -A -o custom-columns='NS:.metadata.namespace,NAME:.metadata.name' --no-headers 2>/dev/null | grep -E "istio-ca-root-cert|istio-ca-crl" | awk '{print $1}' | sort -u); do
    ${CLIENT_EXE} delete cm istio-ca-root-cert istio-ca-crl -n "$ns" --ignore-not-found 2>/dev/null || true
  done

  # Clean up Gateway API CRDs
  infomsg "Cleaning up Gateway API CRDs..."
  ${CLIENT_EXE} get crd -o name 2>/dev/null | grep -E "\.gateway\.networking\.k8s\.io" | xargs -r ${CLIENT_EXE} delete --ignore-not-found 2>/dev/null || true

  # Clean up Gateway API Inference Extension CRDs (both k8s.io and x-k8s.io suffixes)
  infomsg "Cleaning up Gateway API Inference Extension CRDs..."
  ${CLIENT_EXE} get crd -o name 2>/dev/null | grep -E "\.inference\.networking\.(k8s|x-k8s)\.io" | xargs -r ${CLIENT_EXE} delete --ignore-not-found 2>/dev/null || true

  # Clean up ClusterRole/ClusterRoleBinding created by Istio addons (prometheus, grafana, etc.)
  infomsg "Cleaning up addon ClusterRoles and ClusterRoleBindings..."
  ${CLIENT_EXE} delete clusterrole prometheus --ignore-not-found 2>/dev/null || true
  ${CLIENT_EXE} delete clusterrolebinding prometheus --ignore-not-found 2>/dev/null || true

  infomsg "Istio uninstalled successfully"
}

status_istio() {
  infomsg "Checking Istio status (Sail Operator)..."
  echo ""

  # Check Sail Operator
  echo "=== Sail Operator ==="
  if ${CLIENT_EXE} get namespace sail-operator &>/dev/null; then
    echo "Namespace: sail-operator [EXISTS]"
    ${CLIENT_EXE} get pods -n sail-operator 2>/dev/null || echo "  No pods"
  else
    echo "Namespace: sail-operator [NOT FOUND]"
  fi

  # Check Istio CR
  echo ""
  echo "=== Istio CR ==="
  ${CLIENT_EXE} get istio default 2>/dev/null || echo "  Istio CR not found"

  # Check namespace
  echo ""
  echo "=== istio-system Namespace ==="
  if ${CLIENT_EXE} get namespace istio-system &>/dev/null; then
    echo "Namespace: istio-system [EXISTS]"
  else
    echo "Namespace: istio-system [NOT FOUND]"
    return 1
  fi

  # Check istiod
  echo ""
  echo "=== Istiod ==="
  ${CLIENT_EXE} get deployment istiod -n istio-system 2>/dev/null || echo "  Not found"

  # Check CNI (Sail uses istio-cni namespace)
  echo ""
  echo "=== CNI (istio-cni namespace) ==="
  if ${CLIENT_EXE} get namespace istio-cni &>/dev/null; then
    ${CLIENT_EXE} get istiocni default 2>/dev/null || echo "  IstioCNI CR not found"
    ${CLIENT_EXE} get ds -n istio-cni 2>/dev/null || echo "  No DaemonSets"
    ${CLIENT_EXE} get pods -n istio-cni 2>/dev/null || echo "  No pods"
  else
    echo "  istio-cni namespace not found (CNI not installed or using different namespace)"
    # Also check kube-system for istioctl-based installs
    ${CLIENT_EXE} get ds istio-cni-node -n kube-system 2>/dev/null || echo "  Not in kube-system either"
  fi

  # Check ztunnel (Sail uses ztunnel namespace for Ambient mode)
  echo ""
  echo "=== Ztunnel (Ambient mode) ==="
  if ${CLIENT_EXE} get namespace ztunnel &>/dev/null; then
    ${CLIENT_EXE} get ztunnel default 2>/dev/null || echo "  ZTunnel CR not found"
    ${CLIENT_EXE} get ds -n ztunnel 2>/dev/null || echo "  No DaemonSets"
    ${CLIENT_EXE} get pods -n ztunnel 2>/dev/null || echo "  No pods"
    echo "  Ambient mode: ENABLED"
  else
    # Also check istio-system for istioctl-based installs
    if ${CLIENT_EXE} get ds ztunnel -n istio-system &>/dev/null 2>&1; then
      ${CLIENT_EXE} get ds ztunnel -n istio-system
      echo "  Ambient mode: ENABLED (istioctl install)"
    else
      echo "  ztunnel namespace not found (Ambient mode not enabled)"
    fi
  fi

  # Check all pods in istio-system
  echo ""
  echo "=== Istio System Pods ==="
  ${CLIENT_EXE} get pods -n istio-system

  # Check addons
  echo ""
  echo "=== Addons ==="
  for addon in prometheus grafana jaeger; do
    if ${CLIENT_EXE} get deployment ${addon} -n istio-system &>/dev/null 2>&1; then
      echo "  ${addon}: installed"
    else
      echo "  ${addon}: not found"
    fi
  done
}

init_openshift() {
  infomsg "Initializing OpenShift cluster using CRC..."

  # Check if crc-openshift.sh exists
  if [ ! -f "${SCRIPT_DIR}/crc-openshift.sh" ]; then
    errormsg "Cannot find crc-openshift.sh script at ${SCRIPT_DIR}/crc-openshift.sh"
    return 1
  fi

  # Check if pull secret file is provided
  if [ -z "${CRC_PULL_SECRET_FILE}" ]; then
    errormsg "Pull secret file is required. Use --crc-pull-secret-file option."
    errormsg "You can download the pull secret from https://console.redhat.com/openshift/create/local"
    return 1
  fi

  if [ ! -f "${CRC_PULL_SECRET_FILE}" ]; then
    errormsg "Pull secret file not found: ${CRC_PULL_SECRET_FILE}"
    return 1
  fi

  infomsg "Starting CRC with configuration:"
  infomsg "  CPUs: ${CRC_CPUS}"
  infomsg "  Disk Size: ${CRC_DISK_SIZE} GB"
  infomsg "  Pull Secret: ${CRC_PULL_SECRET_FILE}"
  infomsg "  Cluster Monitoring: enabled"

  # Start CRC cluster
  "${SCRIPT_DIR}/crc-openshift.sh" \
    --enable-cluster-monitoring true \
    --crc-cpus "${CRC_CPUS}" \
    --crc-virtual-disk-size "${CRC_DISK_SIZE}" \
    -p "${CRC_PULL_SECRET_FILE}" \
    start

  if [ $? -ne 0 ]; then
    errormsg "Failed to start CRC cluster"
    return 1
  fi

  infomsg "CRC cluster started successfully"

  # Log into the cluster
  infomsg "Logging into OpenShift cluster..."
  ${CLIENT_EXE} login -u kubeadmin -p kiali --server https://api.crc.testing:6443

  if [ $? -ne 0 ]; then
    errormsg "Failed to log into OpenShift cluster"
    return 1
  fi

  infomsg "Logged into OpenShift cluster as kubeadmin"

  # Enable User Workload Monitoring (required for ACM observability)
  enable_user_workload_monitoring
  if [ $? -ne 0 ]; then
    errormsg "Failed to enable User Workload Monitoring"
    return 1
  fi

  # Log into the image registry
  infomsg "Logging into the image registry..."
  podman login --tls-verify=false -u kiali -p $(${CLIENT_EXE} whoami -t) default-route-openshift-image-registry.apps-crc.testing

  if [ $? -ne 0 ]; then
    warnmsg "Failed to log into image registry (this may not be critical)"
  else
    infomsg "Logged into image registry"
  fi

  infomsg "======================================"
  infomsg "OpenShift initialization complete!"
  infomsg "======================================"
  infomsg "Cluster: https://api.crc.testing:6443"
  infomsg "Console: https://console-openshift-console.apps-crc.testing"
  infomsg "Username: kubeadmin"
  infomsg "Password: kiali"
  infomsg ""
  infomsg "Next steps:"
  infomsg "  1. Run: $0 install-istio    (use --ambient for Ambient mode)"
  infomsg "  2. Run: $0 install-acm"
  infomsg "  3. Run: $0 install-kiali"
  infomsg "  4. Run: $0 install-app"
}

##############################################################################
# Test App Functions
##############################################################################

install_app() {
  infomsg "Installing test application..."

  # Create namespace with Istio injection
  if ! ${CLIENT_EXE} get namespace ${APP_NAMESPACE} &>/dev/null; then
    infomsg "Creating namespace: ${APP_NAMESPACE}"
    ${CLIENT_EXE} create namespace ${APP_NAMESPACE}
  fi

  # Enable Istio sidecar injection
  infomsg "Enabling Istio sidecar injection..."
  ${CLIENT_EXE} label namespace ${APP_NAMESPACE} istio-injection=enabled --overwrite

  # Create ConfigMap with HTML content
  infomsg "Creating HTML content ConfigMap..."
  ${CLIENT_EXE} apply -n ${APP_NAMESPACE} -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: hello-world-html
data:
  index.html: |
    <!DOCTYPE html>
    <html>
    <head><title>Hello World</title></head>
    <body><h1>Hello World</h1><p>This is a test application for Kiali.</p></body>
    </html>
EOF

  # Create Deployment using Red Hat UBI httpd image (OpenShift-compatible)
  infomsg "Creating deployment..."
  ${CLIENT_EXE} apply -n ${APP_NAMESPACE} -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-world
  labels:
    app: hello-world
    version: v1
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hello-world
      version: v1
  template:
    metadata:
      labels:
        app: hello-world
        version: v1
    spec:
      containers:
      - name: hello-world
        image: registry.access.redhat.com/ubi9/httpd-24:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: 10m
            memory: 32Mi
          limits:
            cpu: 50m
            memory: 64Mi
        volumeMounts:
        - name: html
          mountPath: /var/www/html
          readOnly: true
      volumes:
      - name: html
        configMap:
          name: hello-world-html
EOF

  # Create Service
  infomsg "Creating service..."
  ${CLIENT_EXE} apply -n ${APP_NAMESPACE} -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: hello-world
  labels:
    app: hello-world
spec:
  ports:
  - port: 80
    targetPort: 8080
    name: http
  selector:
    app: hello-world
EOF

  # Wait for deployment to be ready
  infomsg "Waiting for deployment to be ready..."
  ${CLIENT_EXE} rollout status deployment/hello-world -n ${APP_NAMESPACE} --timeout=${TIMEOUT}s

  # Wait for pod to be fully ready (including Istio sidecar)
  # The rollout status only checks deployment readiness, not sidecar initialization
  infomsg "Waiting for pod to be fully ready (including Istio sidecar)..."
  ${CLIENT_EXE} wait --for=condition=Ready pod -l app=hello-world -n ${APP_NAMESPACE} --timeout=${TIMEOUT}s

  # Wait for Service endpoints to be populated
  infomsg "Waiting for service endpoints to be ready..."
  local max_wait=60
  local waited=0
  while true; do
    local endpoint_ip=$(${CLIENT_EXE} get endpoints hello-world -n ${APP_NAMESPACE} -o jsonpath='{.subsets[0].addresses[0].ip}' 2>/dev/null)
    if [ -n "${endpoint_ip}" ]; then
      debug "Service endpoint ready: ${endpoint_ip}"
      break
    fi
    if [ ${waited} -ge ${max_wait} ]; then
      warnmsg "Timeout waiting for service endpoints (continuing anyway)"
      break
    fi
    sleep 2
    waited=$((waited + 2))
  done

  # Wait for Istio sidecar to be fully synced by making test requests
  # The sidecar may be "ready" but not yet synced with istiod, causing 503s
  infomsg "Waiting for Istio sidecar to be fully synced (testing connectivity)..."
  local service_url="http://hello-world.${APP_NAMESPACE}.svc.cluster.local:80"
  max_wait=60
  waited=0
  while true; do
    local http_code=$(${CLIENT_EXE} exec -n ${APP_NAMESPACE} deploy/hello-world -c hello-world -- curl -s -o /dev/null -w "%{http_code}" ${service_url} 2>/dev/null)
    if [ "${http_code}" == "200" ]; then
      debug "Service responding with HTTP 200"
      break
    fi
    if [ ${waited} -ge ${max_wait} ]; then
      warnmsg "Timeout waiting for service to respond (continuing anyway)"
      break
    fi
    debug "Service returned HTTP ${http_code}, waiting..."
    sleep 2
    waited=$((waited + 2))
  done

  # Create PodMonitor for Istio proxies in this namespace
  # Required because OpenShift monitoring ignores namespaceSelector in PodMonitor
  create_istio_podmonitor "${APP_NAMESPACE}"

  # Create metrics allowlist for ACM observability to collect Istio metrics from this namespace
  create_namespace_metrics_allowlist "${APP_NAMESPACE}"

  infomsg "======================================"
  infomsg "Test application installation complete!"
  infomsg "======================================"
  infomsg "Namespace: ${APP_NAMESPACE}"
  infomsg "Service: hello-world.${APP_NAMESPACE}.svc.cluster.local:80"
  infomsg ""
  infomsg "To generate traffic, run:"
  infomsg "  ${CLIENT_EXE} exec -n ${APP_NAMESPACE} deploy/hello-world -c hello-world -- curl -s http://127.0.0.1:8080"
}

uninstall_app() {
  infomsg "Uninstalling test application..."

  if ! ${CLIENT_EXE} get namespace ${APP_NAMESPACE} &>/dev/null; then
    infomsg "Namespace ${APP_NAMESPACE} does not exist. Nothing to uninstall."
    return 0
  fi

  # Delete deployment
  if ${CLIENT_EXE} get deployment hello-world -n ${APP_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Deleting deployment..."
    ${CLIENT_EXE} delete deployment hello-world -n ${APP_NAMESPACE}
  fi

  # Delete service
  if ${CLIENT_EXE} get service hello-world -n ${APP_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Deleting service..."
    ${CLIENT_EXE} delete service hello-world -n ${APP_NAMESPACE}
  fi

  # Delete configmap
  if ${CLIENT_EXE} get configmap hello-world-html -n ${APP_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Deleting configmap..."
    ${CLIENT_EXE} delete configmap hello-world-html -n ${APP_NAMESPACE}
  fi

  # Delete PodMonitor for Istio proxies
  if ${CLIENT_EXE} get podmonitor istio-proxies-monitor -n ${APP_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Deleting PodMonitor..."
    ${CLIENT_EXE} delete podmonitor istio-proxies-monitor -n ${APP_NAMESPACE}
  fi

  # Delete namespace
  infomsg "Deleting namespace ${APP_NAMESPACE}..."
  ${CLIENT_EXE} delete namespace ${APP_NAMESPACE} --ignore-not-found

  infomsg "Test application uninstallation complete!"
}

status_app() {
  infomsg "Checking test application status..."
  echo ""

  # Check namespace
  if ${CLIENT_EXE} get namespace ${APP_NAMESPACE} &>/dev/null; then
    echo "Namespace: ${APP_NAMESPACE} [EXISTS]"

    # Check Istio injection
    local injection=$(${CLIENT_EXE} get namespace ${APP_NAMESPACE} -o jsonpath='{.metadata.labels.istio-injection}' 2>/dev/null)
    if [ "${injection}" == "enabled" ]; then
      echo "Istio Injection: [ENABLED]"
    else
      echo "Istio Injection: [DISABLED]"
    fi
  else
    echo "Namespace: ${APP_NAMESPACE} [NOT FOUND]"
    echo ""
    echo "Test application does not appear to be installed."
    return 0
  fi

  # Check deployment
  if ${CLIENT_EXE} get deployment hello-world -n ${APP_NAMESPACE} &>/dev/null 2>&1; then
    local ready=$(${CLIENT_EXE} get deployment hello-world -n ${APP_NAMESPACE} -o jsonpath='{.status.readyReplicas}' 2>/dev/null)
    local desired=$(${CLIENT_EXE} get deployment hello-world -n ${APP_NAMESPACE} -o jsonpath='{.spec.replicas}' 2>/dev/null)
    ready=${ready:-0}
    desired=${desired:-0}
    echo "Deployment: ${ready}/${desired} ready"
  else
    echo "Deployment: [NOT FOUND]"
  fi

  # Check service
  if ${CLIENT_EXE} get service hello-world -n ${APP_NAMESPACE} &>/dev/null 2>&1; then
    echo "Service: [EXISTS]"
  else
    echo "Service: [NOT FOUND]"
  fi

  # Check pod sidecar
  local pod_name=$(${CLIENT_EXE} get pods -n ${APP_NAMESPACE} -l app=hello-world -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
  if [ -n "${pod_name}" ]; then
    local container_count=$(${CLIENT_EXE} get pod ${pod_name} -n ${APP_NAMESPACE} -o jsonpath='{.spec.containers[*].name}' 2>/dev/null | wc -w)
    if [ "${container_count}" -ge 2 ]; then
      echo "Istio Sidecar: [INJECTED]"
    else
      echo "Istio Sidecar: [NOT INJECTED]"
    fi
  fi

  echo ""
}

generate_traffic() {
  infomsg "Generating traffic to test application..."

  # Check if test app is running
  if ! ${CLIENT_EXE} get deployment hello-world -n ${APP_NAMESPACE} &>/dev/null 2>&1; then
    errormsg "Test application is not installed in namespace ${APP_NAMESPACE}"
    errormsg "Run '$0 install-app' first to install the test application"
    return 1
  fi

  # Check if deployment is ready
  local ready=$(${CLIENT_EXE} get deployment hello-world -n ${APP_NAMESPACE} -o jsonpath='{.status.readyReplicas}' 2>/dev/null)
  if [ "${ready}" != "1" ]; then
    errormsg "Test application is not ready (ready replicas: ${ready:-0})"
    return 1
  fi

  # Service URL - MUST use the Kubernetes service (not localhost) so Istio sidecar intercepts the traffic.
  # Traffic to localhost bypasses the sidecar and doesn't generate Istio metrics.
  # Traffic through the service generates istio_requests_total and other metrics that Kiali needs.
  local service_url="http://hello-world.${APP_NAMESPACE}.svc.cluster.local:80"
  debug "Using service URL to generate Istio metrics: ${service_url}"

  if [ "${TRAFFIC_CONTINUOUS}" == "true" ]; then
    # Continuous traffic mode
    infomsg "Sending requests to ${service_url} every ${TRAFFIC_INTERVAL} second(s). Press Ctrl-C to stop."
    local count=0
    trap 'infomsg "Sent ${count} total requests. Stopping..."; exit 0' INT TERM
    while true; do
      local http_code=$(${CLIENT_EXE} exec -n ${APP_NAMESPACE} deploy/hello-world -c hello-world -- curl -s -o /dev/null -w "%{http_code}" ${service_url} 2>/dev/null)
      if [ $? -eq 0 ] && [ "${http_code}" == "200" ]; then
        count=$((count + 1))
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Request ${count} sent (HTTP ${http_code})"
      else
        warnmsg "Request ${count} failed (HTTP ${http_code})"
      fi
      sleep ${TRAFFIC_INTERVAL}
    done
  else
    # Send N requests mode
    infomsg "Sending ${TRAFFIC_COUNT} requests to ${service_url} (${TRAFFIC_INTERVAL}s interval)..."
    local success_count=0
    local fail_count=0
    for i in $(seq 1 ${TRAFFIC_COUNT}); do
      local http_code=$(${CLIENT_EXE} exec -n ${APP_NAMESPACE} deploy/hello-world -c hello-world -- curl -s -o /dev/null -w "%{http_code}" ${service_url} 2>/dev/null)
      if [ $? -eq 0 ] && [ "${http_code}" == "200" ]; then
        success_count=$((success_count + 1))
        echo "  Request ${i}/${TRAFFIC_COUNT}: HTTP ${http_code} ✓"
      else
        fail_count=$((fail_count + 1))
        warnmsg "Request ${i}/${TRAFFIC_COUNT}: Failed (HTTP ${http_code})"
      fi
      # Sleep between requests (but not after the last one)
      if [ ${i} -lt ${TRAFFIC_COUNT} ]; then
        sleep ${TRAFFIC_INTERVAL}
      fi
    done
    infomsg "======================================"
    infomsg "Traffic generation complete!"
    infomsg "======================================"
    infomsg "Total requests: ${TRAFFIC_COUNT}"
    infomsg "Successful: ${success_count}"
    infomsg "Failed: ${fail_count}"
    infomsg ""
    infomsg "Metrics will appear in Kiali after propagation (typically 5-6 minutes):"
    infomsg "  1. Prometheus scrapes Envoy metrics (every 30s)"
    infomsg "  2. Metrics federate to ACM Thanos (every 5 minutes)"
    infomsg "  3. Kiali queries Thanos and displays graphs"
    infomsg ""
    infomsg "View in Kiali: https://kiali-${KIALI_NAMESPACE}.$(${CLIENT_EXE} get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}')"
  fi
}

##############################################################################
# Ambient Test App Functions
##############################################################################

install_ambient_app() {
  infomsg "Installing Ambient test application..."

  # Check if Ambient mode is available
  if ! ${CLIENT_EXE} get daemonset ztunnel -n istio-system &>/dev/null 2>&1; then
    errormsg "Istio Ambient mode is not installed (ztunnel daemonset not found)"
    errormsg "Run 'install-istio --ambient' first to install Istio in Ambient mode"
    return 1
  fi

  # Create namespace for Ambient mode app - uses ztunnel/waypoint instead of sidecar injection
  if ! ${CLIENT_EXE} get namespace ${AMBIENT_APP_NAMESPACE} &>/dev/null; then
    infomsg "Creating namespace: ${AMBIENT_APP_NAMESPACE}"
    ${CLIENT_EXE} create namespace ${AMBIENT_APP_NAMESPACE}
  fi

  # Enable Ambient mode for the namespace (L4 via ztunnel)
  infomsg "Enabling Istio Ambient mode for namespace..."
  ${CLIENT_EXE} label namespace ${AMBIENT_APP_NAMESPACE} istio.io/dataplane-mode=ambient --overwrite

  # Create ConfigMap with HTML content
  infomsg "Creating HTML content ConfigMap..."
  ${CLIENT_EXE} apply -n ${AMBIENT_APP_NAMESPACE} -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: hello-world-html
data:
  index.html: |
    <!DOCTYPE html>
    <html>
    <head><title>Hello World (Ambient)</title></head>
    <body><h1>Hello World - Ambient Mode</h1><p>This is a test application using Istio Ambient mode.</p></body>
    </html>
EOF

  # Create Deployment using Red Hat UBI httpd image (OpenShift-compatible)
  # This app uses Ambient mode (ztunnel/waypoint) rather than sidecar injection
  infomsg "Creating deployment (using Ambient ztunnel/waypoint)..."
  ${CLIENT_EXE} apply -n ${AMBIENT_APP_NAMESPACE} -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hello-world
  labels:
    app: hello-world
    version: v1
spec:
  replicas: 1
  selector:
    matchLabels:
      app: hello-world
      version: v1
  template:
    metadata:
      labels:
        app: hello-world
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "8080"
    spec:
      containers:
      - name: hello-world
        image: registry.access.redhat.com/ubi9/httpd-24:latest
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: 10m
            memory: 32Mi
          limits:
            cpu: 50m
            memory: 64Mi
        volumeMounts:
        - name: html
          mountPath: /var/www/html
          readOnly: true
      volumes:
      - name: html
        configMap:
          name: hello-world-html
EOF

  # Create Service
  infomsg "Creating service..."
  ${CLIENT_EXE} apply -n ${AMBIENT_APP_NAMESPACE} -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: hello-world
  labels:
    app: hello-world
spec:
  ports:
  - port: 80
    targetPort: 8080
    name: http
  selector:
    app: hello-world
EOF

  # Wait for deployment to be ready
  infomsg "Waiting for deployment to be ready..."
  ${CLIENT_EXE} rollout status deployment/hello-world -n ${AMBIENT_APP_NAMESPACE} --timeout=${TIMEOUT}s

  # Wait for pod to be fully ready
  infomsg "Waiting for pod to be fully ready..."
  ${CLIENT_EXE} wait --for=condition=Ready pod -l app=hello-world -n ${AMBIENT_APP_NAMESPACE} --timeout=${TIMEOUT}s

  # Wait for Service endpoints to be populated
  infomsg "Waiting for service endpoints to be ready..."
  local max_wait=60
  local waited=0
  while true; do
    local endpoint_ip=$(${CLIENT_EXE} get endpoints hello-world -n ${AMBIENT_APP_NAMESPACE} -o jsonpath='{.subsets[0].addresses[0].ip}' 2>/dev/null)
    if [ -n "${endpoint_ip}" ]; then
      debug "Service endpoint ready: ${endpoint_ip}"
      break
    fi
    if [ ${waited} -ge ${max_wait} ]; then
      warnmsg "Timeout waiting for service endpoints (continuing anyway)"
      break
    fi
    sleep 2
    waited=$((waited + 2))
  done

  # Deploy waypoint proxy for L7 metrics (optional but recommended for full Kiali functionality)
  infomsg "Deploying waypoint proxy for L7 metrics..."
  if command -v istioctl &>/dev/null; then
    istioctl waypoint apply -n ${AMBIENT_APP_NAMESPACE} --enroll-namespace
    if [ $? -eq 0 ]; then
      infomsg "Waypoint proxy deployed - L7 metrics (HTTP/gRPC) will be available"
      # Wait for waypoint to be ready
      infomsg "Waiting for waypoint proxy to be ready..."
      ${CLIENT_EXE} wait --for=condition=Ready pod -l gateway.istio.io/managed=istio.io-mesh-controller -n ${AMBIENT_APP_NAMESPACE} --timeout=120s || true
    else
      warnmsg "Failed to deploy waypoint proxy - only L4 metrics will be available"
    fi
  else
    warnmsg "istioctl not found - skipping waypoint deployment. Only L4 (TCP) metrics will be available."
    warnmsg "Install istioctl and run: istioctl waypoint apply -n ${AMBIENT_APP_NAMESPACE} --enroll-namespace"
  fi

  # Create PodMonitor for waypoint proxies in this namespace (uses istio-proxy container)
  # Note: Ztunnel is monitored globally via ztunnel-monitor in istio-system
  create_istio_podmonitor "${AMBIENT_APP_NAMESPACE}"

  # Create metrics allowlist for ACM observability
  create_namespace_metrics_allowlist "${AMBIENT_APP_NAMESPACE}"

  infomsg "======================================"
  infomsg "Ambient test application installation complete!"
  infomsg "======================================"
  infomsg "Namespace: ${AMBIENT_APP_NAMESPACE}"
  infomsg "Service: hello-world.${AMBIENT_APP_NAMESPACE}.svc.cluster.local:80"
  infomsg "Mode: Istio Ambient (L4 via ztunnel, L7 via waypoint)"
  infomsg ""
  infomsg "Metrics flow:"
  infomsg "  - L4 (TCP): ztunnel metrics in istio-system (istio_tcp_* with app=ztunnel)"
  infomsg "  - L7 (HTTP): waypoint metrics (istio_requests_total with reporter=waypoint)"
  infomsg ""
  infomsg "To generate traffic, run:"
  infomsg "  $0 traffic-ambient"
}

uninstall_ambient_app() {
  infomsg "Uninstalling Ambient test application..."

  if ! ${CLIENT_EXE} get namespace ${AMBIENT_APP_NAMESPACE} &>/dev/null; then
    infomsg "Namespace ${AMBIENT_APP_NAMESPACE} does not exist. Nothing to uninstall."
    return 0
  fi

  # Delete waypoint if exists
  if command -v istioctl &>/dev/null; then
    istioctl waypoint delete -n ${AMBIENT_APP_NAMESPACE} --all 2>/dev/null || true
  fi

  # Delete deployment
  if ${CLIENT_EXE} get deployment hello-world -n ${AMBIENT_APP_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Deleting deployment..."
    ${CLIENT_EXE} delete deployment hello-world -n ${AMBIENT_APP_NAMESPACE}
  fi

  # Delete service
  if ${CLIENT_EXE} get service hello-world -n ${AMBIENT_APP_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Deleting service..."
    ${CLIENT_EXE} delete service hello-world -n ${AMBIENT_APP_NAMESPACE}
  fi

  # Delete configmap
  if ${CLIENT_EXE} get configmap hello-world-html -n ${AMBIENT_APP_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Deleting configmap..."
    ${CLIENT_EXE} delete configmap hello-world-html -n ${AMBIENT_APP_NAMESPACE}
  fi

  # Delete PodMonitor
  if ${CLIENT_EXE} get podmonitor istio-proxies-monitor -n ${AMBIENT_APP_NAMESPACE} &>/dev/null 2>&1; then
    infomsg "Deleting PodMonitor..."
    ${CLIENT_EXE} delete podmonitor istio-proxies-monitor -n ${AMBIENT_APP_NAMESPACE}
  fi

  # Delete namespace
  infomsg "Deleting namespace ${AMBIENT_APP_NAMESPACE}..."
  ${CLIENT_EXE} delete namespace ${AMBIENT_APP_NAMESPACE} --ignore-not-found

  infomsg "Ambient test application uninstallation complete!"
}

status_ambient_app() {
  infomsg "Checking Ambient test application status..."
  echo ""

  # Check namespace
  if ${CLIENT_EXE} get namespace ${AMBIENT_APP_NAMESPACE} &>/dev/null; then
    echo "Namespace: ${AMBIENT_APP_NAMESPACE} [EXISTS]"

    # Check Ambient mode
    local dataplane_mode=$(${CLIENT_EXE} get namespace ${AMBIENT_APP_NAMESPACE} -o jsonpath='{.metadata.labels.istio\.io/dataplane-mode}' 2>/dev/null)
    if [ "${dataplane_mode}" == "ambient" ]; then
      echo "Istio Mode: Ambient [ENABLED]"
    else
      echo "Istio Mode: [NOT AMBIENT - missing istio.io/dataplane-mode=ambient label]"
    fi
  else
    echo "Namespace: ${AMBIENT_APP_NAMESPACE} [NOT FOUND]"
    echo ""
    echo "Ambient test application does not appear to be installed."
    return 0
  fi

  # Check deployment
  if ${CLIENT_EXE} get deployment hello-world -n ${AMBIENT_APP_NAMESPACE} &>/dev/null 2>&1; then
    local ready=$(${CLIENT_EXE} get deployment hello-world -n ${AMBIENT_APP_NAMESPACE} -o jsonpath='{.status.readyReplicas}' 2>/dev/null)
    local desired=$(${CLIENT_EXE} get deployment hello-world -n ${AMBIENT_APP_NAMESPACE} -o jsonpath='{.spec.replicas}' 2>/dev/null)
    ready=${ready:-0}
    desired=${desired:-0}
    echo "Deployment: ${ready}/${desired} ready"
  else
    echo "Deployment: [NOT FOUND]"
  fi

  # Check service
  if ${CLIENT_EXE} get service hello-world -n ${AMBIENT_APP_NAMESPACE} &>/dev/null 2>&1; then
    echo "Service: [EXISTS]"
  else
    echo "Service: [NOT FOUND]"
  fi

  # Check waypoint proxy
  local waypoint_pods=$(${CLIENT_EXE} get pods -n ${AMBIENT_APP_NAMESPACE} -l gateway.istio.io/managed=istio.io-mesh-controller -o name 2>/dev/null | wc -l)
  if [ "${waypoint_pods}" -gt 0 ]; then
    local waypoint_ready=$(${CLIENT_EXE} get pods -n ${AMBIENT_APP_NAMESPACE} -l gateway.istio.io/managed=istio.io-mesh-controller -o jsonpath='{.items[0].status.phase}' 2>/dev/null)
    echo "Waypoint Proxy: [DEPLOYED] (${waypoint_ready})"
    echo "  L7 Metrics: Available (istio_requests_total with reporter=waypoint)"
  else
    echo "Waypoint Proxy: [NOT DEPLOYED]"
    echo "  L7 Metrics: Not available (only L4/TCP metrics via ztunnel)"
  fi

  # Check ztunnel (global)
  if ${CLIENT_EXE} get daemonset ztunnel -n istio-system &>/dev/null 2>&1; then
    local ztunnel_ready=$(${CLIENT_EXE} get daemonset ztunnel -n istio-system -o jsonpath='{.status.numberReady}' 2>/dev/null)
    local ztunnel_desired=$(${CLIENT_EXE} get daemonset ztunnel -n istio-system -o jsonpath='{.status.desiredNumberScheduled}' 2>/dev/null)
    echo "Ztunnel (L4 proxy): ${ztunnel_ready}/${ztunnel_desired} ready"
  else
    echo "Ztunnel: [NOT FOUND - Ambient mode not installed]"
  fi

  echo ""
}

generate_ambient_traffic() {
  infomsg "Generating traffic to Ambient test application..."

  # Check if ambient test app is running
  if ! ${CLIENT_EXE} get deployment hello-world -n ${AMBIENT_APP_NAMESPACE} &>/dev/null 2>&1; then
    errormsg "Ambient test application is not installed in namespace ${AMBIENT_APP_NAMESPACE}"
    errormsg "Run '$0 install-ambient-app' first to install the Ambient test application"
    return 1
  fi

  # Check if deployment is ready
  local ready=$(${CLIENT_EXE} get deployment hello-world -n ${AMBIENT_APP_NAMESPACE} -o jsonpath='{.status.readyReplicas}' 2>/dev/null)
  if [ "${ready}" != "1" ]; then
    errormsg "Ambient test application is not ready (ready replicas: ${ready:-0})"
    return 1
  fi

  # Service URL - traffic goes through ztunnel (L4) and optionally waypoint (L7)
  local service_url="http://hello-world.${AMBIENT_APP_NAMESPACE}.svc.cluster.local:80"
  debug "Using service URL to generate Ambient metrics: ${service_url}"

  # Check if waypoint is deployed for L7 metrics
  local waypoint_pods=$(${CLIENT_EXE} get pods -n ${AMBIENT_APP_NAMESPACE} -l gateway.istio.io/managed=istio.io-mesh-controller -o name 2>/dev/null | wc -l)
  if [ "${waypoint_pods}" -gt 0 ]; then
    infomsg "Waypoint proxy detected - traffic will generate both L4 (ztunnel) and L7 (waypoint) metrics"
  else
    infomsg "No waypoint proxy - traffic will only generate L4 (TCP) metrics via ztunnel"
  fi

  if [ "${TRAFFIC_CONTINUOUS}" == "true" ]; then
    # Continuous traffic mode
    infomsg "Sending requests to ${service_url} every ${TRAFFIC_INTERVAL} second(s). Press Ctrl-C to stop."
    local count=0
    trap 'infomsg "Sent ${count} total requests. Stopping..."; exit 0' INT TERM
    while true; do
      local http_code=$(${CLIENT_EXE} exec -n ${AMBIENT_APP_NAMESPACE} deploy/hello-world -c hello-world -- curl -s -o /dev/null -w "%{http_code}" ${service_url} 2>/dev/null)
      if [ $? -eq 0 ] && [ "${http_code}" == "200" ]; then
        count=$((count + 1))
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Request ${count} sent (HTTP ${http_code})"
      else
        warnmsg "Request ${count} failed (HTTP ${http_code})"
      fi
      sleep ${TRAFFIC_INTERVAL}
    done
  else
    # Send N requests mode
    infomsg "Sending ${TRAFFIC_COUNT} requests to ${service_url} (${TRAFFIC_INTERVAL}s interval)..."
    local success_count=0
    local fail_count=0
    for i in $(seq 1 ${TRAFFIC_COUNT}); do
      local http_code=$(${CLIENT_EXE} exec -n ${AMBIENT_APP_NAMESPACE} deploy/hello-world -c hello-world -- curl -s -o /dev/null -w "%{http_code}" ${service_url} 2>/dev/null)
      if [ $? -eq 0 ] && [ "${http_code}" == "200" ]; then
        success_count=$((success_count + 1))
        echo "  Request ${i}/${TRAFFIC_COUNT}: HTTP ${http_code} ✓"
      else
        fail_count=$((fail_count + 1))
        warnmsg "Request ${i}/${TRAFFIC_COUNT}: Failed (HTTP ${http_code})"
      fi
      # Sleep between requests (but not after the last one)
      if [ ${i} -lt ${TRAFFIC_COUNT} ]; then
        sleep ${TRAFFIC_INTERVAL}
      fi
    done
    infomsg "======================================"
    infomsg "Ambient traffic generation complete!"
    infomsg "======================================"
    infomsg "Total requests: ${TRAFFIC_COUNT}"
    infomsg "Successful: ${success_count}"
    infomsg "Failed: ${fail_count}"
    infomsg ""
    infomsg "Metrics will appear in Kiali after propagation (typically 5-6 minutes):"
    infomsg "  1. Ztunnel/Waypoint generates metrics"
    infomsg "  2. Prometheus scrapes metrics (every 30s)"
    infomsg "  3. Metrics federate to ACM Thanos (every 5 minutes)"
    infomsg "  4. Kiali queries Thanos and displays graphs"
    infomsg ""
    infomsg "Expected metrics:"
    infomsg "  - L4 (ztunnel): istio_tcp_received_bytes_total, istio_tcp_sent_bytes_total"
    if [ "${waypoint_pods}" -gt 0 ]; then
      infomsg "  - L7 (waypoint): istio_requests_total with reporter=waypoint"
    fi
    infomsg ""
    infomsg "View in Kiali: https://kiali-${KIALI_NAMESPACE}.$(${CLIENT_EXE} get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}')"
  fi
}

##############################################################################
# Create All Function
##############################################################################

create_all() {
  infomsg "======================================"
  infomsg "Creating complete ACM + Kiali environment"
  infomsg "======================================"
  infomsg ""
  infomsg "Istio Ambient: $([ "${AMBIENT_MODE}" == "true" ] && echo "enabled (adds ztunnel/waypoint)" || echo "disabled")"
  infomsg ""
  infomsg "This will run the following commands in sequence:"
  infomsg "  1. init-openshift  (Create CRC cluster, enable UWM)"
  infomsg "  2. install-istio   (Install Istio$([ "${AMBIENT_MODE}" == "true" ] && echo " with Ambient mode"))"
  infomsg "  3. install-acm     (Install ACM with observability)"
  infomsg "  4. install-kiali   (Build and install Kiali)"
  infomsg "  5. install-app     (Install sidecar test mesh application)"
  if [ "${AMBIENT_MODE}" == "true" ]; then
    infomsg "  6. install-ambient-app (Install Ambient test mesh application)"
    infomsg "  7. traffic         (Generate traffic to both apps)"
  else
    infomsg "  6. traffic         (Generate initial traffic)"
  fi
  infomsg ""

  # Calculate total steps upfront so all step messages are consistent
  local total_steps=6
  if [ "${AMBIENT_MODE}" == "true" ]; then
    total_steps=7
  fi

  # Step 1: Initialize OpenShift
  infomsg "======================================"
  infomsg "Step 1/${total_steps}: Initializing OpenShift cluster"
  infomsg "======================================"
  init_openshift
  if [ $? -ne 0 ]; then
    errormsg "Failed to initialize OpenShift cluster"
    return 1
  fi

  # After init-openshift, we need to check prerequisites for subsequent commands
  check_prerequisites
  if [ $? -ne 0 ]; then
    errormsg "Prerequisites check failed after OpenShift initialization"
    return 1
  fi

  # Step 2: Install Istio
  infomsg ""
  infomsg "======================================"
  infomsg "Step 2/${total_steps}: Installing Istio"
  infomsg "======================================"
  install_istio
  if [ $? -ne 0 ]; then
    errormsg "Failed to install Istio"
    return 1
  fi

  # Step 3: Install ACM
  infomsg ""
  infomsg "======================================"
  infomsg "Step 3/${total_steps}: Installing ACM with observability"
  infomsg "======================================"
  install_acm
  if [ $? -ne 0 ]; then
    errormsg "Failed to install ACM"
    return 1
  fi

  # Step 4: Install Kiali
  infomsg ""
  infomsg "======================================"
  infomsg "Step 4/${total_steps}: Installing Kiali"
  infomsg "======================================"
  install_kiali
  if [ $? -ne 0 ]; then
    errormsg "Failed to install Kiali"
    return 1
  fi

  # Step 5: Install sidecar test app
  infomsg ""
  infomsg "======================================"
  infomsg "Step 5/${total_steps}: Installing sidecar test application"
  infomsg "======================================"
  install_app
  if [ $? -ne 0 ]; then
    errormsg "Failed to install sidecar test application"
    return 1
  fi

  # Step 6 (Ambient only): Install Ambient test app
  if [ "${AMBIENT_MODE}" == "true" ]; then
    infomsg ""
    infomsg "======================================"
    infomsg "Step 6/${total_steps}: Installing Ambient test application"
    infomsg "======================================"
    install_ambient_app
    if [ $? -ne 0 ]; then
      errormsg "Failed to install Ambient test application"
      return 1
    fi
  fi

  # Final step: Generate initial traffic (always the last step)
  infomsg ""
  infomsg "======================================"
  infomsg "Step ${total_steps}/${total_steps}: Generating initial traffic"
  infomsg "======================================"
  generate_traffic
  if [ $? -ne 0 ]; then
    errormsg "Failed to generate sidecar traffic"
    return 1
  fi

  # Generate Ambient traffic if Ambient mode
  if [ "${AMBIENT_MODE}" == "true" ]; then
    infomsg ""
    infomsg "Generating traffic to Ambient test application..."
    generate_ambient_traffic
    if [ $? -ne 0 ]; then
      errormsg "Failed to generate Ambient traffic"
      return 1
    fi
  fi

  # Final summary
  local apps_domain=$(${CLIENT_EXE} get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}')
  infomsg ""
  infomsg "=========================================================="
  infomsg "Complete ACM + Kiali environment created successfully!"
  infomsg "=========================================================="
  infomsg ""
  infomsg "OpenShift Console: https://console-openshift-console.${apps_domain}"
  infomsg "Kiali URL:         https://kiali-${KIALI_NAMESPACE}.${apps_domain}"
  infomsg ""
  infomsg "Initial traffic has been sent. To generate more traffic:"
  infomsg "  $0 traffic"
  infomsg ""
  infomsg "Note: Metrics take 5-6 minutes to appear in Kiali due to ACM federation interval."
  infomsg "Use 'Last 10 minutes' or longer time ranges in Kiali to see data."
}

##############################################################################
# Argument Parsing
##############################################################################

_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    create-all) _CMD="create-all"; shift ;;
    init-openshift) _CMD="init-openshift"; shift ;;
    install-istio) _CMD="install-istio"; shift ;;
    uninstall-istio) _CMD="uninstall-istio"; shift ;;
    status-istio) _CMD="status-istio"; shift ;;
    install-acm) _CMD="install-acm"; shift ;;
    uninstall-acm) _CMD="uninstall-acm"; shift ;;
    status-acm) _CMD="status-acm"; shift ;;
    install-kiali) _CMD="install-kiali"; shift ;;
    uninstall-kiali) _CMD="uninstall-kiali"; shift ;;
    status-kiali) _CMD="status-kiali"; shift ;;
    install-app) _CMD="install-app"; shift ;;
    uninstall-app) _CMD="uninstall-app"; shift ;;
    status-app) _CMD="status-app"; shift ;;
    traffic) _CMD="traffic"; shift ;;
    install-ambient-app) _CMD="install-ambient-app"; shift ;;
    uninstall-ambient-app) _CMD="uninstall-ambient-app"; shift ;;
    status-ambient-app) _CMD="status-ambient-app"; shift ;;
    traffic-ambient) _CMD="traffic-ambient"; shift ;;
    -n|--namespace) ACM_NAMESPACE="$2"; shift; shift ;;
    -c|--channel) ACM_CHANNEL="$2"; shift; shift ;;
    -on|--observability-namespace) OBSERVABILITY_NAMESPACE="$2"; shift; shift ;;
    -mak|--minio-access-key) MINIO_ACCESS_KEY="$2"; shift; shift ;;
    -msk|--minio-secret-key) MINIO_SECRET_KEY="$2"; shift; shift ;;
    -ce|--client-exe) CLIENT_EXE="$2"; shift; shift ;;
    -t|--timeout) TIMEOUT="$2"; shift; shift ;;
    -kn|--kiali-namespace) KIALI_NAMESPACE="$2"; shift; shift ;;
    -krd|--kiali-repo-dir) KIALI_REPO_DIR="$2"; shift; shift ;;
    -hcd|--helm-charts-dir) HELM_CHARTS_DIR="$2"; shift; shift ;;
    -an|--app-namespace) APP_NAMESPACE="$2"; shift; shift ;;
    -cc|--crc-cpus) CRC_CPUS="$2"; shift; shift ;;
    -cds|--crc-disk-size) CRC_DISK_SIZE="$2"; shift; shift ;;
    -cps|--crc-pull-secret-file) CRC_PULL_SECRET_FILE="$2"; shift; shift ;;
    -tc|--traffic-count) TRAFFIC_COUNT="$2"; shift; shift ;;
    -ti|--traffic-interval) TRAFFIC_INTERVAL="$2"; shift; shift ;;
    -cont|--traffic-continuous) TRAFFIC_CONTINUOUS="true"; shift ;;
    --ambient) AMBIENT_MODE="true"; shift ;;
    -aan|--ambient-app-namespace) AMBIENT_APP_NAMESPACE="$2"; shift; shift ;;
    -v|--verbose) _VERBOSE="true"; shift ;;
    -h|--help)
      cat <<HELPMSG

$0 [options] command

This script installs Red Hat Advanced Cluster Management (ACM) with observability
on an OpenShift cluster for development and testing purposes. It can also install
Kiali configured to use ACM's observability backend.

Valid options:
  -n|--namespace <namespace>
      The namespace where ACM will be installed.
      Default: ${DEFAULT_ACM_NAMESPACE}
  -c|--channel <channel>
      The ACM operator channel (e.g., release-2.14, release-2.15).
      Default: ${DEFAULT_ACM_CHANNEL}
  -on|--observability-namespace <namespace>
      The namespace for observability components (MinIO, Thanos).
      Default: ${DEFAULT_OBSERVABILITY_NAMESPACE}
  -mak|--minio-access-key <key>
      The MinIO access key (username).
      Default: ${DEFAULT_MINIO_ACCESS_KEY}
  -msk|--minio-secret-key <key>
      The MinIO secret key (password).
      Default: ${DEFAULT_MINIO_SECRET_KEY}
  -ce|--client-exe <path>
      The path to the oc or kubectl executable.
      Default: ${DEFAULT_CLIENT_EXE}
  -t|--timeout <seconds>
      Timeout in seconds for waiting on resources.
      Default: ${DEFAULT_TIMEOUT}
  -kn|--kiali-namespace <namespace>
      The namespace where Kiali will be installed.
      Default: ${DEFAULT_KIALI_NAMESPACE}
  -krd|--kiali-repo-dir <path>
      Path to the Kiali server git repository (for building images).
      Default: ${DEFAULT_KIALI_REPO_DIR}
  -hcd|--helm-charts-dir <path>
      Path to the Kiali helm-charts git repository.
      Default: ${DEFAULT_HELM_CHARTS_DIR}
  -an|--app-namespace <namespace>
      The namespace for the test application.
      Default: ${DEFAULT_APP_NAMESPACE}
  -cc|--crc-cpus <num>
      Number of CPUs to assign to the CRC VM (for init-openshift command).
      Default: ${DEFAULT_CRC_CPUS}
  -cds|--crc-disk-size <size>
      Disk size in GB for the CRC VM (for init-openshift command).
      Default: ${DEFAULT_CRC_DISK_SIZE}
  -cps|--crc-pull-secret-file <path>
      Path to the Red Hat pull secret file (required for init-openshift command).
      Download from: https://console.redhat.com/openshift/create/local
  -tc|--traffic-count <num>
      Number of requests to send to test app (for traffic command).
      Default: ${DEFAULT_TRAFFIC_COUNT}
  -ti|--traffic-interval <seconds>
      Interval in seconds between requests (for traffic command).
      Default: ${DEFAULT_TRAFFIC_INTERVAL}
  -cont|--traffic-continuous
      Send requests continuously until Ctrl-C (for traffic command).
      Without this flag, sends --traffic-count requests and stops.
  --ambient
      Enable Istio Ambient mode in addition to sidecar support.
      Adds ztunnel (L4) and waypoint (L7) capabilities alongside sidecars.
      Affects install-istio (installs Ambient profile) and create-all.
  -aan|--ambient-app-namespace <namespace>
      The namespace for the Ambient test application.
      Default: ${DEFAULT_AMBIENT_APP_NAMESPACE}
  -v|--verbose
      Enable verbose/debug output.
  -h|--help
      Display this help message.

The command must be one of:
  create-all:           "Uber command" to install everything (OpenShift+Istio+ACM+Kiali+apps), and send initial traffic
  init-openshift:       Create/start CRC OpenShift cluster and enable User Workload Monitoring
  install-istio:        Install Istio (use --ambient for Ambient mode)
  uninstall-istio:      Remove Istio installation
  status-istio:         Check the status of Istio installation
  install-acm:          Install ACM operator, MultiClusterHub, MinIO, and observability
  uninstall-acm:        Remove all ACM components
  status-acm:           Check the status of ACM installation
  install-kiali:        Build and install Kiali configured for ACM observability
  uninstall-kiali:      Remove Kiali installation
  status-kiali:         Check the status of Kiali installation
  install-app:          Install a simple sidecar test mesh application
  uninstall-app:        Remove the sidecar test application
  status-app:           Check the status of the sidecar test application
  traffic:              Generate HTTP traffic to the sidecar test application
  install-ambient-app:  Install an Ambient mode test mesh application (requires --ambient)
  uninstall-ambient-app: Remove the Ambient test application
  status-ambient-app:   Check the status of the Ambient test application
  traffic-ambient:      Generate HTTP traffic to the Ambient test application

Examples:
  # Standard installation (sidecar support)
  $0 -cps ~/pull-secret.txt create-all         # Create complete environment
  $0 -cps ~/pull-secret.txt init-openshift     # Initialize CRC cluster
  $0 install-istio                             # Install Istio (sidecar mode)

  # With Ambient mode enabled (adds ztunnel L4 + waypoint L7 alongside sidecars)
  $0 -cps ~/pull-secret.txt --ambient create-all      # Create complete environment with Ambient mode
  $0 -cps ~/pull-secret.txt init-openshift            # Initialize CRC cluster
  $0 --ambient install-istio                          # Install Istio with Ambient mode
  $0 status-istio                                     # Check Istio status (shows Ambient if enabled)
  $0 install-ambient-app                              # Install Ambient test app (requires Ambient Istio)
  $0 status-ambient-app                               # Check Ambient test app status
  $0 traffic-ambient                                  # Generate traffic to Ambient app
  $0 uninstall-ambient-app                            # Remove Ambient test app
  $0 uninstall-istio                                  # Remove Istio

  # ACM and Kiali
  $0 install-acm                            # Install ACM with defaults
  $0 -n my-acm install-acm                  # Install ACM in custom namespace
  $0 -c release-2.14 install-acm            # Install specific ACM version
  $0 status-acm                             # Check ACM installation status
  $0 uninstall-acm                          # Remove ACM completely
  $0 install-kiali                          # Build and install Kiali for ACM
  $0 status-kiali                           # Check Kiali installation status
  $0 uninstall-kiali                        # Remove Kiali

  # Sidecar test app
  $0 install-app                            # Install sidecar test mesh application
  $0 -an my-app install-app                 # Install test app in custom namespace
  $0 status-app                             # Check test application status
  $0 uninstall-app                          # Remove test application
  $0 traffic                                # Send 10 requests to test app
  $0 -tc 50 traffic                         # Send 50 requests
  $0 -tc 100 -ti 2 traffic                  # Send 100 requests, 2s interval
  $0 -cont traffic                          # Continuous traffic
  $0 -cont -ti 3 traffic                    # Continuous every 3 seconds

HELPMSG
      exit 0
      ;;
    *)
      errormsg "Unknown argument [$key]. Use -h for help."
      exit 1
      ;;
  esac
done

# Set defaults for unset variables
: ${ACM_NAMESPACE:=${DEFAULT_ACM_NAMESPACE}}
: ${ACM_CHANNEL:=${DEFAULT_ACM_CHANNEL}}
: ${OBSERVABILITY_NAMESPACE:=${DEFAULT_OBSERVABILITY_NAMESPACE}}
: ${MINIO_ACCESS_KEY:=${DEFAULT_MINIO_ACCESS_KEY}}
: ${MINIO_SECRET_KEY:=${DEFAULT_MINIO_SECRET_KEY}}
: ${CLIENT_EXE:=${DEFAULT_CLIENT_EXE}}
: ${TIMEOUT:=${DEFAULT_TIMEOUT}}
: ${KIALI_NAMESPACE:=${DEFAULT_KIALI_NAMESPACE}}
: ${KIALI_REPO_DIR:=${DEFAULT_KIALI_REPO_DIR}}
: ${HELM_CHARTS_DIR:=${DEFAULT_HELM_CHARTS_DIR}}
: ${APP_NAMESPACE:=${DEFAULT_APP_NAMESPACE}}
: ${CRC_CPUS:=${DEFAULT_CRC_CPUS}}
: ${CRC_DISK_SIZE:=${DEFAULT_CRC_DISK_SIZE}}
: ${CRC_PULL_SECRET_FILE:=${DEFAULT_CRC_PULL_SECRET_FILE}}
: ${TRAFFIC_COUNT:=${DEFAULT_TRAFFIC_COUNT}}
: ${TRAFFIC_INTERVAL:=${DEFAULT_TRAFFIC_INTERVAL}}
: ${TRAFFIC_CONTINUOUS:=false}
: ${AMBIENT_MODE:=${DEFAULT_AMBIENT_MODE}}
: ${AMBIENT_APP_NAMESPACE:=${DEFAULT_AMBIENT_APP_NAMESPACE}}

# Debug output
debug "ACM_NAMESPACE=${ACM_NAMESPACE}"
debug "ACM_CHANNEL=${ACM_CHANNEL}"
debug "OBSERVABILITY_NAMESPACE=${OBSERVABILITY_NAMESPACE}"
debug "CLIENT_EXE=${CLIENT_EXE}"
debug "TIMEOUT=${TIMEOUT}"
debug "KIALI_NAMESPACE=${KIALI_NAMESPACE}"
debug "KIALI_REPO_DIR=${KIALI_REPO_DIR}"
debug "HELM_CHARTS_DIR=${HELM_CHARTS_DIR}"
debug "APP_NAMESPACE=${APP_NAMESPACE}"
debug "AMBIENT_MODE=${AMBIENT_MODE}"
debug "AMBIENT_APP_NAMESPACE=${AMBIENT_APP_NAMESPACE}"

##############################################################################
# Main
##############################################################################

if [ -z "${_CMD}" ]; then
  errormsg "Missing command. Use -h for help."
  exit 1
fi

# Check prerequisites (skip for init-openshift and create-all since cluster may not exist yet)
if [ "${_CMD}" != "init-openshift" ] && [ "${_CMD}" != "create-all" ]; then
  check_prerequisites || exit 2
fi

# Execute command
case ${_CMD} in
  create-all)
    create_all
    ;;
  init-openshift)
    init_openshift
    ;;
  install-istio)
    install_istio
    ;;
  uninstall-istio)
    uninstall_istio
    ;;
  status-istio)
    status_istio
    ;;
  install-acm)
    install_acm
    ;;
  uninstall-acm)
    uninstall_acm
    ;;
  status-acm)
    check_status
    ;;
  install-kiali)
    install_kiali
    ;;
  uninstall-kiali)
    uninstall_kiali
    ;;
  status-kiali)
    status_kiali
    ;;
  install-app)
    install_app
    ;;
  uninstall-app)
    uninstall_app
    ;;
  status-app)
    status_app
    ;;
  traffic)
    generate_traffic
    ;;
  install-ambient-app)
    install_ambient_app
    ;;
  uninstall-ambient-app)
    uninstall_ambient_app
    ;;
  status-ambient-app)
    status_ambient_app
    ;;
  traffic-ambient)
    generate_ambient_traffic
    ;;
  *)
    errormsg "Unknown command: ${_CMD}"
    exit 1
    ;;
esac
