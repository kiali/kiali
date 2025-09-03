#!/bin/bash

##############################################################################
# deploy-kiali-minikube.sh
#
# Installs Kiali in both minikube clusters for external controlplane setup.
#
##############################################################################

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

KIALI_REPO_ROOT="${SCRIPT_DIR}/../../../"

set -euo pipefail

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
  local helm_args=()
  #Enable tracing
  helm_args+=(--set external_services.tracing.enabled="true")

  local cluster_name="${1}"
  local web_fqdn="${2}"
  local web_schema="${3}"
  [ -n "${web_fqdn}" ] && helm_args+=("--set server.web_fqdn=${web_fqdn}")
  [ -n "${web_schema}" ] && helm_args+=("--set server.web_schema=${web_schema}")

  if [ "${KIALI_AUTH_STRATEGY}" == "anonymous" ]; then
    helm_args+=(--set auth.strategy="anonymous")
  elif [ "${KIALI_AUTH_STRATEGY}" == "token" ]; then
    helm_args+=(--set auth.strategy="token")
  else
    echo "Kiali auth strategy [${KIALI_AUTH_STRATEGY}] is not supported for minikube multicluster - will not install Kiali"
    return 1
  fi

  if [ "${KIALI_USE_DEV_IMAGE}" == "true" ]; then
    if [ "${KIALI_BUILD_DEV_IMAGE}" == "true" ]; then
      echo "Building the dev image..."
      make -e -C "${KIALI_REPO_ROOT}" build-ui build
    fi

    if [ "${MANAGE_MINIKUBE}" == "true" ]; then
      # For minikube, we need to build and load the image into each cluster
      echo "Building and loading Kiali image for minikube cluster: ${cluster_name}"
      make -e -C "${KIALI_REPO_ROOT}" DORP="${DORP}" CLUSTER_TYPE="minikube" MINIKUBE_PROFILE="${cluster_name}" cluster-push-kiali
      helm_args+=(
        --set deployment.image_pull_policy="Never"
        --set deployment.image_name="localhost/kiali/kiali"
        --set deployment.image_version="dev"
      )
    else
      local image_to_tag="quay.io/kiali/kiali:dev"
      local image_to_push="$(minikube -p ${cluster_name} ip):5000/kiali/kiali:dev"
      echo "Tagging the dev image [${image_to_tag}] -> [${image_to_push}]..."
      ${DORP} tag ${image_to_tag} ${image_to_push}
      echo "Pushing the dev image [${image_to_push}] to the cluster [${cluster_name}]..."
      ${DORP} push --tls-verify=false ${image_to_push}
      helm_args+=(
        --set deployment.image_name="localhost:5000/kiali/kiali"
        --set deployment.image_version="dev"
      )
    fi
  fi

  if [ "${KIALI_CREATE_REMOTE_CLUSTER_SECRETS}" == "true" ]; then
    if [ "${SINGLE_KIALI}" == "true" ]; then
      echo "Preparing remote cluster secret for single Kiali install in multicluster or external mode."
      local remote_cluster_ip
      remote_cluster_ip=$(kubectl get nodes --context="${CLUSTER2_CONTEXT}" -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
      ${SCRIPT_DIR}/kiali-prepare-remote-cluster.sh -c ${CLIENT_EXE} --remote-cluster-name ${CLUSTER2_NAME} -kcc ${CLUSTER1_CONTEXT} -rcc ${CLUSTER2_CONTEXT} --remote-cluster-url "https://${remote_cluster_ip}:8443" -vo false -rcns ${ISTIO_NAMESPACE} -kshc ${KIALI_SERVER_HELM_CHARTS}
    else
      echo "Preparing remote cluster secrets for both Kiali installs."
      local cluster1_ip
      local cluster2_ip
      cluster1_ip=$(kubectl get nodes --context="${CLUSTER1_CONTEXT}" -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
      cluster2_ip=$(kubectl get nodes --context="${CLUSTER2_CONTEXT}" -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
      ${SCRIPT_DIR}/kiali-prepare-remote-cluster.sh -c ${CLIENT_EXE} --remote-cluster-name ${CLUSTER2_NAME} -kcc ${CLUSTER1_CONTEXT} -rcc ${CLUSTER2_CONTEXT} --remote-cluster-url "https://${cluster2_ip}:8443" -vo false
      ${SCRIPT_DIR}/kiali-prepare-remote-cluster.sh -c ${CLIENT_EXE} --remote-cluster-name ${CLUSTER1_NAME} -kcc ${CLUSTER2_CONTEXT} -rcc ${CLUSTER1_CONTEXT} --remote-cluster-url "https://${cluster1_ip}:8443" -vo false
    fi
  fi

  local service_type="LoadBalancer"
  local ingress_enabled="false"
  local web_port="80"

  # Configure external services if external addresses are available
  if [ -n "${KIALI_PROMETHEUS_ADDRESS}" ]; then
    echo "Configuring Kiali to use external Prometheus at: ${KIALI_PROMETHEUS_ADDRESS}"
    helm_args+=(
          --set external_services.prometheus.url="http://${KIALI_PROMETHEUS_ADDRESS}:9090"
        )
  fi

  if [ -n "${KIALI_GRAFANA_ADDRESS}" ]; then
    echo "Configuring Kiali to use external Grafana at: ${KIALI_GRAFANA_ADDRESS}"
    helm_args+=(
          --set external_services.grafana.external_url="http://${KIALI_GRAFANA_ADDRESS}:3000"
        )
  else
    echo "No external Grafana address provided, using default Grafana address"
    helm_args+=(
          --set external_services.grafana.external_url="http://grafana.istio-system:3000"
        )
  fi

  if [ -n "${KIALI_TRACING_ADDRESS}" ]; then
    echo "Configuring Kiali to use external tracing at: ${KIALI_TRACING_ADDRESS}"
    if [ "${TEMPO}" == "true" ]; then
      helm_args+=(
            --set external_services.tracing.external_url="http://${KIALI_TRACING_ADDRESS}:3200"
            --set external_services.tracing.provider="tempo"
            --set external_services.tracing.internal_url="http://${KIALI_TRACING_ADDRESS}:3200"
            --set external_services.tracing.use_grpc="false"
          )
    else
      helm_args+=(
            --set external_services.tracing.external_url="http://${KIALI_TRACING_ADDRESS}/jaeger"
          )
    fi
  elif [ "${TEMPO}" == "true" ]; then
    helm_args+=(
          --set external_services.tracing.external_url="http://tempo-cr-query-frontend.tempo:3200"
          --set external_services.tracing.provider="tempo"
          --set external_services.tracing.internal_url="http://tempo-cr-query-frontend.tempo:3200"
          --set external_services.tracing.use_grpc="false"
        )
  else
    helm_args+=(
          --set external_services.tracing.external_url="http://tracing.istio-system/jaeger"
        )
  fi

  if [ "${CI_CONFIG}" == "true" ]; then
    helm_args+=(
          --set external_services.grafana.dashboards[0].name="Istio Mesh Dashboard"
          --set external_services.istio.validation_reconcile_interval="5s"
          --set health_config.rate[0].kind="service"
          --set health_config.rate[0].name="y-server"
          --set health_config.rate[0].namespace="alpha"
          --set health_config.rate[0].tolerance[0].code="5xx"
          --set health_config.rate[0].tolerance[0].degraded="2"
          --set health_config.rate[0].tolerance[0].failure="100"
          --set kiali_internal.cache_expiration.gateway="2m"
          --set kiali_internal.cache_expiration.istio_status="0"
          --set kiali_internal.cache_expiration.mesh="10s"
          --set kiali_internal.cache_expiration.waypoint="2m"
        )
  fi

  if [ "${IGNORE_HOME_CLUSTER}" == "true" ]; then
    helm_args+=(
          --set clustering.ignore_home_cluster="true"
          --set kubernetes_config.cluster_name="${CLUSTER1_NAME}"
        )
  fi

  echo "helm_args: ${helm_args[@]}"

  helm upgrade --install \
    "${helm_args[@]}" \
    --namespace "${ISTIO_NAMESPACE}" \
    --set deployment.logger.log_level="trace" \
    --set deployment.ingress.enabled="${ingress_enabled}" \
    --set deployment.service_type="${service_type}" \
    --set server.web_port="${web_port}" \
    kiali-server \
    "${KIALI_SERVER_HELM_CHARTS}"

  # Helm chart doesn't support passing in service opts so patch them after the helm deploy.
  kubectl patch service kiali -n "${ISTIO_NAMESPACE}" --type=json -p='[{"op": "replace", "path": "/spec/ports/0/port", "value":80}]'
  kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' -n istio-system service/kiali --timeout=600s
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
