#!/bin/bash

#
# Refer to the --help output for a description of this script and its available options.
#

PRIMARY_REMOTE="primary-remote"
MULTI_PRIMARY="multi-primary"
EXTERNAL_CONTROLPLANE="external-controlplane"

infomsg() {
  echo "[INFO] ${1}"
}

helpmsg() {
  cat <<HELP
This script will run setup a KinD cluster for testing Kiali against a real environment in CI.
Options:
-a|--auth-strategy <anonymous|token>
    Auth stategy to use for Kiali.
    Default: anonymous
-ab|--ambient
    Install Istio Ambient profile
    Default: Not set
-dorp|--docker-or-podman <docker|podman>
    What to use when building images.
    Default: docker
-hcd|--helm-charts-dir
    Directory where the Kiali helm charts are located.
    If one is not supplied a /tmp dir will be created and used.
-iv|--istio-version <#.#.#>
    The version of Istio you want to install.
    If you want to run with a dev build of Istio, the value must be something like "#.#-dev".
    This option is ignored if -ii is false.
    If not specified, the latest version of Istio is installed.
    Default: <the latest release>
-mc|--multicluster <${MULTI_PRIMARY}|${PRIMARY_REMOTE}|${EXTERNAL_CONTROLPLANE}>
    Whether to set up a multicluster environment
    and which kind of multicluster environment to setup.
    Default: <none>
-s|--sail
    Install Istio with the Sail Operator.
    Default: <false>
-te|--tempo
    If Tempo will be installed as the tracing platform
    instead of Jaeger
HELP
}

# Determine where this script is. We assume it is in the hack/ directory - make the cwd the parent directory.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
cd ${SCRIPT_DIR}/..

# TODO: Remove sail option once everything uses sail to install
# process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -a|--auth-strategy)           AUTH_STRATEGY="$2";         shift;shift; ;;
    -ab|--ambient)                AMBIENT="true";             shift;shift; ;;
    -dorp|--docker-or-podman)     DORP="$2";                  shift;shift; ;;
    -h|--help)                    helpmsg;                    exit 1       ;;
    -hcd|--helm-charts-dir)       HELM_CHARTS_DIR="$2";       shift;shift; ;;
    -iv|--istio-version)          ISTIO_VERSION="$2";         shift;shift; ;;
    -mc|--multicluster)
      MULTICLUSTER="${2}"
      if [ "${MULTICLUSTER}" != "${PRIMARY_REMOTE}" -a "${MULTICLUSTER}" != "${MULTI_PRIMARY}" -a "${MULTICLUSTER}" != "${EXTERNAL_CONTROLPLANE}" ]; then
        echo "--multicluster option must be one of '${PRIMARY_REMOTE}' or '${MULTI_PRIMARY}' or '${EXTERNAL_CONTROLPLANE}'"
        exit 1
      fi
      shift;shift
      ;;
    -s|--sail)                     SAIL="true";              shift;shift; ;;
    -te|--tempo)                   TEMPO="$2";               shift;shift; ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

# abort on any error
set -e

# Find the hack script to be used to install istio
ISTIO_INSTALL_SCRIPT="${SCRIPT_DIR}/istio/install-istio-via-sail.sh"

if [ -x "${ISTIO_INSTALL_SCRIPT}" ]; then
  echo "Istio install script: ${ISTIO_INSTALL_SCRIPT}"
else
  echo "Cannot find the Istio install script at: ${ISTIO_INSTALL_SCRIPT}"
  exit 1
fi

install_istio() {
  local image_tag_arg=${ISTIO_TAG:+--set ".spec.values.pilot.tag=\"${ISTIO_TAG}\""}
  local image_hub_arg=${ISTIO_HUB:+--set ".spec.values.pilot.hub=\"${ISTIO_HUB}\""}
  local version_arg=${ISTIO_VERSION:+--set ".spec.version=\"v${ISTIO_VERSION}\""}
  "${ISTIO_INSTALL_SCRIPT}" "$@" ${image_tag_arg} ${image_hub_arg} ${version_arg}
  if [ "$?" != "0" ]; then
    echo "Failed to install Istio"
    exit 1
  fi
}

