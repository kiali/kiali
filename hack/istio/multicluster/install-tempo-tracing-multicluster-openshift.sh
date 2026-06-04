#!/bin/bash

##############################################################################
# install-tempo-tracing-multicluster-openshift.sh
#
# Installs a central Tempo stack on cluster1 and configures tracing so that:
# - local traces from cluster1 go to Tempo through the Tempo gateway
# - remote traces from cluster2 are forwarded to cluster1 and then to Tempo
#
# This script is OpenShift-specific and is intended to live next to
# install-ambient-multicluster-openshift.sh.
#
# High-level flow:
# 1. Install Tempo Operator + OpenTelemetry Operator on cluster1
# 2. Install OpenTelemetry Operator on cluster2
# 3. Install MinIO + TempoStack on cluster1
# 4. Create cluster1 collectors:
#    - otel (local cluster1 tracing -> Tempo gateway)
#    - otel-remote-<cluster2-name> (remote tracing -> Tempo gateway)
# 5. Expose the remote receiver collector in cluster1 via passthrough Route
# 6. Issue mTLS certificates for remote -> central collector traffic
# 7. Create the remote collector in cluster2 and point it to the Route
# 8. Patch the Istio mesh config in both clusters to use the local collector
# 9. Apply mesh-level Telemetry and optional namespace-level Telemetry
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
TEMPO_RESOURCES_DIR="${SCRIPT_DIR}/../tempo/resources"
MINIO_YAML="${TEMPO_RESOURCES_DIR}/minio.yaml"

info() {
  echo "[INFO] $*"
}

warn() {
  echo "[WARN] $*" >&2
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
  ./hack/istio/multicluster/install-tempo-tracing-multicluster-openshift.sh \
    --cluster1-context <ctx> \
    --cluster2-context <ctx> \
    [--cluster1-name <name>] \
    [--cluster2-name <name>] \
    [--istio-namespace <ns>] \
    [--istio-cr-name <name>] \
    [--kiali-name <name>] \
    [--tempo-namespace <ns>] \
    [--tempo-stack-name <name>] \
    [--tempo-tenant <name>] \
    [--tempo-operator-namespace <ns>] \
    [--tracing-namespaces <csv>] \
    [--create-tracing-ui-route <true|false>] \
    [--restart-waypoints <true|false>] \
    [--configure-kiali <true|false>] \
    [--install-cert-manager <true|false>]

Required:
  --cluster1-context         Kube context of the central cluster (Tempo lives here)
  --cluster2-context         Kube context of the remote cluster

Optional:
  --cluster1-name            Logical name attached to central traces (default: cluster1)
  --cluster2-name            Logical name attached to remote traces (default: cluster2)
  --istio-namespace          Istio namespace in both clusters (default: istio-system)
  --istio-cr-name            Sail/Istio CR name to patch (default: default)
  --kiali-name               Kiali CR name in cluster1 to patch for Tempo tracing (default: kiali)
  --tempo-namespace          Tempo namespace in cluster1 (default: tempo)
  --tempo-stack-name         TempoStack name in cluster1 (default: sample)
  --tempo-tenant             Tempo tenant used for writes (default: north)
  --tempo-operator-namespace Operator namespace for Tempo/Otel on OpenShift (default: openshift-tempo-operator)
  --tracing-namespaces       CSV namespaces where namespace-scoped Telemetry will be created if present
                             in the cluster (default: bookinfo)
  --create-tracing-ui-route  Create a tracing-ui Route to the Jaeger UI in cluster1 (default: true)
  --restart-waypoints        Restart a waypoint deployment in tracing namespaces if present (default: true)
  --configure-kiali          Patch Kiali in cluster1 to point tracing to Tempo (default: true)
  --install-cert-manager     Install the OpenShift cert-manager operator in cluster1 if missing (default: true)

Example:
  ./hack/istio/multicluster/install-tempo-tracing-multicluster-openshift.sh \
    --cluster1-context "default/api-user-rhos-d-2-servicemesh-rhqeaws-com:6443/kube:admin" \
    --cluster2-context "default/api-user-rhos-d-5-servicemesh-rhqeaws-com:6443/kube:admin" \
    --cluster1-name cluster1 \
    --cluster2-name cluster2
EOF
}

CTX_CLUSTER1=""
CTX_CLUSTER2=""
CLUSTER1_NAME="cluster1"
CLUSTER2_NAME="cluster2"
ISTIO_NAMESPACE="istio-system"
ISTIO_CR_NAME="default"
KIALI_NAME="kiali"
TEMPO_NAMESPACE="tempo"
TEMPO_STACK_NAME="sample"
TEMPO_TENANT="north"
TEMPO_OPERATOR_NAMESPACE="openshift-tempo-operator"
TRACING_NAMESPACES_CSV="bookinfo"
CREATE_TRACING_UI_ROUTE="true"
RESTART_WAYPOINTS="true"
CONFIGURE_KIALI="true"
INSTALL_CERT_MANAGER="true"
CERT_MANAGER_OPERATOR_NAMESPACE="cert-manager-operator"
CERT_MANAGER_OPERATOR_CHANNEL="stable-v1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cluster1-context) CTX_CLUSTER1="$2"; shift 2 ;;
    --cluster2-context) CTX_CLUSTER2="$2"; shift 2 ;;
    --cluster1-name) CLUSTER1_NAME="$2"; shift 2 ;;
    --cluster2-name) CLUSTER2_NAME="$2"; shift 2 ;;
    --istio-namespace) ISTIO_NAMESPACE="$2"; shift 2 ;;
    --istio-cr-name) ISTIO_CR_NAME="$2"; shift 2 ;;
    --kiali-name) KIALI_NAME="$2"; shift 2 ;;
    --tempo-namespace) TEMPO_NAMESPACE="$2"; shift 2 ;;
    --tempo-stack-name) TEMPO_STACK_NAME="$2"; shift 2 ;;
    --tempo-tenant) TEMPO_TENANT="$2"; shift 2 ;;
    --tempo-operator-namespace) TEMPO_OPERATOR_NAMESPACE="$2"; shift 2 ;;
    --tracing-namespaces) TRACING_NAMESPACES_CSV="$2"; shift 2 ;;
    --create-tracing-ui-route) CREATE_TRACING_UI_ROUTE="$2"; shift 2 ;;
    --restart-waypoints) RESTART_WAYPOINTS="$2"; shift 2 ;;
    --configure-kiali) CONFIGURE_KIALI="$2"; shift 2 ;;
    --install-cert-manager) INSTALL_CERT_MANAGER="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) error "Unknown option: $1 (use --help)" ;;
  esac
