#!/bin/bash

#
# Refer to the --help output for a description of this script and its available options.
#

infomsg() {
  echo "[INFO] ${1}"
}

helpmsg() {
  cat <<HELP
This script will run setup a KinD cluster for testing Kiali against a real environment in CI.
Options:
-dorp|--docker-or-podman <docker|podman>
    What to use when building images.
    Default: docker
-iv|--istio-version <#.#.#>
    The version of Istio you want to install.
    This option is ignored if -ii is false.
    If not specified, the latest version of Istio is installed.
    Default: <the latest release>
HELP
}

# process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -dorp|--docker-or-podman)     DORP="$2";                  shift;shift; ;;
    -h|--help)                    helpmsg;                    exit 1       ;;
    -iv|--istio-version)          ISTIO_VERSION="$2";         shift;shift; ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

# abort on any error
set -e

# set up some of our defaults
DORP="${DORP:-docker}"
AUTH_STRATEGY="${AUTH_STRATEGY:-anonymous}"

# Defaults the branch to master unless it is already set
TARGET_BRANCH="${TARGET_BRANCH:-master}"

# If a specific version of Istio hasn't been provided, try and guess the right one
# based on the Kiali branch being tested (TARGET_BRANCH) and the compatibility matrices:
# https://kiali.io/docs/installation/installation-guide/prerequisites/
# https://istio.io/latest/docs/releases/supported-releases/
if [ "${TARGET_BRANCH}" == "v1.48" ]; then
  ISTIO_VERSION="1.12.0"
elif [ "${TARGET_BRANCH}" == "v1.57" ]; then
  ISTIO_VERSION="1.14.0"
fi

KIND_NODE_IMAGE=""
if [ "${ISTIO_VERSION}" == "1.12.0" ]; then
  KIND_NODE_IMAGE="kindest/node:v1.23.4@sha256:0e34f0d0fd448aa2f2819cfd74e99fe5793a6e4938b328f657c8e3f81ee0dfb9"
else
  KIND_NODE_IMAGE="kindest/node:v1.24.15@sha256:24473777a1eef985dc405c23ab9f4daddb1352ca23db60b75de9e7c408096491"
fi

# print out our settings for debug purposes
cat <<EOM
=== SETTINGS ===
DORP=$DORP
ISTIO_VERSION=$ISTIO_VERSION
KIND_NODE_IMAGE=$KIND_NODE_IMAGE
TARGET_BRANCH=$TARGET_BRANCH
=== SETTINGS ===
EOM

infomsg "Make sure everything exists"
which kubectl > /dev/null || (infomsg "kubectl executable is missing"; exit 1)
which kind > /dev/null || (infomsg "kind executable is missing"; exit 1)
which "${DORP}" > /dev/null || (infomsg "[$DORP] is not in the PATH"; exit 1)

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"

"${SCRIPT_DIR}"/start-kind.sh --name ci --image "${KIND_NODE_IMAGE}"

infomsg "Installing istio"
# Apparently you can't set the requests to zero for the proxy so just setting them to some really low number.
hack/istio/install-istio-via-istioctl.sh --reduce-resources true --client-exe-path "$(which kubectl)" -cn "cluster-default" -mid "mesh-default" -net "network-default"
  
infomsg "Pushing the images into the cluster..."
make -e DORP="${DORP}" -e CLUSTER_TYPE="kind" -e KIND_NAME="ci" cluster-push-kiali

infomsg "Cloning kiali helm-charts..."
git clone --single-branch --branch "${TARGET_BRANCH}" https://github.com/kiali/helm-charts.git helm-charts
make -C helm-charts build-helm-charts

infomsg "Installing kiali server via Helm"
infomsg "Chart to be installed: $(ls -1 helm-charts/_output/charts/kiali-server-*.tgz)"
# The grafana and tracing urls need to be set for backend e2e tests
# but they don't need to be accessible outside the cluster.
# Need a single dashboard set for grafana.
helm install \
  --namespace istio-system \
  --set auth.strategy="${AUTH_STRATEGY}" \
  --set deployment.logger.log_level="trace" \
  --set deployment.service_type="LoadBalancer" \
  --set deployment.image_name=kiali/kiali \
  --set deployment.image_version=dev \
  --set deployment.image_pull_policy="Never" \
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
  helm-charts/_output/charts/kiali-server-*.tgz

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

# Checking pod status in a loop gives us more debug info on the state of the pod.
TIMEOUT="True"
for (( i=1; i<=30; i++ ))
do
  READY=$(kubectl get pods -l app=kiali -n istio-system -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}')
  if [ "${READY}" == "True" ]; then
    infomsg "Kiali finished rolling out successfully"
    TIMEOUT="False"
    break
  fi

  infomsg "Waiting for kiali pod to be ready"
  infomsg "Kiali pod status:"
  # Show status info of kiali pod. yq is used to parse out just the status info.
  kubectl get pods -l app=kiali -n istio-system -o yaml | yq '.items[0].status'
  sleep 10
done

if [ "${TIMEOUT}" == "True" ]; then
  infomsg "Timed out waiting for kiali pods to be ready"
  exit 1
fi

infomsg "Kiali is ready."



