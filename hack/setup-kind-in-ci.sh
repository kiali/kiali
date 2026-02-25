#!/bin/bash

#
# Refer to the --help output for a description of this script and its available options.
#


EXTERNAL_CONTROLPLANE="external-controlplane"
EXTERNAL_KIALI="external-kiali"
MULTI_PRIMARY="multi-primary"
PRIMARY_REMOTE="primary-remote"

KEYCLOAK_LIMIT_MEMORY=""
KEYCLOAK_REQUESTS_MEMORY=""

CLUSTER2_AMBIENT="true"

INSTALL_PERSES="false"

ISTIO_VERSION="${ISTIO_VERSION:-}"

infomsg() {
  echo "[INFO] ${1}"
}

determine_tracing_use_waypoint_name() {
  # For ambient tests, Istio < 1.28 requires using the waypoint name for tracing lookups.
  # For Istio >= 1.28, the default behavior (false) is expected.
  if [ -z "${AMBIENT:-}" ]; then
    echo "false"
    return 0
  fi

  local effective_version=""
  if [ -n "${ISTIO_VERSION:-}" ]; then
    effective_version="$(kiali_istio_normalize_version "${ISTIO_VERSION}")" || {
      echo "ERROR: Unable to parse --istio-version value '${ISTIO_VERSION}'." >&2
      return 1
    }
  else
    effective_version="$(kiali_istio_detect_installed_version_from_istiod "istio-system")" || {
      echo "ERROR: Unable to detect the installed Istio version from the cluster (istiod image tag) while running ambient tests." >&2
      echo "ERROR: Please pass --istio-version explicitly or ensure the istiod deployment image has a version tag." >&2
      return 1
    }
  fi

  if kiali_istio_version_lt "${effective_version}" "1.28.0"; then
    echo "true"
  else
    echo "false"
  fi
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
-c2a|--cluster2-ambient
    Install Istio Ambient in the remote cluster
    Default: true
-dk|--deploy-kiali <true|false>
    Whether to deploy Kiali as part of the setup.
    Default: true
-dorp|--docker-or-podman <docker|podman>
    What to use when building images.
    Default: docker
-hcd|--helm-charts-dir
    Directory where the Kiali helm charts are located.
    If one is not supplied a /tmp dir will be created and used.
-ip|--install-perses <true|false>
    Whether to deploy Perses as part of the setup.
    Helm charts will be installed.
    Default: false
-iv|--istio-version <#.#.#>
    The version of Istio you want to install.
    If you want to run with a dev build of Istio, the value must be something like "#.#-dev".
    This option is ignored if -ii is false.
    If not specified, the latest version of Istio is installed.
    Default: <the latest release>
-klm|--keycloak-limit-memory
    The keycloak resources limit memory in the keycloak helm charts
-krm|--keycloak-requests-memory)
    The keycloak resources requests memory in the keycloak helm charts.
-mc|--multicluster <${MULTI_PRIMARY}|${PRIMARY_REMOTE}|${EXTERNAL_CONTROLPLANE}|${EXTERNAL_KIALI}>
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

source "${SCRIPT_DIR}/istio/version-utils.sh"

# TODO: Remove sail option once everything uses sail to install
# process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -a|--auth-strategy)           AUTH_STRATEGY="$2";         shift;shift; ;;
    -ab|--ambient)                AMBIENT="true";               shift;shift; ;;
    -c2a|--cluster2-ambient)      CLUSTER2_AMBIENT="$2";      shift;shift; ;;
    -dk|--deploy-kiali)           DEPLOY_KIALI="$2";          shift;shift; ;;
    -dorp|--docker-or-podman)     DORP="$2";                  shift;shift; ;;
    -h|--help)                    helpmsg;                    exit 1       ;;
    -hcd|--helm-charts-dir)       HELM_CHARTS_DIR="$2";       shift;shift; ;;
    -ip|--install-perses)         INSTALL_PERSES="$2";        shift;shift; ;;
    -iv|--istio-version)          ISTIO_VERSION="$2";         shift;shift; ;;
    -klm|--keycloak-limit-memory) KEYCLOAK_LIMIT_MEMORY="$2"; shift;shift; ;;
    -krm|--keycloak-requests-memory) KEYCLOAK_REQUESTS_MEMORY="$2"; shift;shift; ;;
    -mc|--multicluster)
      MULTICLUSTER="${2}"
      if [ "${MULTICLUSTER}" != "${PRIMARY_REMOTE}" -a "${MULTICLUSTER}" != "${MULTI_PRIMARY}" -a "${MULTICLUSTER}" != "${EXTERNAL_CONTROLPLANE}" -a "${MULTICLUSTER}" != "${EXTERNAL_KIALI}" ]; then
        echo "--multicluster option must be one of '${PRIMARY_REMOTE}' or '${MULTI_PRIMARY}' or '${EXTERNAL_CONTROLPLANE}' or '${EXTERNAL_KIALI}'"
        exit 1
      fi
      shift;shift
      ;;
    -s|--sail)                     SAIL="true";              shift;shift; ;;
    -te|--tempo)                   TEMPO="$2";               shift;shift; ;;
    -w|--waypoint)                 WAYPOINT="$2";            shift;shift; ;;
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
DEPLOY_KIALI="${DEPLOY_KIALI:-true}"
DORP="${DORP:-docker}"
TEMPO="${TEMPO:-false}"

