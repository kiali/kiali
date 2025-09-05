#!/bin/bash

#
# Refer to the --help output for a description of this script and its available options.
#

EXTERNAL_CONTROLPLANE="external-controlplane"

infomsg() {
  echo "[INFO] ${1}"
}

helpmsg() {
  cat <<HELP
This script will run setup a minikube cluster for testing Kiali against a real environment in CI.
Options:
-a|--auth-strategy <anonymous|token>
    Auth stategy to use for Kiali.
    Default: anonymous
-dk|--deploy-kiali <true|false>
    Whether to deploy Kiali as part of the setup.
    Default: true
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
-mc|--multicluster <${EXTERNAL_CONTROLPLANE}>
    Whether to set up a multicluster environment
    and which kind of multicluster environment to setup.
    Default: <none>
-s|--sail
    Install Istio with the Sail Operator.
    Default: <false>
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
    -dk|--deploy-kiali)           DEPLOY_KIALI="$2";          shift;shift; ;;
    -dorp|--docker-or-podman)     DORP="$2";                  shift;shift; ;;
    -h|--help)                    helpmsg;                    exit 1       ;;
    -hcd|--helm-charts-dir)       HELM_CHARTS_DIR="$2";       shift;shift; ;;
    -iv|--istio-version)          ISTIO_VERSION="$2";         shift;shift; ;;
    -mc|--multicluster)
      MULTICLUSTER="${2}"
      if [ "${MULTICLUSTER}" != "${EXTERNAL_CONTROLPLANE}" ]; then
        echo "--multicluster option must be '${EXTERNAL_CONTROLPLANE}'"
        exit 1
      fi
      shift;shift
      ;;
    -s|--sail)                     SAIL="true";              shift;shift; ;;
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
MULTICLUSTER=$MULTICLUSTER
SAIL=$SAIL
TARGET_BRANCH=$TARGET_BRANCH
BUILD_BRANCH=$BUILD_BRANCH
=== SETTINGS ===
EOM

infomsg "Make sure everything exists"
which kubectl > /dev/null || (infomsg "kubectl executable is missing"; exit 1)
which minikube > /dev/null || (infomsg "minikube executable is missing"; exit 1)
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

setup_minikube_multicluster() {
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

  local cluster1_context
  local cluster2_context
  local cluster1_name
  local cluster2_name
  local istio_version_arg=${ISTIO_VERSION:+--istio-version ${ISTIO_VERSION}}
  if [ "${MULTICLUSTER}" == "${EXTERNAL_CONTROLPLANE}" ]; then
    "${SCRIPT_DIR}"/istio/multicluster/setup-minikube-external-controlplane.sh ${istio_version_arg}
    cluster1_context="controlplane"
    cluster2_context="dataplane"
    cluster1_name="controlplane"
    cluster2_name="dataplane"
    kubectl rollout status deployment prometheus -n istio-system --context controlplane
    kubectl rollout status deployment prometheus -n external-istiod --context dataplane
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
    --ignore-home-cluster false \
    --manage-kind false \
    -dorp "${DORP}" \
    -kas "${AUTH_STRATEGY}" \
    -kudi true \
    -kshc "${HELM_CHARTS_DIR}"/_output/charts/kiali-server-*.tgz \
    -ci true
}

if [ -n "${MULTICLUSTER}" ]; then
  setup_minikube_multicluster
else
  echo "ERROR: This script currently only supports multicluster setup"
  exit 1
fi

if [ "${DEPLOY_KIALI}" != "true" ]; then
  infomsg "Skipping Kiali readiness checks as Kiali was not deployed"
  exit 0
fi

# Unfortunately kubectl rollout status fails if the resource does not exist yet.
for (( i=1; i<=60; i++ ))
do
  PODS=$(kubectl get pods -l app=kiali -n istio-system -o name --context controlplane)
  if [ "${PODS}" != "" ]; then
    infomsg "Kiali pods exist"
    break
  fi

  infomsg "Waiting for kiali pod to exist"
  sleep 5
done

kubectl rollout status deployment/kiali -n istio-system --timeout=120s --context controlplane || { echo "Timed out waiting for kiali pods to be ready"; kubectl get pods -l app=kiali -n istio-system -o yaml --context controlplane | yq '.items[0].status'; exit 1; }

infomsg "Kiali is ready."
