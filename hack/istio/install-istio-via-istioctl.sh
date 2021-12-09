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
CLUSTER_NAME="cluster-default"
CONFIG_PROFILE="" # see "istioctl profile list" for valid values. See: https://istio.io/docs/setup/additional-setup/config-profiles/
DELETE_ISTIO="false"
PURGE_UNINSTALL="true"
ISTIOCTL=
ISTIO_DIR=
ISTIO_EGRESSGATEWAY_ENABLED="true"
ISTIO_INGRESSGATEWAY_ENABLED="true"
MESH_ID="mesh-default"
MTLS="true"
NAMESPACE="istio-system"
NETWORK="network-default"
IMAGE_HUB="gcr.io/istio-release"
IMAGE_TAG="default"

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
    -ih|--image-hub)
      IMAGE_HUB="$2"
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
    -s|--set)
      CUSTOM_INSTALL_SETTINGS="${CUSTOM_INSTALL_SETTINGS} --set $2"
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
       Default: cluster-default
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
  -ih|--image-hub <hub id>
       The hub where the Istio images will be pulled from.
       You can set this to "default" in order to use the default hub that the Istio charts use but
       this may be using docker.io and docker hub rate limiting may cause the installation to fail.
       Default: gcr.io/istio-release
  -it|--image-tag <tag>
       The tag of the Istio images. Leave this as "default" (which means the default images are pulled)
       unless you know the image tag you are pulling is compatible with the charts in the istioctl installer.
       You will need this if you have a dev version of istioctl but want to pull a released version of the images.
       Default: "default"
  -m|--mtls (true|false):
       Indicate if you want global MTLS auto enabled.
       Default: true
  -mid|--mesh-id <mesh ID>:
       Installs istio as part of mesh with the given name.
       Default: mesh-default
  -n|--namespace <name>:
       Install Istio in this namespace.
       Default: istio-system
  -net|--network <network>:
       Installs istio as part of network with the given name.
       Default: network-default
  -s|--set <name=value>:
       Sets a name/value pair for a custom install setting. Some examples you may want to use:
       --set installPackagePath=/git/clone/istio.io/installer
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

if [ "${CLIENT_EXE}" = "" ]; then
  CLIENT_EXE=`which "${CLIENT_EXE_NAME}"`
  if [ "$?" = "0" ]; then
    echo "The cluster client executable is found here: ${CLIENT_EXE}"
  else
    echo "ERROR: You must install the cluster client ${CLIENT_EXE_NAME} in your PATH before you can continue."
    exit 1
  fi
fi

# default the config profile according to the cluster type
if [ -z "${CONFIG_PROFILE}" ]; then
  if [[ "${CLIENT_EXE}" = *"oc" ]]; then
    CONFIG_PROFILE="openshift"
  else
    CONFIG_PROFILE="demo"
  fi
fi

if [ "${ISTIO_DIR}" == "" ]; then
  # Go to the main output directory and try to find an Istio there.
  HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
  OUTPUT_DIR="${OUTPUT_DIR:-${HACK_SCRIPT_DIR}/../../_output}"
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
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  # If on OpenShift but not using openshift profile, do some extra things. To support Istio 1.10 and earlier.
  if [ "${CONFIG_PROFILE}" != "openshift" ]; then
    CNI_OPTIONS="--set components.cni.enabled=true --set components.cni.namespace=kube-system --set values.cni.cniBinDir=/var/lib/cni/bin --set values.cni.cniConfDir=/etc/cni/multus/net.d --set values.cni.chained=false --set values.cni.cniConfFileName=istio-cni.conf --set values.sidecarInjectorWebhook.injectedAnnotations.k8s\.v1\.cni\.cncf\.io/networks=istio-cni"
  fi
fi

MTLS_OPTIONS="--set values.meshConfig.enableAutoMtls=${MTLS}"

