#!/bin/bash

##############################################################################
# start-minikube.sh
#
# Starts up minikube instances for each of the 2 clusters.
#
##############################################################################

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

start_minikube() {
  local profile="${1}"
  local lb_addrs="${2}"

  if [ "${MINIKUBE_CPU}" != "" ]; then local cpu="--kubernetes-cpu ${MINIKUBE_CPU}"; fi
  if [ "${MINIKUBE_DISK}" != "" ]; then local disk="--kubernetes-disk ${MINIKUBE_DISK}"; fi
  if [ "${MINIKUBE_MEMORY}" != "" ]; then local mem="--kubernetes-memory ${MINIKUBE_MEMORY}"; fi

  "${K8S_MINIKUBE_SCRIPT}"                   \
    --minikube-profile "${profile}"          \
    --load-balancer-addrs "${lb_addrs}"      \
    --kubernetes-driver "${MINIKUBE_DRIVER}" \
    ${cpu:-} ${disk:-} ${mem:-}              \
    start

  if [ "$?" != "0" ]; then
    echo "Failed to start minikube for cluster [${profile}]"
    exit 1
  fi
}

# Find the hack script to be used to start minikube
K8S_MINIKUBE_SCRIPT=${SCRIPT_DIR}/../../k8s-minikube.sh
if [  -x "${K8S_MINIKUBE_SCRIPT}" ]; then
  echo "Minikube start script: ${K8S_MINIKUBE_SCRIPT}"
else
  echo "Cannot find the minikube start script at: ${K8S_MINIKUBE_SCRIPT}"
  exit 1
fi

echo "==== START MINIKUBE FOR CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
start_minikube "${CLUSTER1_NAME}" "70-84"

echo "==== START MINIKUBE FOR CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
start_minikube "${CLUSTER2_NAME}" "85-98"
