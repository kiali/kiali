#!/bin/bash

##############################################################################
# install-spire.sh
#
# Installs and configures SPIRE with Istio for local development.
# This script completes the SPIRE setup including:
# - SPIRE Controller Manager for auto-registration
# - ClusterSPIFFEID resources for Istio gateways and sidecars
# - Verification of the setup
#
# Based on: https://istio.io/latest/docs/ops/integrations/spire/
#
##############################################################################

set -e

CLIENT_EXE="${CLIENT_EXE:-kubectl}"
TRUST_DOMAIN="${TRUST_DOMAIN:-example.org}"
SPIRE_NAMESPACE="${SPIRE_NAMESPACE:-spire-server}"
ISTIO_NAMESPACE="${ISTIO_NAMESPACE:-istio-system}"

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
    
    if ! ${CLIENT_EXE} get namespace ${ISTIO_NAMESPACE} &> /dev/null; then
        log_error "Istio namespace '${ISTIO_NAMESPACE}' not found. Please install Istio first."
        exit 1
    fi
    
    log_info "Prerequisites check passed."
}

# Clean up OIDC discovery provider if it exists (optional component that can cause issues)
cleanup_oidc_discovery_provider() {
    if ${CLIENT_EXE} get deployment spire-spiffe-oidc-discovery-provider -n ${SPIRE_NAMESPACE} &> /dev/null; then
        log_info "Removing OIDC discovery provider deployment (optional component)..."
        ${CLIENT_EXE} delete deployment spire-spiffe-oidc-discovery-provider -n ${SPIRE_NAMESPACE} --ignore-not-found=true
        sleep 2
    fi
}

