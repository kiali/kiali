#!/bin/bash

##############################################################################
# uninstall-primary-remote.sh
#
# Attempts to purge Kiali, bookinfo, and Istio from both clusters.
# If minikube is managed by us, the entire minikube instances are deleted.
#
##############################################################################

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

# Find the hack scripts to do the uninstalls
ISTIO_INSTALL_SCRIPT="${SCRIPT_DIR}/../install-istio-via-istioctl.sh"
INSTALL_BOOKINFO_SCRIPT="${SCRIPT_DIR}/../install-bookinfo-demo.sh"
PURGE_KIALI_SCRIPT="${SCRIPT_DIR}/../../purge-kiali-from-cluster.sh"
K8S_MINIKUBE_SCRIPT="${SCRIPT_DIR}/../../k8s-minikube.sh"
KIND_EXE="$(which kind)"

if [ -x "${ISTIO_INSTALL_SCRIPT}" ]; then
  echo "Istio install script: ${ISTIO_INSTALL_SCRIPT}"
else
  echo "Cannot find the Istio install script at: ${ISTIO_INSTALL_SCRIPT}"
  exit 1
fi
if [ -x "${INSTALL_BOOKINFO_SCRIPT}" ]; then
  echo "Bookinfo install script: ${INSTALL_BOOKINFO_SCRIPT}"
else
  echo "Cannot find the Bookinfo install script at: ${INSTALL_BOOKINFO_SCRIPT}"
  exit 1
fi
if [ -x "${PURGE_KIALI_SCRIPT}" ]; then
  echo "Purge-kiali script: ${PURGE_KIALI_SCRIPT}"
else
  echo "Cannot find the purge-kiali script at: ${PURGE_KIALI_SCRIPT}"
  exit 1
fi
if [ "${MANAGE_MINIKUBE}" == "true" ]; then
  if [ -x "${K8S_MINIKUBE_SCRIPT}" ]; then
    echo "k8s-minikube script: ${K8S_MINIKUBE_SCRIPT}"
  else
    echo "Cannot find the k8s-minikube script at: ${K8S_MINIKUBE_SCRIPT}"
    exit 1
  fi
fi

switch_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}"

${PURGE_KIALI_SCRIPT} -c ${CLIENT_EXE} && ${CLIENT_EXE} delete namespace kiali-operator
${INSTALL_BOOKINFO_SCRIPT} -c ${CLIENT_EXE} --delete-bookinfo true
${ISTIO_INSTALL_SCRIPT} -c ${CLIENT_EXE} --delete-istio true
${K8S_MINIKUBE_SCRIPT} --minikube-profile ${CLUSTER1_CONTEXT} delete

switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"

${INSTALL_BOOKINFO_SCRIPT} -c ${CLIENT_EXE} --delete-bookinfo true
${ISTIO_INSTALL_SCRIPT} -c ${CLIENT_EXE} --delete-istio true
${K8S_MINIKUBE_SCRIPT} --minikube-profile ${CLUSTER2_CONTEXT} delete