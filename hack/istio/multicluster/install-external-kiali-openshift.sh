#!/bin/bash

##############################################################################
# install-external-kiali-openshift.sh
#
# # External Kiali on OpenShift - Setup Instructions
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
# │ • Kiali                 │◄────────┤ • Istio Control Plane   │
# │ • Prometheus (federated)│         │ • Istio Data Plane      │
# │ • Grafana               │         │ • Bookinfo App          │
# │ • Jaeger                │         │ • Prometheus (local)    │
# │ • NO Istio              │         │ • Jaeger (local)        │
# └─────────────────────────┘         └─────────────────────────┘
# ```
#
# ## Prerequisites
#
# 1. Two OpenShift clusters provisioned via Jenkins Hive
# 2. Logged into both clusters with appropriate contexts named "mgmt" and "mesh"
# 3. Cluster credentials and API URLs from Slackbot
# 4. helm CLI installed
# 5. oc CLI installed
#
# ## Manual Steps (if not using this script)
#
# ### Step 1: Login to Management Cluster
#
# ```bash
# oc login <mgmt-api-url> -u=kubeadmin -p=<mgmt-password> --insecure-skip-tls-verify
# oc config rename-context $(oc config current-context) mgmt
# ```
#
# ### Step 2: Login to Mesh Cluster
#
# ```bash
# oc login <mesh-api-url> -u=kubeadmin -p=<mesh-password> --insecure-skip-tls-verify
# oc config rename-context $(oc config current-context) mesh
# ```
#
# ### Step 3: Setup Certificate Authority (Shared)
#
# Create shared CA certificates for mTLS communication between clusters:
#
# ```bash
# CERTS_DIR=/tmp/istio-multicluster-certs
# mkdir -p ${CERTS_DIR}
# cd ${CERTS_DIR}
#
# # Download Istio's cert generation Makefile
# ISTIO_DIR=<path-to-istio>
# make -f ${ISTIO_DIR}/tools/certs/Makefile.selfsigned.mk root-ca
# make -f ${ISTIO_DIR}/tools/certs/Makefile.selfsigned.mk mgmt-cacerts
# make -f ${ISTIO_DIR}/tools/certs/Makefile.selfsigned.mk mesh-cacerts
# ```
#
# ### Step 4: Create istio-system namespace on Mesh Cluster
#
# ```bash
# oc --context=mesh create namespace istio-system
# oc --context=mesh label namespace istio-system topology.istio.io/network=network-mesh
# ```
#
# ### Step 5: Install Certificates on Mesh Cluster
#
# ```bash
# oc --context=mesh create secret generic cacerts -n istio-system \
#   --from-file=${CERTS_DIR}/mesh/ca-cert.pem \
#   --from-file=${CERTS_DIR}/mesh/ca-key.pem \
#   --from-file=${CERTS_DIR}/mesh/root-cert.pem \
#   --from-file=${CERTS_DIR}/mesh/cert-chain.pem
# ```
#
# ### Step 6: Install Istio on Mesh Cluster
#
# Install Istio using Sail Operator with multi-cluster configuration:
#
# ```bash
# # Install Sail Operator
# oc --context=mesh apply -f - <<EOF
# apiVersion: v1
# kind: Namespace
# metadata:
#   name: sail-operator
# EOF
#
# helm install sail-operator sail-operator \
#   --kube-context mesh \
#   --namespace sail-operator \
#   --repository https://istio-release.storage.googleapis.com/charts \
#   --wait
#
# # Create IstioCNI (required for OpenShift)
# oc --context=mesh create namespace istio-cni
#
# # Note: Specify the same Istio version you plan to install
# oc --context=mesh apply -f - <<EOF
# apiVersion: sailoperator.io/v1
# kind: IstioCNI
# metadata:
#   name: default
# spec:
#   version: v1.27.2
#   namespace: istio-cni
# EOF
#
# # Wait for IstioCNI to be ready
# oc --context=mesh wait --for=condition=Ready istiocni/default --timeout=300s
#
# # Install Istio control plane
# oc --context=mesh apply -f - <<EOF
# apiVersion: sailoperator.io/v1alpha1
# kind: Istio
# metadata:
#   name: default
#   namespace: istio-system
# spec:
#   version: v1.27.2
#   namespace: istio-system
#   values:
#     global:
#       meshID: mesh-external
#       multiCluster:
#         clusterName: mesh
#       network: network-mesh
# EOF
#
# # Wait for Istio to be ready
# oc --context=mesh wait --for=condition=Ready istio/default \
#   -n istio-system --timeout=300s
# ```
#
# ### Step 7: Install Observability Addons on Mesh Cluster
#
# ```bash
# # Install Prometheus
# oc --context=mesh apply -f \
#   https://raw.githubusercontent.com/istio/istio/release-1.27/samples/addons/prometheus.yaml
#
# # Install Jaeger
# oc --context=mesh apply -f \
#   https://raw.githubusercontent.com/istio/istio/release-1.27/samples/addons/jaeger.yaml
#
# # Expose Prometheus via OpenShift route
# oc --context=mesh expose service prometheus -n istio-system
# ```
#
# ### Step 8: Create istio-system namespace on Management Cluster
#
# ```bash
# oc --context=mgmt create namespace istio-system
# ```
#
# ### Step 9: Install Observability Addons on Management Cluster
#
# Install Prometheus, Grafana, and Jaeger (without Istio):
#
# ```bash
# # Install Prometheus
# oc --context=mgmt apply -f \
#   https://raw.githubusercontent.com/istio/istio/release-1.27/samples/addons/prometheus.yaml
#
# # Install Grafana
# oc --context=mgmt apply -f \
#   https://raw.githubusercontent.com/istio/istio/release-1.27/samples/addons/grafana.yaml
#
# # Install Jaeger
# oc --context=mgmt apply -f \
#   https://raw.githubusercontent.com/istio/istio/release-1.27/samples/addons/jaeger.yaml
# ```
#
# ### Step 10: Configure Prometheus Federation
#
# Get the mesh cluster Prometheus route and configure federation:
#
# ```bash
# # Get the mesh Prometheus external route
# MESH_PROM_ROUTE=$(oc --context=mesh get route prometheus -n istio-system \
#   -o jsonpath='{.spec.host}' 2>/dev/null || \
#   oc --context=mesh get svc prometheus -n istio-system \
#   -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
#
# # Patch management cluster Prometheus to scrape from mesh cluster
# oc --context=mgmt get configmap prometheus -n istio-system -o yaml > /tmp/prometheus-cm.yaml
#
# # Add scrape config for mesh cluster (manual edit required)
# # Add this to the prometheus.yml section:
# #
# # - job_name: 'federate-mesh'
# #   scrape_interval: 15s
# #   honor_labels: true
# #   metrics_path: '/federate'
# #   params:
# #     'match[]':
# #       - '{__name__=~"istio_.*"}'
# #   static_configs:
# #     - targets: ['<MESH_PROM_ROUTE>:9090']
#
# oc --context=mgmt apply -f /tmp/prometheus-cm.yaml
# oc --context=mgmt rollout restart deployment/prometheus -n istio-system
# ```
#
# ### Step 11: Pull Kiali Helm Chart
#
# ```bash
# helm repo add kiali https://kiali.org/helm-charts --force-update
# helm repo update kiali
# helm pull kiali/kiali-server --destination /tmp
# TARBALL=$(ls -1 /tmp/kiali-server*.tgz | sort -V | tail -n1)
# ```
#
# ### Step 12: Prepare Remote Cluster Secret
#
# Create resources in mesh cluster and secret in management cluster:
#
# ```bash
# <kiali-repo>/hack/istio/multicluster/kiali-prepare-remote-cluster.sh \
#   -c oc \
#   --remote-cluster-name mesh \
#   -kcc mgmt \
#   -rcc mesh \
#   -vo false \
#   --allow-skip-tls-verify true \
#   --kiali-resource-name kiali \
#   -rcns istio-system \
#   -kshc ${TARBALL}
# ```
#
# ### Step 13: Install Kiali on Management Cluster
#
# ```bash
# # Get the management cluster route URL
# MGMT_ROUTE_URL="https://kiali-istio-system.$(oc --context=mgmt get \
#   ingresses.config/cluster -o jsonpath='{.spec.domain}')"
#
# helm upgrade --install kiali-server ${TARBALL} \
#   --kube-context mgmt \
#   --namespace istio-system \
#   --set auth.strategy=openshift \
#   --set kiali_route_url="${MGMT_ROUTE_URL}" \
#   --set kubernetes_config.cluster_name=mgmt \
#   --set clustering.ignore_home_cluster=true \
#   --set deployment.logger.log_level=trace \
#   --set deployment.ingress.enabled=true \
#   --set deployment.service_type=ClusterIP \
#   --set external_services.tracing.enabled=true \
#   --set external_services.prometheus.url=http://prometheus.istio-system:9090 \
#   --set external_services.grafana.external_url=http://grafana.istio-system:3000 \
#   --set external_services.tracing.external_url=http://tracing.istio-system/jaeger
# ```
#
# ### Step 14: Configure OAuth for Mesh Cluster Access
#
# Create OAuth client in mesh cluster for Kiali authentication:
#
# ```bash
# MGMT_ROUTE=$(oc --context=mgmt get route kiali -n istio-system \
#   -o jsonpath='{.spec.host}')
#
# oc --context=mgmt get oauthclient kiali-istio-system -o json | \
#   jq ".redirectURIs = [\"https://${MGMT_ROUTE}/api/auth/callback/mesh\"]" | \
#   oc --context=mesh apply -f -
# ```
#
# ### Step 15: Install Bookinfo on Mesh Cluster
#
# ```bash
# oc --context=mesh create namespace bookinfo
# oc --context=mesh label namespace bookinfo istio-injection=enabled
#
# oc --context=mesh apply -n bookinfo -f \
#   https://raw.githubusercontent.com/istio/istio/release-1.27/samples/bookinfo/platform/kube/bookinfo.yaml
#
# oc --context=mesh apply -n bookinfo -f \
#   https://raw.githubusercontent.com/istio/istio/release-1.27/samples/bookinfo/networking/bookinfo-gateway.yaml
# ```
#
# ### Step 16: Access Kiali
#
# 1. Get the Kiali route:
#    ```bash
#    oc --context=mgmt get route kiali -n istio-system
#    ```
#
# 2. Open browser to the route URL
# 3. Login with management cluster kubeadmin credentials
# 4. In Kiali UI, connect to "mesh" cluster using mesh cluster kubeadmin credentials
# 5. You should now see the mesh cluster's Istio resources and Bookinfo app
#
# ## What This Script Does
#
# This script automates all the manual steps above:
# 1. Validates that both cluster contexts exist
# 2. Sets up shared CA certificates
# 3. Installs Istio on the mesh cluster only
# 4. Installs observability addons on both clusters
# 5. Configures Prometheus federation from mesh to management cluster
# 6. Deploys Kiali on the management cluster with remote cluster access
# 7. Optionally installs Bookinfo demo on mesh cluster
#
# ## Usage
#
# ```bash
# # After provisioning clusters and renaming contexts to "mgmt" and "mesh":
# ./install-external-kiali-openshift.sh \
#   --mgmt-context mgmt \
#   --mesh-context mesh \
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
MGMT_USER="kiali"
MGMT_PASS="kiali"
MESH_USER="kiali"
MESH_PASS="kiali"
INSTALL_BOOKINFO="true"
ISTIO_NAMESPACE="istio-system"
BOOKINFO_NAMESPACE="bookinfo"
MESH_ID="mesh-external"
NETWORK_MESH="network-mesh"
CERTS_DIR="/tmp/istio-multicluster-certs"
KIALI_SERVER_HELM_CHARTS=""

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
    --mgmt-user)
      MGMT_USER="$2"
      shift 2
      ;;
    --mgmt-pass)
      MGMT_PASS="$2"
      shift 2
      ;;
    --mesh-user)
      MESH_USER="$2"
      shift 2
      ;;
    --mesh-pass)
      MESH_PASS="$2"
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
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --mgmt-context <name>              Management cluster context name (default: mgmt)"
      echo "  --mesh-context <name>              Mesh cluster context name (default: mesh)"
      echo "  --mgmt-user <user>                 Management cluster username (default: kiali)"
      echo "  --mgmt-pass <pass>                 Management cluster password (default: kiali)"
      echo "  --mesh-user <user>                 Mesh cluster username (default: kiali)"
      echo "  --mesh-pass <pass>                 Mesh cluster password (default: kiali)"
      echo "  --install-bookinfo <true|false>    Install Bookinfo demo (default: true)"
      echo "  --kiali-server-helm-charts <path>  Path to Kiali helm chart tarball (default: downloads latest)"
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

