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
# 1. Purges Kiali from management cluster (only component on mgmt)
# 2. Deletes Bookinfo from mesh cluster
# 3. Removes Istio CRs (with finalizer removal) from mesh cluster
# 4. Purges Istio from mesh cluster
# 5. Deletes observability addons from mesh cluster only
# 6. Removes Sail Operator from mesh cluster
# 7. Deletes istio-system namespaces from both clusters
# 8. Cleans up OAuth clients
# 9. Removes all Istio and Sail CRDs
#
##############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"

# Default values
MGMT_CONTEXT="mgmt"
MESH_CONTEXT="mesh"
ISTIO_NAMESPACE="istio-system"
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
info "=== Step 1: Purging Kiali from management cluster ==="
switch_cluster "${MGMT_CONTEXT}"

if [ -x "${SCRIPT_DIR}/../../purge-kiali-from-cluster.sh" ]; then
  ${SCRIPT_DIR}/../../purge-kiali-from-cluster.sh -c oc || info "Kiali purge completed with warnings"
else
  info "Purge script not found, manually deleting Kiali resources..."
  oc delete deployment kiali -n ${ISTIO_NAMESPACE} --ignore-not-found=true
  oc delete service kiali -n ${ISTIO_NAMESPACE} --ignore-not-found=true
  oc delete route kiali -n ${ISTIO_NAMESPACE} --ignore-not-found=true
  oc delete serviceaccount kiali -n ${ISTIO_NAMESPACE} --ignore-not-found=true
  oc delete configmap kiali -n ${ISTIO_NAMESPACE} --ignore-not-found=true
  oc delete clusterrole kiali kiali-viewer --ignore-not-found=true
  oc delete clusterrolebinding kiali kiali-viewer --ignore-not-found=true
fi

# Delete remote cluster secret
info "Deleting remote cluster secret..."
oc delete secret kiali-remote-cluster-secret-mesh -n ${ISTIO_NAMESPACE} --ignore-not-found=true

# Step 2: Delete Bookinfo from mesh cluster
info "=== Step 2: Deleting Bookinfo from mesh cluster ==="
switch_cluster "${MESH_CONTEXT}"
oc delete namespace ${BOOKINFO_NAMESPACE} --ignore-not-found=true

# Step 3: Delete Kiali service account and resources from mesh cluster
info "=== Step 3: Deleting Kiali resources from mesh cluster ==="
oc delete serviceaccount kiali -n ${ISTIO_NAMESPACE} --ignore-not-found=true
oc delete configmap kiali -n ${ISTIO_NAMESPACE} --ignore-not-found=true
oc delete secret kiali -n ${ISTIO_NAMESPACE} --ignore-not-found=true
oc delete clusterrole kiali --ignore-not-found=true
oc delete clusterrolebinding kiali --ignore-not-found=true

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

# Step 8: Delete istio-system namespaces
info "=== Step 8: Deleting istio-system namespaces ==="
switch_cluster "${MESH_CONTEXT}"
oc delete namespace ${ISTIO_NAMESPACE} --ignore-not-found=true

switch_cluster "${MGMT_CONTEXT}"
oc delete namespace ${ISTIO_NAMESPACE} --ignore-not-found=true

# Step 9: Delete OAuth clients
info "=== Step 9: Deleting OAuth clients ==="
switch_cluster "${MGMT_CONTEXT}"
oc delete oauthclient kiali-${ISTIO_NAMESPACE} --ignore-not-found=true

switch_cluster "${MESH_CONTEXT}"
oc delete oauthclient kiali-${ISTIO_NAMESPACE} --ignore-not-found=true

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

