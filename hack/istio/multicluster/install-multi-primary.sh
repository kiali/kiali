#!/bin/bash

##############################################################################
# install-everything.sh
#
# Installs Istio across two clusters using the "multi-primary" model.
#
# See: https://istio.io/latest/docs/setup/install/multicluster/multi-primary/
#
# See --help for more details on options to this script.
#
##############################################################################

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

install_istio() {
  local clustername="${1}"
  local network="${2}"
  if [ ! -z "${ISTIO_TAG}" ]; then
    local image_tag_arg="--image-tag ${ISTIO_TAG}"
  fi
  if [ ! -z "${ISTIO_HUB}" ]; then
    local image_hub_arg="--image-hub ${ISTIO_HUB}"
  fi
  "${ISTIO_INSTALL_SCRIPT}" ${image_tag_arg:-} ${image_hub_arg:-} --client-exe-path "${CLIENT_EXE}" --cluster-name "${clustername}" --istioctl "${ISTIOCTL}" --istio-dir "${ISTIO_DIR}" --mesh-id "${MESH_ID}" --namespace "${ISTIO_NAMESPACE}" --network "${network}"
  if [ "$?" != "0" ]; then
    echo "Failed to install Istio on cluster [${clustername}]"
    exit 1
  fi
}

create_crossnetwork_gateway() {
  local clustername="${1}"
  local network="${2}"

  # create the gateway
  local image_hub_arg="--set hub=gcr.io/istio-release"
  if [ ! -z "${ISTIO_HUB}" -a "${ISTIO_HUB}" != "default" ]; then
    image_hub_arg="--set hub=${ISTIO_HUB}"
  fi
  if [ ! -z "${ISTIO_TAG}" ]; then
    local image_tag_arg="--set tag=${ISTIO_TAG}"
  fi
  local gateway_yaml="$("${GEN_GATEWAY_SCRIPT}" --mesh "${MESH_ID}" --cluster "${clustername}" --network "${network}")"
  printf "%s" "${gateway_yaml}" | "${ISTIOCTL}" install ${image_hub_arg} ${image_tag_arg:-} -y -f -
  if [ "$?" != "0" ]; then
    echo "Failed to install crossnetwork gateway on cluster [${clustername}]"
    exit 1
  fi

  # expose services
  ${CLIENT_EXE} apply -n ${ISTIO_NAMESPACE} -f "${EXPOSE_SERVICES_YAML}"
  if [ "$?" != "0" ]; then
    echo "Failed to expose services on cluster [${clustername}]"
    exit 1
  fi
}

create_remote_secret() {
  local clustername="${1}"
  local secretcount="$(${CLIENT_EXE} get sa -n ${ISTIO_NAMESPACE} istio-reader-service-account --no-headers | tr -s ' ' | cut -d ' ' -f 2)"
  local secretname=""
  if [ "${secretcount}" -gt 1 ]; then
    # find the service account token secret (the word "token" will be in the secret name)
    secretname="--secret-name $(${CLIENT_EXE} get sa -n ${ISTIO_NAMESPACE} istio-reader-service-account -o jsonpath='{.secrets[0].name}')"
    if ! echo ${secretname} | grep "token"; then
      secretname="--secret-name $(${CLIENT_EXE} get sa -n ${ISTIO_NAMESPACE} istio-reader-service-account -o jsonpath='{.secrets[1].name}')"
      if ! echo ${secretname} | grep "token"; then
        echo "Failed to find the sa token secret"
        exit 1
      fi
    fi
    echo "Choosing to use: [${secretname}]"
  fi
  REMOTE_SECRET="$("${ISTIOCTL}" create-remote-secret --name "${clustername}" ${secretname})"
  if [ "$?" != "0" ]; then
    echo "Failed to generate remote secret for cluster [${clustername}]"
    exit 1
  fi

  # if kind, then we have to make sure the remote secret has the external IP to the API server
  if [ "${MANAGE_KIND}" == "true" ]; then
    local kind_ip=$(${DORP} inspect ${clustername}-control-plane --format "{{ .NetworkSettings.Networks.kind.IPAddress }}")
    REMOTE_SECRET="$(printf '%s' "${REMOTE_SECRET}" | sed -E 's!server:.*!server: https://'"${kind_ip}"':6443!')"
    echo "Updating remote secret for kind cluster [${clustername}] to use API IP [${kind_ip}]"
  fi
}

# Find the hack script to be used to install istio
ISTIO_INSTALL_SCRIPT="${SCRIPT_DIR}/../install-istio-via-istioctl.sh"
if [ -x "${ISTIO_INSTALL_SCRIPT}" ]; then
  echo "Istio install script: ${ISTIO_INSTALL_SCRIPT}"
else
  echo "Cannot find the Istio install script at: ${ISTIO_INSTALL_SCRIPT}"
  exit 1
fi

