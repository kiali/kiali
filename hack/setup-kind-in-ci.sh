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
-t|--tempo
    If Tempo will be installed as the tracing platform
    instead of Jaeger
HELP
}

# Determine where this script is. We assume it is in the hack/ directory - make the cwd the parent directory.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
cd ${SCRIPT_DIR}/..

# process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -a|--auth-strategy)           AUTH_STRATEGY="$2";         shift;shift; ;;
    -ab|--ambient)                AMBIENT="true";             shift;shift; ;;
    -dorp|--docker-or-podman)     DORP="$2";                  shift;shift; ;;
    -h|--help)                    helpmsg;                    exit 1       ;;
    -iv|--istio-version)          ISTIO_VERSION="$2";         shift;shift; ;;
    -mc|--multicluster)
      MULTICLUSTER="${2}"
      if [ "${MULTICLUSTER}" != "${PRIMARY_REMOTE}" -a "${MULTICLUSTER}" != "${MULTI_PRIMARY}" -a "${MULTICLUSTER}" != "${EXTERNAL_CONTROLPLANE}" ]; then
        echo "--multicluster option must be one of '${PRIMARY_REMOTE}' or '${MULTI_PRIMARY}' or '${EXTERNAL_CONTROLPLANE}'"
        exit 1
      fi
      shift;shift
      ;;
    -t|--tempo)                   TEMPO="true";               shift;shift; ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

# abort on any error
set -e

# set up some of our defaults
AUTH_STRATEGY="${AUTH_STRATEGY:-anonymous}"
DORP="${DORP:-docker}"

# Defaults the branch to master unless it is already set
TARGET_BRANCH="${TARGET_BRANCH:-master}"

# If a specific version of Istio hasn't been provided, try and guess the right one
# based on the Kiali branch being tested (TARGET_BRANCH) and the compatibility matrices:
# https://kiali.io/docs/installation/installation-guide/prerequisites/
# https://istio.io/latest/docs/releases/supported-releases/
if [ -z "${ISTIO_VERSION}" ]; then
  if [ "${TARGET_BRANCH}" == "v1.48" ]; then
    ISTIO_VERSION="1.12.0"
  elif [ "${TARGET_BRANCH}" == "v1.57" ]; then
    ISTIO_VERSION="1.14.0"
  elif [ "${TARGET_BRANCH}" == "v1.65" ]; then
    ISTIO_VERSION="1.16.0"
  elif [ "${TARGET_BRANCH}" == "v1.73" ]; then
    ISTIO_VERSION="1.18.0"
  fi
fi

KIND_NODE_IMAGE=""
if [ "${ISTIO_VERSION}" == "1.12.0" -o "${ISTIO_VERSION}" == "1.14.0" -o "${ISTIO_VERSION}" == "1.16.0" ]; then
  KIND_NODE_IMAGE="kindest/node:v1.23.4@sha256:0e34f0d0fd448aa2f2819cfd74e99fe5793a6e4938b328f657c8e3f81ee0dfb9"
else
  KIND_NODE_IMAGE="kindest/node:v1.27.3@sha256:3966ac761ae0136263ffdb6cfd4db23ef8a83cba8a463690e98317add2c9ba72"
fi

# print out our settings for debug purposes
cat <<EOM
=== SETTINGS ===
AUTH_STRATEGY=$AUTH_STRATEGY
DORP=$DORP
ISTIO_VERSION=$ISTIO_VERSION
KIND_NODE_IMAGE=$KIND_NODE_IMAGE
MULTICLUSTER=$MULTICLUSTER
TARGET_BRANCH=$TARGET_BRANCH
=== SETTINGS ===
EOM

infomsg "Make sure everything exists"
which kubectl > /dev/null || (infomsg "kubectl executable is missing"; exit 1)
which kind > /dev/null || (infomsg "kind executable is missing"; exit 1)
which "${DORP}" > /dev/null || (infomsg "[$DORP] is not in the PATH"; exit 1)

HELM_CHARTS_DIR="$(mktemp -d)"

if [ -n "${ISTIO_VERSION}" ]; then
  if [[ "${ISTIO_VERSION}" == *-dev ]]; then
    DOWNLOAD_ISTIO_VERSION_ARG="--dev-istio-version ${ISTIO_VERSION}"
  else
    DOWNLOAD_ISTIO_VERSION_ARG="--istio-version ${ISTIO_VERSION}"
  fi
fi

infomsg "Downloading istio"
"${SCRIPT_DIR}"/istio/download-istio.sh ${DOWNLOAD_ISTIO_VERSION_ARG}

