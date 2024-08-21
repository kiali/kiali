#!/bin/bash

##############################################################################
# env.sh
#
# Configures the environment to prepare for multi-cluster installations.
# The proper way to use this script is to source it (source env.sh) from
# within other scripts.
#
# See: https://istio.io/latest/docs/tasks/security/cert-management/plugin-ca-cert/
#
# See --help for more details on options to this script.
#
##############################################################################

# If we have already been processed, skip everything
if [ "${HACK_ENV_DONE:-}" == "true" ]; then
  return 0
fi

set -u

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"

switch_cluster() {
  local context="${1}"
  local username="${2:-}"
  local password="${3:-}"
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    if ! ${CLIENT_EXE} login --username "${username}" --password "${password}" --server "${context}"; then
      echo "Failed to log into OpenShift cluster. url=[${context}]"
      exit 1
    fi
  else
    if ! ${CLIENT_EXE} config use-context "${context}"; then
      echo "Failed to switch to Kubernetes cluster. context=[${context}]"
      exit 1
    fi
  fi
}

#
# SET UP THE DEFAULTS FOR ALL SETTINGS
#

# CLIENT_EXE_NAME is going to either be "oc" or "kubectl"
# ISTIO_DIR is where the Istio download is installed and thus where the Istio tools are found.
CLIENT_EXE_NAME="kubectl"
ISTIO_DIR=""

# If the scripts need image registry client, this is it (docker or podman)
DORP="${DORP:-podman}"

# The namespace where Istio will be found - this namespace must be the same on both clusters
ISTIO_NAMESPACE="${ISTIO_NAMESPACE:-istio-system}"

# If you want to pull Istio images from a different image repository than what the hack script
# will tell Istio to pull from, then set that hub name here. If you set this to "default",
# the images will come from the repo that the Istio distro pulls from.
# Suffice it to say, this setting is needed to avoid docker.io (and its throttling behavior) for
# Istio production releases but allows you to run with Istio dev builds (set this to "default" for dev builds).
ISTIO_HUB=""

# If you want to override the tag that istioctl will use for the container images it pulls, set this.
# (note: needed this because openshift requires a dev build of istioctl but we still want the released images.
# See: https://github.com/kiali/kiali/pull/3713#issuecomment-809920379)
ISTIO_TAG=""

# Certs directory where you want the generates cert files to be written
CERTS_DIR="/tmp/istio-multicluster-certs"

# The default Mesh and Network identifiers
MESH_ID="mesh-hack"
NETWORK1_ID="network-east"
NETWORK2_ID="network-west"

# Deploy a single kiali or a kiali per cluster
SINGLE_KIALI="${SINGLE_KIALI:-true}"

# Deploy just in one cluster
SINGLE_CLUSTER="${SINGLE_CLUSTER:-false}"

# Use groups for OpenId authorization (single cluster)
AUTH_GROUPS="${AUTH_GROUPS:-}"

# Create kiali remote secrets so kiali can access the different clusters
# When left empty, this will be true if SINGLE_KIALI is true or false otherwise.
KIALI_CREATE_REMOTE_CLUSTER_SECRETS="${KIALI_CREATE_REMOTE_CLUSTER_SECRETS:-}"

# If a gateway is required to cross the networks, set this to true and one will be created
# See: https://istio.io/latest/docs/setup/install/multicluster/multi-primary_multi-network/
CROSSNETWORK_GATEWAY_REQUIRED="true"

# Under some conditions, manually configuring the mesh network will be required.
MANUAL_MESH_NETWORK_CONFIG=""

# The names of each cluster
CLUSTER1_NAME="${CLUSTER1_NAME:-east}"
CLUSTER2_NAME="${CLUSTER2_NAME:-west}"

# If using Kubernetes, these are the kube context names used to connect to the clusters
# If using OpenShift, these are the URLs to the API login server (e.g. "https://api.server-name.com:6443")
CLUSTER1_CONTEXT="${CLUSTER1_CONTEXT:-}"
CLUSTER2_CONTEXT="${CLUSTER2_CONTEXT:-}"

# if using OpenShift, these are the credentials needed to log on to the clusters
CLUSTER1_USER="${CLUSTER1_USER:-kiali}"
CLUSTER1_PASS="${CLUSTER1_PASS:-kiali}"
CLUSTER2_USER="${CLUSTER2_USER:-kiali}"
CLUSTER2_PASS="${CLUSTER2_PASS:-kiali}"

