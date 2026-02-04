#!/bin/bash

##############################################################################
# install-istio-via-istioctl
#
# Installs the Istio into your cluster (either Kubernetes or OpenShift)
# using istioctl.
#
# If you do not yet have it, this script will download a copy of Istio.
#
# See --help for more details on options to this script.
#
##############################################################################

# ISTIO_DIR is where the Istio download is installed and thus where the istioctl binary is found.
# CLIENT_EXE_NAME must be either "oc" or "kubectl"
ADDONS="prometheus grafana jaeger"
CLIENT_EXE_NAME="oc"
CLIENT_EXE=""
CLUSTER_NAME=""
CONFIG_PROFILE="" # see "istioctl profile list" for valid values. See: https://istio.io/docs/setup/additional-setup/config-profiles/
DELETE_ISTIO="false"
DISABLE_IPV6="true"
ENABLE_NATIVE_SIDECARS="false"
PURGE_UNINSTALL="true"
ISTIOCTL=
ISTIO_DIR=
ISTIO_EGRESSGATEWAY_ENABLED="true"
ISTIO_INGRESSGATEWAY_ENABLED="true"
K8S_GATEWAY_API_ENABLED="false"
K8S_GATEWAY_API_VERSION=""
K8S_GATEWAY_API_IE_VERSION=""
ISTIO_VERSION=""
MESH_ID=""
MTLS="true"
NAMESPACE="istio-system"
NETWORK=""
REDUCE_RESOURCES="false"
REQUIRE_SCC="false"
REVISION=""
IMAGE_HUB="gcr.io/istio-release"
IMAGE_TAG="default"

# SPIRE configuration
SPIRE_ENABLED="false"
SPIRE_TRUST_DOMAIN="example.org"
SPIRE_NAMESPACE="spire"