# Defaults the branch to master unless it is already set
TARGET_BRANCH="${TARGET_BRANCH:-master}"

# If a specific version of Istio hasn't been provided, try and guess the right one
# based on the Kiali branch being tested (TARGET_BRANCH) and the compatibility matrices:
# https://kiali.io/docs/installation/installation-guide/prerequisites/
# https://istio.io/latest/docs/releases/supported-releases/
if [ -z "${ISTIO_VERSION}" ]; then
  if [ "${TARGET_BRANCH}" == "v1.73" ]; then
    ISTIO_VERSION="1.18.7"
  elif [ "${TARGET_BRANCH}" == "v2.4" ]; then
    ISTIO_VERSION="1.23.6"
  elif [ "${TARGET_BRANCH}" == "v2.11" ]; then
    ISTIO_VERSION="1.26.8"
  elif [ "${TARGET_BRANCH}" == "v2.17" ]; then
    ISTIO_VERSION="1.27.5"
  elif [ "${TARGET_BRANCH}" == "v2.22" ]; then
    ISTIO_VERSION="1.28.3"
  fi
fi

# Persist the resolved ISTIO_VERSION for subsequent GitHub Actions steps
if [ -n "${GITHUB_ENV:-}" ] && [ -n "${ISTIO_VERSION}" ]; then
  echo "ISTIO_VERSION=${ISTIO_VERSION}" >> "${GITHUB_ENV}"
fi

KIND_NODE_IMAGE=""
if [ "${ISTIO_VERSION}" == 1.18.* ]; then
  KIND_NODE_IMAGE="kindest/node:v1.27.16@sha256:2d21a61643eafc439905e18705b8186f3296384750a835ad7a56cb574b35af8"
elif [[ "${ISTIO_VERSION}" == 1.23.* ]]; then
  KIND_NODE_IMAGE="kindest/node:v1.30.13@sha256:397209b3d947d154f6641f2d0ce8d473732bd91c87d9575ade99049aa33cd648"
elif [[ "${ISTIO_VERSION}" == 1.26.* ]]; then
  KIND_NODE_IMAGE="kindest/node:v1.33.7@sha256:d26ef333bdb2cbe9862a0f7c3803ecc7b4303d8cea8e814b481b09949d353040"
elif [[ "${ISTIO_VERSION}" == 1.27.* ]]; then
  KIND_NODE_IMAGE="kindest/node:v1.33.7@sha256:d26ef333bdb2cbe9862a0f7c3803ecc7b4303d8cea8e814b481b09949d353040"
elif [[ "${ISTIO_VERSION}" == 1.28.* ]]; then
  KIND_NODE_IMAGE="kindest/node:v1.34.3@sha256:08497ee19eace7b4b5348db5c6a1591d7752b164530a36f855cb0f2bdcbadd48"
fi

