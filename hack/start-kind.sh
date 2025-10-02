#!/bin/bash

##############################################################################
# start-kind.sh
#
# Starts up a kind instance with a metallb load balancer.
# For setting up the LB, see: https://kind.sigs.k8s.io/docs/user/loadbalancer
#
# You can optionally use an external image registry with the kind instance
# (see https://kind.sigs.k8s.io/docs/user/local-registry/)
##############################################################################

NAME="kiali-testing"
DORP="docker"
ENABLE_KEYCLOAK="false"
ENABLE_HYDRA="false"
ENABLE_IMAGE_REGISTRY="false"
IMAGE=""
LOAD_BALANCER_RANGE="255.70-255.84"
KEYCLOAK_ISSUER_URI=""
KEYCLOAK_CERTS_DIR=""
HYDRA_ISSUER_URI=""
HYDRA_CERTS_DIR=""
IP_FAMILY="ipv4" # or "dual"

# for now these are fixed unless you override with env vars (no cmdline opts)
KIND_IMAGE_REGISTRY_NAME="${KIND_IMAGE_REGISTRY_NAME:-kind-registry}"
KIND_IMAGE_REGISTRY_PORT="${KIND_IMAGE_REGISTRY_PORT:-5000}"

infomsg() {
  echo "[INFO] ${1}"
}

helpmsg() {
  cat <<HELP
This script will create a single node KinD cluster with metallb enabled for testing Kiali against a real environment.
Options:
-dorp|--docker-or-podman <docker|podman>
    What to use when running kind.
    NOTE: Today only docker works. If you specify podman, it will be ignored and docker will be forced.
    Default: docker
-eh|--enable-hydra <true|false>
    If true, the KinD cluster will be configured to use Hydra for authentication.
    Cannot be used with --enable-keycloak.
    Default: false
-ek|--enable-keycloak <true|false>
    If true, the KinD cluster will be configured to use Keycloak for authentication.
    Cannot be used with --enable-hydra.
    Default: false
-eir|--enable-image-registry <true|false>
    If true, an external image registry will be started and will be used by the KinD cluster.
    When enabled, you can push/pull images using the normal docker/podman push/pull commands
    to manage images that are accessible to the KinD cluster.
    Default: false
-hcd|--hydra-certs-dir <directory>
    Directory where the Hydra certificates are stored.
-hiu|--hydra-issuer-uri <uri>
    The Hydra issuer URI.
-i|--image
    Image of the kind cluster. Defaults to latest kind image if not specified.
-if|--ip-family
    Can be "ipv4" if only IPv4 network is enabled, or "dual" if dual-stack is supported. Default: ipv4
-kcd|--keycloak-certs-dir <directory>
    Directory where the Keycloak certificates are stored.
-kiu|--keycloak-issuer-uri <uri>
    The Keycloak issuer URI.
-lbr|--load-balancer-range
    Range for the metallb load balancer.
    Default: 255.70-255.84
-n|--name
    Name of the kind cluster.
    Default: kiali-testing
HELP
}

# process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -dorp|--docker-or-podman)     DORP="$2";                  shift;shift; ;;
    -eh|--enable-hydra)           ENABLE_HYDRA="$2";          shift;shift; ;;
    -ek|--enable-keycloak)        ENABLE_KEYCLOAK="$2";       shift;shift; ;;
    -eir|--enable-image-registry) ENABLE_IMAGE_REGISTRY="$2"; shift;shift; ;;
    -hcd|--hydra-certs-dir)       HYDRA_CERTS_DIR="$2";       shift;shift; ;;
    -hiu|--hydra-issuer-uri)      HYDRA_ISSUER_URI="$2";      shift;shift; ;;
    -i|--image)                   IMAGE="$2";                 shift;shift; ;;
    -if|--ip-family)              IP_FAMILY="$2";             shift;shift; ;;
    -kcd|--keycloak-certs-dir)    KEYCLOAK_CERTS_DIR="$2";    shift;shift; ;;
    -kiu|--keycloak-issuer-uri)   KEYCLOAK_ISSUER_URI="$2";   shift;shift; ;;
    -lbr|--load-balancer-range)   LOAD_BALANCER_RANGE="$2";   shift;shift; ;;
    -n|--name)                    NAME="$2";                  shift;shift; ;;
    -h|--help)                    helpmsg;                    exit 1       ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