done

[[ -n "${CTX_CLUSTER1}" ]] || { usage; error "--cluster1-context is required"; }
[[ -n "${CTX_CLUSTER2}" ]] || { usage; error "--cluster2-context is required"; }

if [[ "${CREATE_TRACING_UI_ROUTE}" != "true" && "${CREATE_TRACING_UI_ROUTE}" != "false" ]]; then
  error "--create-tracing-ui-route must be true or false"
fi

if [[ "${RESTART_WAYPOINTS}" != "true" && "${RESTART_WAYPOINTS}" != "false" ]]; then
  error "--restart-waypoints must be true or false"
fi

if [[ "${CONFIGURE_KIALI}" != "true" && "${CONFIGURE_KIALI}" != "false" ]]; then
  error "--configure-kiali must be true or false"
fi

if [[ "${INSTALL_CERT_MANAGER}" != "true" && "${INSTALL_CERT_MANAGER}" != "false" ]]; then
  error "--install-cert-manager must be true or false"
fi

require_bin oc
[[ -f "${MINIO_YAML}" ]] || error "Expected file not found: ${MINIO_YAML}"

if ! oc config get-contexts "${CTX_CLUSTER1}" &>/dev/null; then
  error "Cluster1 context not found in kubeconfig: ${CTX_CLUSTER1}"
fi
if ! oc config get-contexts "${CTX_CLUSTER2}" &>/dev/null; then
  error "Cluster2 context not found in kubeconfig: ${CTX_CLUSTER2}"
fi

ensure_openshift_context() {
  local context="$1"
  if ! oc --context "${context}" api-versions | grep -q '^route.openshift.io/'; then
    error "Context does not look like OpenShift (missing route.openshift.io): ${context}"
  fi
}

apply_yaml() {
  local context="$1"
  local yaml="$2"
  printf '%s\n' "${yaml}" | oc --context "${context}" apply -f -
}

ensure_namespace() {
  local context="$1"
  local namespace="$2"
  oc --context "${context}" create namespace "${namespace}" --dry-run=client -o yaml | oc --context "${context}" apply -f - >/dev/null
}

wait_for_crd() {
  local context="$1"
  local crd="$2"
  local attempts="${3:-90}"
  local sleep_s="${4:-5}"

  for _ in $(seq 1 "${attempts}"); do
    if oc --context "${context}" get crd "${crd}" &>/dev/null; then
      return 0
    fi
    sleep "${sleep_s}"
  done

  error "Timed out waiting for CRD [${crd}] on context [${context}]"
}

wait_for_clusterrole() {
  local context="$1"
  local name="$2"
  local attempts="${3:-90}"
  local sleep_s="${4:-5}"

  for _ in $(seq 1 "${attempts}"); do
    if oc --context "${context}" get clusterrole "${name}" &>/dev/null; then
      return 0
    fi
    sleep "${sleep_s}"
  done

  error "Timed out waiting for ClusterRole [${name}] on context [${context}]"
}

wait_for_deployment() {
  local context="$1"
  local namespace="$2"
  local deployment="$3"
  local timeout="${4:-10m}"

  oc --context "${context}" -n "${namespace}" rollout status "deployment/${deployment}" --timeout="${timeout}"
}

wait_for_service() {
  local context="$1"
  local namespace="$2"
  local service="$3"
  local attempts="${4:-90}"
  local sleep_s="${5:-5}"

  for _ in $(seq 1 "${attempts}"); do
    if oc --context "${context}" -n "${namespace}" get svc "${service}" &>/dev/null; then
      return 0
    fi
    sleep "${sleep_s}"
  done

  error "Timed out waiting for Service [${namespace}/${service}] on context [${context}]"
}

wait_for_certificate() {
  local context="$1"
  local namespace="$2"
  local certificate="$3"
  local attempts="${4:-90}"
  local sleep_s="${5:-5}"
  local ready=""

  for _ in $(seq 1 "${attempts}"); do
    ready="$(oc --context "${context}" -n "${namespace}" get certificate "${certificate}" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || true)"
    if [[ "${ready}" == "True" ]]; then
      return 0
    fi
    sleep "${sleep_s}"
  done

  error "Timed out waiting for Certificate [${namespace}/${certificate}] on context [${context}]"
}

