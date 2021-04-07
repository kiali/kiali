#!/bin/bash

##############################################################################
# config-mesh-networks.sh
#
# Configures the mesh networks in the Istio ConfigMap to ensure the
# two clusters' networks are linked.
#
# This is not needed to be performed on minikube since Istio can
# discover the networks automatically. This is only needed on platforms
# where Istio cannot figure out the external IPs of the gateways.
#
##############################################################################

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

if [ "${MANUAL_MESH_NETWORK_CONFIG}" != "true" ]; then
  echo "Will not manually configure the mesh network"
  return 0
else
  echo "Manually configuring the mesh network"
fi

get_gateway_load_balancer_ip() {
  local ip="$(${CLIENT_EXE} get -n ${ISTIO_NAMESPACE} service istio-eastwestgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
  if [ "${ip}" == "" ]; then
    return 1
  fi
  echo ${ip}
}

get_gateway_load_balancer_port() {
  local port="$(${CLIENT_EXE} get -n ${ISTIO_NAMESPACE} service istio-eastwestgateway -o jsonpath='{.spec.ports[?(@.name=="tls")].port}')"
  if [ "${port}" == "" ]; then
    return 1
  fi
  echo ${port}
}

get_gateway_node_ip() {
  local selector="$(${CLIENT_EXE} get -n ${ISTIO_NAMESPACE} service istio-eastwestgateway --output=json | jq -j '.spec.selector | to_entries | .[] | "\(.key)=\(.value),"' | sed -E 's/(.*),\\?/\1/')"
  local hostip="$(${CLIENT_EXE} get -n ${ISTIO_NAMESPACE} pod -o jsonpath='{.items[0].status.hostIP}' -l "${selector}")"
  if [ "${hostip}" == "" ]; then
    return 1
  fi
  echo ${hostip}
}

get_gateway_node_port() {
  local nodeport="$(${CLIENT_EXE} get -n ${ISTIO_NAMESPACE} service istio-eastwestgateway -o jsonpath='{.spec.ports[?(@.name=="tls")].nodePort}')"
  if [ "${nodeport}" == "" ]; then
    return 1
  fi
  echo ${nodeport}
}

echo "==== OBTAIN HOST IP AND NODE PORT FOR CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
switch_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}"
_GATEWAY_IP1="$(get_gateway_load_balancer_ip)"
if [ "$?" == "0" ]; then
  _GATEWAY_PORT1="$(get_gateway_load_balancer_port)"
else
  _GATEWAY_IP1="$(get_gateway_node_ip)"
  _GATEWAY_PORT1="$(get_gateway_node_port)"
fi

echo "==== OBTAIN HOST IP AND NODE PORT FOR CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"
_GATEWAY_IP2="$(get_gateway_load_balancer_ip)"
if [ "$?" == "0" ]; then
  _GATEWAY_PORT2="$(get_gateway_load_balancer_port)"
else
  _GATEWAY_IP2="$(get_gateway_node_ip)"
  _GATEWAY_PORT2="$(get_gateway_node_port)"
fi

_ISTIOD_CONFIG="{'networks':{'${NETWORK1_ID}':{'endpoints':[{'fromRegistry':'${CLUSTER1_NAME}'}],'gateways':[{'address':'${_GATEWAY_IP1}','port':${_GATEWAY_PORT1}}]},'${NETWORK2_ID}':{'endpoints':[{'fromRegistry':'${CLUSTER2_NAME}'}],'gateways':[{'address':'${_GATEWAY_IP2}','port':${_GATEWAY_PORT2}}]}}}"
echo "MeshNetwork config: $_ISTIOD_CONFIG"

echo "==== SETTING MESH NETWORK CONFIG FOR CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
switch_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}"
${CLIENT_EXE} get configmap istio -n ${ISTIO_NAMESPACE} -o json | jq ".data.meshNetworks=\"${_ISTIOD_CONFIG}\"" | ${CLIENT_EXE} apply -f -
${CLIENT_EXE} delete pod -l app=istiod -n ${ISTIO_NAMESPACE}

echo "==== SETTING MESH NETWORK CONFIG FOR CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"
${CLIENT_EXE} get configmap istio -n ${ISTIO_NAMESPACE} -o json | jq ".data.meshNetworks=\"${_ISTIOD_CONFIG}\"" | ${CLIENT_EXE} apply -f -
${CLIENT_EXE} delete pod -l app=istiod -n ${ISTIO_NAMESPACE}
