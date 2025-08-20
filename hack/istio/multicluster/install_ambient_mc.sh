#!/bin/bash

install_ambient_mc() {

  ADDONS="prometheus grafana jaeger"

  # Install Istio on both clusters with ambient profile
  echo "==== INSTALL ISTIO ON CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
  switch_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}"

  echo "Installing Istio with ambient profile on cluster: ${CLUSTER1_NAME}"

  CLIENT_EXE="kubectl"

  # Go to the main output directory and try to find an Istio there.
  HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
  OUTPUT_DIR="${OUTPUT_DIR:-${HACK_SCRIPT_DIR}/../../../_output}"
  if [ "${ISTIO_VERSION}" == "" ]; then
    ALL_ISTIOS=$(ls -dt1 ${OUTPUT_DIR}/istio-*)
    if [ "$?" != "0" ]; then
      ${HACK_SCRIPT_DIR}/download-istio.sh
      if [ "$?" != "0" ]; then
        echo "ERROR: You do not have Istio installed and it cannot be downloaded."
        exit 1
      fi
    fi
  fi
  # install the Istio release that was last downloaded (that's the -t option to ls)
  ISTIO_DIR=$(ls -dt1 ${OUTPUT_DIR}/istio-* | head -n1)

  ISTIOCTL="${ISTIOCTL:-${ISTIO_DIR}/bin/istioctl}"
  if [ ! -f "${ISTIOCTL}" ]; then
     echo "ERROR: istioctl cannot be found at: ${ISTIOCTL}"
     exit 1
  fi

  # Create the IstioOperator configuration for ambient multi-cluster
  MC_EAST_YAML=$(mktemp)
  cat <<EOF > "$MC_EAST_YAML"
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
        clusterName: ${CLUSTER1_NAME}
      network: ${NETWORK1_ID}
EOF

  echo "Istio configuration file created at: ${MC_EAST_YAML}"
  echo "Configuration content:"
  cat "${MC_EAST_YAML}"

  # Install Istio using istioctl directly with ambient profile
  "${ISTIOCTL}" install --skip-confirmation=true -f "${MC_EAST_YAML}"
  if [ "$?" != "0" ]; then
    echo "Failed to install Istio with ambient profile"
    rm -f "${MC_EAST_YAML}"
    exit 1
  fi

  echo "Installing Addons: [${ADDONS}]"
  for addon in ${ADDONS}; do
    echo "Installing addon: [${addon}]"
    while ! (cat ${ISTIO_DIR}/samples/addons/${addon}.yaml | ${CLIENT_EXE} apply -n istio-system -f -)
    do
      echo "Failed to install addon [${addon}] - will retry in 10 seconds..."
      sleep 10
    done
  done

  # Clean up the temporary file
  rm -f "${MC_EAST_YAML}"

  echo "Istio ambient installation completed for cluster: ${CLUSTER1_NAME}"

  echo "==== INSTALL ISTIO ON CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
  switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"

  echo "Installing Istio with ambient profile on cluster: ${CLUSTER2_NAME}"

  MC_WEST_YAML=$(mktemp)
  cat <<EOF > "$MC_WEST_YAML"
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
        clusterName: ${CLUSTER2_NAME}
      network: ${NETWORK2_ID}
EOF

  echo "Istio configuration file created at: ${MC_WEST_YAML}"
  echo "Configuration content:"
  cat "${MC_WEST_YAML}"

  # Install Istio using istioctl directly with ambient profile
  "${ISTIOCTL}" install --skip-confirmation=true -f "${MC_WEST_YAML}"
  if [ "$?" != "0" ]; then
    echo "Failed to install Istio with ambient profile"
    rm -f "${MC_WEST_YAML}"
    exit 1
  fi

  echo "Installing Addons: [${ADDONS}]"
  for addon in ${ADDONS}; do
    echo "Installing addon: [${addon}]"
    while ! (cat ${ISTIO_DIR}/samples/addons/${addon}.yaml | ${CLIENT_EXE} apply -n istio-system -f -)
    do
      echo "Failed to install addon [${addon}] - will retry in 10 seconds..."
      sleep 10
    done
  done

  # Clean up the temporary file
  rm -f "${MC_WEST_YAML}"

  echo "Istio ambient installation completed for cluster: ${CLUSTER2_NAME}"

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