# Validate that only one of Keycloak or Hydra is enabled
if [ "${ENABLE_KEYCLOAK}" == "true" ] && [ "${ENABLE_HYDRA}" == "true" ]; then
  echo "ERROR: Cannot enable both Keycloak and Hydra. Please choose only one."
  exit 1
fi

# TODO KinD doesn't play nice with podman today. Force docker.
if [ "${DORP}" != "docker" ]; then
  DORP="docker"
  infomsg "This script will not work with 'podman' - forcing the use of 'docker'"
  #export KIND_EXPERIMENTAL_PROVIDER=podman
fi

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

# Find the kubectl executable
KUBECTL_EXE=`which kubectl`
if [  -x "${KUBECTL_EXE}" ]; then
  echo "Kubectl executable: ${KUBECTL_EXE}"
else
  echo "Cannot find the kubectl executable. You must install it in your PATH."
  exit 1
fi

start_image_registry_daemon() {
  # see: https://kind.sigs.k8s.io/docs/user/local-registry/
  if [ "${ENABLE_IMAGE_REGISTRY}" == "true" ]; then
    if [ "$(${DORP} inspect -f '{{.State.Running}}' ${KIND_IMAGE_REGISTRY_NAME} 2>/dev/null || true)" != "true" ]; then
      _disable_ipv6="0"
      if [ "${IP_FAMILY}" == "ipv4" ]; then
        _disable_ipv6="1"
      fi
      ${DORP} run --sysctl=net.ipv6.conf.all.disable_ipv6=${_disable_ipv6} -d --restart=always -p "127.0.0.1:${KIND_IMAGE_REGISTRY_PORT}:5000" --name "${KIND_IMAGE_REGISTRY_NAME}" --network bridge registry:2
      infomsg "An image registry daemon has started."
    else
      infomsg "An image registry daemon appears to already be running; this existing daemon will be used."
    fi
    infomsg "To kill this image registry daemon, run: ${DORP} kill ${KIND_IMAGE_REGISTRY_NAME} && ${DORP} rm ${KIND_IMAGE_REGISTRY_NAME}"
  else
    infomsg "No external image registry will be configured for use by the KinD instance."
    if [ "$(${DORP} inspect -f '{{.State.Running}}' ${KIND_IMAGE_REGISTRY_NAME} 2>/dev/null || true)" == "true" ]; then
      infomsg "An external image registry is running - it will be killed now."
      ${DORP} kill ${KIND_IMAGE_REGISTRY_NAME} && ${DORP} rm ${KIND_IMAGE_REGISTRY_NAME}
    fi
  fi
}

echo_image_registry_cluster_config() {
  # see: https://kind.sigs.k8s.io/docs/user/local-registry/
  if [ "${ENABLE_IMAGE_REGISTRY}" == "true" ]; then
    cat <<EOF
containerdConfigPatches:
- |-
  [plugins."io.containerd.grpc.v1.cri".registry]
    config_path = "/etc/containerd/certs.d"
EOF
  else
    echo
  fi
}

echo_keycloak_kubeadm_config() {
  # see: https://kind.sigs.k8s.io/docs/user/local-registry/
  if [ "${ENABLE_KEYCLOAK}" == "true" ]; then
    cat <<EOF
kubeadmConfigPatches:
- |-
  kind: ClusterConfiguration
  apiServer:
    extraArgs:
      oidc-client-id: kube
      oidc-issuer-url: ${KEYCLOAK_ISSUER_URI}
      oidc-groups-claim: groups
      oidc-username-prefix: "oidc:"
      oidc-groups-prefix: "oidc:"
      oidc-username-claim: preferred_username
      oidc-ca-file: /etc/ca-certificates/keycloak/root-ca.pem
EOF
  else
    echo
  fi
}

