#!/bin/bash

##############################################################################
# start-kind.sh
#
# Starts up kind instances for each of the 2 clusters.
#
# For setting up the LB, see: https://kind.sigs.k8s.io/docs/user/loadbalancer
#
##############################################################################
NAME="kiali-testing"
DORP="docker"
IMAGE=""
LOAD_BALANCER_RANGE="255.70-255.84"

infomsg() {
  echo "[INFO] ${1}"
}

helpmsg() {
  cat <<HELP
This script will create a single node KinD cluster with metallb enabled for testing Kiali against a real environment.
Options:
-dorp|--docker-or-podman <docker|podman>
    What to use when running kind.
    Default: docker
-n|--name
    Name of the kind cluster.
    Default: kiali-testing
-i|--image
    Image of the kind cluster. Defaults to latest kind image if not specified.
-lbr|--load-balancer-range
    Range for the metallb load balancer.
    Default: 255.70-255.84
HELP
}

# process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -dorp|--docker-or-podman)     DORP="$2";                  shift;shift; ;;
    -i|--image)                   IMAGE="$2";                 shift;shift; ;;
    -n|--name)                    NAME="$2";                  shift;shift; ;;
    -lbr|--load-balancer-range)   LOAD_BALANCER_RANGE="$2";   shift;shift; ;;
    -h|--help)                    helpmsg;                    exit 1       ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

# abort on any error
set -e

# Find the kind executable
KIND_EXE=`which kind`
if [  -x "${KIND_EXE}" ]; then
  echo "Kind executable: ${KIND_EXE}"
else
  echo "Cannot find the kind executable. You must install it in your PATH. For details, see: https://kind.sigs.k8s.io/docs/user/quick-start"
  exit 1
fi

start_kind() {
  # Due to: https://github.com/kubernetes-sigs/kind/issues/1449#issuecomment-1612648982 we need two nodes.
  infomsg "Kind cluster to be created with name [${NAME}]"
  NODE_IMAGE_LINE=${IMAGE:+image: ${IMAGE}}
  cat <<EOF | kind create cluster --name "${NAME}" --config -
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
    ${NODE_IMAGE_LINE}
  - role: worker
    ${NODE_IMAGE_LINE}
EOF
}

config_metallb() {
  infomsg "Creating Kind LoadBalancer via MetalLB"

  kubectl apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.10/config/manifests/metallb-native.yaml

  local subnet
  subnet=$(${DORP} network inspect kind --format '{{(index .IPAM.Config 0).Subnet}}')

  kubectl rollout status deployment controller -n metallb-system

  local subnet_trimmed
  subnet_trimmed=$(echo ${subnet} | sed -E 's/([0-9]+\.[0-9]+)\.[0-9]+\..*/\1/')
  local first_ip
  first_ip="${subnet_trimmed}.$(echo "${LOAD_BALANCER_RANGE}" | cut -d '-' -f 1)"
  local last_ip
  last_ip="${subnet_trimmed}.$(echo "${LOAD_BALANCER_RANGE}" | cut -d '-' -f 2)"
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
}

start_kind
config_metallb

infomsg "Kind cluster '${NAME}' created successfully with metallb loadbalancer"
