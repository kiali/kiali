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

# If a specific version of Istio hasn't been provided, try and guess the right one
# based on the Kiali branch being tested (TARGET_BRANCH) and the compatibility matrices:
# https://kiali.io/docs/installation/installation-guide/prerequisites/
# https://istio.io/latest/docs/releases/supported-releases/
if [ "${TARGET_BRANCH}" == "v1.48" ]; then
  ISTIO_VERSION="1.13.0"
elif [ "${TARGET_BRANCH}" == "v1.36" ]; then
  ISTIO_VERSION="1.10.0"
elif [ "${TARGET_BRANCH}" == "v1.24" ]; then
  ISTIO_VERSION="1.7.0"
fi

KIND_NODE_IMAGE=""
if [ "${ISTIO_VERSION}" == "1.7.0" ]; then
  KIND_NODE_IMAGE="kindest/node:v1.18.20@sha256:e3dca5e16116d11363e31639640042a9b1bd2c90f85717a7fc66be34089a8169"
elif [ "${ISTIO_VERSION}" == "1.10.0" ]; then
  KIND_NODE_IMAGE="kindest/node:v1.21.10@sha256:84709f09756ba4f863769bdcabe5edafc2ada72d3c8c44d6515fc581b66b029c"
elif [ "${ISTIO_VERSION}" == "1.13.0" ]; then
  KIND_NODE_IMAGE="kindest/node:v1.23.4@sha256:0e34f0d0fd448aa2f2819cfd74e99fe5793a6e4938b328f657c8e3f81ee0dfb9"
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
nodes:
  - role: control-plane
    ${NODE_IMAGE_LINE}
  - role: worker
    ${NODE_IMAGE_LINE}
EOF

# When a new cluster is created, kind automagically sets the kube context.

infomsg "Create Kind LoadBalancer via MetalLB"
lb_addr_range="255.70-255.84"

kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.12.1/manifests/namespace.yaml
kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.12.1/manifests/metallb.yaml

subnet=$(${DORP} network inspect kind --format '{{(index .IPAM.Config 0).Subnet}}')
subnet_trimmed=$(echo "${subnet}" | sed -E 's/([0-9]+\.[0-9]+)\.[0-9]+\..*/\1/')
first_ip="${subnet_trimmed}.$(echo "${lb_addr_range}" | cut -d '-' -f 1)"
last_ip="${subnet_trimmed}.$(echo "${lb_addr_range}" | cut -d '-' -f 2)"
cat <<LBCONFIGMAP | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  namespace: metallb-system
  name: config
data:
  config: |
    address-pools:
    - name: default
      protocol: layer2
      addresses: ['${first_ip}-${last_ip}']
LBCONFIGMAP

if [ -n "${ISTIO_VERSION}" ]; then
  DOWNLOAD_ISTIO_VERSION_ARG="--istio-version ${ISTIO_VERSION}"
fi

infomsg "Downloading istio"
hack/istio/download-istio.sh ${DOWNLOAD_ISTIO_VERSION_ARG}

infomsg "Installing istio"
# Apparently you can't set the requests to zero for the proxy so just setting them to some really low number.
hack/istio/install-istio-via-istioctl.sh --client-exe-path "$(which kubectl)" \
  --set "values.global.proxy.resources.requests.cpu=1m" \
  --set "values.global.proxy.resources.requests.memory=1Mi" \
  --set "values.global.proxy_init.resources.requests.cpu=1m" \
  --set "values.global.proxy_init.resources.requests.memory=1Mi" \
  --set "components.pilot.k8s.resources.requests.cpu=1m" \
  --set "components.pilot.k8s.resources.requests.memory=1Mi"
  
infomsg "Pushing the images into the cluster..."
make -e DORP="${DORP}" -e CLUSTER_TYPE="kind" -e KIND_NAME="ci" cluster-push-kiali

infomsg "Cloning kiali helm-charts..."
git clone --single-branch --branch "${TARGET_BRANCH}" https://github.com/kiali/helm-charts.git helm-charts
make -C helm-charts build-helm-charts

infomsg "Installing kiali server via Helm"
helm install \
  --namespace istio-system \
  --set auth.strategy="anonymous" \
  --set deployment.service_type="LoadBalancer" \
  --set deployment.image_name=kiali/kiali \
  --set deployment.image_version=dev \
  --set deployment.image_pull_policy="Never" \
  kiali-server \
  helm-charts/_output/charts/kiali-server-*-SNAPSHOT.tgz

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