# set up some of our defaults
AUTH_STRATEGY="${AUTH_STRATEGY:-anonymous}"
DORP="${DORP:-docker}"
TEMPO="${TEMPO:-false}"

# Defaults the branch to master unless it is already set
TARGET_BRANCH="${TARGET_BRANCH:-master}"

# If a specific version of Istio hasn't been provided, try and guess the right one
# based on the Kiali branch being tested (TARGET_BRANCH) and the compatibility matrices:
# https://kiali.io/docs/installation/installation-guide/prerequisites/
# https://istio.io/latest/docs/releases/supported-releases/
if [ -z "${ISTIO_VERSION}" ]; then
  if [ "${TARGET_BRANCH}" == "v1.65" ]; then
    ISTIO_VERSION="1.16.0"
  elif [ "${TARGET_BRANCH}" == "v1.73" ]; then
    ISTIO_VERSION="1.18.0"
  fi
fi

KIND_NODE_IMAGE=""
if [ "${ISTIO_VERSION}" == "1.16.0" ]; then
  KIND_NODE_IMAGE="kindest/node:v1.23.4@sha256:0e34f0d0fd448aa2f2819cfd74e99fe5793a6e4938b328f657c8e3f81ee0dfb9"
elif [ "${ISTIO_VERSION}" == "v1.18.0" ]; then
  KIND_NODE_IMAGE="kindest/node:v1.27.3@sha256:3966ac761ae0136263ffdb6cfd4db23ef8a83cba8a463690e98317add2c9ba72"
fi

if [ -z "${HELM_CHARTS_DIR}" ]; then
  HELM_CHARTS_DIR="$(mktemp -d)"
  infomsg "Cloning kiali helm-charts..."
  git clone --single-branch --branch "${TARGET_BRANCH}" https://github.com/kiali/helm-charts.git "${HELM_CHARTS_DIR}"
  make -C "${HELM_CHARTS_DIR}" build-helm-charts
fi

# print out our settings for debug purposes
cat <<EOM
=== SETTINGS ===
AUTH_STRATEGY=$AUTH_STRATEGY
DORP=$DORP
HELM_CHARTS_DIR=$HELM_CHARTS_DIR
ISTIO_VERSION=$ISTIO_VERSION
KIND_NODE_IMAGE=$KIND_NODE_IMAGE
MULTICLUSTER=$MULTICLUSTER
SAIL=$SAIL
TARGET_BRANCH=$TARGET_BRANCH
TEMPO=$TEMPO
=== SETTINGS ===
EOM

infomsg "Make sure everything exists"
which kubectl > /dev/null || (infomsg "kubectl executable is missing"; exit 1)
which kind > /dev/null || (infomsg "kind executable is missing"; exit 1)
which "${DORP}" > /dev/null || (infomsg "[$DORP] is not in the PATH"; exit 1)

if [ -n "${ISTIO_VERSION}" ]; then
  if [[ "${ISTIO_VERSION}" == *-dev ]]; then
    DOWNLOAD_ISTIO_VERSION_ARG="--dev-istio-version ${ISTIO_VERSION}"
  else
    DOWNLOAD_ISTIO_VERSION_ARG="--istio-version ${ISTIO_VERSION}"
  fi
fi

# The sample apps setup scripts still rely on the istioctl dir to be present
# to deploy the samples so we still need to download istio even when using
# sail until the sample app scripts can be updated to pull the sample apps
# from a URL or by mirroring them locally.
infomsg "Downloading istio"
"${SCRIPT_DIR}"/istio/download-istio.sh ${DOWNLOAD_ISTIO_VERSION_ARG}

