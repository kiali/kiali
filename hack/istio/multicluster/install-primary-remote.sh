#!/bin/bash

##############################################################################
# install-primary-remote.sh
#
# Installs Istio across two clusters using the "primary-remote" model.
#
# See: https://istio.io/latest/docs/setup/install/multicluster/primary-remote/
#
# See --help for more details on options to this script.
#
##############################################################################

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

# Start up two minikube instances if requested
if [ "${MANAGE_MINIKUBE}" == "true" ]; then
  echo "Starting minikube instances"
  source ${SCRIPT_DIR}/start-minikube.sh
fi

# Start up two kind instances if requested
if [ "${MANAGE_KIND}" == "true" ]; then
  echo "Starting kind instances"

  echo "==== START KIND FOR CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
  "${SCRIPT_DIR}"/../../start-kind.sh --name "${CLUSTER1_NAME}" --load-balancer-range "255.70-255.84" --image "${KIND_NODE_IMAGE}"

  echo "==== START KIND FOR CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
  "${SCRIPT_DIR}"/../../start-kind.sh --name "${CLUSTER2_NAME}" --load-balancer-range "255.85-255.98" --image "${KIND_NODE_IMAGE}"
fi

# Setup the certificates
source ${SCRIPT_DIR}/setup-ca.sh

# Cluster East
switch_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}"

${CLIENT_EXE} label namespace ${ISTIO_NAMESPACE} topology.istio.io/network=${NETWORK1_ID}

ISTIO_INSTALL_SCRIPT="${SCRIPT_DIR}/../install-istio-via-sail.sh"
image_tag_arg=""
image_hub_arg=""
if [ -n "${ISTIO_TAG}" ]; then
  image_tag_arg="--set spec.values.pilot.tag=${ISTIO_TAG}"
fi
if [ -n "${ISTIO_HUB}" ]; then
  image_hub_arg="--set spec.values.pilot.hub=${ISTIO_HUB}"
fi

MC_EAST_YAML=$(mktemp)
cat <<EOF > "$MC_EAST_YAML"
spec:
  namespace: ${ISTIO_NAMESPACE}
  values:
    meshConfig:
      defaultConfig:
        tracing:
          sampling: 100
          zipkin:
            address: zipkin.istio-system:9411
      extensionProviders:
        - name: prometheus
          prometheus: {}
    global:
      meshID: ${MESH_ID}
      multiCluster:
        clusterName: ${CLUSTER1_NAME}
      network: ${NETWORK1_ID}
    pilot:
      env:
        EXTERNAL_ISTIOD: "true"
EOF


if [ "${TEMPO}" == "true" ]; then
  ${ISTIO_INSTALL_SCRIPT} -a "prometheus grafana tempo" --patch-file "${MC_EAST_YAML}" ${image_tag_arg} ${image_hub_arg}
else
  ${ISTIO_INSTALL_SCRIPT} --patch-file "${MC_EAST_YAML}" ${image_tag_arg} ${image_hub_arg}
fi

helm install istio-eastwestgateway gateway \
  --repo https://istio-release.storage.googleapis.com/charts \
  --wait \
  -n istio-system \
  --kube-context "${CLUSTER1_CONTEXT}" \
  --set name=istio-eastwestgateway \
  --set networkGateway="${NETWORK1_ID}"

EXPOSE_ISTIOD_YAML="${ISTIO_DIR}/samples/multicluster/expose-istiod.yaml"
${CLIENT_EXE} apply --context=${CLUSTER1_CONTEXT} -n ${ISTIO_NAMESPACE} -f $EXPOSE_ISTIOD_YAML

EXPOSE_SERVICES_YAML="${ISTIO_DIR}/samples/multicluster/expose-services.yaml"
${CLIENT_EXE} apply --context=${CLUSTER1_CONTEXT} -n ${ISTIO_NAMESPACE} -f $EXPOSE_SERVICES_YAML

# Install Kiali in both clusters if enabled
if [ "${KIALI_ENABLED}" == "true" ]; then
  if [ -z "${KEYCLOAK_ADDRESS}" ] && [ "${MANAGE_MINIKUBE}" == "true" ]; then
    echo "Keycloak is not available for this cluster setup. Switching Kiali to 'anonymous' mode."
    export KIALI_AUTH_STRATEGY="anonymous"
  fi
  source ${SCRIPT_DIR}/deploy-kiali.sh