# Install SPIRE Controller Manager
install_spire_controller_manager() {
    log_info "Installing SPIRE Controller Manager..."
    
    # Check if controller manager is enabled in SPIRE server
    local cm_enabled=$(helm get values spire -n ${SPIRE_NAMESPACE} 2>/dev/null | grep -A 2 "controllerManager:" | grep "enabled:" | awk '{print $2}' || echo "false")
    
    if [ "$cm_enabled" = "true" ]; then
        log_info "SPIRE Controller Manager is already enabled. Verifying it's running..."
        # Controller manager runs as a sidecar in spire-server statefulset
        local server_pod=$(${CLIENT_EXE} get pod -n ${SPIRE_NAMESPACE} -l app=spire-server -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
        if [ -n "$server_pod" ]; then
            if ${CLIENT_EXE} get pod "$server_pod" -n ${SPIRE_NAMESPACE} -o jsonpath='{.spec.containers[?(@.name=="spire-controller-manager")].name}' &> /dev/null; then
                log_info "SPIRE Controller Manager is running as a sidecar in $server_pod"
                return
            fi
        fi
    fi
    
    # Add SPIRE Helm repository if not already added
    if ! helm repo list | grep -q "spiffe"; then
        log_info "Adding SPIRE Helm repository..."
        helm repo add spiffe https://spiffe.github.io/helm-charts-hardened/
        helm repo update
    fi
    
    # Install or upgrade SPIRE with Controller Manager enabled
    if helm list -n ${SPIRE_NAMESPACE} | grep -q "^spire[[:space:]]"; then
        log_info "SPIRE is already installed. Upgrading to enable Controller Manager..."
        # Clean up OIDC discovery provider before upgrade
        cleanup_oidc_discovery_provider
        helm upgrade spire spiffe/spire -n ${SPIRE_NAMESPACE} \
            --reuse-values \
            --set spire-server.controllerManager.enabled=true \
            --set externalControllerManagers.enabled=true \
            --set spire-server.oidcDiscoveryProvider.enabled=false \
            --wait \
            --timeout 5m || {
            log_warn "Helm upgrade may have timed out, but continuing. Checking critical components..."
            # Check if critical components are running
            if ${CLIENT_EXE} get statefulset spire-server -n ${SPIRE_NAMESPACE} &> /dev/null && \
               ${CLIENT_EXE} get daemonset spire-agent -n ${SPIRE_NAMESPACE} &> /dev/null; then
                log_info "Critical SPIRE components are present. Continuing..."
            else
                log_error "Critical SPIRE components are missing. Upgrade may have failed."
                exit 1
            fi
        }
    else
        log_info "Installing SPIRE with Controller Manager enabled..."
        # Clean up OIDC discovery provider if it exists from a previous installation
        cleanup_oidc_discovery_provider
        # Install required CRDs first if not present
        if ! kubectl get crd clusterspiffeids.spire.spiffe.io &> /dev/null; then
            log_info "Installing ClusterSPIFFEID CRD..."
            curl -s https://raw.githubusercontent.com/spiffe/spire-controller-manager/main/config/crd/bases/spire.spiffe.io_clusterspiffeids.yaml | kubectl apply -f -
        fi
        if ! kubectl get crd clusterstaticentries.spire.spiffe.io &> /dev/null; then
            log_info "Installing ClusterStaticEntry CRD..."
            curl -s https://raw.githubusercontent.com/spiffe/spire-controller-manager/main/config/crd/bases/spire.spiffe.io_clusterstaticentries.yaml | kubectl apply -f -
        fi
        if ! kubectl get crd clusterfederatedtrustdomains.spire.spiffe.io &> /dev/null; then
            log_info "Installing ClusterFederatedTrustDomain CRD..."
            curl -s https://raw.githubusercontent.com/spiffe/spire-controller-manager/main/config/crd/bases/spire.spiffe.io_clusterfederatedtrustdomains.yaml | kubectl apply -f -
        fi
        if kubectl get crd clusterspiffeids.spire.spiffe.io clusterstaticentries.spire.spiffe.io clusterfederatedtrustdomains.spire.spiffe.io &> /dev/null; then
            log_info "Waiting for CRDs to be ready..."
            sleep 3
        fi
        helm install spire spiffe/spire -n ${SPIRE_NAMESPACE} --create-namespace \
            --set global.spire.trustDomain=${TRUST_DOMAIN} \
            --set spire-server.controllerManager.enabled=true \
            --set externalControllerManagers.enabled=true \
            --set spire-server.oidcDiscoveryProvider.enabled=false \
            --wait \
            --timeout 10m || {
            log_warn "Helm install may have timed out, but continuing. Checking critical components..."
            # Check if critical components are running
            if ${CLIENT_EXE} get statefulset spire-server -n ${SPIRE_NAMESPACE} &> /dev/null && \
               ${CLIENT_EXE} get daemonset spire-agent -n ${SPIRE_NAMESPACE} &> /dev/null; then
                log_info "Critical SPIRE components are present. Continuing..."
            else
                log_error "Critical SPIRE components are missing. Installation may have failed."
                exit 1
            fi
        }
    fi
    
    log_info "Waiting for SPIRE Server with Controller Manager to be ready..."
    ${CLIENT_EXE} wait --for=condition=ready --timeout=300s \
        statefulset/spire-server -n ${SPIRE_NAMESPACE} || {
        log_warn "SPIRE Server may still be initializing. Continuing..."
    }
    
    log_info "SPIRE Controller Manager enabled successfully."
}

# Verify ClusterSPIFFEID resources
verify_clusterspiffeids() {
    log_info "Verifying ClusterSPIFFEID resources..."
    
    local ingress_gateway_exists=false
    local sidecar_exists=false
    
    if ${CLIENT_EXE} get clusterspiffeid istio-ingressgateway-reg &> /dev/null; then
        ingress_gateway_exists=true
        log_info "ClusterSPIFFEID for Istio Ingress Gateway exists"
    else
        log_warn "ClusterSPIFFEID for Istio Ingress Gateway not found"
    fi
    
    if ${CLIENT_EXE} get clusterspiffeid istio-sidecar-reg &> /dev/null; then
        sidecar_exists=true
        log_info "ClusterSPIFFEID for Istio Sidecar exists"
    else
        log_warn "ClusterSPIFFEID for Istio Sidecar not found"
    fi
    
    if [ "$ingress_gateway_exists" = false ] || [ "$sidecar_exists" = false ]; then
        log_info "Creating missing ClusterSPIFFEID resources..."
        create_clusterspiffeids
    fi
}

# Create ClusterSPIFFEID resources
create_clusterspiffeids() {
    log_info "Creating ClusterSPIFFEID resources..."
    
    # Create ClusterSPIFFEID for Istio Ingress Gateway
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
    fi
    
    # Create ClusterSPIFFEID for Istio Sidecars
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
    fi
    
    log_info "ClusterSPIFFEID resources created."
}

# Verify SPIRE components
verify_spire_components() {
    log_info "Verifying SPIRE components..."
    
    local all_ready=true
    
    # Check SPIRE Server
    if ${CLIENT_EXE} get statefulset spire-server -n ${SPIRE_NAMESPACE} &> /dev/null; then
        local server_ready=$(${CLIENT_EXE} get statefulset spire-server -n ${SPIRE_NAMESPACE} -o jsonpath='{.status.readyReplicas}')
        local server_desired=$(${CLIENT_EXE} get statefulset spire-server -n ${SPIRE_NAMESPACE} -o jsonpath='{.spec.replicas}')
        if [ "$server_ready" = "$server_desired" ]; then
            log_info "SPIRE Server is ready ($server_ready/$server_desired)"
        else
            log_warn "SPIRE Server is not ready ($server_ready/$server_desired)"
            all_ready=false
        fi
    else
        log_warn "SPIRE Server not found"
        all_ready=false
    fi
    
    # Check SPIRE Agent
    if ${CLIENT_EXE} get daemonset spire-agent -n ${SPIRE_NAMESPACE} &> /dev/null; then
        local agent_ready=$(${CLIENT_EXE} get daemonset spire-agent -n ${SPIRE_NAMESPACE} -o jsonpath='{.status.numberReady}')
        local agent_desired=$(${CLIENT_EXE} get daemonset spire-agent -n ${SPIRE_NAMESPACE} -o jsonpath='{.status.desiredNumberScheduled}')
        if [ "$agent_ready" = "$agent_desired" ]; then
            log_info "SPIRE Agent is ready ($agent_ready/$agent_desired)"
        else
            log_warn "SPIRE Agent is not ready ($agent_ready/$agent_desired)"
            all_ready=false
        fi
    else
        log_warn "SPIRE Agent not found"
        all_ready=false
    fi
    
    # Check SPIRE Controller Manager (runs as sidecar in spire-server)
    local server_pod=$(${CLIENT_EXE} get pod -n ${SPIRE_NAMESPACE} -l app.kubernetes.io/name=spire-server -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || \
                       ${CLIENT_EXE} get pod -n ${SPIRE_NAMESPACE} -l app=spire-server -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$server_pod" ] && [ "$server_pod" != "" ]; then
        if ${CLIENT_EXE} get pod "$server_pod" -n ${SPIRE_NAMESPACE} -o jsonpath='{.spec.containers[?(@.name=="spire-controller-manager")].name}' &> /dev/null; then
            local cm_ready=$(${CLIENT_EXE} get pod "$server_pod" -n ${SPIRE_NAMESPACE} -o jsonpath='{.status.containerStatuses[?(@.name=="spire-controller-manager")].ready}' 2>/dev/null || echo "false")
            if [ "$cm_ready" = "true" ]; then
                log_info "SPIRE Controller Manager is ready (running in $server_pod)"
            else
                log_warn "SPIRE Controller Manager is not ready"
                all_ready=false
            fi
        else
            log_warn "SPIRE Controller Manager container not found in SPIRE Server pod"
            all_ready=false
        fi
    else
        log_warn "SPIRE Server pod not found"
        all_ready=false
    fi
    
    # Check CSI Driver
    if ${CLIENT_EXE} get daemonset spire-spiffe-csi-driver -n ${SPIRE_NAMESPACE} &> /dev/null; then
        local csi_ready=$(${CLIENT_EXE} get daemonset spire-spiffe-csi-driver -n ${SPIRE_NAMESPACE} -o jsonpath='{.status.numberReady}')
        local csi_desired=$(${CLIENT_EXE} get daemonset spire-spiffe-csi-driver -n ${SPIRE_NAMESPACE} -o jsonpath='{.status.desiredNumberScheduled}')
        if [ "$csi_ready" = "$csi_desired" ]; then
            log_info "SPIRE CSI Driver is ready ($csi_ready/$csi_desired)"
        else
            log_warn "SPIRE CSI Driver is not ready ($csi_ready/$csi_desired)"
            all_ready=false
        fi
    else
        log_warn "SPIRE CSI Driver not found"
        all_ready=false
    fi
    
    if [ "$all_ready" = true ]; then
        log_info "All SPIRE components are ready!"
    else
        log_warn "Some SPIRE components are not ready. Please check the status."
    fi
}

# Verify Istio configuration
verify_istio_config() {
    log_info "Verifying Istio configuration with SPIRE..."
    
    # Check if Istio is configured with the correct trust domain
    local trust_domain=$(${CLIENT_EXE} get istiooperator -n ${ISTIO_NAMESPACE} -o jsonpath='{.items[0].spec.meshConfig.trustDomain}' 2>/dev/null || echo "")
    if [ -n "$trust_domain" ]; then
        if [ "$trust_domain" = "$TRUST_DOMAIN" ]; then
            log_info "Istio trust domain is correctly set to: $trust_domain"
        else
            log_warn "Istio trust domain is '$trust_domain' but expected '$TRUST_DOMAIN'"
        fi
    else
        log_warn "Could not determine Istio trust domain"
    fi
    
    # Check if ingress gateway has SPIRE volume
    if ${CLIENT_EXE} get deployment istio-ingressgateway -n ${ISTIO_NAMESPACE} -o jsonpath='{.spec.template.spec.volumes[?(@.name=="workload-socket")]}' &> /dev/null; then
        log_info "Istio Ingress Gateway has SPIRE workload-socket volume configured"
    else
        log_warn "Istio Ingress Gateway does not have SPIRE workload-socket volume"
    fi
}

# Deploy test workload
deploy_test_workload() {
    log_info "Deploying test workload to verify SPIRE integration..."
    
    ${CLIENT_EXE} apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: spire-test
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: curl
  namespace: spire-test
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: curl
  namespace: spire-test
spec:
  replicas: 1
  selector:
    matchLabels:
      app: curl
  template:
    metadata:
      labels:
        app: curl
      annotations:
        inject.istio.io/templates: "sidecar,spire"
    spec:
      terminationGracePeriodSeconds: 0
      serviceAccountName: curl
      containers:
      - name: curl
        image: curlimages/curl:latest
        command: ["/bin/sleep", "3650d"]
        imagePullPolicy: IfNotPresent
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        securityContext:
          runAsUser: 1000
      volumes:
      - name: tmp
        emptyDir: {}
      - name: workload-socket
        csi:
          driver: "csi.spiffe.io"
          readOnly: true
EOF
    
    log_info "Waiting for test workload to be ready..."
    ${CLIENT_EXE} wait --for=condition=available --timeout=120s \
        deployment/curl -n spire-test || {
        log_warn "Test workload failed to become ready"
    }
    
    log_info "Test workload deployed. You can verify SPIRE identity with:"
    log_info "  kubectl exec -t \$(kubectl get pod -l app=curl -n spire-test -o jsonpath='{.items[0].metadata.name}') -n spire-test -c istio-proxy -- cat /var/run/secrets/workload-spiffe-uds/svid.key"
}

# Verify SPIRE identities
verify_spire_identities() {
    log_info "Verifying SPIRE identities..."
    
    local spire_server_pod=$(${CLIENT_EXE} get pod -n ${SPIRE_NAMESPACE} -l app.kubernetes.io/name=spire-server -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || \
                             ${CLIENT_EXE} get pod -n ${SPIRE_NAMESPACE} -l app=spire-server -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || \
                             ${CLIENT_EXE} get pod -n ${SPIRE_NAMESPACE} -o name 2>/dev/null | grep "spire-server" | head -1 | sed 's|pod/||' || echo "")
    
    if [ -z "$spire_server_pod" ]; then
        log_warn "SPIRE Server pod not found. Cannot verify identities."
        log_info "Available pods in ${SPIRE_NAMESPACE}:"
        ${CLIENT_EXE} get pods -n ${SPIRE_NAMESPACE} | head -10
        return
    fi
    
    log_info "Checking SPIRE Server entries using pod: $spire_server_pod"
    ${CLIENT_EXE} exec -n ${SPIRE_NAMESPACE} "$spire_server_pod" -c spire-server -- \
        ./bin/spire-server entry show 2>/dev/null || {
        log_warn "Could not retrieve SPIRE entries. SPIRE Server may still be initializing."
    }
}

# Main execution
main() {
    log_info "Starting SPIRE installation and configuration..."
    log_info "Trust Domain: ${TRUST_DOMAIN}"
    log_info "SPIRE Namespace: ${SPIRE_NAMESPACE}"
    log_info "Istio Namespace: ${ISTIO_NAMESPACE}"
    
    check_prerequisites
    install_spire_controller_manager
    verify_clusterspiffeids
    verify_spire_components
    verify_istio_config
    
    log_info ""
    log_info "SPIRE installation and configuration completed!"
    log_info ""
    log_info "Next steps:"
    log_info "1. Verify SPIRE identities: ./hack/istio/install-spire.sh --verify-identities"
    log_info "2. Deploy a test workload: ./hack/istio/install-spire.sh --deploy-test"
    local cmd="kubectl exec -n ${SPIRE_NAMESPACE} \$(kubectl get pod -n ${SPIRE_NAMESPACE} -l app=spire-server -o jsonpath='{.items[0].metadata.name}') -c spire-server -- ./bin/spire-server entry show"
    log_info "3. Check SPIRE Server entries: ${cmd}"
}

# Handle command line arguments
case "${1:-}" in
    --verify-identities)
        verify_spire_identities
        ;;
    --deploy-test)
        deploy_test_workload
        ;;
    --verify-components)
        verify_spire_components
        ;;
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --verify-identities    Verify SPIRE identities"
        echo "  --deploy-test         Deploy a test workload"
        echo "  --verify-components   Verify SPIRE components"
        echo "  --help, -h            Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  CLIENT_EXE            Kubernetes client (default: kubectl)"
        echo "  TRUST_DOMAIN         SPIRE trust domain (default: example.org)"
        echo "  SPIRE_NAMESPACE      SPIRE namespace (default: spire-server)"
        echo "  ISTIO_NAMESPACE      Istio namespace (default: istio-system)"
        exit 0
        ;;
    *)
        main
        ;;
esac

