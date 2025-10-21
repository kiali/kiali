#!/bin/bash

##############################################################################
# install-external-kiali-openshift.sh
#
# External Kiali on OpenShift - Setup Instructions
#
# This script sets up an "external control plane" architecture where Kiali
# runs in a separate management cluster from the Istio service mesh.
#
# ## Architecture Overview
#
# ```
# ┌─────────────────────────┐         ┌─────────────────────────┐
# │   Cluster 1: "mgmt"     │         │   Cluster 2: "mesh"     │
# │   (Management)          │         │   (Service Mesh)        │
# ├─────────────────────────┤         ├─────────────────────────┤
# │ • Kiali Operator        │◄────────┤ • Istio Control Plane   │
# │ • Kiali Server          │    │    │ • Istio Data Plane      │
# │                         │    │    │ • Bookinfo App          │
# │ Namespaces:             │    │    │ • Prometheus ◄──────────┼─── Istio metrics
# │ - kiali-operator        │    │    │ • Jaeger                │
# │ - kiali-server          │    └────┼─ Kiali queries (HTTPS)  │
# │                         │         │                         │
# │ NO Istio components     │         │ Namespaces:             │
# └─────────────────────────┘         │ - istio-system          │
#                                     │ - kiali-server          │
#                                     │ - kiali-operator*       │
#                                     │ - bookinfo              │
#                                     │ * only if using operator│
#                                     │   for remote resources  │
#                                     └─────────────────────────┘
# ```
#
# ## Prerequisites
#
# 1. Two OpenShift clusters provisioned
# 2. Logged into both clusters with kubectl contexts named "mgmt" and "mesh"
# 3. helm CLI installed
# 4. oc CLI installed
# 5. jq CLI installed
#
# ## What This Script Does
#
# 1. Creates CA certificates for Istio on mesh cluster
# 2. Installs Istio (Sail Operator) on mesh cluster with Prometheus and Jaeger
# 3. Exposes Prometheus via HTTPS route for external access
# 4. Creates remote cluster resources on mesh cluster (via Operator or Server helm chart)
# 5. Creates remote cluster secret on mgmt cluster for Kiali to access mesh
# 6. Installs Kiali Operator on mgmt cluster (in kiali-operator namespace)
# 7. Creates Kiali CR which deploys Kiali Server (in kiali-server namespace)
# 8. Optionally installs Bookinfo demo on mesh cluster
#
# Key Features:
# - Management cluster has ONLY Kiali (in kiali-operator and kiali-server namespaces)
# - All Istio components and observability tools run on mesh cluster
# - Kiali connects to Prometheus via HTTPS OpenShift route
# - Remote cluster access uses service account token authentication
# - Flexible remote resource creation (operator or helm chart)
#
# ## Usage
#
# ```bash
# # After provisioning clusters and renaming contexts to "mgmt" and "mesh":
# 
# # Using operator for remote resources (default):
# ./install-external-kiali-openshift.sh \
#   --mgmt-context mgmt \
#   --mesh-context mesh \
#   --install-bookinfo true
#
# # Or using helm chart for remote resources:
# ./install-external-kiali-openshift.sh \
#   --mgmt-context mgmt \
#   --mesh-context mesh \
#   --remote-resources-installer helm \
#   --install-bookinfo true
# ```
#
# ## Cleanup
#
# To remove everything:
#
# ```bash
# ./uninstall-external-kiali-openshift.sh \
#   --mgmt-context mgmt \
#   --mesh-context mesh
# ```
#
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"

# Default values
MGMT_CONTEXT="mgmt"
MESH_CONTEXT="mesh"
INSTALL_BOOKINFO="true"
ISTIO_NAMESPACE="istio-system"
KIALI_OPERATOR_NAMESPACE="kiali-operator"
KIALI_NAMESPACE="kiali-server"
BOOKINFO_NAMESPACE="bookinfo"
MESH_ID="mesh-external"
NETWORK_MESH="network-mesh"
CERTS_DIR="/tmp/istio-multicluster-certs"
KIALI_OPERATOR_HELM_CHARTS=""
KIALI_SERVER_HELM_CHARTS=""
REMOTE_RESOURCES_INSTALLER="operator"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --mgmt-context)
      MGMT_CONTEXT="$2"
      shift 2
      ;;
    --mesh-context)
      MESH_CONTEXT="$2"
      shift 2
      ;;
    --install-bookinfo)
      INSTALL_BOOKINFO="$2"
      shift 2
      ;;
    --kiali-server-helm-charts)
      KIALI_SERVER_HELM_CHARTS="$2"
      shift 2
      ;;
    --remote-resources-installer)
      REMOTE_RESOURCES_INSTALLER="$2"
      shift 2
      ;;
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --mgmt-context <name>              Management cluster context name (default: mgmt)"
      echo "  --mesh-context <name>              Mesh cluster context name (default: mesh)"
      echo "  --install-bookinfo <true|false>    Install Bookinfo demo (default: true)"
      echo "  --kiali-server-helm-charts <path>  Path to Kiali helm chart tarball (default: downloads latest)"
      echo "  --remote-resources-installer <helm|operator>"
      echo "                                     Method to create remote cluster resources (default: operator)"
      echo "  --help                             Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Utility functions
