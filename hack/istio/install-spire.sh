#!/bin/bash

##############################################################################
# install-spire.sh
#
# Installs SPIRE components for use with Istio.
# This script is designed to be called BEFORE Istio installation.
#
# It installs:
# - SPIRE Server with Controller Manager
# - SPIRE Agent
# - SPIRE CSI Driver
# - ClusterSPIFFEID resources for Istio
#
# After running this script, install Istio with SPIRE configuration using:
#   install-istio-via-istioctl.sh --spire-enabled true
#
# Based on: https://istio.io/latest/docs/ops/integrations/spire/
#
##############################################################################

set -e

# Script directory for sourcing other scripts
SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"

CLIENT_EXE="${CLIENT_EXE:-kubectl}"
TRUST_DOMAIN="${TRUST_DOMAIN:-example.org}"
SPIRE_NAMESPACE="${SPIRE_NAMESPACE:-spire}"
ISTIO_NAMESPACE="${ISTIO_NAMESPACE:-istio-system}"
SPIRE_HELM_RELEASE="${SPIRE_HELM_RELEASE:-spire}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v helm &> /dev/null; then
        log_error "helm is not installed. Please install helm first."
        exit 1
    fi
    
    if ! ${CLIENT_EXE} cluster-info &> /dev/null; then
        log_error "Kubernetes cluster is not accessible. Please check your kubeconfig."
        exit 1
    fi
    
    log_info "Prerequisites check passed."
}

# Add SPIRE Helm repository
add_spire_helm_repo() {
    if ! helm repo list | grep -q "spiffe"; then
        log_info "Adding SPIRE Helm repository..."
        helm repo add spiffe https://spiffe.github.io/helm-charts-hardened/
    fi
    helm repo update spiffe
}

# Install SPIRE CRDs
install_spire_crds() {
    log_info "Installing SPIRE CRDs..."
    
    local crds_needed=false
    
    if ! ${CLIENT_EXE} get crd clusterspiffeids.spire.spiffe.io &> /dev/null; then
        crds_needed=true
        log_info "Installing ClusterSPIFFEID CRD..."
        curl -s https://raw.githubusercontent.com/spiffe/spire-controller-manager/main/config/crd/bases/spire.spiffe.io_clusterspiffeids.yaml | ${CLIENT_EXE} apply -f -
    fi
    
    if ! ${CLIENT_EXE} get crd clusterstaticentries.spire.spiffe.io &> /dev/null; then
        crds_needed=true
        log_info "Installing ClusterStaticEntry CRD..."
        curl -s https://raw.githubusercontent.com/spiffe/spire-controller-manager/main/config/crd/bases/spire.spiffe.io_clusterstaticentries.yaml | ${CLIENT_EXE} apply -f -
    fi
    
    if ! ${CLIENT_EXE} get crd clusterfederatedtrustdomains.spire.spiffe.io &> /dev/null; then
        crds_needed=true
        log_info "Installing ClusterFederatedTrustDomain CRD..."
        curl -s https://raw.githubusercontent.com/spiffe/spire-controller-manager/main/config/crd/bases/spire.spiffe.io_clusterfederatedtrustdomains.yaml | ${CLIENT_EXE} apply -f -
    fi
    
    if [ "$crds_needed" = true ]; then
        log_info "Waiting for CRDs to be established..."
        ${CLIENT_EXE} wait --for=condition=Established --timeout=60s \
            crd/clusterspiffeids.spire.spiffe.io \
            crd/clusterstaticentries.spire.spiffe.io \
            crd/clusterfederatedtrustdomains.spire.spiffe.io || {
            log_warn "CRDs may still be initializing..."
        }
    else
        log_info "SPIRE CRDs already installed."
    fi
}

