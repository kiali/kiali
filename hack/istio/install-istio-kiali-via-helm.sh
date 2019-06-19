#!/bin/bash

##############################################################################
# install-istio-kiali-via-helm.sh
#
# Installs the Istio into your cluster (either Kubernetes or OpenShift)
# using Helm.
#
# If you do not yet have it, this script will download a copy of Istio.
#
# You should have "helm" version 2.10 or higher installed and in your PATH.
# If you do not, a temporary helm will be installed locally.
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
KIALI_CREATE_SECRET="false"
DASHBOARDS_ENABLED="false"
USE_DEMO_VALUES="false"
USE_DEMO_AUTH_VALUES="false"
#HELM_REPO_TO_ADD="https://gcsweb.istio.io/gcs/istio-prerelease/daily-build/release-1.1-latest-daily/charts/"

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
    -hr|--helm-repo)
      HELM_REPO_TO_ADD="$2"
      shift;shift
      ;;
    -id|--istio-dir)
      ISTIO_DIR="$2"
      shift;shift
      ;;
    -ke|--kiali-enabled)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        KIALI_ENABLED="$2"
        KIALI_CREATE_SECRET="$2"
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
      shift;shift
      ;;
    -u|--username)
      USERNAME="$2"
      shift;shift
      ;;
    -s|--set)
      CUSTOM_HELM_VALUES="${CUSTOM_HELM_VALUES} --set $2"
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
  -hr|--helm-repo <url>:
       Will add this Istio Helm repo which contains remote Istio dependencies.
       Default: ${HELM_REPO_TO_ADD}
  -id|--istio-dir <dir>:
       Where Istio has already been downloaded. If not found, this script aborts.
  -ke|--kiali-enabled (true|false):
       When set to true, Kiali will be installed.
       Ignored if --use-demo or --use-demo-auth is true.
       Default: false
  -kt|--kiali-tag <tag>:
       Defines the docker tag that will identify the image to be pulled when Kiali is deployed.
       If you want the latest-and-greatest image, set this to "latest".
       If you have locally built your own development version of Kiali, set this to "dev".
       Ignored if --use-demo or --use-demo-auth is true.
       Default: the tag default defined by the Istio Helm chart
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
  -s|--set <name=value>:
       Sets a name/value pair for a custom helm value.
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
  # we know Kiali is always enabled in the demo yamls but we do not need to create the secret
  KIALI_CREATE_SECRET="false"
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
  TMP_HELM_DIR=${TMP_HELM_DIR:-/tmp/helm-install}
  mkdir -p ${TMP_HELM_DIR}
  export PATH=${PATH}:${TMP_HELM_DIR}
  echo "You do not have helm installed in your PATH. A temporary helm installation will be downloaded to ${TMP_HELM_DIR}..."
  curl https://raw.githubusercontent.com/helm/helm/master/scripts/get > ${TMP_HELM_DIR}/get_helm.sh
  chmod 700 ${TMP_HELM_DIR}/get_helm.sh
  HELM_INSTALL_DIR=${TMP_HELM_DIR} ${TMP_HELM_DIR}/get_helm.sh --no-sudo
  HELM_EXE=${TMP_HELM_DIR}/helm
  echo "Helm temporarily installed at ${HELM_EXE}. Version is: $(${HELM_EXE} version)"
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

# When installing Istio (i.e. not deleting it) perform some preparation steps
if [ "${DELETE_ISTIO}" != "true" ]; then
  # Create the istio-system namespace
  # If OpenShift, we need to do some additional things - see:
  #   https://istio.io/docs/setup/kubernetes/platform-setup/openshift/
  echo Creating the namespace: ${NAMESPACE}
  if [[ "${CLIENT_EXE}" = *"oc" ]]; then
    ${CLIENT_EXE} new-project ${NAMESPACE}
    echo Performing additional commands for OpenShift
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-ingress-service-account -n ${NAMESPACE}
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z default -n ${NAMESPACE}
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z prometheus -n ${NAMESPACE}
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-egressgateway-service-account -n ${NAMESPACE}
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-citadel-service-account -n ${NAMESPACE}
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-ingressgateway-service-account -n ${NAMESPACE}
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-cleanup-old-ca-service-account -n ${NAMESPACE}
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-mixer-post-install-account -n ${NAMESPACE}
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-mixer-service-account -n ${NAMESPACE}
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-pilot-service-account -n ${NAMESPACE}
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-sidecar-injector-service-account -n ${NAMESPACE}
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-galley-service-account -n ${NAMESPACE}
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z istio-security-post-install-account -n ${NAMESPACE}
    if [ "${DASHBOARDS_ENABLED}" == "true" -o "${USE_DEMO_VALUES}" == "true" -o "${USE_DEMO_AUTH_VALUES}" == "true" ]; then
      ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z grafana -n ${NAMESPACE}
      ${CLIENT_EXE} adm policy add-scc-to-user anyuid -z jaeger -n ${NAMESPACE}
    fi
    ${CLIENT_EXE} adm policy add-scc-to-user privileged -z default -n ${NAMESPACE}
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