info() {
  echo "[INFO] $*"
}

error() {
  echo "[ERROR] $*" >&2
  exit 1
}

# Validate prerequisites
info "=== Validating Prerequisites ==="

if ! command -v oc &> /dev/null; then
  error "oc is not installed or not in PATH"
fi

if ! command -v helm &> /dev/null; then
  error "helm is not installed or not in PATH"
fi

if [ "${REMOTE_RESOURCES_INSTALLER}" != "helm" ] && [ "${REMOTE_RESOURCES_INSTALLER}" != "operator" ]; then
  error "Invalid value for --remote-resources-installer: ${REMOTE_RESOURCES_INSTALLER}. Must be 'helm' or 'operator'"
fi

if ! oc config get-contexts "${MGMT_CONTEXT}" &> /dev/null; then
  error "Management cluster context '${MGMT_CONTEXT}' not found. Please login and rename context."
fi

if ! oc config get-contexts "${MESH_CONTEXT}" &> /dev/null; then
  error "Mesh cluster context '${MESH_CONTEXT}' not found. Please login and rename context."
fi

info "✓ All prerequisites validated"

# Set critical environment variables for external Kiali mode
export IGNORE_HOME_CLUSTER="true"
export SINGLE_KIALI="true"
export KIALI_ENABLED="true"
export BOOKINFO_ENABLED="${INSTALL_BOOKINFO}"

# Source the Kiali multicluster environment
source ${SCRIPT_DIR}/env.sh \
  --client-exe oc \
  --manage-kind false \
  --manage-minikube false \
  --cluster1-context ${MGMT_CONTEXT} \
  --cluster2-context ${MESH_CONTEXT} \
  --cluster1-name mgmt \
  --cluster2-name mesh \
  --mesh-id ${MESH_ID} \
  --network1 network-mgmt \
  --network2 ${NETWORK_MESH} \
  --kiali-auth-strategy openshift

# Override the switch_cluster function to use context switching instead of oc login
# This is necessary because we're already logged into both clusters with named contexts
# This override must come AFTER sourcing env.sh
switch_cluster() {
  local context="${1}"
  # Ignore username and password parameters if provided (not needed for context switching)
  if ! oc config use-context "${context}"; then
    error "Failed to switch to cluster context: ${context}"
  fi
  info "Switched to cluster context: ${context}"
}

# Step 1: Setup Certificate Authority (mesh cluster only)
info "=== Step 1: Setting up Certificate Authority for mesh cluster ==="

# Create root CA and mesh cluster certs (no certs needed for mgmt since no Istio there)
mkdir -p "${CERTS_DIR}"
if [ ! -d "${CERTS_DIR}" ]; then
  error "Cannot create certs directory - ${CERTS_DIR}"
fi

pushd "${CERTS_DIR}" > /dev/null
make -f ${ISTIO_DIR}/tools/certs/Makefile.selfsigned.mk root-ca
make -f ${ISTIO_DIR}/tools/certs/Makefile.selfsigned.mk mesh-cacerts
popd > /dev/null

info "Certificates created for mesh cluster"

# Step 2: Create istio-system namespace on mesh cluster
info "=== Step 2: Creating istio-system namespace on mesh cluster ==="
switch_cluster "${MESH_CONTEXT}"
oc create namespace ${ISTIO_NAMESPACE} --dry-run=client -o yaml | oc apply -f -
oc label namespace ${ISTIO_NAMESPACE} topology.istio.io/network=${NETWORK_MESH} --overwrite