# Script directory
SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -a|--addons)
      ADDONS="$2"
      shift;shift
      ;;
    -c|--client-exe)
      CLIENT_EXE_NAME="$2"
      shift;shift
      ;;
    -cep|--client-exe-path)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -cn|--cluster-name)
      CLUSTER_NAME="$2"
      shift;shift
      ;;
    -cp|--config-profile)
      CONFIG_PROFILE="$2"
      shift;shift
      ;;
    -di|--delete-istio)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        DELETE_ISTIO="$2"
      else
        echo "ERROR: The --delete-istio flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -d6|--disable-ipv6)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        DISABLE_IPV6="$2"
      else
        echo "ERROR: The --disable-ipv6 flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -pu|--purge-uninstall)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        PURGE_UNINSTALL="$2"
      else
        echo "ERROR: The --purge-uninstall flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -ic|--istioctl)
      ISTIOCTL="$2"
      shift;shift
      ;;
    -id|--istio-dir)
      ISTIO_DIR="$2"
      shift;shift
      ;;
    -iee|--istio-egressgateway-enabled)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        ISTIO_EGRESSGATEWAY_ENABLED="$2"
      else
        echo "ERROR: The --istio-egressgateway-enabled flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -iie|--istio-ingressgateway-enabled)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        ISTIO_INGRESSGATEWAY_ENABLED="$2"
      else
        echo "ERROR: The --istio-ingressgateway-enabled flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -gae|--k8s-gateway-api-enabled)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        K8S_GATEWAY_API_ENABLED="$2"
      else
        echo "ERROR: The --k8s-gateway-api-enabled flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -gav|--k8s-gateway-api-version)
      K8S_GATEWAY_API_VERSION="$2"
      shift;shift
      ;;
    -gaiev|--k8s-gateway-api-ie-version)
      K8S_GATEWAY_API_IE_VERSION="$2"
      shift;shift
      ;;
    -iv|--istio-version)
      ISTIO_VERSION="$2"
      shift;shift
      ;;
    -ih|--image-hub)
      IMAGE_HUB="$2"
      shift;shift
      ;;
    -ir|--istio-revision)
      REVISION="$2"
      shift;shift
      ;;
    -it|--image-tag)
      IMAGE_TAG="$2"
      shift;shift
      ;;
    -mid|--mesh-id)
      MESH_ID="$2"
      shift;shift
      ;;
    -m|--mtls)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        MTLS="$2"
      else
        echo "ERROR: The --mtls flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -n|--namespace)
      NAMESPACE="$2"
      shift;shift
      ;;
    -net|--network)
      NETWORK="$2"
      shift;shift
      ;;
    -nsc|--native-sidecars)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        ENABLE_NATIVE_SIDECARS="$2"
      else
        echo "ERROR: The --native-sidecars flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -rr|--reduce-resources)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        REDUCE_RESOURCES="$2"
      else
        echo "ERROR: The --reduce-resources flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -rs|--require-scc)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        REQUIRE_SCC="$2"
      else
        echo "ERROR: The --require-scc flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -s|--set)
      CUSTOM_INSTALL_SETTINGS="${CUSTOM_INSTALL_SETTINGS} --set $2"
      shift;shift
      ;;
    -se|--spire-enabled)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        SPIRE_ENABLED="$2"
      else
        echo "ERROR: The --spire-enabled flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -std|--spire-trust-domain)
      SPIRE_TRUST_DOMAIN="$2"
      shift;shift
      ;;
    -sns|--spire-namespace)
      SPIRE_NAMESPACE="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -a|--addons <space-separated addon names>:
       The names of the addons you want to install along with the core Istio components.
       Make sure this value is space-separated. Valid addon names can be found in your Istio
       distribution directory samples/addons.
       Default: prometheus grafana jaeger
  -c|--client-exe <name>:
       Cluster client executable name - valid values are "kubectl" or "oc".
       Default: oc
  -cep|--client-exe-path <full path to client exec>:
       Cluster client executable path - e.g. "/bin/kubectl" or "minikube kubectl --"
       This value overrides any other value set with --client-exe
  -cn|--cluster-name <cluster name>:
       Installs istio as part of cluster with the given name.
       Default: unset (use Istio default of "Kubernetes")
  -cp|--config-profile <profile name>:
       Installs Istio with the given profile.
       Run "istioctl profile list" to see the valid list of configuration profiles available.
       See: https://istio.io/docs/setup/additional-setup/config-profiles/
       Default: "demo" on non-OpenShift platforms, "openshift" on OpenShift
  -di|--delete-istio (true|false):
       Set to 'true' if you want to delete Istio, rather than install it.
       By default, it will remove all Istio resources, including cluster-scoped resources.
       If you want to keep Istio control planes in other namespaces, set --purge-uninstall to 'false'.
       Default: false
  -d6|--disable-ipv6 (true|false):
       Set to 'false' to avoid using the argument values.cni.ambient.ipv6.
       By default, Istio 1.23 Ambient profile enables IPv6, which doesn't work properly on docker.
       The value doesn't exist in previous versions.
       Default: true
  -pu|--purge-uninstall (true|false):
       Set to 'true' if you want to remove all Istio resources, including cluster-scoped resources.
       Default: true
  -ic|--istioctl <path to istioctl binary>:
       Where the istioctl executable is found. Use this when developing Istio installer and testing it.
       Default: "istioctl" found in the bin/ directory of the Istio directory (--istio-dir).
  -id|--istio-dir <dir>:
       Where Istio has already been downloaded. If not found, this script aborts.
  -iee|--istio-egressgateway-enabled (true|false)
       When set to true, istio-egressgateway will be installed.
       Default: true
  -iie|--istio-ingressgateway-enabled (true|false)
       When set to true, istio-ingressgateway will be installed.
       Default: true
  -ir|--istio-revision <revision>:
       The Istio revision to set while installing, "istio.io/rev=<revision>".
       Default: empty
  -gae|--k8s-gateway-api-enabled (true|false)
       When set to true, K8s Gateway API will be installed.
       Default: false
  -gav|--k8s-gateway-api-version <version>:
       The K8s Gateway API version to install. This is considered when --k8s-gateway-api-enabled is specified as "true".
  -ih|--image-hub <hub id>
       The hub where the Istio images will be pulled from.
       You can set this to "default" in order to use the default hub that the Istio charts use but
       this may be using Docker Hub, and Docker Hub rate limiting may cause the installation to fail.
       Default: gcr.io/istio-release
  -it|--image-tag <tag>
       The tag of the Istio images. Leave this as "default" (which means the default images are pulled)
       unless you know the image tag you are pulling is compatible with the charts in the istioctl installer.
       You will need this if you have a dev version of istioctl but want to pull a released version of the images.
       Default: "default"
  -iv|--istio-version <version>:
       The Istio version to install. This is ignored if --istio-dir is specified.
  -m|--mtls (true|false):
       Indicate if you want global MTLS auto enabled.
       Default: true
  -mid|--mesh-id <mesh ID>:
       Installs istio as part of mesh with the given name.
       Default: unset
  -n|--namespace <name>:
       Install Istio in this namespace.
       Default: istio-system
  -net|--network <network>:
       Installs istio as part of network with the given name.
       Default: unset
  -nsc|--native-sidecars (true|false):
       Indicate if you want native sidecars enabled.
       Default: false
  -rr|--reduce-resources (true|false):
       When true some Istio components (such as the sidecar proxies) will be given
       a smaller amount of resources (CPU and memory) which will allow you
       to run Istio on a cluster that does not have a large amount of resources.
       Default: false
  -rs|--require-scc (true|false):
       Required when running Istio < 1.20 in OpenShift
       Default: false
  -s|--set <name=value>:
       Sets a name/value pair for a custom install setting. Some examples you may want to use:
       --set installPackagePath=/git/clone/istio.io/installer
  -se|--spire-enabled (true|false):
       When set to true, SPIRE will be installed before Istio, and Istio will be configured
       to use SPIRE for workload identity. This includes configuring the trust domain,
       ingress gateway with SPIRE CSI driver volumes, and sidecar injection templates.
       Default: false
  -std|--spire-trust-domain <domain>:
       The SPIRE trust domain to use. Only used when --spire-enabled is true.
       Default: example.org
  -sns|--spire-namespace <namespace>:
       The namespace where SPIRE will be installed. Only used when --spire-enabled is true.
       Default: spire
  -h|--help:
       this message