# Find the files necessary to create the crossnetwork gateway, if required
if [ "${CROSSNETWORK_GATEWAY_REQUIRED}" == "true" ]; then
  GEN_GATEWAY_SCRIPT="${ISTIO_DIR}/samples/multicluster/gen-eastwest-gateway.sh"
  EXPOSE_SERVICES_YAML="${ISTIO_DIR}/samples/multicluster/expose-services.yaml"
  if [ -x "${GEN_GATEWAY_SCRIPT}" ]; then
    echo "Generate-gateway script: ${GEN_GATEWAY_SCRIPT}"
  else
    echo "Cannot find the generate-gateway script at: ${GEN_GATEWAY_SCRIPT}"
    exit 1
  fi
  if [ -f "${EXPOSE_SERVICES_YAML}" ]; then
    echo "Expose-services yaml: ${EXPOSE_SERVICES_YAML}"
  else
    echo "Cannot find the expose-services yaml at: ${EXPOSE_SERVICES_YAML}"
    exit 1
  fi
fi

# Start up two minikube instances if requested
if [ "${MANAGE_MINIKUBE}" == "true" ]; then
  echo "Starting minikube instances"
  source ${SCRIPT_DIR}/start-minikube.sh
fi

# Start up two kind instances if requested
if [ "${MANAGE_KIND}" == "true" ]; then
  echo "Starting kind instances"
  
  # If a specific version of Istio hasn't been provided, try and guess the right one
  # based on the Kiali branch being tested (TARGET_BRANCH) and the compatibility matrices:
  # https://kiali.io/docs/installation/installation-guide/prerequisites/
  # https://istio.io/latest/docs/releases/supported-releases/
  if [ "${TARGET_BRANCH:-""}" == "v1.48" ]; then
    ISTIO_VERSION="1.13.0"
  else
    ISTIO_VERSION=""
  fi

  KIND_NODE_IMAGE=""
  if [ "${ISTIO_VERSION}" == "1.13.0" ]; then
    KIND_NODE_IMAGE="kindest/node:v1.23.4@sha256:0e34f0d0fd448aa2f2819cfd74e99fe5793a6e4938b328f657c8e3f81ee0dfb9"
  else
    KIND_NODE_IMAGE="kindest/node:v1.27.3@sha256:3966ac761ae0136263ffdb6cfd4db23ef8a83cba8a463690e98317add2c9ba72"
  fi

  echo "==== START KIND FOR CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
  "${SCRIPT_DIR}"/../../start-kind.sh --name "${CLUSTER1_NAME}" --load-balancer-range "255.70-255.84" --image "${KIND_NODE_IMAGE}"

  echo "==== START KIND FOR CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
  "${SCRIPT_DIR}"/../../start-kind.sh --name "${CLUSTER2_NAME}" --load-balancer-range "255.85-255.98" --image "${KIND_NODE_IMAGE}"
fi

# Setup the certificates
source ${SCRIPT_DIR}/setup-ca.sh

echo "==== INSTALL ISTIO ON CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
switch_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}"
install_istio "${CLUSTER1_NAME}" "${NETWORK1_ID}"

echo "==== INSTALL ISTIO ON CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"
install_istio "${CLUSTER2_NAME}" "${NETWORK2_ID}"

if [ "${CROSSNETWORK_GATEWAY_REQUIRED}" == "true" ]; then
  echo "==== CREATE CROSSNETWORK GATEWAY ON CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
  switch_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}"
  create_crossnetwork_gateway "${CLUSTER1_NAME}" "${NETWORK1_ID}"

  echo "==== CREATE CROSSNETWORK GATEWAY ON CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
  switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"
  create_crossnetwork_gateway "${CLUSTER2_NAME}" "${NETWORK2_ID}"

  echo "==== SETTING UP THE MESH NETWORK CONFIGURATION MANUALLY"
  source ${SCRIPT_DIR}/config-mesh-networks.sh
else
  echo "Crossnetwork gateway is not required - will not create one"
fi

echo "==== ENABLE ENDPOINT DISCOVERY ON CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
switch_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}"
create_remote_secret "${CLUSTER1_NAME}"
switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"
printf "%s" "${REMOTE_SECRET}" | ${CLIENT_EXE} apply -f -

echo "==== ENABLE ENDPOINT DISCOVERY ON CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"
create_remote_secret "${CLUSTER2_NAME}"
switch_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}"
printf "%s" "${REMOTE_SECRET}" | ${CLIENT_EXE} apply -f -

# Configure Prometheus federation
${CLIENT_EXE} patch svc prometheus -n ${ISTIO_NAMESPACE} --context ${CLUSTER2_CONTEXT} -p "{\"spec\": {\"type\": \"LoadBalancer\"}}"

WEST_PROMETHEUS_ADDRESS=$(${CLIENT_EXE} --context=${CLUSTER2_CONTEXT} -n ${ISTIO_NAMESPACE} get svc prometheus -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
sed -i "s/WEST_PROMETHEUS_ADDRESS/$WEST_PROMETHEUS_ADDRESS/g" ${SCRIPT_DIR}/prometheus.yaml
${CLIENT_EXE} apply -f ${SCRIPT_DIR}/prometheus.yaml -n ${ISTIO_NAMESPACE} --context ${CLUSTER1_CONTEXT} 
sed -i "s/$WEST_PROMETHEUS_ADDRESS/WEST_PROMETHEUS_ADDRESS/g" ${SCRIPT_DIR}/prometheus.yaml

# Configure Tracing "federation"
source ${SCRIPT_DIR}/setup-tracing.sh

# Install bookinfo across cluster if enabled
source ${SCRIPT_DIR}/split-bookinfo.sh
source ${SCRIPT_DIR}/../install-sleep-demo.sh -c ${CLIENT_EXE} 
