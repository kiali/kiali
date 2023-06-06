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
  if [ "${SINGLE_KIALI}" == "true" ]; then
    echo "Installing Kiali in a single cluster."
  else
    echo "Installing Kiali in the two clusters"
  fi
fi

if ! which helm; then
  echo "You do not have helm in your PATH - will not install Kiali"
  return 1
fi

deploy_kiali() {
  local helm_args=""
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    helm_args="--disable-openapi-validation"
    if [ "${KIALI_USE_DEV_IMAGE}" == "true" ]; then
      echo "'--kiali-use-dev-image true' is only supported with minikube today - will not install Kiali"
      return 1
    fi
  fi

  local cluster_name="${1}"
  local web_fqdn="${2}"
  local web_schema="${3}"
  [ ! -z "${web_fqdn}" ] && helm_args="--set server.web_fqdn=${web_fqdn} ${helm_args}"
  [ ! -z "${web_schema}" ] && helm_args="--set server.web_schema=${web_schema} ${helm_args}"

  local minikube_ip=$(minikube ip -p "${cluster_name}")
  local minikube_ip_dashed=$(minikube ip -p "${cluster_name}" | sed 's/\./-/g')
  local kube_hostname="keycloak-${minikube_ip_dashed}.nip.io"

  if [ "${KIALI_USE_DEV_IMAGE}" == "true" ]; then
    local image_to_tag="quay.io/kiali/kiali:dev"
    local image_to_push="${minikube_ip}:5000/kiali/kiali:dev"
    echo "Tagging the dev image [${image_to_tag}] -> [${image_to_push}]..."
    ${DORP} tag ${image_to_tag} ${image_to_push}
    echo "Pushing the dev image [${image_to_push}] to the cluster [${cluster_name}]..."
    ${DORP} push --tls-verify=false ${image_to_push}
    helm_args="--set deployment.image_name=localhost:5000/kiali/kiali --set deployment.image_version=dev ${helm_args}"
  fi

  # These need to exist prior to installing Kiali.
  # Create secret with the oidc secret
  ${CLIENT_EXE} create configmap kiali-cabundle --from-file="openid-server-ca.crt=${KEYCLOAK_CERTS_DIR}/root-ca.pem" -n "${ISTIO_NAMESPACE}"
  ${CLIENT_EXE} create secret generic kiali --from-literal="oidc-secret=kube-client-secret" -n istio-system
  ${CLIENT_EXE} create clusterrolebinding kiali-user-viewer --clusterrole=kiali-viewer --user=oidc:kiali

  if [ "${KIALI_CREATE_REMOTE_CLUSTER_SECRETS}" == "true" ]; then
    if [ "${SINGLE_KIALI}" == "true" ]; then
      echo "Preparing remote cluster secret for single Kiali install in multicluster mode."
      ${SCRIPT_DIR}/kiali-prepare-remote-cluster.sh -c ${CLIENT_EXE} -kcc ${CLUSTER1_CONTEXT} -rcc ${CLUSTER2_CONTEXT} -vo false
    else
      echo "Preparing remote cluster secrets for both Kiali installs."
      ${SCRIPT_DIR}/kiali-prepare-remote-cluster.sh -c ${CLIENT_EXE} -kcc ${CLUSTER1_CONTEXT} -rcc ${CLUSTER2_CONTEXT} -vo false
      ${SCRIPT_DIR}/kiali-prepare-remote-cluster.sh -c ${CLIENT_EXE} -kcc ${CLUSTER2_CONTEXT} -rcc ${CLUSTER1_CONTEXT} -vo false
    fi
  fi

  # use the latest published server helm chart (if using dev images, it is up to the user to make sure this chart works with the dev image)
  helm upgrade --install                          \
    ${helm_args}                                  \
    --namespace ${ISTIO_NAMESPACE}                \
    --set kubernetes_config.cache_enabled="false" \
    --set auth.strategy="openid"                  \
    --set auth.openid.client_id="kube"            \
    --set auth.openid.issuer_uri="https://${kube_hostname}/realms/kube" \
    --set auth.openid.insecure_skip_verify_tls="false" \
    --set deployment.logger.log_level="debug"     \
    --set deployment.ingress.enabled="true"       \
    --repo https://kiali.org/helm-charts          \
    kiali-server                                  \
    ${KIALI_SERVER_HELM_CHARTS}
}

echo "==== DEPLOY KIALI TO CLUSTER #1 [${CLUSTER1_NAME}] - ${CLUSTER1_CONTEXT}"
switch_cluster "${CLUSTER1_CONTEXT}" "${CLUSTER1_USER}" "${CLUSTER1_PASS}"
deploy_kiali "${CLUSTER1_NAME}" "${KIALI1_WEB_FQDN}" "${KIALI1_WEB_SCHEMA}"

if [ "${SINGLE_KIALI}" != "true" ]
then
  echo "==== DEPLOY KIALI TO CLUSTER #2 [${CLUSTER2_NAME}] - ${CLUSTER2_CONTEXT}"
  switch_cluster "${CLUSTER2_CONTEXT}" "${CLUSTER2_USER}" "${CLUSTER2_PASS}"
  deploy_kiali "${CLUSTER2_NAME}" "${KIALI2_WEB_FQDN}" "${KIALI2_WEB_SCHEMA}"
fi