HELPMSG
      exit 1
      ;;
    *)
      echo "ERROR: Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

if [ "${CLIENT_EXE}" == "" ]; then
  CLIENT_EXE=`which "${CLIENT_EXE_NAME}"`
  if [ "$?" = "0" ]; then
    echo "The cluster client executable is found here: ${CLIENT_EXE}"
  else
    echo "ERROR: You must install the cluster client ${CLIENT_EXE_NAME} in your PATH before you can continue."
    exit 1
  fi
fi

# Determine if we are running with OpenShift or not

if ${CLIENT_EXE} api-versions | grep --quiet "route.openshift.io"; then
  IS_OPENSHIFT="true"
  echo "You are connecting to an OpenShift cluster"
else
  IS_OPENSHIFT="false"
  echo "You are connecting to a (non-OpenShift) Kubernetes cluster"
fi

# default the config profile according to the cluster type
if [ -z "${CONFIG_PROFILE}" ]; then
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    CONFIG_PROFILE="openshift"
  else
    CONFIG_PROFILE="demo"
  fi
fi

if [ "${ISTIO_DIR}" == "" ]; then
  # Go to the main output directory and try to find an Istio there.
  HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
  OUTPUT_DIR="${OUTPUT_DIR:-${HACK_SCRIPT_DIR}/../../_output}"
  if [ "${ISTIO_VERSION}" == "" ]; then
    ALL_ISTIOS=$(ls -dt1 ${OUTPUT_DIR}/istio-*)
    if [ "$?" != "0" ]; then
      ${HACK_SCRIPT_DIR}/download-istio.sh
      if [ "$?" != "0" ]; then
        echo "ERROR: You do not have Istio installed and it cannot be downloaded."
        exit 1
      fi
    fi
    # install the Istio release that was last downloaded (that's the -t option to ls)
    ISTIO_DIR=$(ls -dt1 ${OUTPUT_DIR}/istio-* | head -n1)
  else
    ISTIO_DIR=$(ls -dt1 ${OUTPUT_DIR}/istio-${ISTIO_VERSION} | head -n1)
    if [ ! -d "${ISTIO_DIR}" ]; then
      ${HACK_SCRIPT_DIR}/download-istio.sh --istio-version ${ISTIO_VERSION}
      if [ "$?" != "0" ]; then
        echo "ERROR: You do not have Istio [${ISTIO_VERSION}] installed and it cannot be downloaded."
        exit 1
      fi
      ISTIO_DIR=$(ls -dt1 ${OUTPUT_DIR}/istio-${ISTIO_VERSION} | head -n1)
    fi
  fi
fi

if [ ! -d "${ISTIO_DIR}" ]; then
   echo "ERROR: Istio cannot be found at: ${ISTIO_DIR}"
   exit 1
fi

echo "Istio is found here: ${ISTIO_DIR}"