fi

# Cluster West
switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"

${CLIENT_EXE} --context=${CLUSTER2_CONTEXT} annotate namespace ${ISTIO_NAMESPACE} topology.istio.io/controlPlaneClusters=${CLUSTER1_NAME}
${CLIENT_EXE} --context=${CLUSTER2_CONTEXT} label namespace ${ISTIO_NAMESPACE} topology.istio.io/network=${NETWORK2_ID}

DISCOVERY_ADDRESS=$(${CLIENT_EXE} --context=${CLUSTER1_CONTEXT} -n ${ISTIO_NAMESPACE} get svc istio-eastwestgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

MC_WEST_YAML=$(mktemp)
cat <<EOF > "$MC_WEST_YAML"
spec:
  profile: remote
  namespace: ${ISTIO_NAMESPACE}
  values:
    istiodRemote:
      injectionPath: /inject/cluster/${CLUSTER2_NAME}/net/${NETWORK2_ID}
    global:
      remotePilotAddress: ${DISCOVERY_ADDRESS}
EOF
${ISTIO_INSTALL_SCRIPT} -a "prometheus" --patch-file "${MC_WEST_YAML}" --wait "false"

# We need the istio reconcile to get to the point where it has created the remote RBAC but fails on pinging the primary's istiod.
# If we don't wait until the RBAC is created by istio, then the Sail reconiliation will fail because istioctl create-remote-secret
# also creates the RBAC and if that happens Sail can't take ownership of those resources.
kubectl --context="${CLUSTER2_CONTEXT}" wait --for='jsonpath={.status.conditions[?(@.type=="Ready")].message}="readiness probe on remote istiod failed"' istios/default --timeout=1m

# For kind we need to use the container IP otherwise the unresolvable localhost will be used.
SERVER_FLAG=""
if [ "${MANAGE_KIND}" == "true" ]; then
    CLUSTER2_CONTAINER_IP=$(${CLIENT_EXE} get nodes "${CLUSTER2_NAME}"-control-plane --context "${CLUSTER2_CONTEXT}" -o jsonpath='{.status.addresses[?(@.type == "InternalIP")].address}')
    SERVER_FLAG="--server=https://${CLUSTER2_CONTAINER_IP}:6443"
fi
${ISTIOCTL} create-remote-secret --context=${CLUSTER2_CONTEXT} --name=${CLUSTER2_NAME} ${SERVER_FLAG} | ${CLIENT_EXE} apply -f - --context="${CLUSTER1_CONTEXT}"

helm install istio-eastwestgateway gateway \
  --repo https://istio-release.storage.googleapis.com/charts \
  -n istio-system \
  --kube-context "${CLUSTER2_CONTEXT}" \
  --set name=istio-eastwestgateway \
  --set networkGateway="${NETWORK2_ID}"

${CLIENT_EXE} patch svc prometheus -n ${ISTIO_NAMESPACE} --context ${CLUSTER2_CONTEXT} -p "{\"spec\": {\"type\": \"LoadBalancer\"}}"

# Configure Prometheus federation
WEST_PROMETHEUS_ADDRESS=$(${CLIENT_EXE} --context=${CLUSTER2_CONTEXT} -n ${ISTIO_NAMESPACE} get svc prometheus -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
sed -i "s/WEST_PROMETHEUS_ADDRESS/$WEST_PROMETHEUS_ADDRESS/g" ${SCRIPT_DIR}/prometheus.yaml
${CLIENT_EXE} apply -f ${SCRIPT_DIR}/prometheus.yaml -n ${ISTIO_NAMESPACE} --context ${CLUSTER1_CONTEXT} 
sed -i "s/$WEST_PROMETHEUS_ADDRESS/WEST_PROMETHEUS_ADDRESS/g" ${SCRIPT_DIR}/prometheus.yaml

echo "==== DEPLOY ISTIO INGRESS GATEWAY ON CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
kubectl --context "${CLUSTER1_CONTEXT}" apply -n "${ISTIO_NAMESPACE}" -f "${SCRIPT_DIR}/../istio-gateway.yaml"

# Configure Tracing "federation"
source ${SCRIPT_DIR}/setup-tracing.sh

# Install bookinfo across cluster if enabled
source ${SCRIPT_DIR}/split-bookinfo.sh