wait_for_route_host() {
  local context="$1"
  local namespace="$2"
  local route_name="$3"
  local attempts="${4:-90}"
  local sleep_s="${5:-5}"
  local host=""

  for _ in $(seq 1 "${attempts}"); do
    host="$(oc --context "${context}" -n "${namespace}" get route "${route_name}" -o jsonpath='{.spec.host}' 2>/dev/null || true)"
    if [[ -n "${host}" ]]; then
      printf '%s' "${host}"
      return 0
    fi
    sleep "${sleep_s}"
  done

  error "Timed out waiting for Route host [${namespace}/${route_name}] on context [${context}]"
}

indent_text() {
  local spaces="$1"
  local prefix=""
  prefix="$(printf '%*s' "${spaces}" '')"
  sed "s/^/${prefix}/"
}

wait_for_any_deployment_in_namespace() {
  local context="$1"
  local namespace="$2"
  local attempts="${3:-90}"
  local sleep_s="${4:-5}"

  for _ in $(seq 1 "${attempts}"); do
    if oc --context "${context}" -n "${namespace}" get deployment -o name 2>/dev/null | grep -q .; then
      oc --context "${context}" -n "${namespace}" wait --for=condition=Available deployment --all --timeout=10m >/dev/null 2>&1 || true
      return 0
    fi
    sleep "${sleep_s}"
  done

  error "Timed out waiting for deployments in namespace [${namespace}] on context [${context}]"
}

install_operator_namespace_and_group() {
  local context="$1"

  ensure_namespace "${context}" "${TEMPO_OPERATOR_NAMESPACE}"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: ${TEMPO_OPERATOR_NAMESPACE}
  namespace: ${TEMPO_OPERATOR_NAMESPACE}
spec:
  upgradeStrategy: Default
EOF
)"
}

install_cert_manager_operator_cluster1() {
  local context="$1"

  if oc --context "${context}" get crd certificates.cert-manager.io &>/dev/null; then
    info "cert-manager is already installed on cluster1"
    return 0
  fi

  if [[ "${INSTALL_CERT_MANAGER}" != "true" ]]; then
    error "cert-manager is required for mTLS between collectors, but it is not installed on cluster1 and --install-cert-manager=false"
  fi

  info "Installing cert-manager Operator for Red Hat OpenShift on cluster1"
  ensure_namespace "${context}" "${CERT_MANAGER_OPERATOR_NAMESPACE}"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: openshift-cert-manager-operator
  namespace: ${CERT_MANAGER_OPERATOR_NAMESPACE}
spec:
  targetNamespaces:
  - ${CERT_MANAGER_OPERATOR_NAMESPACE}
EOF
)"

  apply_yaml "${context}" "$(cat <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: openshift-cert-manager-operator
  namespace: ${CERT_MANAGER_OPERATOR_NAMESPACE}
spec:
  channel: ${CERT_MANAGER_OPERATOR_CHANNEL}
  installPlanApproval: Automatic
  name: openshift-cert-manager-operator
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF
)"

  wait_for_crd "${context}" "certificates.cert-manager.io" 120 5
  wait_for_crd "${context}" "issuers.cert-manager.io" 120 5
  wait_for_any_deployment_in_namespace "${context}" "${CERT_MANAGER_OPERATOR_NAMESPACE}" 120 5
  wait_for_any_deployment_in_namespace "${context}" "cert-manager" 120 5
}

install_tempo_operator_cluster1() {
  local context="$1"

  info "Installing Tempo Operator on cluster1"
  install_operator_namespace_and_group "${context}"

  apply_yaml "${context}" "$(cat <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  labels:
    operators.coreos.com/tempo-product.${TEMPO_OPERATOR_NAMESPACE}: ''
  name: tempo-product
  namespace: ${TEMPO_OPERATOR_NAMESPACE}
spec:
  channel: stable
  installPlanApproval: Automatic
  name: tempo-product
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF
)"

  wait_for_crd "${context}" "tempostacks.tempo.grafana.com"
  wait_for_any_deployment_in_namespace "${context}" "${TEMPO_OPERATOR_NAMESPACE}"
}

install_opentelemetry_operator() {
  local context="$1"

  info "Installing OpenTelemetry Operator on context: ${context}"
  install_operator_namespace_and_group "${context}"

  apply_yaml "${context}" "$(cat <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: my-opentelemetry-operator
  namespace: ${TEMPO_OPERATOR_NAMESPACE}
spec:
  channel: stable
  installPlanApproval: Automatic
  name: opentelemetry-product
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF
)"

  wait_for_crd "${context}" "opentelemetrycollectors.opentelemetry.io"
  wait_for_any_deployment_in_namespace "${context}" "${TEMPO_OPERATOR_NAMESPACE}"
}

install_minio_cluster1() {
  local context="$1"

  info "Installing MinIO backing store on cluster1"
  ensure_namespace "${context}" "${TEMPO_NAMESPACE}"
  oc --context "${context}" -n "${TEMPO_NAMESPACE}" apply -f "${MINIO_YAML}"

  oc --context "${context}" -n "${TEMPO_NAMESPACE}" create secret generic tempostack-dev-minio \
    --from-literal=bucket="tempo-data" \
    --from-literal=endpoint="http://minio.${TEMPO_NAMESPACE}.svc.cluster.local:9000" \
    --from-literal=access_key_id="minio" \
    --from-literal=access_key_secret="minio123" \
    --dry-run=client -o yaml | oc --context "${context}" apply -f -
}