ISTIOCTL="${ISTIOCTL:-${ISTIO_DIR}/bin/istioctl}"
if [ ! -f "${ISTIOCTL}" ]; then
   echo "ERROR: istioctl cannot be found at: ${ISTIOCTL}"
   exit 1
fi

echo "istioctl is found here: ${ISTIOCTL}"

# If OpenShift, install CNI
if [ "${IS_OPENSHIFT}" == "true" ]; then
  # If on OpenShift but not using openshift profile, do some extra things. To support Istio 1.10 and earlier.
  if [ "${CONFIG_PROFILE}" != "openshift" ]; then
    CNI_OPTIONS="--set components.cni.enabled=true --set components.cni.namespace=kube-system --set values.cni.cniBinDir=/var/lib/cni/bin --set values.cni.cniConfDir=/etc/cni/multus/net.d --set values.cni.chained=false --set values.cni.cniConfFileName=istio-cni.conf --set values.sidecarInjectorWebhook.injectedAnnotations.k8s\.v1\.cni\.cncf\.io/networks=istio-cni"
  fi
fi

# If IPv6 is disabled, apply the appropriate settings based on profile
echo "DISABLE_IPV6: ${DISABLE_IPV6}"
if [ "${DISABLE_IPV6}" == "true" ]; then
  if [ "${CONFIG_PROFILE}" == "ambient" ]; then
    CNI_OPTIONS="${CNI_OPTIONS} --set values.cni.ambient.ipv6=false"
    echo "Disabling Ambient CNI IPv6"
  else
    # For non-ambient profiles (like demo), disable IPv6 by preventing dual-stack and IPv6 iptables rules
    IPV6_DISABLE_OPTIONS=" \
      --set values.global.proxy.excludeIPRanges=::1/128 \
      --set meshConfig.defaultConfig.proxyMetadata.DISABLE_IPV6=true \
      --set meshConfig.defaultConfig.proxyMetadata.ENABLE_INBOUND_IPV6=false"
    echo "Disabling IPv6 for [${CONFIG_PROFILE}] profile"
  fi
fi

if [ "${DISABLE_IPV6}" == "false" ]; then
  DUALSTACK_OPTIONS=" \
    --set meshConfig.defaultConfig.proxyMetadata.ISTIO_DUAL_STACK=true \
    --set values.pilot.env.ISTIO_DUAL_STACK=true \
    --set values.pilot.ipFamilyPolicy=RequireDualStack \
    --set values.gateways.istio-ingressgateway.ipFamilyPolicy=RequireDualStack \
    --set values.gateways.istio-egressgateway.ipFamilyPolicy=RequireDualStack"
fi

MTLS_OPTIONS="--set values.meshConfig.enableAutoMtls=${MTLS}"

NATIVE_SIDECARS_OPTIONS="--set values.pilot.env.ENABLE_NATIVE_SIDECARS=${ENABLE_NATIVE_SIDECARS}"

# When installing Istio (i.e. not deleting it) perform some preparation steps
if [ "${DELETE_ISTIO}" != "true" ]; then
  # Create the istio-system namespace
  # If OpenShift, we need to do some additional things - see:
  #   https://istio.io/latest/docs/setup/platform-setup/openshift/
  echo Creating the control plane namespace: ${NAMESPACE}
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    if ! ${CLIENT_EXE} get namespace ${NAMESPACE}; then
      ${CLIENT_EXE} new-project ${NAMESPACE}
    fi
    if [ "${REQUIRE_SCC}" == "true" ]; then
      echo "Creating SCC for OpenShift"
      cat <<SCC | ${CLIENT_EXE} apply -f -
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: istio-openshift-scc
runAsUser:
  type: RunAsAny
seLinuxContext:
  type: RunAsAny
supplementalGroups:
  type: RunAsAny
fsGroup:
  type: RunAsAny
seccompProfiles:
- '*'
priority: 9
users:
- "system:serviceaccount:${NAMESPACE}:istiod"
- "system:serviceaccount:${NAMESPACE}:istio-ingressgateway-service-account"
- "system:serviceaccount:${NAMESPACE}:istio-egressgateway-service-account"
- "system:serviceaccount:${NAMESPACE}:prometheus"
- "system:serviceaccount:${NAMESPACE}:grafana"
SCC
    fi
  else
    if ! ${CLIENT_EXE} get namespace ${NAMESPACE}; then
      ${CLIENT_EXE} create namespace ${NAMESPACE}
    fi
  fi

  echo "Labeling namespace with network name [${NETWORK}]"
  ${CLIENT_EXE} label --overwrite namespace ${NAMESPACE} topology.istio.io/network=${NETWORK}