setup_kind_singlecluster() {

  local certs_dir

  if [ "${AUTH_STRATEGY}" == "openid" ]; then
    echo "Auth strategy is open id"
      certs_dir=$(mktemp -d)
      KEYCLOAK_CERTS_DIR="${certs_dir}"/keycloak
      mkdir -p "${certs_dir}"/keycloak
      auth_flags=()
      local keycloak_ip

      "${SCRIPT_DIR}/keycloak.sh" -kcd "${KEYCLOAK_CERTS_DIR}" create-ca

      docker network create kind || true

      # Given: 172.18.0.0/16 this should return 172.18
      beginning_subnet_octets=$(docker network inspect kind --format '{{(index .IPAM.Config 0).Subnet}}' | cut -d'.' -f1,2)
      lb_range_start="255.70"
      lb_range_end="255.84"

      KEYCLOAK_ADDRESS="${beginning_subnet_octets}.${lb_range_start}"

      echo "==== START KIND FOR CLUSTER"
      "${SCRIPT_DIR}"/start-kind.sh \
            --name "ci" \
            --load-balancer-range "${lb_range_start}-${lb_range_end}" \
            --image "${KIND_NODE_IMAGE}" \
            --enable-keycloak true \
            --keycloak-certs-dir "${KEYCLOAK_CERTS_DIR}" \
            --keycloak-issuer-uri "https://${KEYCLOAK_ADDRESS}/realms/kube"
      "${SCRIPT_DIR}/keycloak.sh" -kcd "${KEYCLOAK_CERTS_DIR}" -kip "${KEYCLOAK_ADDRESS}" deploy

      keycloak_ip_cl=$(kubectl get svc keycloak -n keycloak -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')
            auth_flags+=(--keycloak-address "${keycloak_ip_cl}")
            auth_flags+=(--certs-dir "${certs_dir}")

  else
    "${SCRIPT_DIR}"/start-kind.sh --name ci --image "${KIND_NODE_IMAGE}"
  fi

  infomsg "Installing istio"
  if [[ "${ISTIO_VERSION}" == *-dev ]]; then
    local hub_arg="--image-hub default"
  fi

  if [ -n "${AMBIENT}" ]; then
      infomsg "Installing Istio with Ambient profile"
      if [ "${SAIL}" == "true" ]; then
        local image_tag_arg=${ISTIO_TAG:+--set ".spec.values.pilot.tag=\"${ISTIO_TAG}\""}
        local image_hub_arg=${ISTIO_HUB:+--set ".spec.values.pilot.hub=\"${ISTIO_HUB}\""}
        local version_arg=${ISTIO_VERSION:+--set ".spec.version=\"v${ISTIO_VERSION}\""}
        "${ISTIO_INSTALL_SCRIPT}" ${image_tag_arg} ${image_hub_arg} ${version_arg} --config-profile ambient
      else
        # -net is giving issues trying to access the services inside the cluster with HTTP code 56
        # At least with Ambient 1.21
        "${SCRIPT_DIR}"/istio/install-istio-via-istioctl.sh --reduce-resources true --client-exe-path "$(which kubectl)" -cn "cluster-default" -mid "mesh-default" -gae true ${hub_arg:-} -cp ambient
      fi
  elif [ "${SAIL}" == "true" ]; then
    install_istio
  else
    "${SCRIPT_DIR}"/istio/install-istio-via-istioctl.sh --reduce-resources true --client-exe-path "$(which kubectl)" -cn "cluster-default" -mid "mesh-default" -net "network-default" -gae true ${hub_arg:-}
  fi

  infomsg "Pushing the images into the cluster..."
  make -e DORP="${DORP}" -e CLUSTER_TYPE="kind" -e KIND_NAME="ci" cluster-push-kiali

  HELM="${HELM_CHARTS_DIR}/_output/helm-install/helm"

  infomsg "Using helm: $(ls -l ${HELM})"
  infomsg "$(${HELM} version)"

  infomsg "Installing kiali server via Helm"
  infomsg "Chart to be installed: $(ls -1 ${HELM_CHARTS_DIR}/_output/charts/kiali-server-*.tgz)"

  # The grafana and tracing urls need to be set for backend e2e tests
  # but they don't need to be accessible outside the cluster.
  # Need a single dashboard set for grafana.
  ${HELM} install \
    --namespace istio-system \
    --wait \
    --set auth.strategy="${AUTH_STRATEGY}" \
    --set auth.openid.client_id="kube" \
    --set-string auth.openid.issuer_uri="${ISSUER_URI}" \
    --set auth.openid.insecure_skip_verify_tls="false" \
    --set auth.openid.username_claim="preferred_username" \
    --set deployment.logger.log_level="trace" \
    --set deployment.image_name=localhost/kiali/kiali \
    --set deployment.image_version=dev \
    --set deployment.image_pull_policy="Never" \
    --set deployment.service_type="LoadBalancer" \
    --set external_services.grafana.external_url="http://grafana.istio-system:3000" \
    --set external_services.grafana.dashboards[0].name="Istio Mesh Dashboard" \
    --set external_services.tracing.enabled="true" \
    --set external_services.tracing.external_url="http://tracing.istio-system:16685/jaeger" \
    --set external_services.istio.validation_reconcile_interval="5s" \
    --set health_config.rate[0].kind="service" \
    --set health_config.rate[0].name="y-server" \
    --set health_config.rate[0].namespace="alpha" \
    --set health_config.rate[0].tolerance[0].code="5xx" \
    --set health_config.rate[0].tolerance[0].degraded=2 \
    --set health_config.rate[0].tolerance[0].failure=100 \
    --set kiali_internal.cache_expiration.gateway="2m" \
    --set kiali_internal.cache_expiration.istio_status="0" \
    --set kiali_internal.cache_expiration.mesh="10s" \
    --set kiali_internal.cache_expiration.waypoint="2m" \
    kiali-server \
    "${HELM_CHARTS_DIR}"/_output/charts/kiali-server-*.tgz

  if [ "${AUTH_STRATEGY}" == "openid" ]; then
        local keycloak_ip
        keycloak_ip=$(kubectl get svc keycloak -n keycloak -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')
        auth_flags+=(--keycloak-address "${keycloak_ip}")
        auth_flags+=(--certs-dir "${certs_dir}")

      "${SCRIPT_DIR}"/istio/multicluster/deploy-kiali.sh \
        --cluster1-context "kind-ci" \
        --single-cluster "true" \
        --kiali-create-remote-cluster-secrets "false" \
        --cluster1-name "ci" \
        --manage-kind true \
        ${auth_flags[@]} \
        -dorp docker \
        -kas "${AUTH_STRATEGY}" \
        -kudi true \
        -kshc "${HELM_CHARTS_DIR}"/_output/charts/kiali-server-*.tgz \
        -ag "default" \
        -ci true
  else
     # Helm chart doesn't support passing in service opts so patch them after the helm deploy.
      kubectl patch service kiali -n istio-system --type=json -p='[{"op": "replace", "path": "/spec/ports/0/port", "value":80}]'
      kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' -n istio-system service/kiali
  fi
}

setup_kind_tempo() {
  "${SCRIPT_DIR}"/start-kind.sh --name ci --image "${KIND_NODE_IMAGE}"

  if [ "${SAIL}" == "true" ]; then
    infomsg "Installing Istio with Sail"
    install_istio -a "prometheus grafana tempo"
  else
    infomsg "Installing tempo"
    ${SCRIPT_DIR}/istio/tempo/install-tempo-env.sh -c kubectl -ot true

    kubectl create ns istio-system
    kubectl apply -f https://github.com/open-telemetry/opentelemetry-operator/releases/latest/download/opentelemetry-operator.yaml
    kubectl wait pods --all -n opentelemetry-operator-system --for=condition=Ready --timeout=5m

    kubectl apply -f ${SCRIPT_DIR}/istio/tempo/otel-collector.yaml

    infomsg "Installing istio"
    if [[ "${ISTIO_VERSION}" == *-dev ]]; then
      local hub_arg="--image-hub default"
    fi

    "${SCRIPT_DIR}"/istio/install-istio-via-istioctl.sh --reduce-resources true --client-exe-path "$(which kubectl)" -cn "cluster-default" -mid "mesh-default" -net "network-default" -gae "true" ${hub_arg:-} -a "prometheus grafana" -s values.meshConfig.defaultConfig.tracing.zipkin.address="tempo-cr-distributor.tempo:9411"
  fi

  infomsg "Pushing the images into the cluster..."
  make -e DORP="${DORP}" -e CLUSTER_TYPE="kind" -e KIND_NAME="ci" cluster-push-kiali

  HELM="${HELM_CHARTS_DIR}/_output/helm-install/helm"

  infomsg "Using helm: $(ls -l ${HELM})"
  infomsg "$(${HELM} version)"

  infomsg "Installing kiali server via Helm"
  infomsg "Chart to be installed: $(ls -1 ${HELM_CHARTS_DIR}/_output/charts/kiali-server-*.tgz)"
  # The grafana and tracing urls need to be set for backend e2e tests
  # but they don't need to be accessible outside the cluster.
  # Need a single dashboard set for grafana.
  ${HELM} install \
    --namespace istio-system \
    --wait \
    --set auth.strategy="${AUTH_STRATEGY}" \
    --set deployment.logger.log_level="trace" \
    --set deployment.image_name=localhost/kiali/kiali \
    --set deployment.image_version=dev \
    --set deployment.image_pull_policy="Never" \
    --set deployment.service_type="LoadBalancer" \
    --set external_services.grafana.external_url="http://grafana.istio-system:3000" \
    --set external_services.grafana.dashboards[0].name="Istio Mesh Dashboard" \
    --set external_services.tracing.enabled="true" \
    --set external_services.tracing.provider="tempo" \
    --set external_services.tracing.external_url="http://tempo-cr-query-frontend.tempo:3200" \
    --set external_services.tracing.internal_url="http://tempo-cr-query-frontend.tempo:3200" \
    --set external_services.tracing.use_grpc="false" \
    --set external_services.istio.validation_reconcile_interval="5s" \
    --set health_config.rate[0].kind="service" \
    --set health_config.rate[0].name="y-server" \
    --set health_config.rate[0].namespace="alpha" \
    --set health_config.rate[0].tolerance[0].code="5xx" \
    --set health_config.rate[0].tolerance[0].degraded=2 \
    --set health_config.rate[0].tolerance[0].failure=100 \
    --set kiali_internal.cache_expiration.gateway="2m" \
    --set kiali_internal.cache_expiration.istio_status="0" \
    --set kiali_internal.cache_expiration.mesh="10s" \
    --set kiali_internal.cache_expiration.waypoint="2m" \
    kiali-server \
    "${HELM_CHARTS_DIR}"/_output/charts/kiali-server-*.tgz
  
  # Helm chart doesn't support passing in service opts so patch them after the helm deploy.
  kubectl patch service kiali -n istio-system --type=json -p='[{"op": "replace", "path": "/spec/ports/0/port", "value":80}]'
  kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' -n istio-system service/kiali
}

setup_kind_multicluster() {
  if [ -n "${ISTIO_VERSION}" ]; then
    if [[ "${ISTIO_VERSION}" == *-dev ]]; then
      DOWNLOAD_ISTIO_VERSION_ARG="--dev-istio-version ${ISTIO_VERSION}"
    else
      DOWNLOAD_ISTIO_VERSION_ARG="--istio-version ${ISTIO_VERSION}"
    fi
  fi

  infomsg "Downloading istio"
  "${SCRIPT_DIR}"/istio/download-istio.sh ${DOWNLOAD_ISTIO_VERSION_ARG}

  local script_dir
  script_dir="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
  local output_dir
  output_dir="${script_dir}/../_output"
  # use the Istio release that was last downloaded (that's the -t option to ls)
  local istio_dir
  istio_dir=$(ls -dt1 ${output_dir}/istio-* | head -n1)
  if [[ "${ISTIO_VERSION}" == *-dev ]]; then
    local hub_arg="--istio-hub default"
  fi

  local certs_dir
  if [ "${AUTH_STRATEGY}" == "openid" ]; then
    certs_dir=$(mktemp -d)
    mkdir -p "${certs_dir}"/keycloak
  fi

  if [ -n "${KIND_NODE_IMAGE}" ]; then
    local kind_node_image="--kind-node-image ${KIND_NODE_IMAGE}"
  fi

  local cluster1_context
  local cluster2_context
  local cluster1_name
  local cluster2_name
  local istio_version_arg=${ISTIO_VERSION:+--istio-version ${ISTIO_VERSION}}
  if [ "${MULTICLUSTER}" == "${MULTI_PRIMARY}" ]; then
    "${SCRIPT_DIR}"/istio/multicluster/install-multi-primary.sh \
      --kiali-enabled false \
      --manage-kind true \
      --certs-dir "${certs_dir}" \
      -dorp docker \
      --istio-dir "${istio_dir}" \
      ${kind_node_image:-} \
      ${hub_arg:-} \
      ${istio_version_arg}

    cluster1_context="kind-east"
    cluster2_context="kind-west"
    cluster1_name="east"
    cluster2_name="west"
    kubectl rollout status deployment prometheus -n istio-system --context kind-east
    kubectl rollout status deployment prometheus -n istio-system --context kind-west
  elif [ "${MULTICLUSTER}" == "${PRIMARY_REMOTE}" ]; then
    "${SCRIPT_DIR}"/istio/multicluster/install-primary-remote.sh --kiali-enabled false --manage-kind true -dorp docker -te ${TEMPO} --istio-dir "${istio_dir}" ${kind_node_image:-} ${hub_arg:-} ${istio_version_arg}
    cluster1_context="kind-east"
    cluster2_context="kind-west"
    cluster1_name="east"
    cluster2_name="west"
    kubectl rollout status deployment prometheus -n istio-system --context kind-east
    kubectl rollout status deployment prometheus -n istio-system --context kind-west
  elif [ "${MULTICLUSTER}" == "${EXTERNAL_CONTROLPLANE}" ]; then
    "${SCRIPT_DIR}"/istio/multicluster/setup-external-controlplane.sh ${kind_node_image:-} ${istio_version_arg}
    cluster1_context="kind-controlplane"
    cluster2_context="kind-dataplane"
    cluster1_name="controlplane"
    cluster2_name="dataplane"
    kubectl rollout status deployment prometheus -n istio-system --context kind-controlplane
    kubectl rollout status deployment prometheus -n external-istiod --context kind-dataplane
  fi

  auth_flags=()
  if [ "${AUTH_STRATEGY}" == "openid" ]; then
    local keycloak_ip
    keycloak_ip=$(kubectl get svc keycloak -n keycloak -o=jsonpath='{.status.loadBalancer.ingress[0].ip}' --context "${cluster1_context}") 
    auth_flags+=(--keycloak-address "${keycloak_ip}")
    auth_flags+=(--certs-dir "${certs_dir}")
  fi
  "${SCRIPT_DIR}"/istio/multicluster/deploy-kiali.sh \
    --cluster1-context ${cluster1_context} \
    --cluster2-context ${cluster2_context} \
    --cluster1-name ${cluster1_name} \
    --cluster2-name ${cluster2_name} \
    --manage-kind true \
    ${auth_flags[@]} \
    -dorp docker \
    -kas "${AUTH_STRATEGY}" \
    -kudi true \
    -kshc "${HELM_CHARTS_DIR}"/_output/charts/kiali-server-*.tgz \
    --tempo ${TEMPO} \
    -ci true
}

if [ -n "${MULTICLUSTER}" ]; then
  setup_kind_multicluster
else
  if [ "${TEMPO}" == "true" ]; then
    infomsg "Installing tempo"
    setup_kind_tempo
  else
    setup_kind_singlecluster
  fi
  # Create the citest service account whose token will be used to log into Kiali
  infomsg "Installing the test ServiceAccount with read-write permissions"
  for o in role rolebinding serviceaccount; do ${HELM} template --show-only "templates/${o}.yaml" --namespace=istio-system --set deployment.instance_name=citest --set auth.strategy=anonymous kiali-server "${HELM_CHARTS_DIR}"/_output/charts/kiali-server-*.tgz; done | kubectl apply -f -
fi


# Unfortunately kubectl rollout status fails if the resource does not exist yet.
for (( i=1; i<=60; i++ ))
do
  PODS=$(kubectl get pods -l app=kiali -n istio-system -o name)
  if [ "${PODS}" != "" ]; then
    infomsg "Kiali pods exist"
    break
  fi

  infomsg "Waiting for kiali pod to exist"
  sleep 5
done

kubectl rollout status deployment/kiali -n istio-system --timeout=120s || { echo "Timed out waiting for kiali pods to be ready"; kubectl get pods -l app=kiali -n istio-system -o yaml | yq '.items[0].status'; exit 1; }

infomsg "Kiali is ready."
