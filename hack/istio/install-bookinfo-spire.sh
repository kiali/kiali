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
    
    log_info "Waiting for deployments to be ready..."
    for deployment in $deployments; do
        if [[ "$deployment" == *"traffic-generator"* ]]; then
            continue
        fi
        
        # Check deployment status
        local ready=$(${CLIENT_EXE} get deployment ${deployment} -n ${NAMESPACE} -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        local desired=$(${CLIENT_EXE} get deployment ${deployment} -n ${NAMESPACE} -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
        local updated=$(${CLIENT_EXE} get deployment ${deployment} -n ${NAMESPACE} -o jsonpath='{.status.updatedReplicas}' 2>/dev/null || echo "0")
        local unavailable=$(${CLIENT_EXE} get deployment ${deployment} -n ${NAMESPACE} -o jsonpath='{.status.unavailableReplicas}' 2>/dev/null || echo "0")
        local replicas=$(${CLIENT_EXE} get deployment ${deployment} -n ${NAMESPACE} -o jsonpath='{.status.replicas}' 2>/dev/null || echo "0")
        
        # If deployment is already ready and updated, and no unavailable replicas, skip rollout wait
        if [ "$ready" == "$desired" ] && [ "$updated" == "$desired" ] && [ "$unavailable" == "0" ] && [ "$desired" != "0" ]; then
            log_info "Deployment ${deployment} is already ready (${ready}/${desired} replicas)"
            continue
        fi
        
        # Check if there are multiple replicasets (indicating a rollout in progress)
        local replicaset_count=$(${CLIENT_EXE} get replicaset -n ${NAMESPACE} -l app=${deployment} --no-headers 2>/dev/null | wc -l || echo "0")
        if [ "$replicaset_count" -gt "1" ]; then
            log_info "Deployment ${deployment} has multiple replicasets, rollout in progress (ready: ${ready}/${desired}, updated: ${updated}/${desired}, replicas: ${replicas})"
        fi
        
        # Get new replicaset (most recently created)
        local new_rs=$(${CLIENT_EXE} get replicaset -n ${NAMESPACE} -l app=${deployment} --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-1].metadata.name}' 2>/dev/null || echo "")
        
        # Check if new pods are failing - if updatedReplicas is 0 but we have unavailable replicas, pods might be failing
        if [ "$updated" == "0" ] && [ "$unavailable" != "0" ] && [ "$replicas" != "0" ]; then
            log_warn "Deployment ${deployment} appears to have failing pods. Checking pod status..."
            ${CLIENT_EXE} get pods -n ${NAMESPACE} -l app=${deployment} --field-selector=status.phase!=Running,status.phase!=Succeeded 2>/dev/null | head -5 || true
        fi
        
        # Check if new replicaset exists but has 0 current replicas (pods not starting)
        if [ -n "$new_rs" ]; then
            local new_rs_desired=$(${CLIENT_EXE} get replicaset ${new_rs} -n ${NAMESPACE} -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
            local new_rs_current=$(${CLIENT_EXE} get replicaset ${new_rs} -n ${NAMESPACE} -o jsonpath='{.status.replicas}' 2>/dev/null || echo "0")
            if [ "$new_rs_desired" != "0" ] && [ "$new_rs_current" == "0" ]; then
                log_warn "New replicaset ${new_rs} has ${new_rs_desired} desired but 0 current replicas. Checking pod events..."
                ${CLIENT_EXE} get events -n ${NAMESPACE} --field-selector involvedObject.kind=ReplicaSet,involvedObject.name=${new_rs} --sort-by='.lastTimestamp' 2>/dev/null | tail -5 || true
            fi
        fi
        
        # Only wait for rollout if deployment is actually rolling out
        if [ "$updated" != "$desired" ] || [ "$unavailable" != "0" ] || [ "$ready" != "$desired" ]; then
            # Check if rollout appears stuck (new replicaset exists but has 0 current replicas for too long)
            local rollout_stuck=false
            if [ -n "$new_rs" ]; then
                local new_rs_desired=$(${CLIENT_EXE} get replicaset ${new_rs} -n ${NAMESPACE} -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
                local new_rs_current=$(${CLIENT_EXE} get replicaset ${new_rs} -n ${NAMESPACE} -o jsonpath='{.status.replicas}' 2>/dev/null || echo "0")
                if [ "$new_rs_desired" != "0" ] && [ "$new_rs_current" == "0" ]; then
                    # Check if old replicaset is still running (rollout stuck)
                    local old_rs=$(${CLIENT_EXE} get replicaset -n ${NAMESPACE} -l app=${deployment} --sort-by=.metadata.creationTimestamp -o jsonpath='{.items[-2].metadata.name}' 2>/dev/null || echo "")
                    if [ -n "$old_rs" ] && [ "$old_rs" != "$new_rs" ]; then
                        local old_rs_ready=$(${CLIENT_EXE} get replicaset ${old_rs} -n ${NAMESPACE} -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
                        if [ "$old_rs_ready" != "0" ]; then
                            log_warn "Deployment ${deployment} rollout appears stuck: new replicaset ${new_rs} has 0 pods, old replicaset ${old_rs} still has ${old_rs_ready} ready pods"
                            rollout_stuck=true
                        fi
                    fi
                fi
            fi
            
            if [ "$rollout_stuck" == "true" ]; then
                log_warn "Skipping rollout wait for ${deployment} - rollout appears stuck. Check pod events for details."
                log_info "To debug, run: ${CLIENT_EXE} get events -n ${NAMESPACE} --field-selector involvedObject.name=${new_rs}"
            else
                log_info "Waiting for deployment ${deployment} to roll out (ready: ${ready}/${desired}, updated: ${updated}/${desired}, unavailable: ${unavailable})..."
                ${CLIENT_EXE} rollout status deployment/${deployment} -n ${NAMESPACE} --timeout=120s || {
                    log_warn "Deployment ${deployment} rollout timed out or failed"
                    log_info "Current status: ready=${ready}, desired=${desired}, updated=${updated}, unavailable=${unavailable}, replicas=${replicas}"
                    # Show pod status for debugging
                    log_info "Pod status for ${deployment}:"
                    ${CLIENT_EXE} get pods -n ${NAMESPACE} -l app=${deployment} 2>/dev/null | head -10 || true
                }
            fi
        else
            log_info "Deployment ${deployment} is ready, no rollout in progress"
        fi
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