# When installing Istio (i.e. not deleting it) perform some preparation steps
if [ "${DELETE_ISTIO}" != "true" ]; then
  # Create the istio-system namespace
  # If OpenShift, we need to do some additional things - see:
  #   https://istio.io/latest/docs/setup/platform-setup/openshift/
  echo Creating the control plane namespace: ${NAMESPACE}
  if [[ "${CLIENT_EXE}" = *"oc" ]]; then
    if ! ${CLIENT_EXE} get namespace ${NAMESPACE}; then
      ${CLIENT_EXE} new-project ${NAMESPACE}
    fi

    echo Performing additional commands for OpenShift
    ${CLIENT_EXE} adm policy add-scc-to-group anyuid system:serviceaccounts:${NAMESPACE}
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
  if [[ "${CLIENT_EXE}" = *"oc" ]]; then
    # If on OpenShift but not using openshift profile, do some extra things. To support Istio 1.10 and earlier.
    if [ "${CONFIG_PROFILE}" != "openshift" ]; then
      CNI_OPTIONS="${CNI_OPTIONS} --set values.cni.excludeNamespaces[0]=${NAMESPACE}"
    fi
  fi
fi

for s in \
   "${IMAGE_HUB_OPTION}" \
   "${IMAGE_TAG_OPTION}" \
   "${MTLS_OPTIONS}" \
   "${CUSTOM_NAMESPACE_OPTIONS}" \
   "--set values.gateways.istio-egressgateway.enabled=${ISTIO_EGRESSGATEWAY_ENABLED}" \
   "--set values.gateways.istio-ingressgateway.enabled=${ISTIO_INGRESSGATEWAY_ENABLED}" \
   "--set values.global.meshID=${MESH_ID}" \
   "--set values.global.multiCluster.clusterName=${CLUSTER_NAME}" \
   "--set values.global.network=${NETWORK}" \
   "--set values.meshConfig.accessLogFile=/dev/stdout" \
   "${CNI_OPTIONS}" \
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
    # Although the 'uninstall' command has been available since Istio 1.7 and is listed in the official istio doc,
    # it's still available in 'experimental' (x) scope, so it might change in the future.
    # The optional --purge flag will remove all Istio resources, including cluster-scoped resources that may be shared with other Istio control planes.
    ${ISTIOCTL} x uninstall --purge -y
  else
    ${ISTIOCTL} manifest generate --set profile=${CONFIG_PROFILE} ${MANIFEST_CONFIG_SETTINGS_TO_APPLY} | ${CLIENT_EXE} delete -f -
  fi
  if [[ "${CLIENT_EXE}" = *"oc" ]]; then
    echo "===== IMPORTANT ====="
    echo "For each namespace in the mesh, run these commands to remove previously created resources:"
    echo "  oc -n <target-namespace> delete network-attachment-definition istio-cni"
    echo "===== IMPORTANT ====="
  fi

  echo "Deleting the istio namespace [${NAMESPACE}]"
  ${CLIENT_EXE} delete namespace ${NAMESPACE}
else
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

  echo "Installing Addons: [${ADDONS}]"
  for addon in ${ADDONS}; do
    echo "Installing addon: [${addon}]"
    while ! (cat ${ISTIO_DIR}/samples/addons/${addon}.yaml | sed "s/istio-system/${NAMESPACE}/g" | ${CLIENT_EXE} apply -n ${NAMESPACE} -f -)
    do
      echo "Failed to install addon [${addon}] - will retry in 10 seconds..."
      sleep 10
    done
  done

  # Do some OpenShift specific things
  if [[ "${CLIENT_EXE}" = *"oc" ]]; then
    if [ "${ISTIO_INGRESSGATEWAY_ENABLED}" == "true" ]; then
      ${CLIENT_EXE} -n ${NAMESPACE} expose svc/istio-ingressgateway --port=http2
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
    if [ "$($CLIENT_EXE -n ${NAMESPACE} get cm istio-sidecar-injector -ojsonpath='{.data.values}' | jq '.istio_cni.enabled')" != "true" ]; then
      echo "===== WARNING ====="
      echo "CNI IS NOT ENABLED BUT SHOULD HAVE BEEN"
      echo "===== WARNING ====="
    fi
  fi
fi
