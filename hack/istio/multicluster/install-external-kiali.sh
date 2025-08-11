#!/bin/bash

##############################################################################
# install-external-kiali.sh
#
# Installs two clusters, one with only Kiali (cluster-1 = "mgmt") amd one with only istio (cluster-2 = "mesh").
#
# See --help for more details on options to this script.
#
##############################################################################

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

# The names of each cluster
if [ "${CLUSTER1_NAME}" == "east" ]; then
  CLUSTER1_NAME="mgmt"
fi
if [ "${CLUSTER2_NAME}" == "west" ]; then
  CLUSTER2_NAME="mesh"
fi

if [ "${MANAGE_KIND}" == "true" ]; then
  CLUSTER1_CONTEXT="kind-${CLUSTER1_NAME}"
  CLUSTER2_CONTEXT="kind-${CLUSTER2_NAME}"
else
  CLUSTER1_CONTEXT="${CLUSTER1_NAME}"
  CLUSTER2_CONTEXT="${CLUSTER2_NAME}"
fi

# Only install Kiali on cluster-1
IGNORE_HOME_CLUSTER="true"
SINGLE_KIALI="true"

# TODO: just use anonymous auth until we have this working...
KIALI_AUTH_STRATEGY="anonymous"

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
  local profile_flag=""
  if [ "${IS_OPENSHIFT}" == "true" ] || [ "${KIALI_AUTH_STRATEGY}" == "openshift" ]; then
    profile_flag="--set profile=openshift"
  fi

  printf "%s" "${gateway_yaml}" | "${ISTIOCTL}" install ${profile_flag} ${image_hub_arg} ${image_tag_arg:-} -y -f -
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

MC_MESH_YAML=$(mktemp)
cat <<EOF > "$MC_MESH_YAML"
spec:
  values:
    global:
      meshID: ${MESH_ID}
      multiCluster:
        clusterName: ${CLUSTER2_NAME}
      network: ${NETWORK2_ID}
EOF

# Start up two minikube instances if requested
if [ "${MANAGE_MINIKUBE}" == "true" ]; then
  echo "Starting minikube instances"
  source ${SCRIPT_DIR}/start-minikube.sh
fi

# Start up two kind instances if requested
if [ "${MANAGE_KIND}" == "true" ]; then
  echo "Starting kind instances"

  if [ "${KIALI_AUTH_STRATEGY}" == "openid" ]; then
    "${SCRIPT_DIR}/../../keycloak.sh" -kcd "${KEYCLOAK_CERTS_DIR}" create-ca

    docker network create kind || true

    # Given: 172.18.0.0/16 this should return 172.18
    subnet=""

    # we always use docker today, but we'll leave this here just in case in the future Kind and podman play nice
    if [ "${DORP}" == "docker" ]; then
      # loop through all known subnets in the kind network and pick out the IPv4 subnet, ignoring any IPv6 that might be in the list
      subnets_count="$(docker network inspect kind | jq '.[0].IPAM.Config | length')"
      infomsg "There are [$subnets_count] subnets in the kind network"
      for ((i=0; i<subnets_count; i++)); do
        subnet=$(docker network inspect kind --format '{{(index .IPAM.Config '$i').Subnet}}' 2> /dev/null)
        if [[ -n $subnet && $subnet != *:* && $subnet == *\.* ]]; then
          infomsg "Using subnet [$subnet]"
          break
        else
          infomsg "Ignoring subnet [$subnet]"
          subnet=""
        fi
      done
      if [ -z "$subnet" ]; then
        infomsg "No subnets found in the expected docker network list. Maybe this is a podman network - let's check"
        subnet=$(docker network inspect kind | jq -r '.[0].subnets[] | select(.subnet | test("^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+/")) | .subnet' 2>/dev/null)
      fi
    else
      subnet=$(podman network inspect kind | jq -r '.[0].subnets[] | select(.subnet | test("^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+/")) | .subnet' 2>/dev/null)
    fi

    if [ -z "$subnet" ]; then
      infomsg "There does not appear to be any IPv4 subnets configured"
      exit 1
    fi

    beginning_subnet_octets=$(echo $subnet | cut -d'.' -f1,2 2>/dev/null)
    lb_range_start="255.70"
    lb_range_end="255.84"

    KEYCLOAK_ADDRESS="${beginning_subnet_octets}.${lb_range_start}"

    echo "==== START KIND FOR CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
    "${SCRIPT_DIR}"/../../start-kind.sh \
      --name "${CLUSTER1_NAME}" \
      --load-balancer-range "${lb_range_start}-${lb_range_end}" \
      --enable-keycloak true \
      --keycloak-certs-dir "${KEYCLOAK_CERTS_DIR}" \
      --keycloak-issuer-uri https://"${KEYCLOAK_ADDRESS}"/realms/kube \
      --image "${KIND_NODE_IMAGE}"

    "${SCRIPT_DIR}/../../keycloak.sh" -kcd "${KEYCLOAK_CERTS_DIR}" -kip "${KEYCLOAK_ADDRESS}" deploy

    echo "==== START KIND FOR CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
    "${SCRIPT_DIR}"/../../start-kind.sh \
      --name "${CLUSTER2_NAME}" \
      --load-balancer-range "255.85-255.98" \
      --enable-keycloak true \
      --keycloak-certs-dir "${KEYCLOAK_CERTS_DIR}" \
      --keycloak-issuer-uri https://"${KEYCLOAK_ADDRESS}"/realms/kube \
      --image "${KIND_NODE_IMAGE}"
  else
    echo "==== START KIND FOR CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
    "${SCRIPT_DIR}"/../../start-kind.sh \
      --name "${CLUSTER1_NAME}" \
      --load-balancer-range "255.70-255.84" \
      --image "${KIND_NODE_IMAGE}"

    echo "==== START KIND FOR CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
    "${SCRIPT_DIR}"/../../start-kind.sh \
      --name "${CLUSTER2_NAME}" \
      --load-balancer-range "255.85-255.98" \
      --image "${KIND_NODE_IMAGE}"
  fi