install_tempo_stack_cluster1() {
  local context="$1"

  info "Installing TempoStack [${TEMPO_STACK_NAME}] on cluster1"
  ensure_namespace "${context}" "${TEMPO_NAMESPACE}"

  apply_yaml "${context}" "$(cat <<EOF
apiVersion: tempo.grafana.com/v1alpha1
kind: TempoStack
metadata:
  name: ${TEMPO_STACK_NAME}
  namespace: ${TEMPO_NAMESPACE}
spec:
  managementState: Managed
  storageSize: 1Gi
  storage:
    secret:
      type: s3
      name: tempostack-dev-minio
  observability:
    tracing:
      jaeger_agent_endpoint: localhost:6831
  tenants:
    mode: openshift
    authentication:
    - tenantName: north
      tenantId: f78bf974-aee2-47e8-8bb4-9ba41a41824a
    - tenantName: south
      tenantId: ac4dd897-40da-4403-9cab-53905e22ef78
  template:
    gateway:
      enabled: true
    queryFrontend:
      jaegerQuery:
        enabled: true
EOF
)"

  wait_for_service "${context}" "${TEMPO_NAMESPACE}" "tempo-${TEMPO_STACK_NAME}-gateway"
  wait_for_service "${context}" "${TEMPO_NAMESPACE}" "tempo-${TEMPO_STACK_NAME}-query-frontend"
}

apply_tempo_writer_role_cluster1() {
  local context="$1"

  info "Ensuring Tempo gateway write ClusterRole exists for tenant [${TEMPO_TENANT}]"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: tempostack-traces-write
rules:
- apiGroups:
  - tempo.grafana.com
  resources:
  - ${TEMPO_TENANT}
  resourceNames:
  - traces
  verbs:
  - create
EOF
)"

  wait_for_clusterrole "${context}" "tempostack-traces-write"
}

apply_tempo_writer_binding_cluster1() {
  local context="$1"
  local remote_collector_name="$2"

  info "Binding central collectors to Tempo gateway write ClusterRole"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: tempostack-traces-write-collectors
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: tempostack-traces-write
subjects:
- kind: ServiceAccount
  name: otel-collector
  namespace: ${ISTIO_NAMESPACE}
- kind: ServiceAccount
  name: ${remote_collector_name}-collector
  namespace: ${ISTIO_NAMESPACE}
EOF
)"
}

apply_tempo_reader_rbac_cluster1() {
  local context="$1"

  info "Ensuring Tempo gateway read RBAC exists for tenant [${TEMPO_TENANT}]"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: tempostack-traces-reader-${TEMPO_TENANT}
rules:
- apiGroups:
  - tempo.grafana.com
  resources:
  - ${TEMPO_TENANT}
  resourceNames:
  - traces
  verbs:
  - get
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: tempostack-traces-reader-${TEMPO_TENANT}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: tempostack-traces-reader-${TEMPO_TENANT}
subjects:
- kind: Group
  apiGroup: rbac.authorization.k8s.io
  name: system:authenticated
EOF
)"

  wait_for_clusterrole "${context}" "tempostack-traces-reader-${TEMPO_TENANT}"
}

apply_cluster1_local_collector() {
  local context="$1"

  info "Applying local cluster1 tracing collector"
  ensure_namespace "${context}" "${ISTIO_NAMESPACE}"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: otel
  namespace: ${ISTIO_NAMESPACE}
spec:
  mode: deployment
  replicas: 1
  config:
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
    extensions:
      bearertokenauth:
        filename: /var/run/secrets/kubernetes.io/serviceaccount/token
    exporters:
      otlp_http/tempo:
        auth:
          authenticator: bearertokenauth
        endpoint: https://tempo-${TEMPO_STACK_NAME}-gateway.${TEMPO_NAMESPACE}.svc.cluster.local:8080/api/traces/v1/${TEMPO_TENANT}
        headers:
          X-Scope-OrgID: ${TEMPO_TENANT}
        tls:
          ca_file: /var/run/secrets/kubernetes.io/serviceaccount/service-ca.crt
          insecure: false
    service:
      extensions:
      - bearertokenauth
      pipelines:
        traces:
          receivers:
          - otlp
          exporters:
          - otlp_http/tempo
      telemetry:
        metrics:
          readers:
          - pull:
              exporter:
                prometheus:
                  host: 0.0.0.0
                  port: 8888
EOF
)"

  wait_for_deployment "${context}" "${ISTIO_NAMESPACE}" "otel-collector"
}

