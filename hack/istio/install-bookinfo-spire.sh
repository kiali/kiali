#!/bin/bash

##############################################################################
# install-bookinfo-spire.sh
#
# Updates Bookinfo demo application to use SPIRE for workload identity.
# This script patches existing Bookinfo deployments to include:
# - SPIRE label: spiffe.io/spire-managed-identity: "true"
# - CSI volume for SPIRE workload socket
#
# Prerequisites:
# - SPIRE must be installed (e.g. install-istio-via-istioctl.sh --spire-enabled true)
# - Bookinfo must be deployed
#
##############################################################################

set -e

CLIENT_EXE="${CLIENT_EXE:-kubectl}"
NAMESPACE="${NAMESPACE:-bookinfo}"
SPIRE_NAMESPACE="${SPIRE_NAMESPACE:-spire}"

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

# Check if SPIRE is installed
check_spire_installed() {
    log_info "Checking if SPIRE is installed..."
    
    # Check for SPIRE namespace
    if ! ${CLIENT_EXE} get namespace ${SPIRE_NAMESPACE} &> /dev/null; then
        log_error "SPIRE namespace '${SPIRE_NAMESPACE}' not found."
        log_error "Please install SPIRE first using one of these methods:"
        log_error "  1. ./install-istio-via-istioctl.sh --spire-enabled true"
        log_error "  2. ./install-spire.sh"
        exit 1
    fi
    
    # Check for SPIRE server (Helm chart uses app.kubernetes.io/name=server)
    local spire_server_pod=$(${CLIENT_EXE} get pod -n ${SPIRE_NAMESPACE} -l app.kubernetes.io/name=server,app.kubernetes.io/instance=spire -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$spire_server_pod" ]; then
        log_error "SPIRE Server pod not found in namespace '${SPIRE_NAMESPACE}'."
        log_error "Please ensure SPIRE is properly installed."
        exit 1
    fi
    
    # Check for SPIRE CSI driver
    if ! ${CLIENT_EXE} get daemonset -n ${SPIRE_NAMESPACE} -l app.kubernetes.io/name=spiffe-csi-driver -o name &> /dev/null && \
       ! ${CLIENT_EXE} get daemonset spire-spiffe-csi-driver -n ${SPIRE_NAMESPACE} -o name &> /dev/null; then
        log_error "SPIRE CSI driver not found in namespace '${SPIRE_NAMESPACE}'."
        log_error "The CSI driver is required for workloads to get SPIFFE identities."
        exit 1
    fi
    
    log_info "SPIRE is installed in namespace '${SPIRE_NAMESPACE}'."
}

# Patch deployment to add SPIRE configuration
patch_deployment_for_spire() {
    local deployment=$1
    log_info "Patching deployment: ${deployment}"
    
    # Add SPIRE label to pod template (this triggers SPIRE Controller Manager to register the workload)
    ${CLIENT_EXE} patch deployment ${deployment} -n ${NAMESPACE} --type='json' -p='[
        {
            "op": "add",
            "path": "/spec/template/metadata/labels/spiffe.io~1spire-managed-identity",
            "value": "true"
        }
    ]' 2>/dev/null || {
        # If patch fails (label already exists or path doesn't exist), try strategic merge patch
        log_info "JSON patch failed for label, trying strategic merge patch..."
        ${CLIENT_EXE} patch deployment ${deployment} -n ${NAMESPACE} -p '{"spec":{"template":{"metadata":{"labels":{"spiffe.io/spire-managed-identity":"true"}}}}}' || {
            log_error "Failed to add SPIRE label to deployment ${deployment}"
            return 1
        }
    }
    
    # Check if CSI volume already exists in the deployment spec (not the pod spec from injection)
    local existing_csi=$(${CLIENT_EXE} get deployment ${deployment} -n ${NAMESPACE} -o jsonpath='{.spec.template.spec.volumes[?(@.name=="workload-socket")].csi.driver}' 2>/dev/null || echo "")
    
    if [ "$existing_csi" == "csi.spiffe.io" ]; then
        log_info "CSI volume 'workload-socket' already exists in ${deployment}"
    else
        # Add CSI volume for SPIRE workload socket using strategic merge patch
        # This works even if the volumes array doesn't exist in the deployment spec
        # The CSI volume will override any emptyDir volume injected by the sidecar injector
        log_info "Adding SPIRE CSI volume to ${deployment}..."
        ${CLIENT_EXE} patch deployment ${deployment} -n ${NAMESPACE} --type='strategic' -p='{
            "spec": {
                "template": {
                    "spec": {
                        "volumes": [
                            {
                                "name": "workload-socket",
                                "csi": {
                                    "driver": "csi.spiffe.io",
                                    "readOnly": true
                                }
                            }
                        ]
                    }
                }
            }
        }' || {
            log_warn "Failed to add SPIRE CSI volume to ${deployment}"
        }
    fi
    
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
    
    log_info "Waiting for deployments to be ready..."
    for deployment in $deployments; do
        if [[ "$deployment" == *"traffic-generator"* ]]; then
            continue
        fi
        
        log_info "Waiting for deployment ${deployment} to roll out..."
        ${CLIENT_EXE} rollout status deployment/${deployment} -n ${NAMESPACE} --timeout=180s || {
            log_warn "Deployment ${deployment} rollout timed out or failed"
            log_info "Checking pod status..."
            ${CLIENT_EXE} get pods -n ${NAMESPACE} -l app=${deployment} 2>/dev/null | head -5 || true
        }
    done
}