# Should Kiali be installed? This installs the last release of Kiali via the kiali-server helm chart.
# If you want another version, you must disable this and install what you want manually.
KIALI_ENABLED="${KIALI_ENABLED:-true}"

# When installing Kiali, this will determine if a released image is used or if a local dev image is to be pushed and used.
KIALI_USE_DEV_IMAGE="${KIALI_USE_DEV_IMAGE:-false}"

# Sets the auth strategy for kiali. If "openid" is used then keycloak is provisioned for the auth provider.
KIALI_AUTH_STRATEGY="${KIALI_AUTH_STRATEGY:-openid}"

# Should Bookinfo demo be installed? If so, where?
BOOKINFO_ENABLED="true"
BOOKINFO_NAMESPACE="bookinfo"

# If true and client exe is kubectl, then two minikube instances will be installed/uninstalled by these scripts
MANAGE_MINIKUBE="${MANAGE_MINIKUBE:-true}"

# If true and client exe is kubectl, then two kind instances will be installed/uninstalled by these scripts
MANAGE_KIND="${MANAGE_KIND:-false}"

# Minikube options - these are ignored if MANAGE_MINIKUBE is false
MINIKUBE_DRIVER="kvm2"
MINIKUBE_CPU=""
MINIKUBE_DISK=""
MINIKUBE_MEMORY=""

# Keycloak settings.
KEYCLOAK_ADDRESS="${KEYCLOAK_ADDRESS:-}"
KEYCLOAK_DB_PASSWORD="${KEYCLOAK_DB_PASSWORD:-keycloak-password}"
KEYCLOAK_KUBE_CLIENT_SECRET="${KEYCLOAK_KUBE_CLIENT_SECRET:-kube-client-secret}"
KIALI_USER_PASSWORD="${KIALI_USER_PASSWORD:-kiali}"

# Some settings that can be configured when helm installing the two Kiali instances.
KIALI1_WEB_FQDN="${KIALI1_WEB_FQDN:-}"
KIALI1_WEB_SCHEMA="${KIALI1_WEB_SCHEMA:-}"
KIALI2_WEB_FQDN="${KIALI2_WEB_FQDN:-}"
KIALI2_WEB_SCHEMA="${KIALI2_WEB_SCHEMA:-}"