apply_cluster1_remote_collector() {
  local context="$1"
  local collector_name="$2"

  info "Applying dedicated remote collector [${collector_name}] on cluster1"
  ensure_namespace "${context}" "${ISTIO_NAMESPACE}"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: ${collector_name}
  namespace: ${ISTIO_NAMESPACE}
spec:
  mode: deployment
  replicas: 1
  volumeMounts:
  - name: otel-remote-server-certs
    mountPath: /etc/otel/server
    readOnly: true
  - name: otel-remote-ca
    mountPath: /etc/otel/ca
    readOnly: true
  volumes:
  - name: otel-remote-server-certs
    secret:
      secretName: ${REMOTE_MTLS_SERVER_SECRET_NAME}
  - name: otel-remote-ca
    secret:
      secretName: ${REMOTE_MTLS_CA_SECRET_NAME}
  config:
    receivers:
      otlp:
        protocols:
          http:
            endpoint: 0.0.0.0:4318
            tls:
              cert_file: /etc/otel/server/tls.crt
              key_file: /etc/otel/server/tls.key
              client_ca_file: /etc/otel/ca/tls.crt
    processors:
      batch: {}
      resource:
        attributes:
        - key: receiving.cluster
          action: upsert
          value: ${CLUSTER1_NAME}
        - key: source.cluster
          action: upsert
          value: ${CLUSTER2_NAME}
    extensions:
      bearertokenauth:
        filename: /var/run/secrets/kubernetes.io/serviceaccount/token
    exporters:
      otlp_http/tempo:
        auth:
          authenticator: bearertokenauth
        endpoint: https://tempo-${TEMPO_STACK_NAME}-gateway.${TEMPO_NAMESPACE}.svc.cluster.local:8080/api/traces/v1/${TEMPO_TENANT}
        headers:
          X-Scope-OrgID: ${TEMPO_TENANT}
        tls:
          ca_file: /var/run/secrets/kubernetes.io/serviceaccount/service-ca.crt
          insecure: false
    service:
      extensions:
      - bearertokenauth
      pipelines:
        traces:
          receivers:
          - otlp
          processors:
          - resource
          - batch
          exporters:
          - otlp_http/tempo
      telemetry:
        metrics:
          readers:
          - pull:
              exporter:
                prometheus:
                  host: 0.0.0.0
                  port: 8888
EOF
)"

  wait_for_service "${context}" "${ISTIO_NAMESPACE}" "${collector_name}-collector"
}

apply_cluster1_remote_route() {
  local context="$1"
  local route_name="$2"
  local service_name="$3"

  info "Exposing central remote collector via Route [${route_name}]"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: ${route_name}
  namespace: ${ISTIO_NAMESPACE}
spec:
  to:
    kind: Service
    name: ${service_name}
    weight: 100
  port:
    targetPort: otlp-http
  tls:
    termination: passthrough
  wildcardPolicy: None
EOF
)"
}

issue_remote_collector_mtls_certs_cluster1() {
  local context="$1"
  local collector_name="$2"
  local collector_service_name="$3"
  local route_host="$4"

  info "Issuing mTLS certificates for remote collector traffic on cluster1"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: ${collector_name}-selfsigned-issuer
  namespace: ${ISTIO_NAMESPACE}
spec:
  selfSigned: {}
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: ${collector_name}-ca
  namespace: ${ISTIO_NAMESPACE}
spec:
  isCA: true
  commonName: ${collector_name}-ca
  secretName: ${REMOTE_MTLS_CA_SECRET_NAME}
  privateKey:
    algorithm: ECDSA
    size: 256
  issuerRef:
    name: ${collector_name}-selfsigned-issuer
    kind: Issuer
    group: cert-manager.io
---
apiVersion: cert-manager.io/v1
kind: Issuer
metadata:
  name: ${collector_name}-ca-issuer
  namespace: ${ISTIO_NAMESPACE}
spec:
  ca:
    secretName: ${REMOTE_MTLS_CA_SECRET_NAME}
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: ${collector_name}-server
  namespace: ${ISTIO_NAMESPACE}
spec:
  secretName: ${REMOTE_MTLS_SERVER_SECRET_NAME}
  isCA: false
  usages:
  - server auth
  dnsNames:
  - ${collector_service_name}
  - ${collector_service_name}.${ISTIO_NAMESPACE}.svc
  - ${collector_service_name}.${ISTIO_NAMESPACE}.svc.cluster.local
  - ${route_host}
  issuerRef:
    name: ${collector_name}-ca-issuer
    kind: Issuer
    group: cert-manager.io
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: ${collector_name}-client
  namespace: ${ISTIO_NAMESPACE}
spec:
  secretName: ${REMOTE_MTLS_CLIENT_SECRET_NAME}
  isCA: false
  usages:
  - client auth
  dnsNames:
  - ${collector_name}-client.${ISTIO_NAMESPACE}.svc.cluster.local
  issuerRef:
    name: ${collector_name}-ca-issuer
    kind: Issuer
    group: cert-manager.io
EOF
)"

  wait_for_certificate "${context}" "${ISTIO_NAMESPACE}" "${collector_name}-ca" 120 5
  wait_for_certificate "${context}" "${ISTIO_NAMESPACE}" "${collector_name}-server" 120 5
  wait_for_certificate "${context}" "${ISTIO_NAMESPACE}" "${collector_name}-client" 120 5
}

apply_cluster1_tracing_ui_route() {
  local context="$1"

  info "Creating Tempo tracing UI Route on cluster1"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: tracing
  namespace: ${TEMPO_NAMESPACE}
spec:
  to:
    kind: Service
    name: tempo-${TEMPO_STACK_NAME}-gateway
    weight: 100
  port:
    targetPort: public
  tls:
    termination: reencrypt
    insecureEdgeTerminationPolicy: Allow
  wildcardPolicy: None
EOF
)"
}

patch_mesh_config_for_tracing() {
  local context="$1"
  local provider_index=""
  local provider_name=""
  local providers_listing=""

  info "Patching Istio meshConfig tracing provider on context: ${context}"
  if ! oc --context "${context}" -n "${ISTIO_NAMESPACE}" get istio "${ISTIO_CR_NAME}" &>/dev/null; then
    error "Istio CR [${ISTIO_NAMESPACE}/${ISTIO_CR_NAME}] not found on context [${context}]"
  fi

  oc --context "${context}" -n "${ISTIO_NAMESPACE}" patch istio "${ISTIO_CR_NAME}" --type merge -p "$(cat <<EOF
spec:
  values:
    meshConfig:
      enableTracing: true
EOF
)"

  providers_listing="$(oc --context "${context}" -n "${ISTIO_NAMESPACE}" get istio "${ISTIO_CR_NAME}" -o go-template='{{with .spec.values.meshConfig.extensionProviders}}{{range $i, $e := .}}{{printf "%d=%s\n" $i $e.name}}{{end}}{{end}}')"

  while IFS='=' read -r provider_index provider_name; do
    [[ -n "${provider_index}" ]] || continue
    if [[ "${provider_name}" == "otel-tracing" ]]; then
      oc --context "${context}" -n "${ISTIO_NAMESPACE}" patch istio "${ISTIO_CR_NAME}" --type json -p "$(cat <<EOF
