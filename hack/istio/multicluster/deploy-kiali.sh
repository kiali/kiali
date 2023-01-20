#!/bin/bash

##############################################################################
# deploy-kiali.sh
#
# Installs Kiali in both clusters.
#
##############################################################################

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

if [ "${KIALI_ENABLED}" != "true" ]; then
  echo "Will not install kiali"
  return 0
else
  echo "Installing Kiali in the two clusters"
fi

if ! which helm; then
  echo "You do not have helm in your PATH - will not install Kiali"
  return 1
fi

deploy_kiali() {
  local helm_args=""
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    helm_args="--disable-openapi-validation"
  fi

  local web_fqdn="${1}"
  local web_schema="${2}"
  [ ! -z "${web_fqdn}" ] && helm_args="--set server.web_fqdn=${web_fqdn} ${helm_args}"
  [ ! -z "${web_schema}" ] && helm_args="--set server.web_schema=${web_schema} ${helm_args}"

  MINIKUBE_IP_DASHED=$(minikube ip -p "${CLUSTER1_NAME}" | sed 's/\./-/g')
  KUBE_HOSTNAME="keycloak-${MINIKUBE_IP_DASHED}.nip.io"

  # These need to exist prior to installing Kiali.
  # Create secret with the oidc secret
  kubectl create configmap kiali-cabundle --from-file="openid-server-ca.crt=${KEYCLOAK_CERTS_DIR}/root-ca.pem" -n "${ISTIO_NAMESPACE}"
  kubectl create secret generic kiali --from-literal="oidc-secret=kube-client-secret" -n istio-system

  kubectl create clusterrolebinding kiali-user-viewer --clusterrole=kiali-viewer --user=oidc:kiali

  helm upgrade --install                 \
    ${helm_args}                         \
    --namespace ${ISTIO_NAMESPACE}       \
    --set kubernetes_config.cache_enabled="false" \
    --set auth.strategy="openid"      \
    --set auth.openid.client_id="kube"      \
    --set auth.openid.issuer_uri="https://${KUBE_HOSTNAME}/realms/kube" \
    --set deployment.ingress.enabled="true" \
    --repo https://kiali.org/helm-charts \
    kiali-server                         \
    kiali-server
}

echo "==== DEPLOY KIALI TO CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
switch_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}"
deploy_kiali "${KIALI1_WEB_FQDN}" "${KIALI1_WEB_SCHEMA}"

if [ "${SINGLE_KIALI}" != "true" ]
then
  echo "==== DEPLOY KIALI TO CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
  switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"
  deploy_kiali "${KIALI2_WEB_FQDN}" "${KIALI2_WEB_SCHEMA}"
fi