KIALI_BUILD_DEV_IMAGE="${KIALI_BUILD_DEV_IMAGE:-false}"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -be|--bookinfo-enabled)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && echo "--bookinfo-enabled must be 'true' or 'false'" && exit 1
      BOOKINFO_ENABLED="$2"
      shift;shift
      ;;
    -bn|--bookinfo-namespace)
      BOOKINFO_NAMESPACE="$2"
      shift;shift
      ;;
    -c|--client-exe)
      CLIENT_EXE_NAME="$2"
      shift;shift
      ;;
    -c1c|--cluster1-context)
      CLUSTER1_CONTEXT="$2"
      shift;shift
      ;;
    -c1n|--cluster1-name)
      CLUSTER1_NAME="$2"
      shift;shift
      ;;
    -c1p|--cluster1-password)
      CLUSTER1_PASS="$2"
      shift;shift
      ;;
    -c1u|--cluster1-username)
      CLUSTER1_USER="$2"
      shift;shift
      ;;
    -c2c|--cluster2-context)
      CLUSTER2_CONTEXT="$2"
      shift;shift
      ;;
    -c2n|--cluster2-name)
      CLUSTER2_NAME="$2"
      shift;shift
      ;;
    -c2p|--cluster2-password)
      CLUSTER2_PASS="$2"
      shift;shift
      ;;
    -c2u|--cluster2-username)
      CLUSTER2_USER="$2"
      shift;shift
      ;;
    -cd|--certs-dir)
      CERTS_DIR="$2"
      shift;shift
      ;;
    -dorp|--docker-or-podman)
      [ "${2:-}" != "docker" -a "${2:-}" != "podman" ] && echo "-dorp must be 'docker' or 'podman'" && exit 1
      DORP="$2"
      shift;shift
      ;;
    -ag|--auth-groups)
      AUTH_GROUPS="$2"
      shift;shift
      ;;
    -gr|--gateway-required)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && echo "--gateway-required must be 'true' or 'false'" && exit 1
      CROSSNETWORK_GATEWAY_REQUIRED="$2"
      shift;shift
      ;;
    -id|--istio-dir)
      ISTIO_DIR="$2"
      shift;shift
      ;;
    -in|--istio-namespace)
      ISTIO_NAMESPACE="$2"
      shift;shift
      ;;
    -ih|--istio-hub)
      ISTIO_HUB="$2"
      shift;shift
      ;;
    -it|--istio-tag)
      ISTIO_TAG="$2"
      shift;shift
      ;;
    -ka|--keycloak-address)
      KEYCLOAK_ADDRESS="$2"
      shift;shift
      ;;
    -kas|--kiali-auth-strategy)
      [ "${2:-}" != "anonymous" -a "${2:-}" != "openid" -a "${2:-}" != "openshift" ] && echo "--kiali-auth-strategy must be 'anonymous', 'openid', or 'openshift'" && exit 1
      KIALI_AUTH_STRATEGY="$2"
      shift;shift
      ;;
    -kbdi|--kiali-build-dev-image)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && echo "--kiali-build-dev-image must be 'true' or 'false'" && exit 1
      KIALI_BUILD_DEV_IMAGE="$2"
      shift;shift
      ;;
    -kcrcs|--kiali-create-remote-cluster-secrets)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && echo "--kiali-create-remote-cluster-secrets must be 'true' or 'false'" && exit 1
      KIALI_CREATE_REMOTE_CLUSTER_SECRETS="$2"
      shift;shift
      ;;
    -ke|--kiali-enabled)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && echo "--kiali-enabled must be 'true' or 'false'" && exit 1
      KIALI_ENABLED="$2"
      shift;shift
      ;;
    -kshc|--kiali-server-helm-charts)
      KIALI_SERVER_HELM_CHARTS="$2"
      shift;shift
      ;;
    -kudi|--kiali-use-dev-image)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && echo "--kiali-use-dev-image must be 'true' or 'false'" && exit 1
      KIALI_USE_DEV_IMAGE="$2"
      shift;shift
      ;;
    -k1wf|--kiali1-web-fqdn)
      KIALI1_WEB_FQDN="$2"
      shift;shift
      ;;
    -k1ws|--kiali1-web-schema)
      KIALI1_WEB_SCHEMA="$2"
      shift;shift
      ;;
    -k2wf|--kiali2-web-fqdn)
      KIALI2_WEB_FQDN="$2"
      shift;shift
      ;;
    -k2ws|--kiali2-web-schema)
      KIALI2_WEB_SCHEMA="$2"
      shift;shift
      ;;
    -kdp|--keycloak-db-password)
      KEYCLOAK_DB_PASSWORD="$2"
      shift;shift
      ;;
    -kcs|--keycloak-client-secret)
      KEYCLOAK_KUBE_CLIENT_SECRET="$2"
      shift;shift
      ;;
    -kup|--kiali-user-password)
      KIALI_USER_PASSWORD="$2"
      shift;shift
      ;;
    -mcpu|--minikube-cpu)
      MINIKUBE_CPU="$2"
      shift;shift
      ;;
    -md|--minikube-driver)
      MINIKUBE_DRIVER="$2"
      shift;shift
      ;;
    -mdisk|--minikube-disk)
      MINIKUBE_DISK="$2"
      shift;shift
      ;;
    -mi|--mesh-id)
      MESH_ID="$2"
      shift;shift
      ;;
    -mk|--manage-kind)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && echo "--manage-kind must be 'true' or 'false'" && exit 1
      MANAGE_KIND="$2"
      [ "${MANAGE_KIND}" == "true" ] && MANAGE_MINIKUBE="false" # cannot manage minikube if managing kind
      shift;shift
      ;;
    -mm|--manage-minikube)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && echo "--manage-minikube must be 'true' or 'false'" && exit 1
      MANAGE_MINIKUBE="$2"
      [ "${MANAGE_MINIKUBE}" == "true" ] && MANAGE_KIND="false" # cannot manage kind if managing minikube
      shift;shift
      ;;
    -mmem|--minikube-memory)
      MINIKUBE_MEMORY="$2"
      shift;shift
      ;;
    -mnc|--manual-network-config)
      [ "${2:-}" != "true" -a "${2:-}" != "false" ] && echo "--manual-network-config must be 'true' or 'false'" && exit 1
      MANUAL_MESH_NETWORK_CONFIG="$2"
      shift;shift
      ;;
    -n1|--network1)
      NETWORK1_ID="$2"
      shift;shift
      ;;
    -n2|--network2)
      NETWORK2_ID="$2"
      shift;shift
      ;;
    -sk|--single-cluster)
      SINGLE_CLUSTER="$2"
      shift;shift
      ;;
    -sk|--single-kiali)
      SINGLE_KIALI="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -be|--bookinfo-enabled <bool>: If true, install the bookinfo demo spread across the two clusters (Default: true)
  -bn|--bookinfo-namespace: If the bookinfo demo will be installed, this is its namespace (Default: bookinfo)
  -c|--client-exe <name>: Cluster client executable name - valid values are "kubectl" or "oc". If you use
                          kubectl, it is assumed minikube will be used and the cluster names are profile names.
  -c1c|--cluster1-context <name>: If cluster1 is Kubernetes, this is the context used to connect to the cluster
  -c1n|--cluster1-name <name>: The name of cluster1 (Default: east)
  -c1p|--cluster1-password <name>: If cluster1 is OpenShift, this is the password used to log in (Default: kiali)
  -c1u|--cluster1-username <name>: If cluster1 is OpenShift, this is the username used to log in (Default: kiali)
  -c2c|--cluster2-context <name>: If cluster2 is Kubernetes, this is the context used to connect to the cluster
  -c2n|--cluster2-name <name>: The name of cluster2 (Default: west)
  -c2p|--cluster2-password <name>: If cluster2 is OpenShift, this is the password used to log in (Default: kiali)
  -c2u|--cluster2-username <name>: If cluster2 is OpenShift, this is the username used to log in (Default: kiali)
  -cd|--certs-dir <dir>: Directory where the keycloak certs are located. (Default: /tmp/istio-multicluster-certs)
  -dorp|--docker-or-podman <docker|podman>: What image registry client to use (Default: podman)
  -ag|--auth-groups <string>: If using Group for authentication, a comma separated groups list. Just for OpenID.
  -gr|--gateway-required <bool>: If a gateway is required to cross between networks, set this to true
  -id|--istio-dir <dir>: Where Istio has already been downloaded. If not found, this script aborts.
  -in|--istio-namespace <name>: Where the Istio control plane is installed (default: istio-system).
  -ih|--istio-hub <hub>: If you want to override the image hub used by istioctl (where the images are found),
                         set this to the hub name, or "default" to use the default image locations.
  -it|--istio-tag <tag>: If you want to override the image tag used by istioctl, set this to the tag name.
  -kas|--kiali-auth-strategy <openid|openshift|anonymous>: The authentication strategy to use for Kiali (Default: openid)
  -kbdi|--kiali-build-dev-image <bool>: If "true" the local dev image of Kiali will be built and used in the Kiali deployment.
                                        Will be ignored if --kiali-enabled is 'false'. (Default: false)
  -kcrcs|--kiali-create-remote-cluster-secrets <bool>: Create remote cluster secrets for kiali remote cluster access.
  -ke|--kiali-enabled <bool>: If "true" the latest release of Kiali will be installed in both clusters. If you want
                              a different version of Kiali installed, you must set this to "false" and install it yourself.
                              (Default: true)
  -kshc|--kiali-server-helm-charts <path>: If specified, must be the path to a Kiali server helm charts tarball. If not
                                           specified, the latest published helm charts is used. (Default: kiali-server)
  -kudi|--kiali-use-dev-image: If "true" the local dev image of Kiali will be pushed and used in the Kiali deployment.
                               The local dev image must be tagged as "quay.io/kiali/kiali:dev" prior to running this script;
                               that will be the image pushed to the clusters. You can "make container-build-kiali" to build it.
                               Will be ignored if --kiali-enabled is 'false'. (Default: false)
                               CURRENTLY ONLY SUPPORTED WITH MINIKUBE!
  -k1wf|--kiali1-web-fqdn <fqdn>: If specified, this will be the #1 Kaili setting for spec.server.web_fqdn.
  -k1ws|--kiali1-web-schema <schema>: If specified, this will be the #1 Kaili setting for spec.server.web_schema.
  -k2wf|--kiali2-web-fqdn <fqdn>: If specified, this will be the #2 Kaili setting for spec.server.web_fqdn.
  -k2ws|--kiali2-web-schema <schema>: If specified, this will be the #2 Kaili setting for spec.server.web_schema.
  -ka|--keycloak-address <ip or host name>: Address of the keycloak idp.
  -kcs|--keycloak-client-secret <password>: Client secret for the openshift kube client in keycloak.
  -kdp|--keycloak-db-password <password>: Password for the keycloak database.
  -kup|--kiali-user-password <password>: Password for the kiali user in keycloak.
  -mcpu|--minikube-cpu <cpu count>: Number of CPUs to give to each minikube cluster
  -md|--minikube-driver <name>: The driver used by minikube (e.g. virtualbox, kvm2) (Default: kvm2)
  -mdisk|--minikube-disk <space>: Amount of disk space to give to each minikube cluster
  -mi|--mesh-id <id>: When Istio is installed, it will be part of the mesh with this given name. (Default: mesh-default)
  -mk|--manage-kind <bool>: If "true" and if --client-exe is kubectl, two kind instances will be managed
  -mm|--manage-minikube <bool>: If "true" and if --client-exe is kubectl, two minikube instances will be managed
  -mmem|--minikube-memory <mem>: Amount of memory to give to each minikube cluster
  -mnc|--manual-network-config <bool>: If true, manually configure mesh network. False tells Istio to try to auto-discover things.
                                       (Default: true if on OpenShift, false otherwise)
  -n1|--network1 <id>: When Istio is installed in cluster 1, it will be part of the network with this given name. (Default: network-default)
  -n2|--network2 <id>: When Istio is installed in cluster 2, it will be part of the network with this given name.
                       If this is left as empty string, it will be the same as --network1. (Default: "")
  -sc|--single-cluster <bool>: If "true", perform action just in CLUSTER 1. (Default: false)
  -sk|--single-kiali <bool>: If "true", a single kiali will be deployed for the whole mesh. (Default: true)
  -h|--help: this message
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

