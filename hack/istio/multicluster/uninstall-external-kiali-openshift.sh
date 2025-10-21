#!/bin/bash

##############################################################################
# uninstall-external-kiali-openshift.sh
#
# Uninstalls the external Kiali setup from two OpenShift clusters.
# This script properly handles finalizers on Istio CRs before removing CRDs.
#
# ## Usage
#
# ```bash
# ./uninstall-external-kiali-openshift.sh \
#   --mgmt-context mgmt \
#   --mesh-context mesh
# ```
#
# ## What This Script Does
#
# 1. Deletes Kiali CR and uninstalls Kiali Operator from mgmt cluster
# 2. Deletes kiali-operator and kiali-server namespaces from mgmt cluster
# 3. Deletes Bookinfo from mesh cluster
# 4. Uninstalls Kiali remote resources helm release from mesh cluster
# 5. Removes Istio CRs (with finalizer removal) from mesh cluster
# 6. Deletes observability addons (Prometheus, Jaeger, routes) from mesh cluster
# 7. Removes Sail Operator from mesh cluster
# 8. Deletes istio-system namespace from mesh cluster
# 9. Removes all Istio and Sail CRDs from mesh cluster
#
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"

# Default values
MGMT_CONTEXT="mgmt"
MESH_CONTEXT="mesh"
ISTIO_NAMESPACE="istio-system"
KIALI_OPERATOR_NAMESPACE="kiali-operator"
KIALI_NAMESPACE="kiali-server"
BOOKINFO_NAMESPACE="bookinfo"

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
    --help)
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --mgmt-context <name>    Management cluster context name (default: mgmt)"
      echo "  --mesh-context <name>    Mesh cluster context name (default: mesh)"
      echo "  --help                   Show this help message"
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

switch_cluster() {
  local context="${1}"
  if ! oc config use-context "${context}"; then
    error "Failed to switch to cluster context: ${context}"
  fi
  info "Switched to cluster context: ${context}"
}

info "=== Starting cleanup of external Kiali setup ==="
info "Management cluster: ${MGMT_CONTEXT}"
info "Mesh cluster: ${MESH_CONTEXT}"

# Step 1: Purge Kiali from management cluster
info "=== Step 1: Purging Kiali Operator and CR from management cluster ==="
switch_cluster "${MGMT_CONTEXT}"

# Delete Kiali CR first (in kiali-server namespace)
info "Deleting Kiali CR..."
oc delete kiali kiali -n ${KIALI_NAMESPACE} --ignore-not-found=true --timeout=60s || \
  info "Kiali CR deletion completed with warnings"

# Uninstall Kiali Operator helm release (in kiali-operator namespace)
if helm list -n ${KIALI_OPERATOR_NAMESPACE} 2>/dev/null | grep -q kiali-operator; then
  info "Uninstalling Kiali Operator helm release..."
  helm uninstall kiali-operator -n ${KIALI_OPERATOR_NAMESPACE} || info "Helm uninstall completed with warnings"
fi

# Delete both Kiali namespaces
info "Deleting kiali-operator namespace..."
oc delete namespace ${KIALI_OPERATOR_NAMESPACE} --ignore-not-found=true

info "Deleting kiali-server namespace from mgmt cluster..."
oc delete namespace ${KIALI_NAMESPACE} --ignore-not-found=true

# Clean up any remaining cluster-scoped resources
oc delete clusterrole kiali kiali-viewer --ignore-not-found=true
oc delete clusterrolebinding kiali kiali-viewer --ignore-not-found=true
oc delete oauthclient kiali-${KIALI_NAMESPACE} --ignore-not-found=true

# Step 2: Delete Bookinfo from mesh cluster
info "=== Step 2: Deleting Bookinfo from mesh cluster ==="
switch_cluster "${MESH_CONTEXT}"
oc delete namespace ${BOOKINFO_NAMESPACE} --ignore-not-found=true

# Step 3: Delete Kiali remote cluster resources from mesh cluster
info "=== Step 3: Deleting Kiali remote cluster resources from mesh cluster ==="

# Try to delete Kiali CR if it exists (operator method)
info "Checking for Kiali CR on mesh cluster..."
oc delete kiali kiali -n ${KIALI_NAMESPACE} --ignore-not-found=true --timeout=60s 2>/dev/null || \
  info "No Kiali CR found or already deleted"