fi

if [ "${IMAGE_HUB}" != "default" ]; then
  IMAGE_HUB_OPTION="--set hub=${IMAGE_HUB}"
fi

if [ "${IMAGE_TAG}" != "default" ]; then
  IMAGE_TAG_OPTION="--set tag=${IMAGE_TAG}"
fi

if [ "${NAMESPACE}" != "istio-system" ]; then
  # see https://github.com/istio/istio/issues/30897 for these settings
  CUSTOM_NAMESPACE_OPTIONS="--set namespace=${NAMESPACE}"
  CUSTOM_NAMESPACE_OPTIONS="${CUSTOM_NAMESPACE_OPTIONS} --set values.global.istioNamespace=${NAMESPACE}"
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    # If on OpenShift but not using openshift profile, do some extra things. To support Istio 1.10 and earlier.
    if [ "${CONFIG_PROFILE}" != "openshift" ]; then
      CNI_OPTIONS="${CNI_OPTIONS} --set values.cni.excludeNamespaces[0]=${NAMESPACE}"
    fi
  fi
fi

if [ "${REDUCE_RESOURCES}" == "true" ]; then
  REDUCE_RESOURCES_OPTIONS=" \
    --set values.global.proxy.resources.requests.cpu=1m \
    --set values.global.proxy.resources.requests.memory=1Mi \
    --set values.global.proxy_init.resources.requests.cpu=1m \
    --set values.global.proxy_init.resources.requests.memory=1Mi \
    --set components.pilot.k8s.resources.requests.cpu=1m \
    --set components.pilot.k8s.resources.requests.memory=1Mi"
fi

if [ "${CLUSTER_NAME}" != "" ]; then
  CLUSTER_NAME_OPTION="--set values.global.multiCluster.clusterName=${CLUSTER_NAME}"
fi

if [ "${MESH_ID}" != "" ]; then
  MESH_ID_OPTION="--set values.global.meshID=${MESH_ID}"
fi

if [ "${NETWORK}" != "" ]; then
  NETWORK_OPTION="--set values.global.network=${NETWORK}"
fi

if [ "${REVISION}" != "" ]; then
  REVISION_OPTION="--set revision=${REVISION}"
  REVISION_CM="-${REVISION}"
fi

# SPIRE configuration options
# When SPIRE is enabled, we need to configure Istio to use SPIRE for workload identity
if [ "${SPIRE_ENABLED}" == "true" ]; then
  echo "SPIRE integration enabled"
  echo "  Trust Domain: ${SPIRE_TRUST_DOMAIN}"
  echo "  SPIRE Namespace: ${SPIRE_NAMESPACE}"
  
  # Configure trust domain to match SPIRE and set SPIFFE_ENDPOINT_SOCKET for SDS integration
  # The SPIFFE_ENDPOINT_SOCKET tells Istio proxies to use the SPIRE socket for certificate fetching
  SPIRE_OPTIONS=" \
    --set meshConfig.trustDomain=${SPIRE_TRUST_DOMAIN} \
    --set meshConfig.defaultConfig.proxyMetadata.SPIFFE_ENDPOINT_SOCKET=/run/secrets/workload-spiffe-uds/socket"
  
  # Note: Ingress gateway SPIRE volumes will be patched after Istio installation
  # because IstioOperator doesn't support direct volume configuration via --set flags
fi

DEFAULT_ZIPKIN_SERVICE_OPTION="--set values.meshConfig.defaultConfig.tracing.zipkin.address=zipkin.${NAMESPACE}:9411"
if [[ "${CUSTOM_INSTALL_SETTINGS}" == *"values.meshConfig.defaultConfig.tracing.zipkin.address"* ]]; then
  echo "Custom zipkin address set. Not setting default zipkin address."
  DEFAULT_ZIPKIN_SERVICE_OPTION=""
fi