KEYCLOAK_CERTS_DIR=${CERTS_DIR}/keycloak

if [ "${ISTIO_DIR}" == "" ]; then
  # Go to the main output directory and try to find an Istio there.
  SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
  OUTPUT_DIR="${OUTPUT_DIR:-${SCRIPT_DIR}/../../../_output}"
  ALL_ISTIOS=$(ls -dt1 ${OUTPUT_DIR}/istio-*)
  if [ "$?" != "0" ]; then
    ${OUTPUT_DIR}/../hack/istio/download-istio.sh
    if [ "$?" != "0" ]; then
      echo "ERROR: You do not have Istio installed and it cannot be downloaded"
      exit 1
    fi
  fi
  # use the Istio release that was last downloaded (that's the -t option to ls)
  ISTIO_DIR=$(ls -dt1 ${OUTPUT_DIR}/istio-* | head -n1)
fi

if [ ! -d "${ISTIO_DIR}" ]; then
   echo "ERROR: Istio cannot be found at: ${ISTIO_DIR}"
   exit 1
fi

echo "Istio is found here: ${ISTIO_DIR}"

ISTIOCTL="${ISTIO_DIR}/bin/istioctl"
if [ -x "${ISTIOCTL}" ]; then
  echo "istioctl is found here: ${ISTIOCTL}"
  ${ISTIOCTL} version