# Install SPIRE using Helm
install_spire() {
    log_info "Installing SPIRE..."
    log_info "  Trust Domain: ${TRUST_DOMAIN}"
    log_info "  Namespace: ${SPIRE_NAMESPACE}"
    
    add_spire_helm_repo
    install_spire_crds
    
    # Create namespace if it doesn't exist
    if ! ${CLIENT_EXE} get namespace ${SPIRE_NAMESPACE} &> /dev/null; then
        ${CLIENT_EXE} create namespace ${SPIRE_NAMESPACE}
    fi
    
    # Check if SPIRE is already installed
    if helm status ${SPIRE_HELM_RELEASE} -n ${SPIRE_NAMESPACE} &> /dev/null; then
        log_info "SPIRE is already installed. Upgrading..."
        helm upgrade ${SPIRE_HELM_RELEASE} spiffe/spire -n ${SPIRE_NAMESPACE} \
            --reuse-values \
            --set global.spire.trustDomain=${TRUST_DOMAIN} \
            --set spire-server.controllerManager.enabled=true \
            --set externalControllerManagers.enabled=true \
            --set spire-server.oidcDiscoveryProvider.enabled=false \
            --set spire-agent.sds.enabled=true \
            --set spire-agent.sds.defaultSVIDName=default \
            --set spire-agent.sds.defaultBundleName=ROOTCA \
            --set spire-agent.sds.defaultAllBundlesName=ROOTCA \
            --wait \
            --timeout 10m || {
            log_warn "Helm upgrade may have timed out. Checking components..."
        }
    else
        log_info "Installing SPIRE via Helm..."
        helm install ${SPIRE_HELM_RELEASE} spiffe/spire -n ${SPIRE_NAMESPACE} \
            --set global.spire.trustDomain=${TRUST_DOMAIN} \
            --set spire-server.controllerManager.enabled=true \
            --set externalControllerManagers.enabled=true \
            --set spire-server.oidcDiscoveryProvider.enabled=false \
            --set spire-agent.sds.enabled=true \
            --set spire-agent.sds.defaultSVIDName=default \
            --set spire-agent.sds.defaultBundleName=ROOTCA \
            --set spire-agent.sds.defaultAllBundlesName=ROOTCA \
            --wait \
            --timeout 10m || {
            log_warn "Helm install may have timed out. Checking components..."
        }
    fi
    
    # Wait for critical components
    log_info "Waiting for SPIRE components to be ready..."
    
    # SPIRE Helm chart uses app.kubernetes.io/name=server (not spire-server)
    ${CLIENT_EXE} wait --for=condition=ready --timeout=300s \
        pod -l app.kubernetes.io/name=server,app.kubernetes.io/instance=spire -n ${SPIRE_NAMESPACE} 2>/dev/null || {
        log_warn "SPIRE Server may still be initializing..."
    }
    
    # SPIRE Helm chart uses app.kubernetes.io/name=agent (not spire-agent)
    ${CLIENT_EXE} wait --for=condition=ready --timeout=300s \
        pod -l app.kubernetes.io/name=agent,app.kubernetes.io/instance=spire -n ${SPIRE_NAMESPACE} 2>/dev/null || {
        log_warn "SPIRE Agent may still be initializing..."
    }
    
    log_info "SPIRE installation completed."
}

# Create ClusterSPIFFEID resources for Istio
create_clusterspiffeids() {
    log_info "Creating ClusterSPIFFEID resources for Istio..."
    
    # ClusterSPIFFEID for Istio Ingress Gateway
    if ! ${CLIENT_EXE} get clusterspiffeid istio-ingressgateway-reg &> /dev/null; then
        log_info "Creating ClusterSPIFFEID for Istio Ingress Gateway..."
        ${CLIENT_EXE} apply -f - <<EOF
apiVersion: spire.spiffe.io/v1alpha1
kind: ClusterSPIFFEID
metadata:
  name: istio-ingressgateway-reg
spec:
  spiffeIDTemplate: "spiffe://{{ .TrustDomain }}/ns/{{ .PodMeta.Namespace }}/sa/{{ .PodSpec.ServiceAccountName }}"
  workloadSelectorTemplates:
    - "k8s:ns:${ISTIO_NAMESPACE}"
    - "k8s:sa:istio-ingressgateway-service-account"
EOF
    else
        log_info "ClusterSPIFFEID for Istio Ingress Gateway already exists."
    fi
    
    # ClusterSPIFFEID for Istio Sidecars (using label selector)
    if ! ${CLIENT_EXE} get clusterspiffeid istio-sidecar-reg &> /dev/null; then
        log_info "Creating ClusterSPIFFEID for Istio Sidecars..."
        ${CLIENT_EXE} apply -f - <<EOF
apiVersion: spire.spiffe.io/v1alpha1
kind: ClusterSPIFFEID
metadata:
  name: istio-sidecar-reg
spec:
  spiffeIDTemplate: "spiffe://{{ .TrustDomain }}/ns/{{ .PodMeta.Namespace }}/sa/{{ .PodSpec.ServiceAccountName }}"
  podSelector:
    matchLabels:
      spiffe.io/spire-managed-identity: "true"
EOF
    else
        log_info "ClusterSPIFFEID for Istio Sidecars already exists."
    fi
    
    log_info "ClusterSPIFFEID resources created."
}