# Determine if we should be using the demo values. If so, see if the demo yaml already exists, otherwise,
# we will use the demo values file to build it.
rm -f /tmp/istio.yaml
if [ -f "/tmp/istio.yaml" ]; then
  echo "ERROR: There is an existing /tmp/istio.yaml installation file in the way that cannot be deleted"
  exit 1
fi

if [ "${USE_DEMO_VALUES}" == "true" ]; then
  if [ -f "${ISTIO_DIR}/install/kubernetes/istio-demo.yaml" ]; then
    cp "${ISTIO_DIR}/install/kubernetes/istio-demo.yaml" /tmp/istio.yaml
  else
    _HELM_VALUES="--values ${ISTIO_DIR}/install/kubernetes/helm/istio/values-istio-demo.yaml"
  fi
elif [ "${USE_DEMO_AUTH_VALUES}" == "true" ]; then
  if [ -f "${ISTIO_DIR}/install/kubernetes/istio-demo-auth.yaml" ]; then
    cp "${ISTIO_DIR}/install/kubernetes/istio-demo-auth.yaml" /tmp/istio.yaml
  else
    _HELM_VALUES="--values ${ISTIO_DIR}/install/kubernetes/helm/istio/values-istio-demo-auth.yaml"
  fi
else
  if [ "${KIALI_TAG}" != "" ]; then
    _KIALI_TAG_ARG="--set kiali.tag=${KIALI_TAG}"
  fi
  _HELM_VALUES="--set kiali.enabled=${KIALI_ENABLED} ${_KIALI_TAG_ARG} --set tracing.enabled=${DASHBOARDS_ENABLED} --set grafana.enabled=${DASHBOARDS_ENABLED} --set global.mtls.enabled=${MTLS} --set global.controlPlaneSecurityEnabled=${MTLS}"
fi

# Create the install yaml via the helm template command
if [ ! -f "/tmp/istio.yaml" ]; then
  echo Initializing client-side helm...
  ${HELM_EXE} init --client-only
  if [ ! -z "${HELM_REPO_TO_ADD}" ]; then
    echo Adding Helm repo: ${HELM_REPO_TO_ADD}
    ${HELM_EXE} repo add istio.io ${HELM_REPO_TO_ADD}
    echo Updating Helm dependencies...
    ${HELM_EXE} dep update "${ISTIO_DIR}/install/kubernetes/helm/istio"
  fi
  echo Building Helm yaml for Istio...
  ${HELM_EXE} template ${_HELM_VALUES} ${CUSTOM_HELM_VALUES} "${ISTIO_DIR}/install/kubernetes/helm/istio" --name istio --namespace ${NAMESPACE} > /tmp/istio.yaml
fi

if [ "${DELETE_ISTIO}" == "true" ]; then
  echo DELETING ISTIO!
  ${CLIENT_EXE} delete -f /tmp/istio.yaml
  ${HELM_EXE} template "${ISTIO_DIR}/install/kubernetes/helm/istio-init" --name istio-init --namespace ${NAMESPACE} | ${CLIENT_EXE} delete -f -
  ${CLIENT_EXE} delete -f "${ISTIO_DIR}/install/kubernetes/helm/istio-init/files"
  ${CLIENT_EXE} delete namespace ${NAMESPACE}
else
  echo Installing Istio...
  ${HELM_EXE} template "${ISTIO_DIR}/install/kubernetes/helm/istio-init" --name istio-init --namespace ${NAMESPACE} | ${CLIENT_EXE} apply -f -
  _crd_count="0"
  echo -n "Waiting for the CRDs to be created"
  while [ "$_crd_count" -lt "20" ]; do
    sleep 1
    echo -n "."
    _crd_count=$(${CLIENT_EXE} get crds | grep 'istio.io\|certmanager.k8s.io' | wc -l)
  done
  echo "done"
  ${CLIENT_EXE} apply -f /tmp/istio.yaml

  if [ "${KIALI_ENABLED}" == "true" ]; then
    ${CLIENT_EXE} patch clusterrole kiali -p '[{"op":"add", "path":"/rules/-", "value":{"apiGroups":["apps.openshift.io"], "resources":["deploymentconfigs"],"verbs": ["get", "list", "watch"]}}]' --type json
    ${CLIENT_EXE} patch clusterrole kiali -p '[{"op":"add", "path":"/rules/-", "value":{"apiGroups":["project.openshift.io"], "resources":["projects"],"verbs": ["get"]}}]' --type json
    ${CLIENT_EXE} patch clusterrole kiali -p '[{"op":"add", "path":"/rules/-", "value":{"apiGroups":["route.openshift.io"], "resources":["routes"],"verbs": ["get"]}}]' --type json
  fi
fi