setup_kind_singlecluster() {

  "${SCRIPT_DIR}"/start-kind.sh --name ci --image "${KIND_NODE_IMAGE}"

  GAE="true"
  infomsg "Installing istio"
  if [[ "${ISTIO_VERSION}" == *-dev ]]; then
    local hub_arg="--image-hub default"
  fi

  if [ -n "${AMBIENT}" ]; then
      infomsg "Installing Istio with Ambient profile"
      local ambient_args="--config-profile ambient"
  fi

  "${SCRIPT_DIR}"/istio/install-istio-via-istioctl.sh --reduce-resources true --client-exe-path "$(which kubectl)" -cn "cluster-default" -mid "mesh-default" -net "network-default" -gae true ${hub_arg:-} ${ambient_args:-}

  infomsg "Pushing the images into the cluster..."
  make -e DORP="${DORP}" -e CLUSTER_TYPE="kind" -e KIND_NAME="ci" cluster-push-kiali

  infomsg "Cloning kiali helm-charts..."
  git clone --single-branch --branch "${TARGET_BRANCH}" https://github.com/kiali/helm-charts.git "${HELM_CHARTS_DIR}"
  make -C "${HELM_CHARTS_DIR}" build-helm-charts

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
    --set external_services.grafana.url="http://grafana.istio-system:3000" \
    --set external_services.grafana.dashboards[0].name="Istio Mesh Dashboard" \
    --set external_services.tracing.url="http://tracing.istio-system:16685/jaeger" \
    --set health_config.rate[0].kind="service" \
    --set health_config.rate[0].name="y-server" \
    --set health_config.rate[0].namespace="alpha" \
    --set health_config.rate[0].tolerance[0].code="5xx" \
    --set health_config.rate[0].tolerance[0].degraded=2 \
    --set health_config.rate[0].tolerance[0].failure=100 \
    kiali-server \
    "${HELM_CHARTS_DIR}"/_output/charts/kiali-server-*.tgz

  # Helm chart doesn't support passing in service opts so patch them after the helm deploy.
  kubectl patch service kiali -n istio-system --type=json -p='[{"op": "replace", "path": "/spec/ports/0/port", "value":80}]'
  kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' -n istio-system service/kiali
}

setup_kind_tempo() {
  "${SCRIPT_DIR}"/start-kind.sh --name ci --image "${KIND_NODE_IMAGE}"

  infomsg "Installing tempo"
  ${SCRIPT_DIR}/istio/tempo/install-tempo-env.sh -c kubectl -ot true

  infomsg "Installing istio"
  if [[ "${ISTIO_VERSION}" == *-dev ]]; then
    local hub_arg="--image-hub default"
  fi
  
  "${SCRIPT_DIR}"/istio/install-istio-via-istioctl.sh --reduce-resources true --client-exe-path "$(which kubectl)" -cn "cluster-default" -mid "mesh-default" -net "network-default" -gae "true" ${hub_arg:-} -a "prometheus grafana" -s values.meshConfig.defaultConfig.tracing.zipkin.address="tempo-cr-distributor.tempo:9411"

  infomsg "Pushing the images into the cluster..."
  make -e DORP="${DORP}" -e CLUSTER_TYPE="kind" -e KIND_NAME="ci" cluster-push-kiali

  infomsg "Cloning kiali helm-charts..."
  git clone --single-branch --branch "${TARGET_BRANCH}" https://github.com/kiali/helm-charts.git "${HELM_CHARTS_DIR}"
  make -C "${HELM_CHARTS_DIR}" build-helm-charts

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
    --set external_services.grafana.url="http://grafana.istio-system:3000" \
    --set external_services.grafana.dashboards[0].name="Istio Mesh Dashboard" \
    --set external_services.tracing.provider="tempo" \
    --set external_services.tracing.url="http://tempo-cr-query-frontend.tempo:3200" \
    --set external_services.tracing.in_cluster_url="http://tempo-cr-query-frontend.tempo:3200" \
    --set external_services.tracing.use_grpc="false" \
    --set health_config.rate[0].kind="service" \
    --set health_config.rate[0].name="y-server" \
    --set health_config.rate[0].namespace="alpha" \
    --set health_config.rate[0].tolerance[0].code="5xx" \
    --set health_config.rate[0].tolerance[0].degraded=2 \
    --set health_config.rate[0].tolerance[0].failure=100 \
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

  infomsg "Cloning kiali helm-charts..."
  git clone --single-branch --branch "${TARGET_BRANCH}" https://github.com/kiali/helm-charts.git "${HELM_CHARTS_DIR}"
  make -C "${HELM_CHARTS_DIR}" build-helm-charts

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

  local cluster1_context
  local cluster2_context
  local cluster1_name
  local cluster2_name
  if [ "${MULTICLUSTER}" == "${MULTI_PRIMARY}" ]; then
    "${SCRIPT_DIR}"/istio/multicluster/install-multi-primary.sh \
      --kiali-enabled false \
      --manage-kind true \
      --certs-dir "${certs_dir}" \
      -dorp docker \
      --istio-dir "${istio_dir}" \
      ${hub_arg:-}

    cluster1_context="kind-east"
    cluster2_context="kind-west"
    cluster1_name="east"
    cluster2_name="west"
    kubectl rollout status deployment prometheus -n istio-system --context kind-east
    kubectl rollout status deployment prometheus -n istio-system --context kind-west
  elif [ "${MULTICLUSTER}" == "${PRIMARY_REMOTE}" ]; then 
    "${SCRIPT_DIR}"/istio/multicluster/install-primary-remote.sh --kiali-enabled false --manage-kind true -dorp docker --istio-dir "${istio_dir}" ${hub_arg:-}
    cluster1_context="kind-east"
    cluster2_context="kind-west"
    cluster1_name="east"
    cluster2_name="west"
    kubectl rollout status deployment prometheus -n istio-system --context kind-east
    kubectl rollout status deployment prometheus -n istio-system --context kind-west
  elif [ "${MULTICLUSTER}" == "${EXTERNAL_CONTROLPLANE}" ]; then
    "${SCRIPT_DIR}"/istio/multicluster/setup-external-controlplane.sh
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
    -kshc "${HELM_CHARTS_DIR}"/_output/charts/kiali-server-*.tgz
}

if [ -n "${MULTICLUSTER}" ]; then
  setup_kind_multicluster
else
  if [ -n "${TEMPO}" ]; then
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