# Step 3: Install certificates on mesh cluster
info "=== Step 3: Installing certificates on mesh cluster ==="
oc --context=${MESH_CONTEXT} get secret cacerts -n ${ISTIO_NAMESPACE} &> /dev/null || \
  oc --context=${MESH_CONTEXT} create secret generic cacerts -n ${ISTIO_NAMESPACE} \
    --from-file=${CERTS_DIR}/mesh/ca-cert.pem \
    --from-file=${CERTS_DIR}/mesh/ca-key.pem \
    --from-file=${CERTS_DIR}/mesh/root-cert.pem \
    --from-file=${CERTS_DIR}/mesh/cert-chain.pem

# Step 4: Install Istio on mesh cluster
info "=== Step 4: Installing Istio on mesh cluster ==="

# First install Istio control plane (which will install Sail Operator)
MC_MESH_YAML=$(mktemp)
cat <<EOF > "$MC_MESH_YAML"
spec:
  values:
    global:
      meshID: ${MESH_ID}
      multiCluster:
        clusterName: mesh
      network: ${NETWORK_MESH}
EOF

install_istio --patch-file "${MC_MESH_YAML}" -a "prometheus jaeger"

# Now create IstioCNI CR (required for OpenShift) - must be after Sail Operator is installed
info "Creating istio-cni namespace and IstioCNI CR..."
oc --context=${MESH_CONTEXT} create namespace istio-cni --dry-run=client -o yaml | oc apply -f -

# Determine Istio version to use (from env or default)
ISTIO_VERSION_TO_USE="${ISTIO_VERSION:-v1.27.2}"
info "Using Istio version for CNI: ${ISTIO_VERSION_TO_USE}"

oc --context=${MESH_CONTEXT} apply -f - <<EOF
apiVersion: sailoperator.io/v1
kind: IstioCNI
metadata:
  name: default
spec:
  version: ${ISTIO_VERSION_TO_USE}
  namespace: istio-cni
EOF

info "Waiting for IstioCNI to be ready..."
oc --context=${MESH_CONTEXT} wait --for=condition=Ready istiocni/default --timeout=300s || \
  info "IstioCNI may still be initializing"

# Step 5: Create Kiali Operator and Kiali namespace on management cluster
info "=== Step 5: Creating namespaces on management cluster ==="
switch_cluster "${MGMT_CONTEXT}"
oc create namespace ${KIALI_OPERATOR_NAMESPACE} --dry-run=client -o yaml | oc apply -f -
oc create namespace ${KIALI_NAMESPACE} --dry-run=client -o yaml | oc apply -f -

# Step 6: Management cluster - no observability addons needed
info "=== Step 6: Management cluster setup ==="
info "Skipping observability addons on management cluster - only Kiali will be installed"
switch_cluster "${MGMT_CONTEXT}"

# Step 7: Expose mesh Prometheus for external access
info "=== Step 7: Exposing mesh Prometheus for external access ==="
switch_cluster "${MESH_CONTEXT}"

# Expose Prometheus service via OpenShift route with TLS
oc create route edge prometheus \
  --service=prometheus \
  --insecure-policy=Redirect \
  -n ${ISTIO_NAMESPACE} 2>/dev/null || \
  info "Prometheus route already exists or creation skipped"