# Verify SPIRE components
verify_spire_components() {
    log_info "Verifying SPIRE components..."
    
    local all_ready=true
    
    # Check SPIRE Server (Helm chart uses app.kubernetes.io/name=server)
    local server_pod=$(${CLIENT_EXE} get pod -n ${SPIRE_NAMESPACE} -l app.kubernetes.io/name=server,app.kubernetes.io/instance=spire -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$server_pod" ]; then
        local server_ready=$(${CLIENT_EXE} get pod "$server_pod" -n ${SPIRE_NAMESPACE} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || echo "False")
        if [ "$server_ready" = "True" ]; then
            log_info "SPIRE Server is ready: $server_pod"
        else
            log_warn "SPIRE Server is not ready"
            all_ready=false
        fi
    else
        log_warn "SPIRE Server pod not found"
        all_ready=false
    fi
    
    # Check SPIRE Agent (Helm chart uses app.kubernetes.io/name=agent)
    local agent_ready=$(${CLIENT_EXE} get daemonset -n ${SPIRE_NAMESPACE} -l app.kubernetes.io/name=agent,app.kubernetes.io/instance=spire -o jsonpath='{.items[0].status.numberReady}' 2>/dev/null || echo "0")
    local agent_desired=$(${CLIENT_EXE} get daemonset -n ${SPIRE_NAMESPACE} -l app.kubernetes.io/name=agent,app.kubernetes.io/instance=spire -o jsonpath='{.items[0].status.desiredNumberScheduled}' 2>/dev/null || echo "0")
    if [ "$agent_ready" = "$agent_desired" ] && [ "$agent_ready" != "0" ]; then
        log_info "SPIRE Agent is ready ($agent_ready/$agent_desired)"
    else
        log_warn "SPIRE Agent is not ready ($agent_ready/$agent_desired)"
        all_ready=false
    fi
    
    # Check SPIRE CSI Driver
    local csi_ready=$(${CLIENT_EXE} get daemonset -n ${SPIRE_NAMESPACE} -l app.kubernetes.io/name=spiffe-csi-driver -o jsonpath='{.items[0].status.numberReady}' 2>/dev/null || \
                      ${CLIENT_EXE} get daemonset spire-spiffe-csi-driver -n ${SPIRE_NAMESPACE} -o jsonpath='{.status.numberReady}' 2>/dev/null || echo "0")
    local csi_desired=$(${CLIENT_EXE} get daemonset -n ${SPIRE_NAMESPACE} -l app.kubernetes.io/name=spiffe-csi-driver -o jsonpath='{.items[0].status.desiredNumberScheduled}' 2>/dev/null || \
                        ${CLIENT_EXE} get daemonset spire-spiffe-csi-driver -n ${SPIRE_NAMESPACE} -o jsonpath='{.status.desiredNumberScheduled}' 2>/dev/null || echo "0")
    if [ "$csi_ready" = "$csi_desired" ] && [ "$csi_ready" != "0" ]; then
        log_info "SPIRE CSI Driver is ready ($csi_ready/$csi_desired)"
    else
        log_warn "SPIRE CSI Driver is not ready ($csi_ready/$csi_desired)"
        all_ready=false
    fi
    
    # Check Controller Manager (runs as sidecar in spire-server)
    if [ -n "$server_pod" ]; then
        local cm_ready=$(${CLIENT_EXE} get pod "$server_pod" -n ${SPIRE_NAMESPACE} -o jsonpath='{.status.containerStatuses[?(@.name=="spire-controller-manager")].ready}' 2>/dev/null || echo "false")
        if [ "$cm_ready" = "true" ]; then
            log_info "SPIRE Controller Manager is ready"
        else
            log_warn "SPIRE Controller Manager is not ready or not found"
            all_ready=false
        fi
    fi
    
    if [ "$all_ready" = true ]; then
        log_info "All SPIRE components are ready!"
        return 0
    else
        log_warn "Some SPIRE components are not ready."
        return 1
    fi
}

# Verify SPIRE identities
verify_spire_identities() {
    log_info "Verifying SPIRE identities..."
    
    # SPIRE Helm chart uses app.kubernetes.io/name=server
    local spire_server_pod=$(${CLIENT_EXE} get pod -n ${SPIRE_NAMESPACE} -l app.kubernetes.io/name=server,app.kubernetes.io/instance=spire -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$spire_server_pod" ]; then
        log_warn "SPIRE Server pod not found. Cannot verify identities."
        return 1
    fi
    
    log_info "SPIRE Server entries:"
    ${CLIENT_EXE} exec -n ${SPIRE_NAMESPACE} "$spire_server_pod" -c spire-server -- \
        ./bin/spire-server entry show 2>/dev/null || {
        log_warn "Could not retrieve SPIRE entries."
    }
}

# Uninstall SPIRE
uninstall_spire() {
    log_info "Uninstalling SPIRE..."
    log_info "  SPIRE Namespace: ${SPIRE_NAMESPACE}"
    
    # Remove ClusterSPIFFEID resources
    log_info "Removing ClusterSPIFFEID resources..."
    ${CLIENT_EXE} delete clusterspiffeid istio-ingressgateway-reg --ignore-not-found=true 2>/dev/null || true
    ${CLIENT_EXE} delete clusterspiffeid istio-sidecar-reg --ignore-not-found=true 2>/dev/null || true
    
    # Uninstall SPIRE Helm release
    if helm status ${SPIRE_HELM_RELEASE} -n ${SPIRE_NAMESPACE} &> /dev/null; then
        log_info "Uninstalling SPIRE Helm release..."
        helm uninstall ${SPIRE_HELM_RELEASE} -n ${SPIRE_NAMESPACE} --wait --timeout 5m || {
            log_warn "Helm uninstall may have timed out."
        }
    else
        log_info "SPIRE Helm release not found."
    fi
    
    # Delete SPIRE namespace
    if ${CLIENT_EXE} get namespace ${SPIRE_NAMESPACE} &> /dev/null; then
        log_info "Deleting SPIRE namespace..."
        ${CLIENT_EXE} delete namespace ${SPIRE_NAMESPACE} --timeout=120s || {
            log_warn "Namespace deletion timed out. It may still be terminating."
        }
    fi
    
    # Remove SPIRE CRDs
    log_info "Removing SPIRE CRDs..."
    ${CLIENT_EXE} delete crd clusterspiffeids.spire.spiffe.io --ignore-not-found=true 2>/dev/null || true
    ${CLIENT_EXE} delete crd clusterstaticentries.spire.spiffe.io --ignore-not-found=true 2>/dev/null || true
    ${CLIENT_EXE} delete crd clusterfederatedtrustdomains.spire.spiffe.io --ignore-not-found=true 2>/dev/null || true
    
    log_info "SPIRE uninstallation completed."
}

# Show status
show_status() {
    log_info "SPIRE Status:"
    log_info "  Namespace: ${SPIRE_NAMESPACE}"
    log_info "  Trust Domain: ${TRUST_DOMAIN}"
    echo ""
    
    verify_spire_components
    
    echo ""
    log_info "ClusterSPIFFEID resources:"
    ${CLIENT_EXE} get clusterspiffeid 2>/dev/null || log_warn "No ClusterSPIFFEID resources found"
}

# Print help
print_help() {
    cat <<HELPMSG
Usage: $0 [OPTIONS]

Installs SPIRE components for use with Istio. This script should be run
BEFORE installing Istio with SPIRE support.

Options:
  (no options)            Install SPIRE and create ClusterSPIFFEID resources
  --uninstall             Uninstall SPIRE completely
  --status                Show SPIRE component status
  --verify-identities     Show SPIRE registered identities
  --verify-components     Verify SPIRE components are ready
  --help, -h              Show this help message

Environment variables:
  CLIENT_EXE              Kubernetes client executable (default: kubectl)
  TRUST_DOMAIN            SPIRE trust domain (default: example.org)
  SPIRE_NAMESPACE         SPIRE namespace (default: spire)
  ISTIO_NAMESPACE         Istio namespace for ClusterSPIFFEID (default: istio-system)

Example:
  # Install SPIRE with custom trust domain
  TRUST_DOMAIN=my-mesh.example.com $0

  # Then install Istio with SPIRE support
  ./install-istio-via-istioctl.sh --spire-enabled true --trust-domain my-mesh.example.com
HELPMSG
}

# Main installation
main() {
    log_info "Starting SPIRE installation..."
    log_info "  Trust Domain: ${TRUST_DOMAIN}"
    log_info "  SPIRE Namespace: ${SPIRE_NAMESPACE}"
    log_info "  Istio Namespace: ${ISTIO_NAMESPACE}"
    
    check_prerequisites
    install_spire
    create_clusterspiffeids
    
    # Verify SPIRE components are ready
    if ! verify_spire_components; then
        log_error ""
        log_error "SPIRE installation failed - components are not ready."
        log_error "Check pod logs with: kubectl logs -n ${SPIRE_NAMESPACE} -l app.kubernetes.io/name=spire-server"
        log_error ""
        log_error "Common issues:"
        log_error "  - Trust domain conflict with existing registration entries"
        log_error "  - Resource constraints (CPU/memory)"
        log_error "  - Network policies blocking communication"
        log_error ""
        log_error "To clean up and retry:"
        log_error "  $0 --uninstall"
        exit 1
    fi
    
    log_info ""
    log_info "SPIRE installation completed successfully!"
    log_info ""
    log_info "Next steps:"
    log_info "  Install Istio with SPIRE support:"
    log_info "    ./install-istio-via-istioctl.sh --spire-enabled true --trust-domain ${TRUST_DOMAIN}"
    log_info ""
    log_info "  Or check SPIRE status:"
    log_info "    $0 --status"
}

# Handle command line arguments
case "${1:-}" in
    --uninstall)
        uninstall_spire
        ;;
    --status)
        show_status
        ;;
    --verify-identities)
        verify_spire_identities
        ;;
    --verify-components)
        verify_spire_components
        ;;
    --help|-h)
        print_help
        exit 0
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown option: $1"
        print_help
        exit 1
        ;;
esac
