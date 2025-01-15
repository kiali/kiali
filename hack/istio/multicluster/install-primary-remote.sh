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

ISTIO_INSTALL_SCRIPT="${SCRIPT_DIR}/../install-istio-via-istioctl.sh"
if [ ! -z "${ISTIO_TAG}" ]; then
  image_tag_arg="--image-tag ${ISTIO_TAG}"
fi
if [ ! -z "${ISTIO_HUB}" ]; then
  image_hub_arg="--image-hub ${ISTIO_HUB}"
fi

if [ "${TEMPO}" == "true" ]; then
  "${SCRIPT_DIR}"/../tempo/install-tempo-env.sh -c ${CLIENT_EXE} -ot true
  ${ISTIO_INSTALL_SCRIPT} ${image_tag_arg:-} ${image_hub_arg:-} --client-exe-path ${CLIENT_EXE} --cluster-name ${CLUSTER1_NAME} --istioctl ${ISTIOCTL} --istio-dir ${ISTIO_DIR} --mesh-id ${MESH_ID} --namespace ${ISTIO_NAMESPACE} --network ${NETWORK1_ID} --set values.pilot.env.EXTERNAL_ISTIOD=true --k8s-gateway-api-enabled true  -a "prometheus grafana" -s values.meshConfig.defaultConfig.tracing.zipkin.address="tempo-cr-distributor.tempo:9411"
else
  ${ISTIO_INSTALL_SCRIPT} ${image_tag_arg:-} ${image_hub_arg:-} --client-exe-path ${CLIENT_EXE} --cluster-name ${CLUSTER1_NAME} --istioctl ${ISTIOCTL} --istio-dir ${ISTIO_DIR} --mesh-id ${MESH_ID} --namespace ${ISTIO_NAMESPACE} --network ${NETWORK1_ID} --set values.pilot.env.EXTERNAL_ISTIOD=true --k8s-gateway-api-enabled true
fi

GEN_GATEWAY_SCRIPT="${ISTIO_DIR}/samples/multicluster/gen-eastwest-gateway.sh"
${GEN_GATEWAY_SCRIPT} --mesh ${MESH_ID} --cluster ${CLUSTER1_NAME} --network ${NETWORK1_ID} | ${ISTIOCTL} --context=${CLUSTER1_CONTEXT} install -y -f -

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

# some previous versions of Istio do not install the Istio CRDs via the remote profile, thus we need to explicitly set
# components.base.enabled=true to get the CRDs installed.
# As of Istio 1.24, it seems this is no longer necessary, but it doesn't hurt anything if we specify it.
${ISTIOCTL} install -y --force=true --set profile=remote --set components.base.enabled=true --set values.istiodRemote.injectionPath=/inject/cluster/${CLUSTER2_NAME}/net/${NETWORK2_ID} --set values.global.remotePilotAddress=${DISCOVERY_ADDRESS}
${CLIENT_EXE} apply -f ${ISTIO_DIR}/samples/addons/prometheus.yaml -n ${ISTIO_NAMESPACE}

CA_BUNDLE=$(${CLIENT_EXE} get secret cacerts -n ${ISTIO_NAMESPACE} --context ${CLUSTER1_CONTEXT} -o jsonpath={.data."ca-cert\.pem"})

${CLIENT_EXE} patch mutatingwebhookconfigurations.admissionregistration.k8s.io -n ${ISTIO_NAMESPACE} istio-sidecar-injector -p "{\"webhooks\":[{\"clientConfig\":{\"caBundle\":\"${CA_BUNDLE}\"},\"name\":\"rev.namespace.sidecar-injector.istio.io\"}]}"
${CLIENT_EXE} patch mutatingwebhookconfigurations.admissionregistration.k8s.io -n ${ISTIO_NAMESPACE} istio-sidecar-injector -p "{\"webhooks\":[{\"clientConfig\":{\"caBundle\":\"${CA_BUNDLE}\"},\"name\":\"rev.object.sidecar-injector.istio.io\"}]}"
${CLIENT_EXE} patch mutatingwebhookconfigurations.admissionregistration.k8s.io -n ${ISTIO_NAMESPACE} istio-sidecar-injector -p "{\"webhooks\":[{\"clientConfig\":{\"caBundle\":\"${CA_BUNDLE}\"},\"name\":\"namespace.sidecar-injector.istio.io\"}]}"
${CLIENT_EXE} patch mutatingwebhookconfigurations.admissionregistration.k8s.io -n ${ISTIO_NAMESPACE} istio-sidecar-injector -p "{\"webhooks\":[{\"clientConfig\":{\"caBundle\":\"${CA_BUNDLE}\"},\"name\":\"object.sidecar-injector.istio.io\"}]}"