for s in \
   "${IMAGE_HUB_OPTION}" \
   "${IMAGE_TAG_OPTION}" \
   "${MTLS_OPTIONS}" \
   "${NATIVE_SIDECARS_OPTIONS}" \
   "${CLUSTER_NAME_OPTION}" \
   "${CUSTOM_NAMESPACE_OPTIONS}" \
   "--set values.gateways.istio-egressgateway.enabled=${ISTIO_EGRESSGATEWAY_ENABLED}" \
   "--set values.gateways.istio-ingressgateway.enabled=${ISTIO_INGRESSGATEWAY_ENABLED}" \
   "--set values.meshConfig.enableTracing=true" \
   "--set values.meshConfig.defaultConfig.tracing.sampling=100.0" \
   "${DEFAULT_ZIPKIN_SERVICE_OPTION}" \
   "--set values.meshConfig.accessLogFile=/dev/stdout" \
   "${CNI_OPTIONS}" \
   "${MESH_ID_OPTION}" \
   "${NETWORK_OPTION}" \
   "${REDUCE_RESOURCES_OPTIONS}" \
   "${REVISION_OPTION}" \
   "${DUALSTACK_OPTIONS}" \
   "${IPV6_DISABLE_OPTIONS}" \
   "${SPIRE_OPTIONS}" \
   "${CUSTOM_INSTALL_SETTINGS}"
do
  MANIFEST_CONFIG_SETTINGS_TO_APPLY="${MANIFEST_CONFIG_SETTINGS_TO_APPLY} ${s}"
done

echo "CONFIG_PROFILE=${CONFIG_PROFILE}"
echo "MANIFEST_CONFIG_SETTINGS_TO_APPLY=${MANIFEST_CONFIG_SETTINGS_TO_APPLY}"