fi

# Setup the certificates
source ${SCRIPT_DIR}/setup-ca.sh

echo "==== INSTALL ISTIO ON CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"
install_istio --patch-file "${MC_MESH_YAML}" -a "prometheus jaeger"

echo "==== INSTALL ADDONS ON CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
ADDONS="prometheus grafana jaeger"
for addon in ${ADDONS}; do
    istio_version=$(${CLIENT_EXE} --context="${CLUSTER2_CONTEXT}" -n "${ISTIO_NAMESPACE}" get istios -l kiali.io/testing -o jsonpath='{.items[0].spec.version}')
    # Verison comes in the form v1.23.0 but we want 1.23
    # Remove the 'v' and remove the .0 from 1.23.0 and we should be left with 1.23
    addon_version="${istio_version:1:4}"
    curl -s "https://raw.githubusercontent.com/istio/istio/refs/heads/release-$addon_version/samples/addons/$addon.yaml" | \
      yq "select(.metadata) | .metadata.namespace = \"${ISTIO_NAMESPACE}\"" - | \
      kubectl --context="${CLUSTER1_CONTEXT}" apply -n "${ISTIO_NAMESPACE}" -f -
done

# Configure Prometheus federation
${CLIENT_EXE} patch svc prometheus -n ${ISTIO_NAMESPACE} --context ${CLUSTER2_CONTEXT} -p "{\"spec\": {\"type\": \"LoadBalancer\"}}"

WEST_PROMETHEUS_ADDRESS=$(${CLIENT_EXE} --context=${CLUSTER2_CONTEXT} -n ${ISTIO_NAMESPACE} get svc prometheus -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
if [ -z "${WEST_PROMETHEUS_ADDRESS}" ]; then
  echo "WARNING! Prometheus not updated - cannot determine the west prometheus load balancer ingress IP"
else
  ## TODO: prometheus.yaml has CLUSTER_NAME in it that should also be searched-replaced, but that is not done here
  cat ${SCRIPT_DIR}/prometheus.yaml | sed -e "s/WEST_PROMETHEUS_ADDRESS/$WEST_PROMETHEUS_ADDRESS/g" | ${CLIENT_EXE} apply -n ${ISTIO_NAMESPACE} --context ${CLUSTER1_CONTEXT} -f -
fi

# TODO Anything to do for this? Configure Tracing "federation"
# source ${SCRIPT_DIR}/setup-tracing.sh

# Install Kiali if enabled
if [ "${KIALI_ENABLED}" == "true" ]; then
  if [ -z "${KEYCLOAK_ADDRESS}" ] && [ "${MANAGE_MINIKUBE}" == "true" ]; then
    echo "Keycloak is not available for this cluster setup. Switching Kiali to 'anonymous' mode."
    export KIALI_AUTH_STRATEGY="anonymous"
  fi

  source ${SCRIPT_DIR}/deploy-kiali.sh
fi

if [ "${BOOKINFO_ENABLED}" == "true" ]; then
  switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"
  echo "Installing bookinfo demo in namespace [${BOOKINFO_NAMESPACE}] on [${CLUSTER2_CONTEXT}]"
  source ${SCRIPT_DIR}/../install-bookinfo-demo.sh --client-exe "${CLIENT_EXE}" --istio-dir "${ISTIO_DIR}" --istio-namespace "${ISTIO_NAMESPACE}" --namespace "${BOOKINFO_NAMESPACE}" --kube-context "${CLUSTER2_CONTEXT}" -tg --mongo
fi