echo_keycloak_mount() {
  # see: https://kind.sigs.k8s.io/docs/user/local-registry/
  if [ "${ENABLE_KEYCLOAK}" == "true" ]; then
    cat <<EOF
    extraMounts:
    - hostPath: $KEYCLOAK_CERTS_DIR/root-ca.pem
      containerPath: /etc/ca-certificates/keycloak/root-ca.pem
      readOnly: true
EOF
  else
    echo
  fi
}

echo_hydra_kubeadm_config() {
  if [ "${ENABLE_HYDRA}" == "true" ]; then
    cat <<EOF
kubeadmConfigPatches:
- |-
  kind: ClusterConfiguration
  apiServer:
    extraArgs:
      oidc-client-id: kiali-app
      oidc-issuer-url: ${HYDRA_ISSUER_URI}
      oidc-groups-claim: groups
      oidc-username-claim: email
      oidc-ca-file: /etc/ca-certificates/hydra/hydra-ca.pem
EOF
  else
    echo
  fi
}

echo_hydra_mount() {
  if [ "${ENABLE_HYDRA}" == "true" ]; then
    cat <<EOF
    extraMounts:
    - hostPath: $HYDRA_CERTS_DIR/hydra-ca.pem
      containerPath: /etc/ca-certificates/hydra/hydra-ca.pem
      readOnly: true
EOF
  else
    echo
  fi
}

finish_image_registry_config() {
  # see: https://kind.sigs.k8s.io/docs/user/local-registry/
  if [ "${ENABLE_IMAGE_REGISTRY}" == "true" ]; then
    local reg_dir="/etc/containerd/certs.d/localhost:${KIND_IMAGE_REGISTRY_PORT}"
    for node in $(${KIND_EXE} get nodes --name "${NAME}"); do
      ${DORP} exec "${node}" mkdir -p "${reg_dir}"
      cat <<EOF1 | ${DORP} exec -i "${node}" cp /dev/stdin "${reg_dir}/hosts.toml"
[host."http://${KIND_IMAGE_REGISTRY_NAME}:5000"]
EOF1
    done

    if [ "$(${DORP} inspect -f='{{json .NetworkSettings.Networks.kind}}' ${KIND_IMAGE_REGISTRY_NAME})" = 'null' ]; then
      ${DORP} network connect "kind" ${KIND_IMAGE_REGISTRY_NAME}
    fi

    cat <<EOF2 | ${KUBECTL_EXE} apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
    host: "localhost:${KIND_IMAGE_REGISTRY_PORT}"
    help: "https://kind.sigs.k8s.io/docs/user/local-registry/"
EOF2
  fi
}

if [ "${ENABLE_KEYCLOAK}" == "true" ] && [ -z "${KEYCLOAK_CERTS_DIR}" ]; then
  echo "You must specify the directory where the Keycloak certs are stored with the -kcd|--keycloak-certs-dir option when keycloak is enabled."
  exit 1
fi

if [ "${ENABLE_HYDRA}" == "true" ] && [ -z "${HYDRA_CERTS_DIR}" ]; then
  echo "You must specify the directory where the Hydra certs are stored with the -hcd|--hydra-certs-dir option when Hydra is enabled."
  exit 1
fi