# Verify SPIRE identities for Bookinfo workloads
verify_spire_identities() {
    log_info "Verifying SPIRE identities for Bookinfo workloads..."
    
    # SPIRE Helm chart uses app.kubernetes.io/name=server
    local spire_server_pod=$(${CLIENT_EXE} get pod -n ${SPIRE_NAMESPACE} -l app.kubernetes.io/name=server,app.kubernetes.io/instance=spire -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$spire_server_pod" ]; then
        log_warn "SPIRE Server pod not found in namespace '${SPIRE_NAMESPACE}'. Cannot verify identities."
        return 1
    fi
    
    log_info "Checking SPIRE entries for Bookinfo workloads..."
    ${CLIENT_EXE} exec -n ${SPIRE_NAMESPACE} "$spire_server_pod" -c spire-server -- \
        ./bin/spire-server entry show 2>/dev/null | grep -E "bookinfo|${NAMESPACE}" || {
        log_warn "No SPIRE entries found for Bookinfo workloads yet. They may still be registering..."
        log_info "Wait a few seconds and try again with: $0 --verify"
    }
}

# Remove SPIRE configuration from a deployment
unpatch_deployment_for_spire() {
    local deployment=$1
    log_info "Removing SPIRE configuration from deployment: ${deployment}"

    # Remove SPIRE label from pod template
    ${CLIENT_EXE} patch deployment ${deployment} -n ${NAMESPACE} --type='json' -p='[
        {
            "op": "remove",
            "path": "/spec/template/metadata/labels/spiffe.io~1spire-managed-identity"
        }
    ]' 2>/dev/null || {
        log_warn "SPIRE label not found or already removed from ${deployment}"
    }

    # Remove CSI volume for SPIRE workload socket
    # First, find the index of the workload-socket volume
    local volume_index=$(${CLIENT_EXE} get deployment ${deployment} -n ${NAMESPACE} -o json 2>/dev/null | \
        jq -r '.spec.template.spec.volumes | to_entries[] | select(.value.name == "workload-socket") | .key' 2>/dev/null || echo "")

    if [ -n "$volume_index" ]; then
        ${CLIENT_EXE} patch deployment ${deployment} -n ${NAMESPACE} --type='json' -p="[
            {
                \"op\": \"remove\",
                \"path\": \"/spec/template/spec/volumes/${volume_index}\"
            }
        ]" 2>/dev/null || {
            log_warn "Failed to remove CSI volume from ${deployment}"
        }
        log_info "Removed CSI volume from ${deployment}"
    else
        log_warn "CSI volume 'workload-socket' not found in ${deployment}"
    fi

    log_info "Successfully removed SPIRE configuration from deployment: ${deployment}"
}