# Step 1: Setup Certificate Authority
info "=== Step 1: Setting up Certificate Authority ==="
source ${SCRIPT_DIR}/setup-ca.sh

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

# Step 5: Create istio-system namespace on management cluster
info "=== Step 5: Creating istio-system namespace on management cluster ==="
switch_cluster "${MGMT_CONTEXT}"
oc create namespace ${ISTIO_NAMESPACE} --dry-run=client -o yaml | oc apply -f -

# Step 6: Install observability addons on management cluster
info "=== Step 6: Installing observability addons on management cluster ==="

# Get Istio version from mesh cluster
switch_cluster "${MESH_CONTEXT}"
ISTIO_VERSION=$(oc -n ${ISTIO_NAMESPACE} get istios -o jsonpath='{.items[0].spec.version}' 2>/dev/null || echo "v1.27.2")
ADDON_VERSION="${ISTIO_VERSION:1:4}"
info "Using Istio version ${ISTIO_VERSION} (addon version ${ADDON_VERSION})"

switch_cluster "${MGMT_CONTEXT}"
ADDONS="prometheus grafana jaeger"
for addon in ${ADDONS}; do
  info "Installing ${addon} on management cluster..."
  # Try to use yq to set namespace if available, otherwise rely on oc -n flag
  if command -v yq &> /dev/null; then
    curl -s "https://raw.githubusercontent.com/istio/istio/refs/heads/release-${ADDON_VERSION}/samples/addons/${addon}.yaml" | \
      yq "select(.metadata) | .metadata.namespace = \"${ISTIO_NAMESPACE}\"" - | \
      oc apply -n ${ISTIO_NAMESPACE} -f - || \
      error "Failed to install ${addon}"
  else
    curl -s "https://raw.githubusercontent.com/istio/istio/refs/heads/release-${ADDON_VERSION}/samples/addons/${addon}.yaml" | \
      oc apply -n ${ISTIO_NAMESPACE} -f - || \
      error "Failed to install ${addon}"
  fi
