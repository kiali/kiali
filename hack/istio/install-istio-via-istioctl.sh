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
ISTIOCTL=
ISTIO_DIR=
CLIENT_EXE_NAME="oc"
NAMESPACE="istio-system"
USERNAME="admin"
PASSPHRASE="admin"
MTLS="false"
DELETE_ISTIO="false"
KIALI_ENABLED="false"
KIALI_CREATE_SECRET="false"
DASHBOARDS_ENABLED="false"
ISTIO_EGRESSGATEWAY_ENABLED="true"
CONFIG_PROFILE="default" # see "istioctl profile list" for valid values. See: https://istio.io/docs/setup/additional-setup/config-profiles/

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -c|--client-exe)
      CLIENT_EXE_NAME="$2"
      shift;shift
      ;;
    -cep|--client-exe-path)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -cp|--config-profile)
      CONFIG_PROFILE="$2"
      if [ "${2}" == "demo" -o "${2}" == "demo-auth" ]; then
        KIALI_ENABLED="true"
        DASHBOARDS_ENABLED="true"
      fi
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
    -de|--dashboards-enabled)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        DASHBOARDS_ENABLED="$2"
      else
        echo "ERROR: The --dashboards-enabled flag must be 'true' or 'false'"
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
    -ke|--kiali-enabled)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        KIALI_ENABLED="$2"
      else
        echo "ERROR: The --kiali-enabled flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -kt|--kiali-tag)
      KIALI_TAG="$2"
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
    -p|--passphrase)
      PASSPHRASE="$2"
      KIALI_CREATE_SECRET="true"
      shift;shift
      ;;
    -u|--username)
      USERNAME="$2"
      KIALI_CREATE_SECRET="true"
      shift;shift
      ;;
    -s|--set)
      CUSTOM_INSTALL_SETTINGS="${CUSTOM_INSTALL_SETTINGS} --set $2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client-exe <name>:
       Cluster client executable name - valid values are "kubectl" or "oc".
       Default: oc
  -cep|--client-exe-path <full path to client exec>:
       Cluster client executable path - e.g. "/bin/kubectl" or "minikube kubectl --"
       This value overrides any other value set with --client-exe
  -cp|--config-profile <profile name>:
       Installs Istio with the given profile.
       Run "istioctl profile list" to see the valid list of configuration profiles available.
       See: https://istio.io/docs/setup/additional-setup/config-profiles/
       Default: default
  -di|--delete-istio (true|false):
       Set to 'true' if you want to delete Istio, rather than install it.
       Default: false
  -de|--dashboards-enabled (true|false):
       Set to 'true' if you want Jaeger and Grafana installed.
       Default: false
  -ic|--istioctl <path to istioctl binary>:
       Where the istioctl executable is found. Use this when developing Istio installer and testing it.
       Default: "istioctl" found in the bin/ directory of the Istio directory (--istio-dir).
  -id|--istio-dir <dir>:
       Where Istio has already been downloaded. If not found, this script aborts.
  -iee|--istio-egressgateway-enabled (true|false)
       When set to true, istio-egressgateway will be installed.
       Default: true
  -ke|--kiali-enabled (true|false):
       When set to true, Kiali will be installed.
       Default: false
  -kt|--kiali-tag <tag>:
       Defines the docker tag that will identify the image to be pulled when Kiali is deployed.
       If you want the latest-and-greatest image, set this to "latest".
       If you have locally built your own development version of Kiali, set this to "dev".
       Default: the tag default defined by the Istio Helm chart
  -m|--mtls (true|false):
       Indicate if you want global MTLS auto enabled.
       Default: false
  -n|--namespace <name>:
       Install Istio in this namespace.
       Default: istio-system
  -p|--passphrase <pass>:
       The passphrase for the Kiali secret - this is the password to use when logging into Kiali.
       Default: admin
  -u|--username <uname>:
       The username for the Kiali secret - this is the name to use when logging into Kiali.
       Default: admin
  -s|--set <name=value>:
       Sets a name/value pair for a custom install setting. Some examples you may want to use:
       --set installPackagePath=/git/clone/istio.io/installer
       --set values.kiali.tag=v1.9
       --set components.telemetry.k8s.resources.requests.memory=100Mi
       --set components.telemetry.k8s.resources.requests.cpu=50m
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
  # Istio 1.4 had different option names than 1.5+
  if ${ISTIOCTL} --remote=false version | grep -q "1\.4" ; then
    CNI_OPTIONS="--set cni.enabled=true --set cni.components.cni.enabled=true --set cni.components.cni.namespace=kube-system --set values.cni.cniBinDir=/var/lib/cni/bin --set values.cni.cniConfDir=/var/run/multus/cni/net.d"
    TELEMETRY_OPTIONS="--set telemetry.components.telemetry.k8s.resources.requests.memory=100Mi --set telemetry.components.telemetry.k8s.resources.requests.cpu=50m"
  else
    CNI_OPTIONS="--set components.cni.enabled=true --set components.cni.namespace=kube-system --set values.cni.cniBinDir=/var/lib/cni/bin --set values.cni.cniConfDir=/etc/cni/multus/net.d --set values.cni.chained=false --set values.cni.cniConfFileName=istio-cni.conf --set values.sidecarInjectorWebhook.injectedAnnotations.k8s\.v1\.cni\.cncf\.io/networks=istio-cni"
    TELEMETRY_OPTIONS="--set components.telemetry.k8s.resources.requests.memory=100Mi --set components.telemetry.k8s.resources.requests.cpu=50m"

    # Istio 1.5 used global.mtls.auto, 1.6 renamed it
    if ${ISTIOCTL} --remote=false version | grep -q "1\.5" ; then
      MTLS_OPTIONS="--set values.global.mtls.auto=${MTLS}"
    else
      MTLS_OPTIONS="--set values.meshConfig.enableAutoMtls=${MTLS}"
    fi
    MTLS_OPTIONS="${MTLS_OPTIONS} --set values.global.controlPlaneSecurityEnabled=${MTLS}"
  fi
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

  # Create the kiali secret
  if [ "${KIALI_CREATE_SECRET}" == "true" ]; then
    _ENCODED_USERNAME=$(echo -n "${USERNAME}" | base64)
    _ENCODED_PASSPHRASE=$(echo -n "${PASSPHRASE}" | base64)

    echo Creating the Kiali secret
    cat <<EOF | ${CLIENT_EXE} apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: kiali
  namespace: ${NAMESPACE}
  labels:
    app: kiali
