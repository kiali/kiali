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
  ISTIO_VERSION="1.12.9"
elif [ "${TARGET_BRANCH}" == "v1.57" ]; then
  ISTIO_VERSION="1.14.5"
elif [ "${TARGET_BRANCH}" == "v1.65" ]; then
  ISTIO_VERSION="1.16.7"
fi

KIND_NODE_IMAGE=""
if [ "${ISTIO_VERSION}" == "1.12.9" ]; then
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

NODE_IMAGE_LINE=""
if [ -n "${KIND_NODE_IMAGE}" ]; then
  NODE_IMAGE_LINE="image: ${KIND_NODE_IMAGE}"
fi
infomsg "Kind cluster to be created with name [ci]"
cat <<EOF | kind create cluster --name ci --config -
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  ipFamily: ipv4
nodes:
  - role: control-plane
    ${NODE_IMAGE_LINE}
  - role: worker
    ${NODE_IMAGE_LINE}
EOF

# When a new cluster is created, kind automagically sets the kube context.

infomsg "Create Kind LoadBalancer via MetalLB"
lb_addr_range="255.70-255.84"

kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.5/config/manifests/metallb-native.yaml

# loop through all known subnets in the kind network and pick out the IPv4 subnet, ignoring any IPv6 that might be in the list
subnets_count="$(${DORP} network inspect kind | jq '.[0].IPAM.Config | length')"
infomsg "There are [$subnets_count] subnets in the kind network"
for ((i=0; i<subnets_count; i++)); do
  subnet=$(${DORP} network inspect kind --format '{{(index .IPAM.Config '$i').Subnet}}' 2> /dev/null)
  if [[ -n $subnet && $subnet != *:* && $subnet == *\.* ]]; then
    infomsg "Using subnet [$subnet]"
    break
  else
    infomsg "Ignoring subnet [$subnet]"
    subnet=""
  fi
done
if [ -z "$subnet" ]; then
  infomsg "There does not appear to be any IPv4 subnets configured"
  exit 1
fi

subnet_trimmed=$(echo "${subnet}" | sed -E 's/([0-9]+\.[0-9]+)\.[0-9]+\..*/\1/')
first_ip="${subnet_trimmed}.$(echo "${lb_addr_range}" | cut -d '-' -f 1)"
last_ip="${subnet_trimmed}.$(echo "${lb_addr_range}" | cut -d '-' -f 2)"

if [ -n "${ISTIO_VERSION}" ]; then
  DOWNLOAD_ISTIO_VERSION_ARG="--istio-version ${ISTIO_VERSION}"
fi

infomsg "Downloading istio"
hack/istio/download-istio.sh ${DOWNLOAD_ISTIO_VERSION_ARG}

kubectl rollout status deployment controller -n metallb-system

cat <<LBCONFIGMAP | kubectl apply -f -
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  namespace: metallb-system
  name: config
spec:
  addresses:
  - ${first_ip}-${last_ip}
LBCONFIGMAP

cat <<LBCONFIGMAP | kubectl apply -f -
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  namespace: metallb-system
  name: l2config
spec:
  ipAddressPools:
  - config
LBCONFIGMAP

infomsg "Installing istio"
# Apparently you can't set the requests to zero for the proxy so just setting them to some really low number.
hack/istio/install-istio-via-istioctl.sh --reduce-resources true --client-exe-path "$(which kubectl)" -cn "cluster-default" -mid "mesh-default" -net "network-default" -gae "true" -gav "v0.7.1"
  
infomsg "Pushing the images into the cluster..."
make -e DORP="${DORP}" -e CLUSTER_TYPE="kind" -e KIND_NAME="ci" cluster-push-kiali

infomsg "Cloning kiali helm-charts..."
git clone --single-branch --branch "${TARGET_BRANCH}" https://github.com/kiali/helm-charts.git helm-charts
make -C helm-charts build-helm-charts

HELM="helm-charts/_output/helm-install/helm"

infomsg "Using helm: $(ls -l ${HELM})"
infomsg "$(${HELM} version)"

infomsg "Installing kiali server via Helm"
infomsg "Chart to be installed: $(ls -1 helm-charts/_output/charts/kiali-server-*.tgz)"
# The grafana and tracing urls need to be set for backend e2e tests
# but they don't need to be accessible outside the cluster.
# Need a single dashboard set for grafana.
${HELM} install \
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

# Create the citest service account whose token will be used to log into Kiali
infomsg "Installing the test ServiceAccount with read-write permissions"
for o in role rolebinding serviceaccount; do ${HELM} template --show-only "templates/${o}.yaml" --namespace=istio-system --set deployment.instance_name=citest --set auth.strategy=anonymous kiali-server helm-charts/_output/charts/kiali-server-*.tgz; done | kubectl apply -f -

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