if [ "${DELETE_ISTIO}" == "true" ]; then
  echo DELETING ISTIO!

  echo Deleting Addons
  for addon in $(ls -1 ${ISTIO_DIR}/samples/addons/*.yaml); do
    echo "Deleting addon [${addon}]"
    cat ${addon} | sed "s/istio-system/${NAMESPACE}/g" | ${CLIENT_EXE} delete --ignore-not-found=true -n ${NAMESPACE} -f -
  done

  echo Deleting Core Istio
  if [ "${PURGE_UNINSTALL}" == "true" ]; then
    echo "Purging all Istio resources"
    # The optional --purge flag will remove all Istio resources, including cluster-scoped resources that may be shared with other Istio control planes.
    ${ISTIOCTL} uninstall --purge -y
  else
    ${ISTIOCTL} manifest generate --set profile=${CONFIG_PROFILE} ${MANIFEST_CONFIG_SETTINGS_TO_APPLY} | ${CLIENT_EXE} delete --ignore-not-found=true -f -
  fi
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    echo "Deleting SCC on OpenShift"
    ${CLIENT_EXE} delete scc istio-openshift-scc
    echo "===== IMPORTANT ====="
    echo "For each namespace in the mesh, run these commands to remove previously created resources:"
    echo "  oc -n <target-namespace> delete network-attachment-definition istio-cni"
    echo "===== IMPORTANT ====="
  fi

  echo "Deleting the istio namespace [${NAMESPACE}]"
  ${CLIENT_EXE} delete namespace ${NAMESPACE}

  # Delete SPIRE if it was enabled
  if [ "${SPIRE_ENABLED}" == "true" ]; then
    echo "Deleting SPIRE..."
    TRUST_DOMAIN="${SPIRE_TRUST_DOMAIN}" \
    SPIRE_NAMESPACE="${SPIRE_NAMESPACE}" \
    ISTIO_NAMESPACE="${NAMESPACE}" \
    CLIENT_EXE="${CLIENT_EXE}" \
    ${SCRIPT_DIR}/install-spire.sh --uninstall
  fi
else
  # Install SPIRE first if enabled
  if [ "${SPIRE_ENABLED}" == "true" ]; then
    echo "Installing SPIRE before Istio..."
    TRUST_DOMAIN="${SPIRE_TRUST_DOMAIN}" \
    SPIRE_NAMESPACE="${SPIRE_NAMESPACE}" \
    ISTIO_NAMESPACE="${NAMESPACE}" \
    CLIENT_EXE="${CLIENT_EXE}" \
    ${SCRIPT_DIR}/install-spire.sh

    if [ $? -ne 0 ]; then
      echo "ERROR: Failed to install SPIRE. Aborting Istio installation."
      exit 1
    fi
    echo "SPIRE installed successfully. Proceeding with Istio installation..."
  fi

  echo Installing Istio...
  # There is a bug in istioctl manifest install - it wants to always create the CR in istio-system.
  # If we are not installing in istio-system, we cannot use 'install' but must generate the yaml and apply it ourselves.
  # See https://github.com/istio/istio/issues/30897#issuecomment-781141490
  if [ "${NAMESPACE}" == "istio-system" ]; then
    while ! (${ISTIOCTL} manifest install --skip-confirmation=true --set profile=${CONFIG_PROFILE} ${MANIFEST_CONFIG_SETTINGS_TO_APPLY})
    do
      echo "Failed to install Istio with profile [${CONFIG_PROFILE}]. Will retry in 10 seconds..."
      sleep 10
    done
  else
    while ! (${ISTIOCTL} manifest generate --set profile=${CONFIG_PROFILE} ${MANIFEST_CONFIG_SETTINGS_TO_APPLY} | ${CLIENT_EXE} apply -f -)
    do
      echo "Failed to install Istio with profile [${CONFIG_PROFILE}]. Will retry in 10 seconds..."
      sleep 10
    done
  fi

  # If SPIRE is enabled, patch the ingress gateway to add SPIRE CSI driver volumes
  if [ "${SPIRE_ENABLED}" == "true" ] && [ "${ISTIO_INGRESSGATEWAY_ENABLED}" == "true" ]; then
    echo "Patching Istio Ingress Gateway for SPIRE integration..."
    
    # Wait for ingress gateway deployment to be available
    ${CLIENT_EXE} wait --for=condition=available --timeout=120s deployment/istio-ingressgateway -n ${NAMESPACE} || {
      echo "WARNING: Ingress gateway deployment not available, skipping SPIRE patch"
    }
    
    # Check if workload-socket volume is already a CSI driver (not emptyDir)
    volume_type=$(${CLIENT_EXE} get deployment istio-ingressgateway -n ${NAMESPACE} -o jsonpath='{.spec.template.spec.volumes[?(@.name=="workload-socket")].csi.driver}' 2>/dev/null || echo "")
    
    if [ "$volume_type" = "csi.spiffe.io" ]; then
      echo "SPIRE CSI volume already configured in ingress gateway"
    else
      echo "Configuring ingress gateway with SPIRE CSI volume and label..."
      
      # Step 1: Add SPIRE label using strategic merge patch (works fine for labels)
      echo "  Adding SPIRE label..."
      ${CLIENT_EXE} patch deployment istio-ingressgateway -n ${NAMESPACE} --type='strategic' -p='{
        "spec": {
          "template": {
            "metadata": {
              "labels": {
                "spiffe.io/spire-managed-identity": "true"
              }
            }
          }
        }
      }' || echo "  Note: SPIRE label may already exist"
      
      # Step 2: Find the index of workload-socket volume and replace it with CSI driver
      # Note: Strategic merge patch does NOT work for volumes - it merges fields instead of replacing
      # We must use JSON patch to fully replace the volume
      echo "  Replacing workload-socket volume with SPIRE CSI driver..."
      
      # Find volume index using go-template (doesn't require jq)
      volume_index=""
      volumes_json=$(${CLIENT_EXE} get deployment istio-ingressgateway -n ${NAMESPACE} -o jsonpath='{range .spec.template.spec.volumes[*]}{.name}{"\n"}{end}' 2>/dev/null)
      idx=0
      while IFS= read -r vol_name; do
        if [ "$vol_name" = "workload-socket" ]; then
          volume_index=$idx
          break
        fi
        ((idx++))
      done <<< "$volumes_json"
      
      if [ -n "$volume_index" ]; then
        ${CLIENT_EXE} patch deployment istio-ingressgateway -n ${NAMESPACE} --type='json' -p="[
          {
            \"op\": \"replace\",
            \"path\": \"/spec/template/spec/volumes/${volume_index}\",
            \"value\": {
              \"name\": \"workload-socket\",
              \"csi\": {
                \"driver\": \"csi.spiffe.io\",
                \"readOnly\": true
              }
            }
          }
        ]" || {
          echo "ERROR: Failed to replace workload-socket volume"
        }
      else
        echo "WARNING: workload-socket volume not found, adding it..."
        ${CLIENT_EXE} patch deployment istio-ingressgateway -n ${NAMESPACE} --type='json' -p='[
          {
            "op": "add",
            "path": "/spec/template/spec/volumes/-",
            "value": {
              "name": "workload-socket",
              "csi": {
                "driver": "csi.spiffe.io",
                "readOnly": true
              }
            }
          }
        ]' || echo "ERROR: Failed to add workload-socket volume"
      fi
      
      # Verify the patch worked
      patched_type=$(${CLIENT_EXE} get deployment istio-ingressgateway -n ${NAMESPACE} -o jsonpath='{.spec.template.spec.volumes[?(@.name=="workload-socket")].csi.driver}' 2>/dev/null || echo "")
      if [ "$patched_type" = "csi.spiffe.io" ]; then
        echo "  Successfully configured SPIRE CSI volume"
      else
        echo "ERROR: SPIRE CSI volume patch verification failed"
        echo "  Expected: csi.spiffe.io, Got: $patched_type"
        echo "  Please manually patch the ingress gateway deployment"
      fi
    fi
    
    # Wait for the patched deployment to roll out
    echo "Waiting for ingress gateway to restart with SPIRE configuration..."
    ${CLIENT_EXE} rollout status deployment/istio-ingressgateway -n ${NAMESPACE} --timeout=120s || {
      echo "WARNING: Ingress gateway rollout may still be in progress"
    }
  fi

  echo "Installing Addons: [${ADDONS}]"
  for addon in ${ADDONS}; do
    echo "Installing addon: [${addon}]"
    while ! (cat ${ISTIO_DIR}/samples/addons/${addon}.yaml | sed "s/istio-system/${NAMESPACE}/g" | ${CLIENT_EXE} apply -n ${NAMESPACE} -f -)
    do
      echo "Failed to install addon [${addon}] - will retry in 10 seconds..."
      sleep 10
    done
  done

  if [ "${K8S_GATEWAY_API_ENABLED}" == "true" ]; then
    if [ "${K8S_GATEWAY_API_VERSION}" == "" ]; then
      echo "Gateway API Version is not specified, taking the latest released version"
      K8S_GATEWAY_API_VERSION=`curl --head --silent "https://github.com/kubernetes-sigs/gateway-api/releases/latest" | grep "location: " | awk '{print $2}' | sed "s/.*tag\///g" | cat -v | sed "s/\^M//g"`
    fi
    if [ "${K8S_GATEWAY_API_IE_VERSION}" == "" ]; then
      echo "Gateway API Inference Extension Version is not specified, taking the latest released version"
      K8S_GATEWAY_API_IE_VERSION=`curl --head --silent "https://github.com/kubernetes-sigs/gateway-api-inference-extension/releases/latest" | grep "location: " | awk '{print $2}' | sed "s/.*tag\///g" | cat -v | sed "s/\^M//g"`
    fi
    echo "Verifying that Gateway API is installed; if it is not then Gateway API version ${K8S_GATEWAY_API_VERSION} will be installed now."
    $CLIENT_EXE get crd gateways.gateway.networking.k8s.io &> /dev/null || \
      { $CLIENT_EXE kustomize "github.com/kubernetes-sigs/gateway-api/config/crd?ref=${K8S_GATEWAY_API_VERSION}" | $CLIENT_EXE apply -f -; }
    echo "Verifying that Gateway API Inference Extension is installed; if it is not then Gateway API Inference Extension version ${K8S_GATEWAY_API_IE_VERSION} will be installed now."
    $CLIENT_EXE get crd inferencepools.inference.networking.k8s.io &> /dev/null || \
      { $CLIENT_EXE kustomize "github.com/kubernetes-sigs/gateway-api-inference-extension/config/crd?ref=${K8S_GATEWAY_API_IE_VERSION}" | $CLIENT_EXE apply -f -; }
  fi

  # Do some OpenShift specific things
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    if [ "${ISTIO_INGRESSGATEWAY_ENABLED}" == "true" ]; then
      ${CLIENT_EXE} -n ${NAMESPACE} expose svc/istio-ingressgateway --port=http
    else
      echo "Ingressgateway is disabled - the OpenShift Route will not be created"
    fi

    echo "===== IMPORTANT ====="
    echo "For each namespace in the mesh, run these commands to create the necessary resources:"
    cat <<NAD
  cat <<EOF | oc -n <target-namespace> create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
    echo "===== IMPORTANT ====="

    # Since we are on OpenShift, make sure CNI is enabled
    if [ "$($CLIENT_EXE -n ${NAMESPACE} get cm istio-sidecar-injector${REVISION_CM} -ojsonpath='{.data.values}' | jq '.istio_cni.enabled')" != "true" ]; then
      echo "===== WARNING ====="
      echo "CNI IS NOT ENABLED BUT SHOULD HAVE BEEN"
      echo "===== WARNING ====="
    fi
  fi
fi