[
  {
    "op": "replace",
    "path": "/spec/values/meshConfig/extensionProviders/${provider_index}",
    "value": {
      "name": "otel-tracing",
      "opentelemetry": {
        "service": "otel-collector.${ISTIO_NAMESPACE}.svc.cluster.local",
        "port": 4317
      }
    }
  }
]
EOF
)"
      return
    fi
  done <<< "${providers_listing}"

  if [[ -n "${providers_listing}" ]]; then
    oc --context "${context}" -n "${ISTIO_NAMESPACE}" patch istio "${ISTIO_CR_NAME}" --type json -p "$(cat <<EOF
[
  {
    "op": "add",
    "path": "/spec/values/meshConfig/extensionProviders/-",
    "value": {
      "name": "otel-tracing",
      "opentelemetry": {
        "service": "otel-collector.${ISTIO_NAMESPACE}.svc.cluster.local",
        "port": 4317
      }
    }
  }
]
EOF
)"
    return
  fi

  oc --context "${context}" -n "${ISTIO_NAMESPACE}" patch istio "${ISTIO_CR_NAME}" --type merge -p "$(cat <<EOF
spec:
  values:
    meshConfig:
      extensionProviders:
      - name: otel-tracing
        opentelemetry:
          service: otel-collector.${ISTIO_NAMESPACE}.svc.cluster.local
          port: 4317
EOF
)"
}

apply_mesh_telemetry() {
  local context="$1"

  info "Applying mesh-level tracing Telemetry on context: ${context}"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: telemetry.istio.io/v1
kind: Telemetry
metadata:
  name: otel-tracing
  namespace: ${ISTIO_NAMESPACE}
spec:
  tracing:
  - providers:
    - name: otel-tracing
    randomSamplingPercentage: 100
EOF
)"
}

apply_namespace_telemetry_if_namespace_exists() {
  local context="$1"
  local namespace="$2"

  if ! oc --context "${context}" get namespace "${namespace}" &>/dev/null; then
    info "Skipping namespace Telemetry because namespace does not exist on context [${context}]: ${namespace}"
    return 0
  fi

  info "Applying namespace tracing Telemetry in [${namespace}] on context: ${context}"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: telemetry.istio.io/v1
kind: Telemetry
metadata:
  name: ${namespace}-tracing
  namespace: ${namespace}
spec:
  tracing:
  - providers:
    - name: otel-tracing
    randomSamplingPercentage: 100
EOF
)"
}

restart_waypoint_if_present() {
  local context="$1"
  local namespace="$2"

  if [[ "${RESTART_WAYPOINTS}" != "true" ]]; then
    return 0
  fi

  if oc --context "${context}" -n "${namespace}" get deployment waypoint &>/dev/null; then
    info "Restarting waypoint deployment in [${namespace}] on context: ${context}"
    oc --context "${context}" -n "${namespace}" rollout restart deployment/waypoint
    oc --context "${context}" -n "${namespace}" rollout status deployment/waypoint --timeout=5m || true
  fi
}

configure_kiali_tracing_cluster1() {
  local context="$1"
  local tracing_ui_host="$2"

  if [[ "${CONFIGURE_KIALI}" != "true" ]]; then
    return 0
  fi

  if ! oc --context "${context}" -n "${ISTIO_NAMESPACE}" get kiali "${KIALI_NAME}" &>/dev/null; then
    warn "Kiali CR [${ISTIO_NAMESPACE}/${KIALI_NAME}] not found on cluster1. Skipping Kiali tracing configuration."
    return 0
  fi

  info "Patching Kiali tracing config on cluster1"
  oc --context "${context}" -n "${ISTIO_NAMESPACE}" patch kiali "${KIALI_NAME}" --type merge -p "$(cat <<EOF
spec:
  external_services:
    tracing:
      enabled: true
      provider: tempo
      use_grpc: false
      internal_url: https://tempo-${TEMPO_STACK_NAME}-gateway.${TEMPO_NAMESPACE}.svc.cluster.local:8080/api/traces/v1/${TEMPO_TENANT}/tempo
      external_url: ${tracing_ui_host:+https://${tracing_ui_host}}
      auth:
        type: bearer
        use_kiali_token: true
      tempo_config:
        name: ${TEMPO_STACK_NAME}
        namespace: ${TEMPO_NAMESPACE}
        tenant: ${TEMPO_TENANT}
        org_id: ${TEMPO_TENANT}
        url_format: openshift
EOF
)"
}