start_kind() {
  # Due to: https://github.com/kubernetes-sigs/kind/issues/1449#issuecomment-1612648982 we need two nodes.
  infomsg "Kind cluster to be created with name [${NAME}]"
  infomsg "networking.ipFamily will be set to [${IP_FAMILY}]"
  KIND_NODE_IMAGE=${IMAGE:+image: ${IMAGE}}
  cat <<EOF | ${KIND_EXE} create cluster --name "${NAME}" --config -
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  ipFamily: ${IP_FAMILY}
$(echo_keycloak_kubeadm_config)$(echo_hydra_kubeadm_config)
nodes:
  - role: control-plane
    ${KIND_NODE_IMAGE}
$(echo_keycloak_mount)$(echo_hydra_mount)
  - role: worker
    ${KIND_NODE_IMAGE}
$(echo_image_registry_cluster_config)
EOF
}

config_metallb() {
  infomsg "Creating Kind LoadBalancer via MetalLB"

  ${KUBECTL_EXE} apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.10/config/manifests/metallb-native.yaml

  local subnet
  # we always use docker today, but we'll leave this here just in case in the future Kind and podman play nice
  if [ "${DORP}" == "docker" ]; then
    # loop through all known subnets in the kind network and pick out the IPv4 subnet, ignoring any IPv6 that might be in the list
    local subnets_count="$(docker network inspect kind | jq '.[0].IPAM.Config | length')"
    infomsg "There are [$subnets_count] subnets in the kind network"
    for ((i=0; i<subnets_count; i++)); do
      subnet=$(docker network inspect kind --format '{{(index .IPAM.Config '$i').Subnet}}' 2> /dev/null)
      if [[ -n $subnet && $subnet != *:* && $subnet == *\.* ]]; then
        infomsg "Using subnet [$subnet]"
        break
      else
        infomsg "Ignoring subnet [$subnet]"
        subnet=""
      fi
    done
    if [ -z "$subnet" ]; then
      infomsg "No subnets found in the expected docker network list. Maybe this is a podman network - let's check"
      subnet=$(docker network inspect kind | jq -r '.[0].subnets[] | select(.subnet | test("^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+/")) | .subnet' 2>/dev/null)
    fi
  else
    subnet=$(podman network inspect kind | jq -r '.[0].subnets[] | select(.subnet | test("^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+/")) | .subnet' 2>/dev/null)
  fi

  if [ -z "$subnet" ]; then
    infomsg "There does not appear to be any IPv4 subnets configured"
    exit 1
  fi

  infomsg "Wait for MetalLB controller to be ready"
  ${KUBECTL_EXE} rollout status deployment controller -n metallb-system
  ${KUBECTL_EXE} rollout status daemonset speaker -n metallb-system

  local subnet_trimmed
  subnet_trimmed=$(echo ${subnet} | sed -E 's/([0-9]+\.[0-9]+)\.[0-9]+\..*/\1/')
  local first_ip
  first_ip="${subnet_trimmed}.$(echo "${LOAD_BALANCER_RANGE}" | cut -d '-' -f 1)"
  local last_ip
  last_ip="${subnet_trimmed}.$(echo "${LOAD_BALANCER_RANGE}" | cut -d '-' -f 2)"
  infomsg "LoadBalancer IP Address pool: ${first_ip}-${last_ip}"
  cat <<LBPOOL | ${KUBECTL_EXE} apply -f -
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  namespace: metallb-system
  name: config
spec:
  addresses:
  - ${first_ip}-${last_ip}
LBPOOL

  cat <<LBAD | ${KUBECTL_EXE} apply -f -
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  namespace: metallb-system
  name: l2config
spec:
  ipAddressPools:
  - config
LBAD
}

start_image_registry_daemon
start_kind
config_metallb
finish_image_registry_config

infomsg "Kind cluster '${NAME}' created successfully with metallb loadbalancer"
if [ "${ENABLE_IMAGE_REGISTRY}" == "true" ]; then
  infomsg "The Kind cluster's image registry is named [${KIND_IMAGE_REGISTRY_NAME}] and is accessible at [localhost:${KIND_IMAGE_REGISTRY_PORT}]"
fi