else
  echo "ERROR: istioctl is NOT found at ${ISTIOCTL}"
  exit 1
fi

CERT_MAKEFILE="${ISTIO_DIR}/tools/certs/Makefile.selfsigned.mk"
if [ -f "${CERT_MAKEFILE}" ]; then
  echo "Makefile is found here: ${CERT_MAKEFILE}"
else
  echo "ERROR: Makefile is NOT found at ${CERT_MAKEFILE}"
  exit 1
fi

CLIENT_EXE=`which ${CLIENT_EXE_NAME}`
if [ "$?" = "0" ]; then
  echo "The cluster client executable is found here: ${CLIENT_EXE}"
else
  echo "You must install the cluster client ${CLIENT_EXE_NAME} in your PATH before you can continue"
  exit 1
fi

# Are we on OpenShift or Kubernetes - just use the name of the exe for a very simply way to guess
# If you want to explicitly use Kubernetes or OpenShift and you have both clients in PATH,
# then tell the script which one you want to use via the -c option.
if [[ "$CLIENT_EXE" = *"oc" ]]; then
  IS_OPENSHIFT="true"
  echo "Cluster type = OpenShift"
else
  IS_OPENSHIFT="false"
  echo "Cluster type = Kubernetes"
fi

if [ "${IS_OPENSHIFT}" == "true" ]; then
  if [ -z "${CLUSTER1_CONTEXT}" ]; then
    echo "Cluster 1 context is not specified (--cluster1-context)"
    echo "If OpenShift, it should be the api login server URL. If Kubernetes, it should be the kube context."
    exit 1
  fi
  if [ -z "${CLUSTER2_CONTEXT}" ]; then
    echo "Cluster 2 context is not specified (--cluster2-context)"
    echo "If OpenShift, it should be the api login server URL. If Kubernetes, it should be the kube context."
    exit 1
  fi

  # we do not manage minikube or kind when using OpenShift
  MANAGE_MINIKUBE="false"
  MANAGE_KIND="false"

  # By default, we manually configure the mesh network when using OpenShift
  if [ -z "${MANUAL_MESH_NETWORK_CONFIG}" ]; then
    MANUAL_MESH_NETWORK_CONFIG="true"
  fi