sync_cluster1_remote_certs_to_cluster2() {
  local context_cluster1="$1"
  local context_cluster2="$2"
  local ca_bundle=""
  local client_crt=""
  local client_key=""

  info "Syncing remote collector mTLS client materials from cluster1 to cluster2"
  ca_bundle="$(oc --context "${context_cluster1}" -n "${ISTIO_NAMESPACE}" get secret "${REMOTE_MTLS_CA_SECRET_NAME}" -o jsonpath='{.data.tls\.crt}' 2>/dev/null | base64 -d || true)"
  client_crt="$(oc --context "${context_cluster1}" -n "${ISTIO_NAMESPACE}" get secret "${REMOTE_MTLS_CLIENT_SECRET_NAME}" -o jsonpath='{.data.tls\.crt}' 2>/dev/null | base64 -d || true)"
  client_key="$(oc --context "${context_cluster1}" -n "${ISTIO_NAMESPACE}" get secret "${REMOTE_MTLS_CLIENT_SECRET_NAME}" -o jsonpath='{.data.tls\.key}' 2>/dev/null | base64 -d || true)"

  if [[ -z "${ca_bundle}" ]]; then
    error "Could not read CA certificate from Secret [${ISTIO_NAMESPACE}/${REMOTE_MTLS_CA_SECRET_NAME}] on cluster1"
  fi
  [[ -n "${client_crt}" ]] || error "Could not read client certificate from Secret [${ISTIO_NAMESPACE}/${REMOTE_MTLS_CLIENT_SECRET_NAME}] on cluster1"
  [[ -n "${client_key}" ]] || error "Could not read client key from Secret [${ISTIO_NAMESPACE}/${REMOTE_MTLS_CLIENT_SECRET_NAME}] on cluster1"

  apply_yaml "${context_cluster2}" "$(cat <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: ${REMOTE_MTLS_CLIENT_BUNDLE_SECRET_NAME}
  namespace: ${ISTIO_NAMESPACE}
type: Opaque
stringData:
  ca.crt: |
$(printf '%s\n' "${ca_bundle}" | indent_text 4)
  tls.crt: |
$(printf '%s\n' "${client_crt}" | indent_text 4)
  tls.key: |
$(printf '%s\n' "${client_key}" | indent_text 4)
EOF
)"
}

apply_cluster2_remote_collector() {
  local context="$1"
  local central_route_host="$2"

  info "Applying remote cluster2 collector pointing to cluster1 Route [${central_route_host}]"
  ensure_namespace "${context}" "${ISTIO_NAMESPACE}"
  apply_yaml "${context}" "$(cat <<EOF
apiVersion: opentelemetry.io/v1beta1
kind: OpenTelemetryCollector
metadata:
  name: otel
  namespace: ${ISTIO_NAMESPACE}
spec:
  mode: deployment
  replicas: 1
  volumeMounts:
  - name: otel-remote-client-bundle
    mountPath: /etc/otel/mtls
    readOnly: true
  volumes:
  - name: otel-remote-client-bundle
    secret:
      secretName: ${REMOTE_MTLS_CLIENT_BUNDLE_SECRET_NAME}
  config:
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
    processors:
      batch: {}
      resource:
        attributes:
        - key: k8s.cluster.name
          action: upsert
          value: ${CLUSTER2_NAME}
    exporters:
      otlp_http/central:
        endpoint: https://${central_route_host}
        tls:
          insecure: false
          cert_file: /etc/otel/mtls/tls.crt
          key_file: /etc/otel/mtls/tls.key
          ca_file: /etc/otel/mtls/ca.crt
    service:
      pipelines:
        traces:
          receivers:
          - otlp
          processors:
          - resource
          - batch
          exporters:
          - otlp_http/central
      telemetry:
        metrics:
          readers:
          - pull:
              exporter:
                prometheus:
                  host: 0.0.0.0
                  port: 8888
EOF
)"

  wait_for_deployment "${context}" "${ISTIO_NAMESPACE}" "otel-collector"
}

ensure_openshift_context "${CTX_CLUSTER1}"
ensure_openshift_context "${CTX_CLUSTER2}"

REMOTE_COLLECTOR_NAME="otel-remote-${CLUSTER2_NAME}"
REMOTE_COLLECTOR_ROUTE_NAME="${REMOTE_COLLECTOR_NAME}"
REMOTE_COLLECTOR_SERVICE_NAME="${REMOTE_COLLECTOR_NAME}-collector"
REMOTE_MTLS_CA_SECRET_NAME="${REMOTE_COLLECTOR_NAME}-ca"
REMOTE_MTLS_SERVER_SECRET_NAME="${REMOTE_COLLECTOR_NAME}-server-tls"
REMOTE_MTLS_CLIENT_SECRET_NAME="${REMOTE_COLLECTOR_NAME}-client-tls"
REMOTE_MTLS_CLIENT_BUNDLE_SECRET_NAME="${REMOTE_COLLECTOR_NAME}-client-bundle"

info "=== SETTINGS ==="
info "CTX_CLUSTER1=${CTX_CLUSTER1}"
info "CTX_CLUSTER2=${CTX_CLUSTER2}"
info "CLUSTER1_NAME=${CLUSTER1_NAME}"
info "CLUSTER2_NAME=${CLUSTER2_NAME}"
info "ISTIO_NAMESPACE=${ISTIO_NAMESPACE}"
info "ISTIO_CR_NAME=${ISTIO_CR_NAME}"
info "KIALI_NAME=${KIALI_NAME}"
info "TEMPO_NAMESPACE=${TEMPO_NAMESPACE}"
info "TEMPO_STACK_NAME=${TEMPO_STACK_NAME}"
info "TEMPO_TENANT=${TEMPO_TENANT}"
info "TEMPO_OPERATOR_NAMESPACE=${TEMPO_OPERATOR_NAMESPACE}"
info "TRACING_NAMESPACES=${TRACING_NAMESPACES_CSV}"
info "CREATE_TRACING_UI_ROUTE=${CREATE_TRACING_UI_ROUTE}"
info "RESTART_WAYPOINTS=${RESTART_WAYPOINTS}"
info "CONFIGURE_KIALI=${CONFIGURE_KIALI}"
info "INSTALL_CERT_MANAGER=${INSTALL_CERT_MANAGER}"