if [ -z "${HELM_CHARTS_DIR}" ]; then
  HELM_CHARTS_DIR="$(mktemp -d)"

  # We want to test the helm chart changes that correspond to the server PR being tested.
  # If the server PR has a corresponding helm-charts PR, the helm-charts PR branch
  # must be the same name as the server PR branch.
  # As a fallback, we will use the helm-charts repo's master branch in order to support
  # server PR testing that do not have any corresponding helm-charts PRs.
  # Prefer the PR head branch if this script is running in a pull-request. If
  # that branch does not exist in the helm-charts repo, gracefully fall back to
  # TARGET_BRANCH, and finally to 'master'.
  CANDIDATE_BRANCHES=("${BUILD_BRANCH}" "${GITHUB_HEAD_REF}" "${TARGET_BRANCH}" "master")

  HELM_CHARTS_BRANCH=""
  for b in "${CANDIDATE_BRANCHES[@]}"; do
    infomsg "Evaluating helm-charts branch candidate: [${b}]"
    # Skip empty candidates (GITHUB_HEAD_REF is empty on push workflows)
    if [ -z "${b}" ]; then
      infomsg " -> branch skipped (empty)"
      continue
    fi

    # For master branch, prioritize the official kiali repo over forks
    # For other branches, try the PR author's fork first, then fall back to kiali repo
    # Only add GITHUB_ACTOR if it's not empty to avoid malformed URLs
    CANDIDATE_OWNERS=()
    if [ "${b}" = "master" ]; then
      # For master, prioritize kiali repo first
      CANDIDATE_OWNERS+=("kiali")
      if [ -n "${GITHUB_ACTOR}" ]; then
        CANDIDATE_OWNERS+=("${GITHUB_ACTOR}")
      fi
    else
      # For feature branches, try author's fork first
      if [ -n "${GITHUB_ACTOR}" ]; then
        CANDIDATE_OWNERS+=("${GITHUB_ACTOR}")
      fi
      CANDIDATE_OWNERS+=("kiali")
    fi

    for owner in "${CANDIDATE_OWNERS[@]}"; do
      repo_url="https://github.com/${owner}/helm-charts.git"
      infomsg "Evaluating helm-charts branch [${b}] of owner [${owner}]: ${repo_url}"
      if git ls-remote --exit-code --heads "${repo_url}" "refs/heads/${b}" >/dev/null 2>&1; then
        infomsg " -> branch [${b}] exists in ${owner}/helm-charts"
        HELM_CHARTS_BRANCH="${b}"
        HELM_CHARTS_REPO_URL="${repo_url}"
        break 2
      else
        infomsg " -> branch [${b}] not found in ${owner}/helm-charts"
      fi
    done
    infomsg " -> branch [${b}] not found in candidate owners"
  done

  if [ -z "${HELM_CHARTS_BRANCH}" ]; then
    echo "ERROR: Unable to find a suitable branch in helm-charts repository." >&2
    exit 1
  fi

  infomsg "Cloning kiali helm-charts (branch: ${HELM_CHARTS_BRANCH}) into ${HELM_CHARTS_DIR} ..."
  # Default to kiali repo URL if not set in loop (this should not happen)
  HELM_CHARTS_REPO_URL="${HELM_CHARTS_REPO_URL:-https://github.com/kiali/helm-charts.git}"
  git clone --single-branch --branch "${HELM_CHARTS_BRANCH}" "${HELM_CHARTS_REPO_URL}" "${HELM_CHARTS_DIR}"
  make -C "${HELM_CHARTS_DIR}" build-helm-charts
fi

# print out our settings for debug purposes
cat <<EOM
=== SETTINGS ===
AUTH_STRATEGY=$AUTH_STRATEGY
DEPLOY_KIALI=$DEPLOY_KIALI
DORP=$DORP
HELM_CHARTS_DIR=$HELM_CHARTS_DIR
ISTIO_VERSION=$ISTIO_VERSION
KEYCLOAK_LIMIT_MEMORY=$KEYCLOAK_LIMIT_MEMORY
KEYCLOAK_REQUESTS_MEMORY=$KEYCLOAK_REQUESTS_MEMORY
KIND_NODE_IMAGE=$KIND_NODE_IMAGE
MULTICLUSTER=$MULTICLUSTER
SAIL=$SAIL
TARGET_BRANCH=$TARGET_BRANCH
BUILD_BRANCH=$BUILD_BRANCH
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

make HELM_VERSION="v3.18.4" -C "${HELM_CHARTS_DIR}" .download-helm-binary

HELM="${HELM_CHARTS_DIR}/_output/helm-install/helm"