# Wait for the route to be created and get its hostname
info "Waiting for Prometheus route to be created..."
MESH_PROM_ADDRESS=""
for i in {1..30}; do
  MESH_PROM_ADDRESS=$(oc -n ${ISTIO_NAMESPACE} get route prometheus -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
  if [ -n "${MESH_PROM_ADDRESS}" ]; then
    info "Prometheus route found: ${MESH_PROM_ADDRESS}"
    break
  fi
  sleep 2
done

if [ -z "${MESH_PROM_ADDRESS}" ]; then
  error "Could not determine mesh Prometheus address. Cannot continue."
fi

info "Mesh Prometheus accessible at: https://${MESH_PROM_ADDRESS}"

# Step 8: Pull Kiali Helm Charts if not provided
info "=== Step 8: Pulling Kiali Helm Charts ==="
helm repo add kiali https://kiali.org/helm-charts --force-update
helm repo update kiali

# Pull Kiali Operator helm chart if not provided
if [ -z "${KIALI_OPERATOR_HELM_CHARTS}" ]; then
  helm pull kiali/kiali-operator --destination /tmp
  KIALI_OPERATOR_HELM_CHARTS=$(ls -1 /tmp/kiali-operator*.tgz | sort -V | tail -n1)
  info "Using Kiali Operator helm chart: ${KIALI_OPERATOR_HELM_CHARTS}"
else
  info "Using provided Kiali Operator Helm Chart: ${KIALI_OPERATOR_HELM_CHARTS}"
fi

# Pull Kiali Server helm chart if not provided (needed for kiali-prepare-remote-cluster.sh)
if [ -z "${KIALI_SERVER_HELM_CHARTS}" ] || [ "${KIALI_SERVER_HELM_CHARTS}" == "kiali/kiali-server" ] || [ "${KIALI_SERVER_HELM_CHARTS}" == "kiali-server" ]; then
  helm pull kiali/kiali-server --destination /tmp
  KIALI_SERVER_HELM_CHARTS=$(ls -1 /tmp/kiali-server*.tgz | sort -V | tail -n1)
  info "Using Kiali Server helm chart: ${KIALI_SERVER_HELM_CHARTS}"
else
  info "Using provided Kiali Server Helm Chart: ${KIALI_SERVER_HELM_CHARTS}"
fi

# Step 9a: Create remote cluster resources on mesh cluster
info "=== Step 9a: Creating remote cluster resources on mesh cluster (using ${REMOTE_RESOURCES_INSTALLER}) ==="
switch_cluster "${MESH_CONTEXT}"

MGMT_DOMAIN=$(oc --context=${MGMT_CONTEXT} get ingresses.config/cluster -o jsonpath='{.spec.domain}')
KIALI_REDIRECT_URI="https://kiali-${KIALI_NAMESPACE}.${MGMT_DOMAIN}/api/auth/callback/mesh"

if [ "${REMOTE_RESOURCES_INSTALLER}" == "helm" ]; then
  # Method 1: Use Kiali Server helm chart in remote_cluster_resources_only mode
  info "Using Server helm chart to create remote cluster resources..."
  
  # Create kiali-server namespace on mesh cluster
  oc --context=${MESH_CONTEXT} create namespace ${KIALI_NAMESPACE} --dry-run=client -o yaml | oc apply -f -
  
  # Install Server helm chart with remote_cluster_resources_only=true
  helm upgrade --install kiali-remote-resources ${KIALI_SERVER_HELM_CHARTS} \
    --namespace ${KIALI_NAMESPACE} \
    --set auth.strategy=openshift \
    --set "auth.openshift.redirect_uris[0]=${KIALI_REDIRECT_URI}" \
    --set deployment.remote_cluster_resources_only=true \
    --set deployment.instance_name=kiali \
    --set deployment.namespace=${KIALI_NAMESPACE} \
    --set deployment.view_only_mode=false || \
    error "Failed to create remote cluster resources via helm"
    
  info "Remote cluster resources created via Server helm chart"
  
else
  # Method 2: Use Kiali Operator to create remote cluster resources
  info "Using Kiali Operator to create remote cluster resources..."
  
  # Create namespaces on mesh cluster
  oc --context=${MESH_CONTEXT} create namespace ${KIALI_OPERATOR_NAMESPACE} --dry-run=client -o yaml | oc apply -f -
  oc --context=${MESH_CONTEXT} create namespace ${KIALI_NAMESPACE} --dry-run=client -o yaml | oc apply -f -
  
  # Install Kiali Operator on mesh cluster
  info "Installing Kiali Operator on mesh cluster..."
  helm upgrade --install kiali-operator ${KIALI_OPERATOR_HELM_CHARTS} \
    --namespace ${KIALI_OPERATOR_NAMESPACE} \
    --set cr.create=true \
    --set cr.namespace=${KIALI_NAMESPACE} \
    --set cr.spec.auth.strategy=openshift \
    --set "cr.spec.auth.openshift.redirect_uris[0]=${KIALI_REDIRECT_URI}" \
    --set cr.spec.deployment.instance_name=kiali \
    --set cr.spec.deployment.namespace=${KIALI_NAMESPACE} \
    --set cr.spec.deployment.remote_cluster_resources_only=true \
    --set cr.spec.deployment.view_only_mode=false || \
    error "Failed to install Kiali Operator on mesh cluster"
  
  info "Waiting for Kiali operator on mesh to be ready..."
  oc wait --for=condition=available --timeout=300s deployment/kiali-operator -n ${KIALI_OPERATOR_NAMESPACE} || \
    info "Kiali operator on mesh may still be initializing"
  
  info "Remote cluster resources created via Kiali Operator"
fi

# Create service account token secret for the remote cluster
# The SA name depends on the installation method:
# - Operator method: creates SA named "kiali-service-account"
# - Helm method: creates SA named "kiali"
# Name the secret "kiali" so the kiali-prepare-remote-cluster.sh script can find it
if [ "${REMOTE_RESOURCES_INSTALLER}" == "operator" ]; then
  SA_NAME="kiali-service-account"
else
  SA_NAME="kiali"
fi

info "Creating service account token secret in ${KIALI_NAMESPACE} namespace on mesh cluster (for SA: ${SA_NAME})..."
oc --context=${MESH_CONTEXT} apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: kiali
  namespace: ${KIALI_NAMESPACE}
  annotations:
    kubernetes.io/service-account.name: ${SA_NAME}
type: kubernetes.io/service-account-token
EOF

# Wait for token to be generated
info "Waiting for service account token to be generated..."
for i in {1..30}; do
  TOKEN=$(oc --context=${MESH_CONTEXT} get secret kiali -n ${KIALI_NAMESPACE} -o jsonpath='{.data.token}' 2>/dev/null || echo "")
  if [ -n "${TOKEN}" ]; then
    info "Service account token generated"
    break
  fi
  sleep 2
done

if [ -z "${TOKEN}" ]; then
  error "Service account token was not generated"
fi

# Step 9b: Create remote cluster secret on mgmt cluster
info "=== Step 9b: Creating remote cluster secret on mgmt cluster ==="

# Use kiali-prepare-remote-cluster.sh ONLY to create the secret (not the remote resources)
# Resources are already created by the helm chart above in kiali-server namespace
${SCRIPT_DIR}/kiali-prepare-remote-cluster.sh \
  -c oc \
  --remote-cluster-name mesh \
  -kcc ${MGMT_CONTEXT} \
  -rcc ${MESH_CONTEXT} \
  -kcn ${KIALI_NAMESPACE} \
  -vo false \
  --allow-skip-tls-verify true \
  --kiali-resource-name kiali \
  -rcns ${KIALI_NAMESPACE} \
  --process-kiali-secret true \
  --process-remote-resources false \
  -kshc ${KIALI_SERVER_HELM_CHARTS} || \
  error "Failed to create remote cluster secret"

# Step 10: Install Kiali Operator and CR on management cluster
info "=== Step 10: Installing Kiali Operator on management cluster ==="
switch_cluster "${MGMT_CONTEXT}"

# Get the management cluster route URL
MGMT_ROUTE_URL="https://kiali-${KIALI_NAMESPACE}.${MGMT_DOMAIN}"
info "Kiali route URL will be: ${MGMT_ROUTE_URL}"

# Configure Kiali to use the mesh cluster's Prometheus (via external route)
MESH_PROM_URL="https://${MESH_PROM_ADDRESS}"
info "Kiali will connect to mesh Prometheus at: ${MESH_PROM_URL}"

# Install Kiali Operator and create Kiali CR
# Note: Grafana and Jaeger are disabled since they don't exist on mgmt cluster
# All observability tools are on the mesh cluster
# Prometheus uses OpenShift route with self-signed cert, so skip TLS verification
info "Installing Kiali Operator in ${KIALI_OPERATOR_NAMESPACE} namespace..."
helm upgrade --install kiali-operator ${KIALI_OPERATOR_HELM_CHARTS} \
  --namespace ${KIALI_OPERATOR_NAMESPACE} \
  --set cr.create=true \
  --set cr.namespace=${KIALI_NAMESPACE} \
  --set cr.spec.auth.strategy=openshift \
  --set cr.spec.clustering.ignore_home_cluster=true \
  --set cr.spec.deployment.cluster_wide_access=true \
  --set cr.spec.deployment.logger.log_level=trace \
  --set cr.spec.deployment.namespace=${KIALI_NAMESPACE} \
  --set cr.spec.external_services.custom_dashboards.enabled=true \
  --set cr.spec.external_services.grafana.enabled=false \
  --set cr.spec.external_services.prometheus.url="${MESH_PROM_URL}" \
  --set cr.spec.external_services.prometheus.auth.insecure_skip_verify=true \
  --set cr.spec.external_services.tracing.enabled=false \
  --set cr.spec.kiali_route_url="${MGMT_ROUTE_URL}" \
  --set cr.spec.kubernetes_config.cluster_name=mgmt \
  --set cr.spec.server.web_root=/ || \
  error "Failed to install Kiali Operator"

info "Waiting for Kiali operator to be ready..."
oc wait --for=condition=available --timeout=300s deployment/kiali-operator -n ${KIALI_OPERATOR_NAMESPACE} || \
  info "Kiali operator may still be initializing"

info "Waiting for Kiali CR to be ready..."
for i in {1..60}; do
  KIALI_STATUS=$(oc get kiali kiali -n ${KIALI_NAMESPACE} -o jsonpath='{.status.conditions[?(@.type=="Successful")].status}' 2>/dev/null || echo "")
  if [ "${KIALI_STATUS}" == "True" ]; then
    info "Kiali CR is ready"
    break
  fi
  sleep 5
done

# Step 11: Verify Kiali installation
info "=== Step 11: Verifying Kiali installation ==="

# Wait for Kiali route to be created by the operator
info "Waiting for Kiali route to be created..."
for i in {1..30}; do
  MGMT_ROUTE=$(oc --context=${MGMT_CONTEXT} get route kiali -n ${KIALI_NAMESPACE} -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
  if [ -n "${MGMT_ROUTE}" ]; then
    info "Kiali route created: ${MGMT_ROUTE}"
    break
  fi
  sleep 2
done

if [ -z "${MGMT_ROUTE}" ]; then
  info "WARNING: Could not get Kiali route."
else
  info "Kiali will be accessible at: https://${MGMT_ROUTE}"
  info "OAuth client for mesh cluster was created by ${REMOTE_RESOURCES_INSTALLER} in Step 9a"
fi

# Step 12: Install Bookinfo on mesh cluster (optional)
if [ "${INSTALL_BOOKINFO}" == "true" ]; then
  info "=== Step 12: Installing Bookinfo on mesh cluster ==="
  switch_cluster "${MESH_CONTEXT}"
  
  source ${SCRIPT_DIR}/../install-bookinfo-demo.sh \
    --client-exe oc \
    --istio-dir "${ISTIO_DIR}" \
    --istio-namespace "${ISTIO_NAMESPACE}" \
    --namespace "${BOOKINFO_NAMESPACE}" \
    --kube-context "${MESH_CONTEXT}" \
    -tg \
    --mongo || \
    error "Failed to install Bookinfo"
else
  info "=== Step 12: Skipping Bookinfo installation ==="
fi

# Summary
info "=== Installation Complete ==="
info ""
info "Management Cluster (${MGMT_CONTEXT}):"
info "  - Kiali Operator: ${KIALI_OPERATOR_NAMESPACE} namespace"
info "  - Kiali Server: ${KIALI_NAMESPACE} namespace"
info "  - Kiali URL: https://${MGMT_ROUTE}"
info "  - Authentication: OpenShift OAuth"
info ""
info "Mesh Cluster (${MESH_CONTEXT}):"
info "  - Istio Control Plane: ${ISTIO_NAMESPACE} namespace"
info "  - Prometheus: ${MESH_PROM_URL}"
info "  - Jaeger: ${ISTIO_NAMESPACE} namespace"
info "  - Remote access: Service account 'kiali' in ${KIALI_NAMESPACE}"
if [ "${INSTALL_BOOKINFO}" == "true" ]; then
  info "  - Bookinfo Application: ${BOOKINFO_NAMESPACE} namespace"
fi
info ""
info "Configuration:"
info "  - Remote resources installer: ${REMOTE_RESOURCES_INSTALLER}"
info "  - Kiali connects to mesh Prometheus via HTTPS route (insecure_skip_verify=true)"
info "  - Remote cluster secret: kiali-remote-cluster-secret-mesh in ${KIALI_NAMESPACE}"
info "  - Clustering: ignore_home_cluster=true, cluster_name=mgmt"
info "  - OAuth client name: kiali-${KIALI_NAMESPACE} (same on both clusters)"
info ""
info "Next Steps:"
info "1. Open browser to https://${MGMT_ROUTE}"
info "2. Login with OpenShift OAuth (management cluster credentials)"
info "3. Kiali will automatically connect to the mesh cluster using the remote cluster secret"
info "4. Verify you can see Istio resources and Bookinfo application from the mesh cluster"

