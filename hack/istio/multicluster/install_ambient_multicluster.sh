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


install_helloworld_demo() {

  CLIENT_EXE="kubectl"

  ${CLIENT_EXE} create --context="${CLUSTER1_CONTEXT}" namespace sample
  ${CLIENT_EXE} create --context="${CLUSTER2_CONTEXT}" namespace sample

  ${CLIENT_EXE} label --context="${CLUSTER1_CONTEXT}" namespace sample \
      istio.io/dataplane-mode=ambient
  ${CLIENT_EXE} label --context="${CLUSTER2_CONTEXT}" namespace sample \
      istio.io/dataplane-mode=ambient

  ${CLIENT_EXE} apply --context="${CLUSTER1_CONTEXT}" \
      -f ${ISTIO_DIR}/samples/helloworld/helloworld.yaml \
      -l service=helloworld -n sample
  ${CLIENT_EXE} apply --context="${CLUSTER2_CONTEXT}" \
      -f ${ISTIO_DIR}/samples/helloworld/helloworld.yaml \
      -l service=helloworld -n sample

  ${CLIENT_EXE} apply --context="${CLUSTER1_CONTEXT}" \
      -f ${ISTIO_DIR}/samples/helloworld/helloworld.yaml \
      -l version=v1 -n sample
  ${CLIENT_EXE} label --context="${CLUSTER1_CONTEXT}" svc helloworld -n sample \
      istio.io/global="true"

  ${CLIENT_EXE} apply --context="${CLUSTER2_CONTEXT}" \
      -f ${ISTIO_DIR}/samples/helloworld/helloworld.yaml \
      -l version=v2 -n sample

  ${CLIENT_EXE} label --context="${CLUSTER2_CONTEXT}" svc helloworld -n sample \
      istio.io/global="true"

  ${CLIENT_EXE} apply --context="${CLUSTER1_CONTEXT}" \
      -f ${ISTIO_DIR}/samples/curl/curl.yaml -n sample
  ${CLIENT_EXE} apply --context="${CLUSTER2_CONTEXT}" \
      -f ${ISTIO_DIR}/samples/curl/curl.yaml -n sample

# Verify with:
# kubectl exec --context="${CLUSTER1_CONTEXT}" -n sample -c curl \
#    "$(kubectl get pod --context="${CLUSTER1_CONTEXT}" -n sample -l \
#    app=curl -o jsonpath='{.items[0].metadata.name}')" \
#    -- curl -sS helloworld.sample:5000/hello

}