else
  if [ "${MANAGE_MINIKUBE}" == "true" -a "${MANAGE_KIND}" == "true" ]; then
    echo "ERROR! Cannot manage both minikube and kind - pick one"
    exit 1
  fi

  # when on Kubenetes (minikube or kind) assume the context name is the same as the cluster name
  # If we know we are on kind, the context names are "kind-<name>"
  if [ -z "${CLUSTER1_CONTEXT}" ]; then
    if [ "${MANAGE_KIND}" == "true" ]; then
      CLUSTER1_CONTEXT="kind-${CLUSTER1_NAME}"
    else
      CLUSTER1_CONTEXT="${CLUSTER1_NAME}"
    fi
  fi
  if [ -z "${CLUSTER2_CONTEXT}" ]; then
    if [ "${MANAGE_KIND}" == "true" ]; then
      CLUSTER2_CONTEXT="kind-${CLUSTER2_NAME}"
    else
      CLUSTER2_CONTEXT="${CLUSTER2_NAME}"
    fi
  fi

  # By default, we do not manually configure the mesh network when using Kubernetes (minikube or kind)
  if [ -z "${MANUAL_MESH_NETWORK_CONFIG}" ]; then
    MANUAL_MESH_NETWORK_CONFIG="false"
  fi
fi

# If network2 is unspecified, assume it is the same as network1
if [ -z "${NETWORK2_ID}" ]; then
  NETWORK2_ID="${NETWORK1_ID}"
fi

# If not told explicitly to create remote cluster secrets, only do so if SINGLE_KIALI is true.
# We want the secrets by default if only installing one Kiali since presumably it needs access to the remote cluster.
if [ -z "${KIALI_CREATE_REMOTE_CLUSTER_SECRETS}" ]; then
  KIALI_CREATE_REMOTE_CLUSTER_SECRETS="${SINGLE_KIALI}"
fi

if [ "${KIALI_USE_DEV_IMAGE}" == "true" ]; then
  if [ -z "${KIALI_SERVER_HELM_CHARTS:-}" ]; then
    echo "ERROR: You must specify the Kiali Server Helm Charts (--kiali-server-helm-charts) tarball to use when using a dev image"
    exit 1
  else
    # Used by the Kiali deployment functions, this declares what Kiali Server Helm Charts to use.
    # The user should set this to a tarball if a different helm chart should be used.
    # e.g. /source/helm-charts/_output/charts/kiali-server-1.64.0-SNAPSHOT.tgz
    KIALI_SERVER_HELM_CHARTS="${KIALI_SERVER_HELM_CHARTS:-kiali-server}"
  fi
fi