type: Opaque
data:
  username: ${_ENCODED_USERNAME}
  passphrase: ${_ENCODED_PASSPHRASE}
EOF
  fi
fi

if [ "${KIALI_TAG}" != "" ]; then
  _KIALI_TAG_ARG="--set values.kiali.tag=${KIALI_TAG}"
fi

for s in \
   "--set values.kiali.enabled=${KIALI_ENABLED}" \
   "${_KIALI_TAG_ARG}" \
   "--set addonComponents.tracing.enabled=${DASHBOARDS_ENABLED}" \
   "--set addonComponents.grafana.enabled=${DASHBOARDS_ENABLED}" \
   "${MTLS_OPTIONS}" \
   "--set values.gateways.istio-egressgateway.enabled=${ISTIO_EGRESSGATEWAY_ENABLED}" \
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
  ${ISTIOCTL} manifest generate --set profile=${CONFIG_PROFILE} ${MANIFEST_CONFIG_SETTINGS_TO_APPLY} | ${CLIENT_EXE} delete -f -
  if [[ "${CLIENT_EXE}" = *"oc" ]]; then
    echo "===== IMPORTANT ====="
    echo "For each namespace in the mesh, run these commands to remove previously created policies:"
    echo "  oc adm policy remove-scc-from-group privileged system:serviceaccounts:<target-namespace>"
    echo "  oc adm policy remove-scc-from-group anyuid system:serviceaccounts:<target-namespace>"
    echo "  oc -n <target-namespace> delete network-attachment-definition istio-cni"
    echo "===== IMPORTANT ====="
  fi
else
  echo Installing Istio...
  ${ISTIOCTL} manifest apply --set profile=${CONFIG_PROFILE} ${MANIFEST_CONFIG_SETTINGS_TO_APPLY}
  if [ "$?" != "0" ]; then
    echo "Failed to install Istio with profile [${CONFIG_PROFILE}]"
    exit 1
  fi

  if [ "${KIALI_ENABLED}" == "true" ]; then
    ${CLIENT_EXE} wait --for=condition=available --timeout=600s deployment/kiali -n ${NAMESPACE}
    ${CLIENT_EXE} patch clusterrole kiali -p '[{"op":"add", "path":"/rules/-", "value":{"apiGroups":["apps.openshift.io"], "resources":["deploymentconfigs"],"verbs": ["get", "list", "watch"]}}]' --type json
    ${CLIENT_EXE} patch clusterrole kiali -p '[{"op":"add", "path":"/rules/-", "value":{"apiGroups":["project.openshift.io"], "resources":["projects"],"verbs": ["get"]}}]' --type json
    ${CLIENT_EXE} patch clusterrole kiali -p '[{"op":"add", "path":"/rules/-", "value":{"apiGroups":["route.openshift.io"], "resources":["routes"],"verbs": ["get"]}}]' --type json
  fi

  # Do some OpenShift specific things
  if [[ "${CLIENT_EXE}" = *"oc" ]]; then
    ${CLIENT_EXE} -n ${NAMESPACE} expose svc/istio-ingressgateway --port=http2
    if [ "${KIALI_ENABLED}" == "true" ]; then
      ${CLIENT_EXE} -n ${NAMESPACE} expose svc/kiali
    fi
    ${CLIENT_EXE} -n ${NAMESPACE} expose svc/prometheus

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
