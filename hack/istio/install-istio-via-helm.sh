#!/bin/bash

##############################################################################
# install-istio-via-helm.sh
#
# Installs the Istio into your cluster (either Kubernetes or OpenShift)
# using Helm.
#
# If you do not yet have it, this script will download a copy of Istio.
#
# You must have "helm" version 2.10 or higher installed and in your PATH.
#
# See --help for more details on options to this script.
#
##############################################################################

# ISTIO_DIR is where the Istio download is installed and thus where the Helm charts are found.
# CLIENT_EXE_NAME must be either "oc", "kubectl", or "istiooc"
ISTIO_DIR=
CLIENT_EXE_NAME="oc"
NAMESPACE="istio-system"
USERNAME="admin"
PASSPHRASE="admin"
MTLS="false"
DELETE_ISTIO="false"
KIALI_ENABLED="false"
DASHBOARDS_ENABLED="false"
USE_DEMO_VALUES="false"
USE_DEMO_AUTH_VALUES="false"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -c|--client-exe)
      CLIENT_EXE_NAME="$2"
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
    -id|--istio-dir)
      ISTIO_DIR="$2"
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
      shift;shift
      ;;
    -u|--username)
      USERNAME="$2"
      shift;shift
      ;;
    -ud|--use-demo)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        USE_DEMO_VALUES="$2"
      else
        echo "ERROR: The --use-demo flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -uda|--use-demo-auth)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        USE_DEMO_AUTH_VALUES="$2"
      else
        echo "ERROR: The --use-demo-auth flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client-exe <name>:
       Cluster client executable name - valid values are "kubectl" or "oc" or "istiooc".
       Default: oc
  -di|--delete-istio (true|false):
       Set to 'true' if you want to delete Istio, rather than install it.
       Default: false
  -de|--dashboards-enabled (true|false):
       Set to 'true' if you want Jaeger and Grafana installed.
       Ignored if --use-demo or --use-demo-auth is true.
       Default: false
  -id|--istio-dir <dir>:
       Where Istio has already been downloaded. If not found, this script aborts.
  -ke|--kiali-enabled (true|false):
       When set to true, Kiali will be installed.
       Ignored if --use-demo or --use-demo-auth is true.
       Default: false
  -m|--mtls (true|false):
       Indicate if you want global MTLS enabled.
       Ignored if --use-demo or --use-demo-auth is true.
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
  -ud|--use-demo (true|false):
       If true, use install settings equal to the istio-demo.yaml.
       Only one of --use-demo or --use-demo-auth is allowed to be true.
       Default: false
  -uda|--use-demo-auth (true|false):
       If true, use install settings equal to the istio-demo-auth.yaml.
       Only one of --use-demo or --use-demo-auth is allowed to be true.
       Default: false
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

if [ "${USE_DEMO_VALUES}" == "true" -a "${USE_DEMO_AUTH_VALUES}" == "true" ]; then
  echo "ERROR: Setting both --use-demo and --use-demo-auth to true is not allowed. Aborting."
  exit 1
fi
if [ "${USE_DEMO_VALUES}" == "true" -o "${USE_DEMO_AUTH_VALUES}" == "true" ]; then
  # we know Kiali is always enabled in the demo yamls
  KIALI_ENABLED="true"
fi

CLIENT_EXE=`which ${CLIENT_EXE_NAME}`
if [ "$?" = "0" ]; then
  echo "The cluster client executable is found here: ${CLIENT_EXE}"
else
  echo "ERROR: You must install the cluster client ${CLIENT_EXE_NAME} in your PATH before you can continue."
  exit 1
fi

HELM_EXE=`which helm`
if [ "$?" = "0" ]; then
  echo "The helm executable is found here: ${HELM_EXE}"
else
  echo "ERROR: You must install helm in your PATH before you can continue."
  exit 1
fi

if [ "${ISTIO_DIR}" == "" ]; then
  # Go to the main output directory and try to find an Istio there.
  HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
  OUTPUT_DIR="${OUTPUT_DIR:-${HACK_SCRIPT_DIR}/../../_output}"
  ALL_ISTIOS=$(ls -d1 ${OUTPUT_DIR}/istio-*)
  if [ "$?" != "0" ]; then
    ${HACK_SCRIPT_DIR}/download-istio.sh
    if [ "$?" != "0" ]; then
      echo "ERROR: You do not have Istio installed and it cannot be downloaded."
      exit 1
    fi
  fi
  # just pick the first one we see
  ISTIO_DIR=$(ls -d1 ${OUTPUT_DIR}/istio-* | head -n1)
fi

if [ ! -d "${ISTIO_DIR}" ]; then
   echo "ERROR: Istio cannot be found at: ${ISTIO_DIR}"
   exit 1
fi

echo "Istio is found here: ${ISTIO_DIR}"

# When installing Istio (i.e. not deleting it) perform some preparation steps
if [ "${DELETE_ISTIO}" != "true" ]; then
  # Create the istio-system namespace
  # If OpenShift, we need to do some additional things - see:
  #   https://istio.io/docs/setup/kubernetes/platform-setup/openshift/
  echo Creating the namespace: ${NAMESPACE}
  if [[ "${CLIENT_EXE}" = *"oc" ]]; then
    ${CLIENT_EXE} new-project ${NAMESPACE}
    echo Performing additional commands for OpenShift
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-ingress-service-account -n istio-system
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z default -n istio-system
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z prometheus -n istio-system
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-egressgateway-service-account -n istio-system
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-citadel-service-account -n istio-system
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-ingressgateway-service-account -n istio-system
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-cleanup-old-ca-service-account -n istio-system
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-mixer-post-install-account -n istio-system
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-mixer-service-account -n istio-system
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-pilot-service-account -n istio-system
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-sidecar-injector-service-account -n istio-system
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-galley-service-account -n istio-system
    if [ "${DASHBOARDS_ENABLED}" == "true" -o "${USE_DEMO_VALUES}" == "true" -o "${USE_DEMO_AUTH_VALUES}" == "true" ]; then
      ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z grafana -n istio-system
      ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z jaeger -n istio-system
    fi
  else
    ${CLIENT_EXE} create namespace ${NAMESPACE}
  fi

  # Create the kiali secret
  if [ "${KIALI_ENABLED}" == "true" ]; then
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

# Determine if we should be using the demo values
if [ "${USE_DEMO_VALUES}" == "true" ]; then
  _HELM_VALUES="--values ${ISTIO_DIR}/install/kubernetes/helm/istio/values-istio-demo.yaml"
elif [ "${USE_DEMO_AUTH_VALUES}" == "true" ]; then
  _HELM_VALUES="--values ${ISTIO_DIR}/install/kubernetes/helm/istio/values-istio-demo-auth.yaml"
else
  _HELM_VALUES="--set kiali.enabled=${KIALI_ENABLED} --set tracing.enabled=${DASHBOARDS_ENABLED} --set grafana.enabled=${DASHBOARDS_ENABLED} --set global.mtls.enabled=${MTLS}"
fi

# Create the install yaml via the helm template command
${HELM_EXE} template ${_HELM_VALUES} "${ISTIO_DIR}/install/kubernetes/helm/istio" --name istio --namespace istio-system > /tmp/istio.yaml

if [ "${DELETE_ISTIO}" == "true" ]; then
  echo DELETING ISTIO!
  ${CLIENT_EXE} delete -f /tmp/istio.yaml
  ${CLIENT_EXE} delete namespace ${NAMESPACE}
else
  echo Installing Istio...
  ${CLIENT_EXE} apply -f /tmp/istio.yaml
fi

