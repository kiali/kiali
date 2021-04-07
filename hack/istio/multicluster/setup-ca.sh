#!/bin/bash

##############################################################################
# setup-ca.sh
#
# Configures the Istio certificate authority (CA) with a root certificate,
# signing certificate, and key.
#
# See: https://istio.io/latest/docs/tasks/security/cert-management/plugin-ca-cert/
#
##############################################################################

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

create_secret() {
  local clustername="${1}"

  if ! ${CLIENT_EXE} get namespace ${ISTIO_NAMESPACE}; then
    ${CLIENT_EXE} create namespace ${ISTIO_NAMESPACE}
  fi

  if ! ${CLIENT_EXE} get secret cacerts -n ${ISTIO_NAMESPACE}; then
    ${CLIENT_EXE} create secret generic cacerts -n ${ISTIO_NAMESPACE} \
        --from-file ${CERTS_DIR}/${clustername}/ca-cert.pem           \
        --from-file ${CERTS_DIR}/${clustername}/ca-key.pem            \
        --from-file ${CERTS_DIR}/${clustername}/root-cert.pem         \
        --from-file ${CERTS_DIR}/${clustername}/cert-chain.pem

    if [ "$?" != "0" ]; then
      echo "Failed to create secret in cluster [${clustername}]"
      exit 1
    fi
  else
    echo "Secret already exists in cluster [${clustername}]. It will remain as-is"
  fi
}

mkdir -p "${CERTS_DIR}"
if [ ! -d "${CERTS_DIR}" ]; then
  echo "Cannot create certs directory - ${CERTS_DIR}"
  exit 1
fi
pushd "${CERTS_DIR}"
make -f ${CERT_MAKEFILE} root-ca
make -f ${CERT_MAKEFILE} ${CLUSTER1_NAME}-cacerts
make -f ${CERT_MAKEFILE} ${CLUSTER2_NAME}-cacerts
popd

echo "==== CREATE CERTS FOR CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
switch_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}"
create_secret "${CLUSTER1_NAME}"

echo "==== CREATE CERTS FOR CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"
create_secret "${CLUSTER2_NAME}"
