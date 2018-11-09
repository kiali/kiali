#! /bin/sh

##############################################################################
# deploy-kiali-to-openshift.sh
#
# This script deploys the Kiali components into OpenShift.
# To customize the behavior of this script, you can set one or more of the
# environment variables used by this script.
# See below for all the environment variables used.
#
# To use this script, the "oc" command must be in your PATH.
# This script utilizes "envsubst" - make sure that command line tool
# is installed and in your PATH.
##############################################################################

IMAGE_NAME="${IMAGE_NAME:-kiali/kiali}"
IMAGE_VERSION="${IMAGE_VERSION:-v0.9.0}"
VERSION_LABEL="${VERSION_LABEL:-$IMAGE_VERSION}"
IMAGE_PULL_POLICY_TOKEN="${IMAGE_PULL_POLICY_TOKEN:-imagePullPolicy: Always}"
NAMESPACE="${NAMESPACE:-istio-system}"
JAEGER_URL="${JAEGER_URL:-http://jaeger-query-istio-system.127.0.0.1.nip.io}"
GRAFANA_URL="${GRAFANA_URL:-http://grafana-istio-system.127.0.0.1.nip.io}"
VERBOSE_MODE="${VERBOSE_MODE:-3}"

# Make sure we have access to all required tools

if which 'oc' > /dev/null 2>&1 ; then
  echo "oc is here: $(which oc)"
else
  echo "You do not have 'oc' in your PATH. Please install it and retry."
  exit 1
fi

if which 'envsubst' > /dev/null 2>&1 ; then
  echo "envsubst is here: $(which envsubst)"
else
  echo "You do not have 'envsubst' in your PATH. Please install it and retry."
  echo "If you are on MacOS, you can get this by installing the gettext package"
  exit 1
fi

# It is assumed the yaml files are in the same location as this script.
# Figure out where that is using a method that is valid for bash and sh.

YAML_DIR=$(dirname $(readlink -f "$0"))

# Now deploy all the Kiali components to OpenShift

echo Deploying Kiali to OpenShift project ${NAMESPACE}
cat ${YAML_DIR}/configmap.yaml | VERSION_LABEL=${VERSION_LABEL} JAEGER_URL=${JAEGER_URL} GRAFANA_URL=${GRAFANA_URL}ISTIO_NAMESPACE=${NAMESPACE}  envsubst | oc create -n ${NAMESPACE} -f -
cat ${YAML_DIR}/secret.yaml | VERSION_LABEL=${VERSION_LABEL} envsubst | oc create -n ${NAMESPACE} -f -
cat ${YAML_DIR}/serviceaccount.yaml | VERSION_LABEL=${VERSION_LABEL} envsubst | oc create -n ${NAMESPACE} -f -
cat ${YAML_DIR}/service.yaml | VERSION_LABEL=${VERSION_LABEL} envsubst | oc create -n ${NAMESPACE} -f -
cat ${YAML_DIR}/route.yaml | VERSION_LABEL=${VERSION_LABEL} envsubst | oc create -n ${NAMESPACE} -f -
cat ${YAML_DIR}/deployment.yaml | IMAGE_NAME=${IMAGE_NAME} IMAGE_VERSION=${IMAGE_VERSION} NAMESPACE=${NAMESPACE} VERSION_LABEL=${VERSION_LABEL} VERBOSE_MODE=${VERBOSE_MODE} IMAGE_PULL_POLICY_TOKEN=${IMAGE_PULL_POLICY_TOKEN} envsubst |oc create -n ${NAMESPACE} -f -
cat ${YAML_DIR}/clusterrole.yaml | VERSION_LABEL=${VERSION_LABEL} envsubst | oc create -n ${NAMESPACE} -f -
cat ${YAML_DIR}/clusterrolebinding.yaml | VERSION_LABEL=${VERSION_LABEL} NAMESPACE=${NAMESPACE} envsubst | oc create -n ${NAMESPACE} -f -
cat ${YAML_DIR}/ingress.yaml | VERSION_LABEL=${VERSION_LABEL} envsubst | oc create -n ${NAMESPACE} -f -