done

# Step 7: Configure Prometheus federation
info "=== Step 7: Configuring Prometheus federation ==="
switch_cluster "${MESH_CONTEXT}"

# Expose Prometheus service via OpenShift route
oc expose service prometheus -n ${ISTIO_NAMESPACE} --name=prometheus 2>/dev/null || \
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
  info "WARNING: Could not determine mesh Prometheus address. Federation may not work."
  info "You may need to manually configure Prometheus federation later."
else
  info "Mesh Prometheus address: ${MESH_PROM_ADDRESS}"

  # Configure federation on management cluster using the prometheus.yaml template
  switch_cluster "${MGMT_CONTEXT}"

  # Use the prometheus.yaml template from the multicluster directory
  if [ -f "${SCRIPT_DIR}/prometheus.yaml" ]; then
    info "Applying Prometheus federation configuration using template..."
    cat ${SCRIPT_DIR}/prometheus.yaml | \
      sed -e "s/WEST_PROMETHEUS_ADDRESS/${MESH_PROM_ADDRESS}/g" | \
      sed -e "s/CLUSTER_NAME/mesh/g" | \
      oc apply -n ${ISTIO_NAMESPACE} -f - || \
      info "Prometheus ConfigMap may need manual adjustment"

    # Restart Prometheus to pick up the new configuration
    oc rollout restart deployment/prometheus -n ${ISTIO_NAMESPACE} 2>/dev/null || \
      info "Prometheus deployment restart may be needed"
  else
    info "WARNING: prometheus.yaml template not found at ${SCRIPT_DIR}/prometheus.yaml"
    info "You will need to manually configure Prometheus federation"
    info "Add this federation job to the Prometheus ConfigMap:"
    cat <<EOF
