#!/bin/bash

# Helper function to install ambient multicluster for a single cluster
install_ambient_on_cluster() {
  local context="${1}"
  local user="${2}"
  local pass="${3}"
  local cluster_name="${4}"
  local network="${5}"
  
  echo "==== INSTALL ISTIO ON CLUSTER [${cluster_name}] - ${context}"
  switch_cluster "${context}" "${user}" "${pass}"

  echo "Installing Istio with ambient profile on cluster: ${cluster_name}, network: ${network} and meshID: ${MESH_ID}"

  # Label the namespace
  kubectl --context="${context}" label namespace istio-system topology.istio.io/network=${network}

  # Create the IstioOperator configuration for ambient multi-cluster
  local config_yaml=$(mktemp)
  cat <<EOF > "${config_yaml}"
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
spec:
  profile: ambient
  components:
    pilot:
      k8s:
        env:
          - name: AMBIENT_ENABLE_MULTI_NETWORK
            value: "true"
  values:
    global:
      meshID: ${MESH_ID}
      multiCluster:
        clusterName: ${cluster_name}
      network: ${network}
EOF

  echo "Istio configuration file created at: ${config_yaml}"
  echo "Configuration content:"
  cat "${config_yaml}"

  # Install Istio using istioctl directly with ambient profile
  "${ISTIOCTL}" install --skip-confirmation=true -f "${config_yaml}"
  if [ "$?" != "0" ]; then
    echo "Failed to install Istio with ambient profile"
    rm -f "${config_yaml}"
    exit 1
  fi

  # Install addons
  install_istio_addons "kubectl"

  # Clean up the temporary file
  rm -f "${config_yaml}"

  echo "Istio ambient installation completed for cluster: ${cluster_name}"
}

install_ambient_multicluster() {
  CLIENT_EXE="kubectl"
  
  # Setup Istio environment using shared function
  HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
  setup_istio_environment "${HACK_SCRIPT_DIR}"

  install_ambient_on_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}" "${CLUSTER1_NAME}" "${NETWORK1_ID}"
  install_ambient_on_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}" "${CLUSTER2_NAME}" "${NETWORK2_ID}"
}


# Helper function to setup ambient namespace on a cluster
setup_ambient_namespace() {
  local context="${1}"
  local namespace="${2:-sample}"
  
  kubectl create --context="${context}" namespace "${namespace}" || true
  kubectl label --context="${context}" namespace "${namespace}" \
      istio.io/dataplane-mode=ambient --overwrite
}

# Helper function to deploy helloworld service on a cluster
deploy_helloworld_service() {
  local context="${1}"
  local namespace="${2:-sample}"
  
  kubectl apply --context="${context}" \
      -f "${ISTIO_DIR}/samples/helloworld/helloworld.yaml" \
      -l service=helloworld -n "${namespace}"
}

# Helper function to deploy helloworld version and optionally label service as global
deploy_helloworld_version() {
  local context="${1}"
  local version="${2}"
  local namespace="${3:-sample}"
  local make_global="${4:-true}"
  
  kubectl apply --context="${context}" \
      -f "${ISTIO_DIR}/samples/helloworld/helloworld.yaml" \
      -l version="${version}" -n "${namespace}"
  
  if [ "${make_global}" == "true" ]; then
    kubectl label --context="${context}" svc helloworld -n "${namespace}" \
        istio.io/global="true" --overwrite
  fi
}

# Helper function to deploy curl tool on a cluster
deploy_curl_tool() {
  local context="${1}"
  local namespace="${2:-sample}"
  
  kubectl apply --context="${context}" \
      -f "${ISTIO_DIR}/samples/curl/curl.yaml" -n "${namespace}"
}

install_helloworld_demo() {
  CLIENT_EXE="kubectl"

  # Setup ambient namespaces on both clusters
  setup_ambient_namespace "${CLUSTER1_CONTEXT}"
  setup_ambient_namespace "${CLUSTER2_CONTEXT}"

  # Deploy helloworld service on both clusters
  deploy_helloworld_service "${CLUSTER1_CONTEXT}"
  deploy_helloworld_service "${CLUSTER2_CONTEXT}"

  # Deploy v1 on cluster 1 and v2 on cluster 2, both marked as global
  deploy_helloworld_version "${CLUSTER1_CONTEXT}" "v1"
  deploy_helloworld_version "${CLUSTER2_CONTEXT}" "v2"

  # Deploy curl tool on both clusters
  deploy_curl_tool "${CLUSTER1_CONTEXT}"
  deploy_curl_tool "${CLUSTER2_CONTEXT}"

  # Show verification command for user to test the deployment
  echo ""
  echo "==== HELLOWORLD DEMO INSTALLED SUCCESSFULLY ===="
  echo "To verify the multicluster setup from cluster 1 [${CLUSTER1_NAME}], run:"
  echo ""
  echo "kubectl exec --context=\"${CLUSTER1_CONTEXT}\" -n sample -c curl \\"
  echo "    \"\$(kubectl get pod --context=\"${CLUSTER1_CONTEXT}\" -n sample -l \\"
  echo "    app=curl -o jsonpath='{.items[0].metadata.name}')\" \\"
  echo "    -- curl -sS helloworld.sample:5000/hello"
  echo ""
  echo "This will test connectivity between clusters and show responses from both v1 and v2."

}