# Try to uninstall Kiali Operator from mesh cluster (operator method)
if helm list -n ${KIALI_OPERATOR_NAMESPACE} 2>/dev/null | grep -q kiali-operator; then
  info "Uninstalling Kiali Operator helm release from mesh cluster..."
  helm uninstall kiali-operator -n ${KIALI_OPERATOR_NAMESPACE} || info "Helm uninstall completed with warnings"
fi

# Delete kiali-operator namespace on mesh cluster
info "Deleting kiali-operator namespace from mesh cluster..."
oc delete namespace ${KIALI_OPERATOR_NAMESPACE} --ignore-not-found=true

# Try to uninstall the remote resources helm release (helm method)
if helm list -n ${KIALI_NAMESPACE} 2>/dev/null | grep -q kiali-remote-resources; then
  info "Uninstalling Kiali remote resources helm release from mesh cluster..."
  helm uninstall kiali-remote-resources -n ${KIALI_NAMESPACE} || info "Helm uninstall completed with warnings"
fi

# Delete kiali-server namespace on mesh cluster
info "Deleting kiali-server namespace from mesh cluster..."
oc delete namespace ${KIALI_NAMESPACE} --ignore-not-found=true

# Clean up any remaining cluster-scoped resources (in case they weren't managed by helm/operator)
oc delete clusterrole kiali kiali-viewer --ignore-not-found=true
oc delete clusterrolebinding kiali kiali-viewer --ignore-not-found=true

# Step 4: Remove Istio CRs (CRITICAL: Must remove finalizers first!)
info "=== Step 4: Removing Istio CRs with finalizer handling ==="

# Check for Istio CR
if oc get istios.sailoperator.io -n ${ISTIO_NAMESPACE} &> /dev/null; then
  ISTIO_CRS=$(oc get istios.sailoperator.io -n ${ISTIO_NAMESPACE} -o name 2>/dev/null || echo "")
  for cr in ${ISTIO_CRS}; do
    info "Removing finalizers from ${cr}..."
    oc patch ${cr} -n ${ISTIO_NAMESPACE} --type='merge' -p '{"metadata":{"finalizers":[]}}' 2>/dev/null || info "Finalizer removal skipped"
    info "Deleting ${cr}..."
    oc delete ${cr} -n ${ISTIO_NAMESPACE} --ignore-not-found=true
  done
else
  info "No Istio CRs found"
fi

# Check for IstioRevision CRs
if oc get istiorevisions.sailoperator.io -n ${ISTIO_NAMESPACE} &> /dev/null; then
  ISTIO_REV_CRS=$(oc get istiorevisions.sailoperator.io -n ${ISTIO_NAMESPACE} -o name 2>/dev/null || echo "")
  for cr in ${ISTIO_REV_CRS}; do
    info "Removing finalizers from ${cr}..."
    oc patch ${cr} -n ${ISTIO_NAMESPACE} --type='merge' -p '{"metadata":{"finalizers":[]}}' 2>/dev/null || info "Finalizer removal skipped"
    info "Deleting ${cr}..."
    oc delete ${cr} -n ${ISTIO_NAMESPACE} --ignore-not-found=true
  done
else
  info "No IstioRevision CRs found"
fi

# Check for IstioCNI CRs (cluster-scoped resource)
if oc get istiocnis.sailoperator.io &> /dev/null; then
  ISTIO_CNI_CRS=$(oc get istiocnis.sailoperator.io -o name 2>/dev/null || echo "")
  for cr in ${ISTIO_CNI_CRS}; do
    info "Removing finalizers from ${cr}..."
    oc patch ${cr} --type='merge' -p '{"metadata":{"finalizers":[]}}' 2>/dev/null || info "Finalizer removal skipped"
    info "Deleting ${cr}..."
    oc delete ${cr} --ignore-not-found=true
  done
else
  info "No IstioCNI CRs found"
fi

# Wait a moment for CRs to be fully deleted
sleep 5

# Step 5: Delete observability addons from mesh cluster
info "=== Step 5: Deleting observability addons from mesh cluster ==="
oc delete route prometheus -n ${ISTIO_NAMESPACE} --ignore-not-found=true
oc delete deployment prometheus -n ${ISTIO_NAMESPACE} --ignore-not-found=true
oc delete deployment jaeger -n ${ISTIO_NAMESPACE} --ignore-not-found=true
oc delete service prometheus tracing zipkin jaeger-collector -n ${ISTIO_NAMESPACE} --ignore-not-found=true
oc delete serviceaccount prometheus -n ${ISTIO_NAMESPACE} --ignore-not-found=true
oc delete configmap prometheus -n ${ISTIO_NAMESPACE} --ignore-not-found=true
oc delete clusterrole prometheus --ignore-not-found=true
oc delete clusterrolebinding prometheus --ignore-not-found=true