${CLIENT_EXE} patch mutatingwebhookconfigurations.admissionregistration.k8s.io -n ${ISTIO_NAMESPACE} istio-revision-tag-default -p "{\"webhooks\":[{\"clientConfig\":{\"caBundle\":\"${CA_BUNDLE}\"},\"name\":\"rev.namespace.sidecar-injector.istio.io\"}]}"
${CLIENT_EXE} patch mutatingwebhookconfigurations.admissionregistration.k8s.io -n ${ISTIO_NAMESPACE} istio-revision-tag-default -p "{\"webhooks\":[{\"clientConfig\":{\"caBundle\":\"${CA_BUNDLE}\"},\"name\":\"rev.object.sidecar-injector.istio.io\"}]}"
${CLIENT_EXE} patch mutatingwebhookconfigurations.admissionregistration.k8s.io -n ${ISTIO_NAMESPACE} istio-revision-tag-default -p "{\"webhooks\":[{\"clientConfig\":{\"caBundle\":\"${CA_BUNDLE}\"},\"name\":\"namespace.sidecar-injector.istio.io\"}]}"
${CLIENT_EXE} patch mutatingwebhookconfigurations.admissionregistration.k8s.io -n ${ISTIO_NAMESPACE} istio-revision-tag-default -p "{\"webhooks\":[{\"clientConfig\":{\"caBundle\":\"${CA_BUNDLE}\"},\"name\":\"object.sidecar-injector.istio.io\"}]}"

# For kind we need to use the container IP otherwise the unresolvable localhost will be used.
SERVER_FLAG=""
if [ "${MANAGE_KIND}" == "true" ]; then
    CLUSTER2_CONTAINER_IP=$(${CLIENT_EXE} get nodes "${CLUSTER2_NAME}"-control-plane --context "${CLUSTER2_CONTEXT}" -o jsonpath='{.status.addresses[?(@.type == "InternalIP")].address}')
    SERVER_FLAG="--server=https://${CLUSTER2_CONTAINER_IP}:6443"
fi
${ISTIOCTL} create-remote-secret --context=${CLUSTER2_CONTEXT} --name=${CLUSTER2_NAME} ${SERVER_FLAG} | ${CLIENT_EXE} apply -f - --context="${CLUSTER1_CONTEXT}"

${GEN_GATEWAY_SCRIPT} --mesh ${MESH_ID} --cluster ${CLUSTER2_NAME} --network ${NETWORK2_ID} | ${ISTIOCTL} --context=${CLUSTER2_CONTEXT} install -y -f -

${CLIENT_EXE} patch svc prometheus -n ${ISTIO_NAMESPACE} --context ${CLUSTER2_CONTEXT} -p "{\"spec\": {\"type\": \"LoadBalancer\"}}"

# Configure Prometheus federation
WEST_PROMETHEUS_ADDRESS=$(${CLIENT_EXE} --context=${CLUSTER2_CONTEXT} -n ${ISTIO_NAMESPACE} get svc prometheus -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
sed -i "s/WEST_PROMETHEUS_ADDRESS/$WEST_PROMETHEUS_ADDRESS/g" ${SCRIPT_DIR}/prometheus.yaml
${CLIENT_EXE} apply -f ${SCRIPT_DIR}/prometheus.yaml -n ${ISTIO_NAMESPACE} --context ${CLUSTER1_CONTEXT} 
sed -i "s/$WEST_PROMETHEUS_ADDRESS/WEST_PROMETHEUS_ADDRESS/g" ${SCRIPT_DIR}/prometheus.yaml

# Configure Tracing "federation"
source ${SCRIPT_DIR}/setup-tracing.sh

# Install bookinfo across cluster if enabled
source ${SCRIPT_DIR}/split-bookinfo.sh