info "=== Step 1: Install operators ==="
install_cert_manager_operator_cluster1 "${CTX_CLUSTER1}"
install_tempo_operator_cluster1 "${CTX_CLUSTER1}"
install_opentelemetry_operator "${CTX_CLUSTER1}"
install_opentelemetry_operator "${CTX_CLUSTER2}"

info "=== Step 2: Install Tempo stack on cluster1 ==="
install_minio_cluster1 "${CTX_CLUSTER1}"
install_tempo_stack_cluster1 "${CTX_CLUSTER1}"

info "=== Step 3: Install collectors and gateway RBAC on cluster1 ==="
apply_cluster1_local_collector "${CTX_CLUSTER1}"
apply_cluster1_remote_collector "${CTX_CLUSTER1}" "${REMOTE_COLLECTOR_NAME}"
apply_tempo_writer_role_cluster1 "${CTX_CLUSTER1}"
apply_tempo_writer_binding_cluster1 "${CTX_CLUSTER1}" "${REMOTE_COLLECTOR_NAME}"
apply_tempo_reader_rbac_cluster1 "${CTX_CLUSTER1}"

info "=== Step 4: Expose the dedicated remote receiver on cluster1 ==="
apply_cluster1_remote_route "${CTX_CLUSTER1}" "${REMOTE_COLLECTOR_ROUTE_NAME}" "${REMOTE_COLLECTOR_SERVICE_NAME}"
REMOTE_COLLECTOR_ROUTE_HOST="$(wait_for_route_host "${CTX_CLUSTER1}" "${ISTIO_NAMESPACE}" "${REMOTE_COLLECTOR_ROUTE_NAME}")"
info "Remote collector Route host: ${REMOTE_COLLECTOR_ROUTE_HOST}"
issue_remote_collector_mtls_certs_cluster1 "${CTX_CLUSTER1}" "${REMOTE_COLLECTOR_NAME}" "${REMOTE_COLLECTOR_SERVICE_NAME}" "${REMOTE_COLLECTOR_ROUTE_HOST}"
wait_for_deployment "${CTX_CLUSTER1}" "${ISTIO_NAMESPACE}" "${REMOTE_COLLECTOR_NAME}-collector"

if [[ "${CREATE_TRACING_UI_ROUTE}" == "true" ]]; then
  apply_cluster1_tracing_ui_route "${CTX_CLUSTER1}"
fi

info "=== Step 5: Configure the remote collector on cluster2 ==="
sync_cluster1_remote_certs_to_cluster2 "${CTX_CLUSTER1}" "${CTX_CLUSTER2}"
apply_cluster2_remote_collector "${CTX_CLUSTER2}" "${REMOTE_COLLECTOR_ROUTE_HOST}"

info "=== Step 6: Patch mesh config and apply Telemetry on both clusters ==="
patch_mesh_config_for_tracing "${CTX_CLUSTER1}"
patch_mesh_config_for_tracing "${CTX_CLUSTER2}"
apply_mesh_telemetry "${CTX_CLUSTER1}"
apply_mesh_telemetry "${CTX_CLUSTER2}"

IFS=',' read -r -a tracing_namespaces <<< "${TRACING_NAMESPACES_CSV}"
for ns in "${tracing_namespaces[@]}"; do
  [[ -n "${ns}" ]] || continue
  apply_namespace_telemetry_if_namespace_exists "${CTX_CLUSTER1}" "${ns}"
  apply_namespace_telemetry_if_namespace_exists "${CTX_CLUSTER2}" "${ns}"
  restart_waypoint_if_present "${CTX_CLUSTER1}" "${ns}"
  restart_waypoint_if_present "${CTX_CLUSTER2}" "${ns}"
done

TRACING_UI_HOST=""
if oc --context "${CTX_CLUSTER1}" -n "${TEMPO_NAMESPACE}" get route tracing &>/dev/null; then
  TRACING_UI_HOST="$(oc --context "${CTX_CLUSTER1}" -n "${TEMPO_NAMESPACE}" get route tracing -o jsonpath='{.spec.host}' 2>/dev/null || true)"
fi
configure_kiali_tracing_cluster1 "${CTX_CLUSTER1}" "${TRACING_UI_HOST}"

info "=== DONE ==="
info "Tempo gateway service: tempo-${TEMPO_STACK_NAME}-gateway.${TEMPO_NAMESPACE}.svc.cluster.local"
info "Tempo tracing tenant: ${TEMPO_TENANT}"
info "Cluster1 local collector: ${ISTIO_NAMESPACE}/otel"
info "Cluster1 remote receiver collector: ${ISTIO_NAMESPACE}/${REMOTE_COLLECTOR_NAME}"
info "Cluster1 remote receiver route: https://${REMOTE_COLLECTOR_ROUTE_HOST}"
if [[ "${CREATE_TRACING_UI_ROUTE}" == "true" ]]; then
  TRACING_UI_HOST="$(oc --context "${CTX_CLUSTER1}" -n "${TEMPO_NAMESPACE}" get route tracing -o jsonpath='{.spec.host}' 2>/dev/null || true)"
  [[ -n "${TRACING_UI_HOST}" ]] && info "Tempo Jaeger UI: https://${TRACING_UI_HOST}"
fi