- job_name: 'federate-mesh'
  scrape_interval: 15s
  honor_labels: true
  metrics_path: '/federate'
  params:
    'match[]':
      - '{job="kubernetes-pods"}'
  static_configs:
    - targets:
      - '${MESH_PROM_ADDRESS}:9090'
      labels:
        cluster: 'mesh'
EOF
  fi
fi

# Step 8: Pull Kiali Helm Chart if not provided
if [ -z "${KIALI_SERVER_HELM_CHARTS}" ]; then
  info "=== Step 8: Pulling Kiali Helm Chart ==="
  helm repo add kiali https://kiali.org/helm-charts --force-update
  helm repo update kiali
  helm pull kiali/kiali-server --destination /tmp
  KIALI_SERVER_HELM_CHARTS=$(ls -1 /tmp/kiali-server*.tgz | sort -V | tail -n1)
  info "Using Kiali helm chart: ${KIALI_SERVER_HELM_CHARTS}"
else
  info "=== Step 8: Using provided Kiali Helm Chart: ${KIALI_SERVER_HELM_CHARTS} ==="
fi

# Step 9: Prepare remote cluster secret
info "=== Step 9: Preparing remote cluster secret ==="
${SCRIPT_DIR}/kiali-prepare-remote-cluster.sh \
  -c oc \
  --remote-cluster-name mesh \
  -kcc ${MGMT_CONTEXT} \
  -rcc ${MESH_CONTEXT} \
  -vo false \
  --allow-skip-tls-verify true \
  --kiali-resource-name kiali \
  -rcns ${ISTIO_NAMESPACE} \
  -kshc ${KIALI_SERVER_HELM_CHARTS} || \
  error "Failed to prepare remote cluster secret"