# Step 6: Management cluster cleanup (no observability addons to delete)
info "=== Step 6: Management cluster cleanup ==="
info "No observability addons to delete from management cluster (Kiali only setup)"
switch_cluster "${MGMT_CONTEXT}"

# Step 7: Delete Sail Operator and istio-cni from mesh cluster
info "=== Step 7: Deleting Sail Operator and istio-cni from mesh cluster ==="
switch_cluster "${MESH_CONTEXT}"

# Delete istio-cni namespace
info "Deleting istio-cni namespace..."
oc delete namespace istio-cni --ignore-not-found=true

if helm list -n sail-operator 2>/dev/null | grep -q sail-operator; then
  info "Uninstalling Sail Operator helm release..."
  helm uninstall sail-operator -n sail-operator || info "Helm uninstall completed with warnings"
fi
oc delete namespace sail-operator --ignore-not-found=true

# Step 8: Delete istio-system namespace from mesh cluster only
info "=== Step 8: Deleting istio-system namespace from mesh cluster ==="
switch_cluster "${MESH_CONTEXT}"
oc delete namespace ${ISTIO_NAMESPACE} --ignore-not-found=true

# Step 9: Delete OAuth client from mesh cluster
info "=== Step 9: Deleting OAuth client from mesh cluster ==="
switch_cluster "${MESH_CONTEXT}"
oc delete oauthclient kiali-${KIALI_NAMESPACE} --ignore-not-found=true
info "OAuth client for mgmt cluster is automatically deleted with kiali-server namespace"

# Step 10: Remove Istio and Sail CRDs from mesh cluster
info "=== Step 10: Removing Istio and Sail CRDs from mesh cluster ==="
switch_cluster "${MESH_CONTEXT}"

# Get all Istio and Sail CRDs
ISTIO_CRDS=$(oc get crds | grep -E '(istio|sail)' | awk '{print $1}' || echo "")
if [ -n "${ISTIO_CRDS}" ]; then
  for crd in ${ISTIO_CRDS}; do
    info "Deleting CRD: ${crd}..."
    oc delete crd ${crd} --ignore-not-found=true --timeout=60s || \
      info "CRD ${crd} may require manual cleanup"
  done
else
  info "No Istio/Sail CRDs found in mesh cluster"
fi

# Step 11: Remove any Gateway API CRDs if they were installed
info "=== Step 11: Checking for Gateway API CRDs ==="
GATEWAY_CRDS=$(oc get crds | grep 'gateway.networking.k8s.io' | awk '{print $1}' || echo "")
if [ -n "${GATEWAY_CRDS}" ]; then
  info "Found Gateway API CRDs (leaving them as they may be used by other components)"
else
  info "No Gateway API CRDs found"
fi

# Final verification
info "=== Final Verification ==="
switch_cluster "${MGMT_CONTEXT}"
MGMT_NAMESPACES=$(oc get ns | grep -E '(istio|kiali|sail)' || echo "")
if [ -z "${MGMT_NAMESPACES}" ]; then
  info "✅ Management cluster clean: No istio/kiali/sail namespaces"
else
  info "⚠️  Management cluster may have remaining namespaces:"
  echo "${MGMT_NAMESPACES}"
fi

switch_cluster "${MESH_CONTEXT}"
MESH_NAMESPACES=$(oc get ns | grep -E '(istio|kiali|sail|bookinfo)' || echo "")
if [ -z "${MESH_NAMESPACES}" ]; then
  info "✅ Mesh cluster clean: No istio/kiali/sail/bookinfo namespaces"
else
  info "⚠️  Mesh cluster may have remaining namespaces:"
  echo "${MESH_NAMESPACES}"
fi

MESH_CRDS=$(oc get crds | grep -E '(istio|kiali|sail)' || echo "")
if [ -z "${MESH_CRDS}" ]; then
  info "✅ Mesh cluster clean: No istio/kiali/sail CRDs"
else
  info "⚠️  Mesh cluster may have remaining CRDs:"
  echo "${MESH_CRDS}"
fi

info "=== Cleanup Complete ==="
info ""
info "Both clusters have been cleaned up."
info "If any resources remain, you may need to manually remove them."