infomsg "Using helm: $(ls -l ${HELM})"
infomsg "$(${HELM} version)"

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

      # Optional: keycloak memory limits
      if [ -n "$KEYCLOAK_LIMIT_MEMORY" ]; then
        MEMORY_LIMIT_ARG="-slm $KEYCLOAK_LIMIT_MEMORY"
      else
        MEMORY_LIMIT_ARG=""
      fi
      if [ -n "$KEYCLOAK_REQUESTS_MEMORY" ]; then
        MEMORY_REQUEST_ARG="-srm $KEYCLOAK_REQUESTS_MEMORY"
      else
        MEMORY_REQUEST_ARG=""
      fi

      "${SCRIPT_DIR}/keycloak.sh" -kcd "${KEYCLOAK_CERTS_DIR}" -kip "${KEYCLOAK_ADDRESS}" $MEMORY_LIMIT_ARG $MEMORY_REQUEST_ARG deploy

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

  local tracing_use_waypoint_name
  tracing_use_waypoint_name="$(determine_tracing_use_waypoint_name)"
  local tracing_use_waypoint_args=()
  # use_waypoint_name defaults to false. Only set it explicitly when true.
  if [ "${tracing_use_waypoint_name}" == "true" ]; then
    tracing_use_waypoint_args=(--set external_services.tracing.use_waypoint_name="true")
  fi
  infomsg "external_services.tracing.use_waypoint_name=${tracing_use_waypoint_name} (ambient=${AMBIENT:-false}, istio_version=${ISTIO_VERSION:-auto})"

  PERSES_ARGS=()
  if [ "${INSTALL_PERSES}" == "true" ]; then
    infomsg "Installing Perses"
    kubectl apply -f "${SCRIPT_DIR}"/istio/perses/project.yaml
    kubectl apply -f "${SCRIPT_DIR}"/istio/perses/datasource.yaml
    kubectl apply -f "${SCRIPT_DIR}"/istio/perses/dashboard.yaml

    ${HELM} repo add perses https://perses.github.io/helm-charts
    ${HELM} install perses perses/perses -n istio-system -f "${SCRIPT_DIR}"/istio/perses/values.yaml
          PERSES_ARGS=(
        "--set" "external_services.perses.enabled=true"
        "--set" "external_services.perses.internal_url=http://perses.istio-system:8080"
        "--set" "external_services.perses.external_url=http://localhost:4000"
        "--set" "external_services.perses.dashboards[0].name=Istio Mesh Dashboard"
        "--set" "external_services.perses.dashboards[0].variables.namespace=var-namespace"
        "--set" "external_services.perses.dashboards[0].variables.workload=var-workload"
        "--set" "external_services.perses.dashboards[0].variables.datasource=var-datasource"
      )
  fi

  if [ "${DEPLOY_KIALI}" != "true" ]; then
    infomsg "Skipping Kiali deployment as requested"
    return
  fi

  infomsg "Pushing the images into the cluster..."
  make -e DORP="${DORP}" -e CLUSTER_TYPE="kind" -e KIND_NAME="ci" cluster-push-kiali

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
    "${PERSES_ARGS[@]}" \
    --set external_services.tracing.enabled="true" \
    --set external_services.tracing.external_url="http://tracing.istio-system:16685/jaeger" \
    "${tracing_use_waypoint_args[@]}" \
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
    --set kiali_internal.graph_cache.enabled="false" \
    --set kiali_internal.health_cache.enabled="false" \
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

    kubectl apply -f ${SCRIPT_DIR}/istio/tempo/resources/otel-collector.yaml

    infomsg "Installing istio"
    if [[ "${ISTIO_VERSION}" == *-dev ]]; then
      local hub_arg="--image-hub default"
    fi

    "${SCRIPT_DIR}"/istio/install-istio-via-istioctl.sh --reduce-resources true --client-exe-path "$(which kubectl)" -cn "cluster-default" -mid "mesh-default" -net "network-default" -gae "true" ${hub_arg:-} -a "prometheus grafana" -s values.meshConfig.defaultConfig.tracing.zipkin.address="tempo-cr-distributor.tempo:9411"
  fi

  local tracing_use_waypoint_name
  tracing_use_waypoint_name="$(determine_tracing_use_waypoint_name)"
  local tracing_use_waypoint_args=()
  # use_waypoint_name defaults to false. Only set it explicitly when true.
  if [ "${tracing_use_waypoint_name}" == "true" ]; then
    tracing_use_waypoint_args=(--set external_services.tracing.use_waypoint_name="true")
  fi
  infomsg "external_services.tracing.use_waypoint_name=${tracing_use_waypoint_name} (ambient=${AMBIENT:-false}, istio_version=${ISTIO_VERSION:-auto})"

  if [ "${DEPLOY_KIALI}" != "true" ]; then
    infomsg "Skipping Kiali deployment as requested"
    return
  fi

  infomsg "Pushing the images into the cluster..."
  make -e DORP="${DORP}" -e CLUSTER_TYPE="kind" -e KIND_NAME="ci" cluster-push-kiali

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
    "${tracing_use_waypoint_args[@]}" \
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
    --set kiali_internal.graph_cache.enabled="false" \
    --set kiali_internal.health_cache.enabled="false" \
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
  # Build hub_arg as an array for proper expansion
  local hub_arg=()
  if [[ "${ISTIO_VERSION}" == *-dev ]]; then
    hub_arg=(--istio-hub default)
  fi

  local certs_dir
  # Always create a temporary directory for Istio multicluster certificates to avoid permission issues
  # The default /tmp/istio-multicluster-certs may have permission problems
  certs_dir=$(mktemp -d)
  if [ ! -d "${certs_dir}" ]; then
    echo "ERROR: Failed to create temporary certs directory"
    exit 1
  fi
  if [ "${AUTH_STRATEGY}" == "openid" ]; then
    mkdir -p "${certs_dir}"/keycloak
  fi

  # Build kind_node_image as an array for proper expansion
  local kind_node_image=()
  if [ -n "${KIND_NODE_IMAGE}" ]; then
    kind_node_image=(--kind-node-image "${KIND_NODE_IMAGE}")
  fi

  if [ -n "$KEYCLOAK_LIMIT_MEMORY" ]; then
    MEMORY_LIMIT_ARG="-kml $KEYCLOAK_LIMIT_MEMORY"
  else
    MEMORY_LIMIT_ARG=""
  fi
  if [ -n "$KEYCLOAK_REQUESTS_MEMORY" ]; then
    MEMORY_REQUEST_ARG="-krm $KEYCLOAK_REQUESTS_MEMORY"
  else
    MEMORY_REQUEST_ARG=""
  fi
  # Build ambient argument properly for array expansion
  if [ -n "$AMBIENT" ]; then
    AMBIENT_ARG=(-a true)
  else
    AMBIENT_ARG=()
  fi
  # Build cluster2 ambient argument properly for array expansion
  if [ -n "$AMBIENT" ] && [ "$CLUSTER2_AMBIENT" == "false" ]; then
    CLUSTER2_AMBIENT_ARG=(--cluster2-ambient false)
  else
    CLUSTER2_AMBIENT_ARG=()
  fi
  # Build waypoint argument properly for array expansion
  if [ "${WAYPOINT}" == "true" ]; then
    WAYPOINT_ARG=(--waypoint true)
  else
    WAYPOINT_ARG=()
  fi

  local cluster1_context
  local cluster2_context
  local cluster1_name
  local cluster2_name
  local ignore_home_cluster="false"
  # Build istio_version_arg as an array for proper expansion
  local istio_version_arg=()
  if [ -n "${ISTIO_VERSION}" ]; then
    istio_version_arg=(--istio-version "${ISTIO_VERSION}")
  fi
  # Always pass --certs-dir with a temporary directory to avoid permission issues with the default /tmp/istio-multicluster-certs
  local certs_dir_arg="--certs-dir ${certs_dir}"

  # Pass auth strategy to install-multi-primary.sh so it knows whether to set up Keycloak
  # For multicluster, 'token' auth strategy maps to 'anonymous' (multicluster scripts only support anonymous, openid, or openshift)
  local kiali_auth_strategy="${AUTH_STRATEGY}"
  if [ "${AUTH_STRATEGY}" == "token" ]; then
    kiali_auth_strategy="anonymous"
  fi
  # Ensure we only pass valid values (anonymous, openid, or openshift)
  if [ "${kiali_auth_strategy}" != "anonymous" ] && [ "${kiali_auth_strategy}" != "openid" ] && [ "${kiali_auth_strategy}" != "openshift" ]; then
    echo "ERROR: Invalid AUTH_STRATEGY '${AUTH_STRATEGY}' for multicluster. Must be 'token' (maps to 'anonymous'), 'openid', or 'openshift'"
    exit 1
  fi

  if [ "${MULTICLUSTER}" == "${MULTI_PRIMARY}" ]; then
    # Build arguments array to ensure proper argument passing
    local install_args=(
      --kiali-enabled false
      --manage-kind true
      --certs-dir "${certs_dir}"
    )
    install_args+=(
      -dorp docker
      --istio-dir "${istio_dir}"
      -kas "${kiali_auth_strategy}"
    )
    if [ -n "${MEMORY_REQUEST_ARG}" ]; then
      # MEMORY_REQUEST_ARG contains multiple words (e.g., "-krm 1Gi")
      install_args+=(${MEMORY_REQUEST_ARG})
    fi
    if [ -n "${MEMORY_LIMIT_ARG}" ]; then
      # MEMORY_LIMIT_ARG contains multiple words (e.g., "-kml 1Gi")
      install_args+=(${MEMORY_LIMIT_ARG})
    fi
    if [ ${#AMBIENT_ARG[@]} -gt 0 ]; then
      install_args+=("${AMBIENT_ARG[@]}")
    fi
    if [ ${#CLUSTER2_AMBIENT_ARG[@]} -gt 0 ]; then
      install_args+=("${CLUSTER2_AMBIENT_ARG[@]}")
    fi
    if [ ${#WAYPOINT_ARG[@]} -gt 0 ]; then
      install_args+=("${WAYPOINT_ARG[@]}")
    fi
    if [ ${#kind_node_image[@]} -gt 0 ]; then
      install_args+=("${kind_node_image[@]}")
    fi
    if [ ${#hub_arg[@]} -gt 0 ]; then
      install_args+=("${hub_arg[@]}")
    fi
    if [ ${#istio_version_arg[@]} -gt 0 ]; then
      install_args+=("${istio_version_arg[@]}")
    fi
    "${SCRIPT_DIR}"/istio/multicluster/install-multi-primary.sh "${install_args[@]}"

    cluster1_context="kind-east"
    cluster2_context="kind-west"
    cluster1_name="east"
    cluster2_name="west"
    kubectl rollout status deployment prometheus -n istio-system --context kind-east
    kubectl rollout status deployment prometheus -n istio-system --context kind-west
  elif [ "${MULTICLUSTER}" == "${PRIMARY_REMOTE}" ]; then
    "${SCRIPT_DIR}"/istio/multicluster/install-primary-remote.sh --kiali-enabled false --manage-kind true -dorp docker -te ${TEMPO} --istio-dir "${istio_dir}" "${kind_node_image[@]}" "${hub_arg[@]}" "${istio_version_arg[@]}"
    cluster1_context="kind-east"
    cluster2_context="kind-west"
    cluster1_name="east"
    cluster2_name="west"
    kubectl rollout status deployment prometheus -n istio-system --context kind-east
    kubectl rollout status deployment prometheus -n istio-system --context kind-west
  elif [ "${MULTICLUSTER}" == "${EXTERNAL_KIALI}" ]; then
    # Only pass --certs-dir if certs_dir has a value to avoid argument parsing issues
    local external_certs_dir_arg=""
    if [ -n "${certs_dir}" ]; then
      external_certs_dir_arg="--certs-dir ${certs_dir}"
    fi
    "${SCRIPT_DIR}"/istio/multicluster/install-external-kiali.sh --kiali-enabled false --manage-kind true ${external_certs_dir_arg} -dorp docker -te ${TEMPO} --istio-dir "${istio_dir}" "${kind_node_image[@]}" "${hub_arg[@]}" "${istio_version_arg[@]}"
    cluster1_context="kind-mgmt"
    cluster2_context="kind-mesh"
    cluster1_name="mgmt"
    cluster2_name="mesh"
    ignore_home_cluster="true"
    kubectl rollout status deployment prometheus -n istio-system --context kind-mesh
  elif [ "${MULTICLUSTER}" == "${EXTERNAL_CONTROLPLANE}" ]; then
    "${SCRIPT_DIR}"/istio/multicluster/setup-external-controlplane.sh "${kind_node_image[@]}" "${istio_version_arg[@]}"
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

  if [ "${DEPLOY_KIALI}" != "true" ]; then
    infomsg "Skipping Kiali deployment as requested"
    return
  fi

  "${SCRIPT_DIR}"/istio/multicluster/deploy-kiali.sh \
    --cluster1-context ${cluster1_context} \
    --cluster2-context ${cluster2_context} \
    --cluster1-name ${cluster1_name} \
    --cluster2-name ${cluster2_name} \
    --ignore-home-cluster ${ignore_home_cluster} \
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

if [ "${DEPLOY_KIALI}" != "true" ]; then
  infomsg "Skipping Kiali readiness checks as Kiali was not deployed"
  exit 0
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
