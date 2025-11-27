#!/bin/bash

##############################################################################
# install-bookinfo-spire.sh
#
# Updates Bookinfo demo application to use SPIRE for workload identity.
# This script patches existing Bookinfo deployments to include:
# - SPIRE label: spiffe.io/spire-managed-identity: "true"
# - SPIRE template annotation: inject.istio.io/templates: "sidecar,spire"
# - CSI volume for SPIRE workload socket
#
##############################################################################

set -e

CLIENT_EXE="${CLIENT_EXE:-kubectl}"
NAMESPACE="${NAMESPACE:-bookinfo}"

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

# Check if namespace exists
check_namespace() {
    if ! ${CLIENT_EXE} get namespace ${NAMESPACE} &> /dev/null; then
        log_error "Namespace '${NAMESPACE}' not found. Please install Bookinfo first."
        exit 1
    fi
    log_info "Namespace '${NAMESPACE}' found."
}

# Patch deployment to add SPIRE configuration
patch_deployment_for_spire() {
    local deployment=$1
    log_info "Patching deployment: ${deployment}"
    
    # Add SPIRE label and annotation to pod template
    ${CLIENT_EXE} patch deployment ${deployment} -n ${NAMESPACE} --type='json' -p='[
        {
            "op": "add",
            "path": "/spec/template/metadata/labels/spiffe.io~1spire-managed-identity",
            "value": "true"
        },
        {
            "op": "add",
            "path": "/spec/template/metadata/annotations/inject.istio.io~1templates",
            "value": "sidecar,spire"
        }
    ]' || {
        # If patch fails, try to add individually
        log_warn "JSON patch failed, trying individual patches..."
        ${CLIENT_EXE} patch deployment ${deployment} -n ${NAMESPACE} -p '{"spec":{"template":{"metadata":{"labels":{"spiffe.io/spire-managed-identity":"true"},"annotations":{"inject.istio.io/templates":"sidecar,spire"}}}}}' || {
            log_error "Failed to patch deployment ${deployment}"
            return 1
        }
    }
    
    # Add CSI volume for SPIRE workload socket
    ${CLIENT_EXE} patch deployment ${deployment} -n ${NAMESPACE} --type='json' -p='[
        {
            "op": "add",
            "path": "/spec/template/spec/volumes/-",
            "value": {
                "name": "workload-socket",
                "csi": {
                    "driver": "csi.spiffe.io",
                    "readOnly": true
                }
            }
        }
    ]' || {
        log_warn "Failed to add CSI volume to ${deployment}, checking if it already exists..."
        # Check if volume already exists
        if ! ${CLIENT_EXE} get deployment ${deployment} -n ${NAMESPACE} -o jsonpath='{.spec.template.spec.volumes[?(@.name=="workload-socket")]}' &> /dev/null; then
            log_error "CSI volume not found and could not be added to ${deployment}"
            return 1
        else
            log_info "CSI volume already exists in ${deployment}"
        fi
    }
    
    log_info "Successfully patched deployment: ${deployment}"
}

# Update all Bookinfo deployments
update_bookinfo_deployments() {
    log_info "Updating Bookinfo deployments for SPIRE..."
    
    local deployments=$(${CLIENT_EXE} get deployments -n ${NAMESPACE} -o jsonpath='{.items[*].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$deployments" ]; then
        log_error "No deployments found in namespace ${NAMESPACE}"
        exit 1
    fi
    
    for deployment in $deployments; do
        # Skip traffic generator if it exists
        if [[ "$deployment" == *"traffic-generator"* ]]; then
            log_info "Skipping traffic generator: ${deployment}"
            continue
        fi
        patch_deployment_for_spire "$deployment"
    done
    
    log_info "Waiting for deployments to roll out..."
    for deployment in $deployments; do
        if [[ "$deployment" == *"traffic-generator"* ]]; then
            continue
        fi
        ${CLIENT_EXE} rollout status deployment/${deployment} -n ${NAMESPACE} --timeout=120s || {
            log_warn "Deployment ${deployment} may still be rolling out"
        }
    done
}

# Verify SPIRE identities for Bookinfo workloads
verify_spire_identities() {
    log_info "Verifying SPIRE identities for Bookinfo workloads..."
    
    local spire_server_pod=$(${CLIENT_EXE} get pod -n spire-server -l app.kubernetes.io/name=spire-server -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || \
                             ${CLIENT_EXE} get pod -n spire-server -l app=spire-server -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || \
                             ${CLIENT_EXE} get pod -n spire-server -o name 2>/dev/null | grep "spire-server" | head -1 | sed 's|pod/||' || echo "")
    
    if [ -z "$spire_server_pod" ]; then
        log_warn "SPIRE Server pod not found. Cannot verify identities."
        return
    fi
    
    log_info "Checking SPIRE entries for Bookinfo workloads..."
    ${CLIENT_EXE} exec -n spire-server "$spire_server_pod" -c spire-server -- \
        ./bin/spire-server entry show 2>/dev/null | grep -E "bookinfo|${NAMESPACE}" || {
        log_warn "No SPIRE entries found for Bookinfo workloads yet. They may still be registering..."
    }
}

# Show status
show_status() {
    log_info "Bookinfo SPIRE Status:"
    echo ""
    echo "Deployments:"
    ${CLIENT_EXE} get deployments -n ${NAMESPACE}
    echo ""
    echo "Pods:"
    ${CLIENT_EXE} get pods -n ${NAMESPACE} -o wide
    echo ""
    echo "Pods with SPIRE label:"
    ${CLIENT_EXE} get pods -n ${NAMESPACE} -l spiffe.io/spire-managed-identity=true
}

# Main execution
main() {
    log_info "Installing Bookinfo with SPIRE support..."
    log_info "Namespace: ${NAMESPACE}"
    
    check_namespace
    update_bookinfo_deployments
    
    log_info "Waiting for pods to restart with SPIRE configuration..."
    sleep 10
    
    show_status
    
    log_info ""
    log_info "Waiting a bit more for SPIRE identities to be registered..."
    sleep 15
    
    verify_spire_identities
    
    log_info ""
    log_info "Bookinfo SPIRE installation completed!"
    log_info ""
    log_info "To verify SPIRE identities:"
    log_info "  kubectl exec -n spire-server spire-server-0 -c spire-server -- ./bin/spire-server entry show | grep bookinfo"
    log_info ""
    log_info "To check if a pod has SPIRE identity:"
    log_info "  kubectl exec -n ${NAMESPACE} <pod-name> -c istio-proxy -- ls -la /run/secrets/workload-spiffe-uds/"
}

# Handle command line arguments
case "${1:-}" in
    --verify)
        verify_spire_identities
        ;;
    --status)
        show_status
        ;;
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --verify    Verify SPIRE identities for Bookinfo workloads"
        echo "  --status    Show Bookinfo SPIRE status"
        echo "  --help, -h  Show this help message"
        echo ""
        echo "Environment variables:"
        echo "  CLIENT_EXE  Kubernetes client (default: kubectl)"
        echo "  NAMESPACE   Bookinfo namespace (default: bookinfo)"
        exit 0
        ;;
    *)
        main
        ;;
esac

