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
CONFIG_PROFILE="demo" # see "istioctl profile list" for valid values. See: https://istio.io/docs/setup/additional-setup/config-profiles/
DELETE_ISTIO="false"
ISTIOCTL=
ISTIO_DIR=
ISTIO_EGRESSGATEWAY_ENABLED="true"
MESH_ID="mesh-default"
MTLS="true"
NAMESPACE="istio-system"
NETWORK="network-default"

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
       Default: demo
  -di|--delete-istio (true|false):
       Set to 'true' if you want to delete Istio, rather than install it.
       Default: false
  -ic|--istioctl <path to istioctl binary>:
       Where the istioctl executable is found. Use this when developing Istio installer and testing it.
       Default: "istioctl" found in the bin/ directory of the Istio directory (--istio-dir).
  -id|--istio-dir <dir>:
       Where Istio has already been downloaded. If not found, this script aborts.
  -iee|--istio-egressgateway-enabled (true|false)
       When set to true, istio-egressgateway will be installed.
       Default: true
  -m|--mtls (true|false):
       Indicate if you want global MTLS auto enabled.
       Default: false
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
  CNI_OPTIONS="--set components.cni.enabled=true --set components.cni.namespace=kube-system --set values.cni.cniBinDir=/var/lib/cni/bin --set values.cni.cniConfDir=/etc/cni/multus/net.d --set values.cni.chained=false --set values.cni.cniConfFileName=istio-cni.conf --set values.sidecarInjectorWebhook.injectedAnnotations.k8s\.v1\.cni\.cncf\.io/networks=istio-cni"

  # Istio 1.8 removed mixer - so components.telemetry settings are only valid from 1.7 and earlier.
  if ${ISTIOCTL} --remote=false version | grep -q "1\.6\|1\.7" ; then
    TELEMETRY_OPTIONS="--set components.telemetry.k8s.resources.requests.memory=100Mi --set components.telemetry.k8s.resources.requests.cpu=50m"
  fi

  MTLS_OPTIONS="--set values.meshConfig.enableAutoMtls=${MTLS}"
fi

# When installing Istio (i.e. not deleting it) perform some preparation steps
if [ "${DELETE_ISTIO}" != "true" ]; then
  # Create the istio-system namespace
  # If OpenShift, we need to do some additional things - see:
  #   https://istio.io/docs/setup/kubernetes/platform-setup/openshift/
  echo Creating the control plane namespace: ${NAMESPACE}
  if [[ "${CLIENT_EXE}" = *"oc" ]]; then
    ${CLIENT_EXE} new-project ${NAMESPACE}

    echo Performing additional commands for OpenShift
    ${CLIENT_EXE} adm policy add-scc-to-group anyuid system:serviceaccounts -n ${NAMESPACE}
  else
    ${CLIENT_EXE} create namespace ${NAMESPACE}
  fi
fi

for s in \
   "${MTLS_OPTIONS}" \
   "--set values.gateways.istio-egressgateway.enabled=${ISTIO_EGRESSGATEWAY_ENABLED}" \
   "--set values.global.meshID=${MESH_ID}" \
   "--set values.global.multiCluster.clusterName=${CLUSTER_NAME}" \
   "--set values.global.network=${NETWORK}" \
   "${CNI_OPTIONS}" \
   "${TELEMETRY_OPTIONS}" \
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
    ${CLIENT_EXE} delete --ignore-not-found=true -f ${addon}
  done

  echo Deleting Core Istio
  ${ISTIOCTL} manifest generate --set profile=${CONFIG_PROFILE} ${MANIFEST_CONFIG_SETTINGS_TO_APPLY} | ${CLIENT_EXE} delete -f -
  if [[ "${CLIENT_EXE}" = *"oc" ]]; then
    echo "===== IMPORTANT ====="
    echo "For each namespace in the mesh, run these commands to remove previously created policies:"
    echo "  oc adm policy remove-scc-from-group privileged system:serviceaccounts:<target-namespace>"
    echo "  oc adm policy remove-scc-from-group anyuid system:serviceaccounts:<target-namespace>"
    echo "  oc -n <target-namespace> delete network-attachment-definition istio-cni"
    echo "===== IMPORTANT ====="
  fi

  echo "Deleting the istio namespace [${NAMESPACE}]"
  ${CLIENT_EXE} delete namespace ${NAMESPACE}
else
  echo Installing Istio...
  ${ISTIOCTL} manifest install --skip-confirmation=true --set profile=${CONFIG_PROFILE} ${MANIFEST_CONFIG_SETTINGS_TO_APPLY}
  if [ "$?" != "0" ]; then
    echo "Failed to install Istio with profile [${CONFIG_PROFILE}]"
    exit 1
  fi

  echo "Installing Addons: [${ADDONS}]"
  for addon in ${ADDONS}; do
    echo "Installing addon: [${addon}]"
    ${CLIENT_EXE} apply -f ${ISTIO_DIR}/samples/addons/${addon}.yaml
  done

  # Do some OpenShift specific things
  if [[ "${CLIENT_EXE}" = *"oc" ]]; then
    ${CLIENT_EXE} -n ${NAMESPACE} expose svc/istio-ingressgateway --port=http2

    echo "===== IMPORTANT ====="
    echo "For each namespace in the mesh, run these commands so sidecar injection works:"
    echo "  oc adm policy add-scc-to-group privileged system:serviceaccounts:<target-namespace>"
    echo "  oc adm policy add-scc-to-group anyuid system:serviceaccounts:<target-namespace>"
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