# Export all variables so child scripts pick them up
export BOOKINFO_ENABLED \
       BOOKINFO_NAMESPACE \
       CERTS_DIR \
       CLIENT_EXE_NAME \
       CLUSTER1_CONTEXT \
       CLUSTER1_NAME \
       CLUSTER1_PASS \
       CLUSTER1_USER \
       CLUSTER2_CONTEXT \
       CLUSTER2_NAME \
       CLUSTER2_PASS \
       CLUSTER2_USER \
       CROSSNETWORK_GATEWAY_REQUIRED \
       DORP \
       AUTH_GROUPS \
       IS_OPENSHIFT \
       ISTIO_DIR \
       ISTIO_NAMESPACE \
       ISTIO_HUB \
       ISTIO_TAG \
       KIALI_AUTH_STRATEGY \
       KIALI_BUILD_DEV_IMAGE \
       KIALI_CREATE_REMOTE_CLUSTER_SECRETS \
       KIALI_ENABLED \
       KIALI_USE_DEV_IMAGE \
       KEYCLOAK_CERTS_DIR \
       MANAGE_KIND \
       MANAGE_MINIKUBE \
       MANUAL_MESH_NETWORK_CONFIG \
       MINIKUBE_CPU \
       MINIKUBE_DISK \
       MINIKUBE_DRIVER \
       MINIKUBE_MEMORY \
       MESH_ID \
       NETWORK1_ID \
       NETWORK2_ID \
       SINGLE_KIALI \
       SINGLE_CLUSTER

cat <<EOM
=== SETTINGS ===
BOOKINFO_ENABLED=$BOOKINFO_ENABLED
BOOKINFO_NAMESPACE=$BOOKINFO_NAMESPACE
CERTS_DIR=$CERTS_DIR
CLIENT_EXE_NAME=$CLIENT_EXE_NAME
CLUSTER1_CONTEXT=$CLUSTER1_CONTEXT
CLUSTER1_NAME=$CLUSTER1_NAME
CLUSTER1_PASS=$CLUSTER1_PASS
CLUSTER1_USER=$CLUSTER1_USER
CLUSTER2_CONTEXT=$CLUSTER2_CONTEXT
CLUSTER2_NAME=$CLUSTER2_NAME
CLUSTER2_PASS=$CLUSTER2_PASS
CLUSTER2_USER=$CLUSTER2_USER
CROSSNETWORK_GATEWAY_REQUIRED=$CROSSNETWORK_GATEWAY_REQUIRED
DORP=$DORP
IS_OPENSHIFT=$IS_OPENSHIFT
ISTIO_DIR=$ISTIO_DIR
ISTIO_NAMESPACE=$ISTIO_NAMESPACE
ISTIO_HUB=$ISTIO_HUB
ISTIO_TAG=$ISTIO_TAG
KEYCLOAK_CERTS_DIR=$KEYCLOAK_CERTS_DIR
KIALI_AUTH_STRATEGY=$KIALI_AUTH_STRATEGY
KIALI_BUILD_DEV_IMAGE=$KIALI_BUILD_DEV_IMAGE
KIALI_CREATE_REMOTE_CLUSTER_SECRETS=$KIALI_CREATE_REMOTE_CLUSTER_SECRETS
KIALI_ENABLED=$KIALI_ENABLED
KIALI_SERVER_HELM_CHARTS=$KIALI_SERVER_HELM_CHARTS
KIALI_USE_DEV_IMAGE=$KIALI_USE_DEV_IMAGE
KIALI1_WEB_FQDN=$KIALI1_WEB_FQDN
KIALI1_WEB_SCHEMA=$KIALI1_WEB_SCHEMA
KIALI2_WEB_FQDN=$KIALI2_WEB_FQDN
KIALI2_WEB_SCHEMA=$KIALI2_WEB_SCHEMA
MANAGE_KIND=$MANAGE_KIND
MANAGE_MINIKUBE=$MANAGE_MINIKUBE
MANUAL_MESH_NETWORK_CONFIG=$MANUAL_MESH_NETWORK_CONFIG
MINIKUBE_CPU=$MINIKUBE_CPU
MINIKUBE_DISK=$MINIKUBE_DISK
MINIKUBE_DRIVER=$MINIKUBE_DRIVER
MINIKUBE_MEMORY=$MINIKUBE_MEMORY
MESH_ID=$MESH_ID
NETWORK1_ID=$NETWORK1_ID
NETWORK2_ID=$NETWORK2_ID
SINGLE_CLUSTER=$SINGLE_CLUSTER
SINGLE_KIALI=$SINGLE_KIALI
AUTH_GROUPS=$AUTH_GROUPS
=== SETTINGS ===
EOM

export HACK_ENV_DONE="true"