# Uninstall SPIRE support from all Bookinfo deployments
uninstall_spire() {
    log_info "Removing SPIRE support from Bookinfo deployments..."

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
        unpatch_deployment_for_spire "$deployment"
    done

    log_info "Waiting for deployments to restart without SPIRE configuration..."
    for deployment in $deployments; do
        if [[ "$deployment" == *"traffic-generator"* ]]; then
            continue
        fi
        log_info "Waiting for deployment ${deployment} to roll out..."
        ${CLIENT_EXE} rollout status deployment/${deployment} -n ${NAMESPACE} --timeout=180s || {
            log_warn "Deployment ${deployment} rollout timed out or failed"
        }
    done

    log_info ""
    log_info "SPIRE support has been removed from Bookinfo deployments."
    log_info "Pods will restart with standard Istio sidecar injection."
}

# Show status
show_status() {
    log_info "Bookinfo SPIRE Status:"
    log_info "  Namespace: ${NAMESPACE}"
    log_info "  SPIRE Namespace: ${SPIRE_NAMESPACE}"
    echo ""
    echo "Deployments:"
    ${CLIENT_EXE} get deployments -n ${NAMESPACE}
    echo ""
    echo "Pods:"
    ${CLIENT_EXE} get pods -n ${NAMESPACE} -o wide
    echo ""
    echo "Pods with SPIRE label:"
    ${CLIENT_EXE} get pods -n ${NAMESPACE} -l spiffe.io/spire-managed-identity=true 2>/dev/null || echo "  (none found)"
}

# Print help
print_help() {
    cat <<HELPMSG
Usage: $0 [OPTIONS]

Updates Bookinfo demo application to use SPIRE for workload identity.

Prerequisites:
  - SPIRE must be installed (via install-spire.sh or install-istio-via-istioctl.sh --spire-enabled true)
  - Bookinfo must be deployed

Options:
  (no options)    Install SPIRE support for Bookinfo deployments
  --uninstall     Remove SPIRE support from Bookinfo deployments
  --verify        Verify SPIRE identities for Bookinfo workloads
  --status        Show Bookinfo SPIRE status
  --help, -h      Show this help message

Environment variables:
  CLIENT_EXE       Kubernetes client (default: kubectl)
  NAMESPACE        Bookinfo namespace (default: bookinfo)
  SPIRE_NAMESPACE  SPIRE namespace (default: spire)

Example:
  # Install SPIRE support for Bookinfo
  $0

  # Verify SPIRE identities
  $0 --verify

  # Remove SPIRE support
  $0 --uninstall
HELPMSG
}

# Main execution
main() {
    log_info "Installing Bookinfo with SPIRE support..."
    log_info "  Bookinfo Namespace: ${NAMESPACE}"
    log_info "  SPIRE Namespace: ${SPIRE_NAMESPACE}"
    
    check_namespace
    check_spire_installed
    update_bookinfo_deployments
    
    log_info "Waiting for pods to restart with SPIRE configuration..."
    sleep 10
    
    show_status
    
    log_info ""
    log_info "Waiting for SPIRE identities to be registered..."
    sleep 15
    
    verify_spire_identities
    
    log_info ""
    log_info "Bookinfo SPIRE installation completed!"
    log_info ""
    log_info "To verify SPIRE identities:"
    log_info "  kubectl exec -n ${SPIRE_NAMESPACE} \$(kubectl get pod -n ${SPIRE_NAMESPACE} -l app.kubernetes.io/name=server,app.kubernetes.io/instance=spire -o jsonpath='{.items[0].metadata.name}') -c spire-server -- ./bin/spire-server entry show | grep bookinfo"
    log_info ""
    log_info "To check if a pod has SPIRE identity:"
    log_info "  kubectl exec -n ${NAMESPACE} <pod-name> -c istio-proxy -- ls -la /run/secrets/workload-spiffe-uds/"
}

# Handle command line arguments
case "${1:-}" in
    --uninstall)
        check_namespace
        uninstall_spire
        show_status
        ;;
    --verify)
        verify_spire_identities
        ;;
    --status)
        show_status
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