# Step 10: Install Kiali on management cluster
info "=== Step 10: Installing Kiali on management cluster ==="
switch_cluster "${MGMT_CONTEXT}"

# Get the management cluster route URL
MGMT_ROUTE_URL="https://kiali-${ISTIO_NAMESPACE}.$(oc get ingresses.config/cluster -o jsonpath='{.spec.domain}')"
info "Kiali route URL will be: ${MGMT_ROUTE_URL}"

helm upgrade --install kiali-server ${KIALI_SERVER_HELM_CHARTS} \
  --namespace ${ISTIO_NAMESPACE} \
  --set auth.strategy=openshift \
  --set kiali_route_url="${MGMT_ROUTE_URL}" \
  --set kubernetes_config.cluster_name=mgmt \
  --set clustering.ignore_home_cluster=true \
  --set deployment.logger.log_level=trace \
  --set deployment.ingress.enabled=true \
  --set deployment.service_type=ClusterIP \
  --set external_services.tracing.enabled=true \
  --set external_services.prometheus.url=http://prometheus.${ISTIO_NAMESPACE}:9090 \
  --set external_services.grafana.external_url=http://grafana.${ISTIO_NAMESPACE}:3000 \
  --set external_services.grafana.dashboards[0].name="Istio Mesh Dashboard" \
  --set external_services.tracing.external_url=http://tracing.${ISTIO_NAMESPACE}/jaeger || \
  error "Failed to install Kiali"

# Step 11: Configure OAuth for mesh cluster access
info "=== Step 11: Configuring OAuth for mesh cluster access ==="

# Wait for Kiali route to be created
info "Waiting for Kiali route to be created..."
for i in {1..30}; do
  MGMT_ROUTE=$(oc --context=${MGMT_CONTEXT} get route kiali -n ${ISTIO_NAMESPACE} -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
  if [ -n "${MGMT_ROUTE}" ]; then
    info "Kiali route created: ${MGMT_ROUTE}"
    break
  fi
  sleep 2
done

if [ -z "${MGMT_ROUTE}" ]; then
  info "WARNING: Could not get Kiali route. OAuth configuration may need to be done manually."
else
  # Create OAuth client in mesh cluster
  oc --context=${MGMT_CONTEXT} get oauthclient kiali-${ISTIO_NAMESPACE} -o json 2>/dev/null | \
    jq ".redirectURIs = [\"https://${MGMT_ROUTE}/api/auth/callback/mesh\"]" | \
    oc --context=${MESH_CONTEXT} apply -f - || \
    info "OAuth client configuration may need manual adjustment"
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
info "  - Kiali URL: https://${MGMT_ROUTE}"
info "  - Prometheus: http://prometheus.${ISTIO_NAMESPACE}:9090"
info "  - Grafana: http://grafana.${ISTIO_NAMESPACE}:3000"
info "  - Jaeger: http://tracing.${ISTIO_NAMESPACE}"
info ""
info "Mesh Cluster (${MESH_CONTEXT}):"
info "  - Istio Control Plane: ${ISTIO_NAMESPACE}"
if [ "${INSTALL_BOOKINFO}" == "true" ]; then
  info "  - Bookinfo Application: ${BOOKINFO_NAMESPACE}"
fi
info ""
info "Next Steps:"
info "1. Open browser to https://${MGMT_ROUTE}"
info "2. Login with management cluster kubeadmin credentials"
info "3. In Kiali UI, connect to 'mesh' cluster using mesh cluster kubeadmin credentials"
info "4. Verify you can see Istio resources and applications from the mesh cluster"

