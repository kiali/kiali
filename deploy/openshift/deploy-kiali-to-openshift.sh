#!/bin/bash

##############################################################################
# deploy-kiali-to-openshift.sh
#
# This script deploys the Kiali components into OpenShift.
#
# To customize the behavior of this script, you can set one or more of the
# environment variables used by this script.
# See below for all the environment variables used.
#
# This script assumes all the OpenShift YAML files exist in the same
# directory where this script is found. If an expected YAML file is missing,
# an attempt will be made to download it.
#
# To use this script, the "oc" command must be in your PATH.
# This script utilizes "envsubst" - make sure that command line tool
# is installed and in your PATH.
##############################################################################

# Ask the user for the credentials if necessary.
# (note: the "=" inside ${} is on purpose - if the envvar is explicitly empty, it will stay that way)
KIALI_USERNAME="${KIALI_USERNAME=admin}"
KIALI_PASSPHRASE="${KIALI_PASSPHRASE=admin}"

# If the username or passphrase is empty, we are being told that we need to ask the user
if [ "$KIALI_USERNAME" == "" ]; then
  KIALI_USERNAME=$(read -p 'What do you want to use for the Kiali Username: ' val && echo -n $val)
fi
if [ "$KIALI_PASSPHRASE" == "" ]; then
  KIALI_PASSPHRASE=$(read -sp 'What do you want to use for the Kiali Passphrase: ' val && echo -n $val)
  echo
fi

export IMAGE_NAME="${IMAGE_NAME:-kiali/kiali}"
export IMAGE_VERSION="${IMAGE_VERSION:-v0.9.0}"
export VERSION_LABEL="${VERSION_LABEL:-$IMAGE_VERSION}"
export IMAGE_PULL_POLICY_TOKEN="${IMAGE_PULL_POLICY_TOKEN:-imagePullPolicy: Always}"
export NAMESPACE="${NAMESPACE:-istio-system}"
export ISTIO_NAMESPACE="${ISTIO_NAMESPACE:-$NAMESPACE}"
export JAEGER_URL="${JAEGER_URL:-http://jaeger-query-istio-system.127.0.0.1.nip.io}"
export GRAFANA_URL="${GRAFANA_URL:-http://grafana-istio-system.127.0.0.1.nip.io}"
export VERBOSE_MODE="${VERBOSE_MODE:-3}"
export KIALI_USERNAME_BASE64="$(echo -n ${KIALI_USERNAME} | base64)"
export KIALI_PASSPHRASE_BASE64="$(echo -n ${KIALI_PASSPHRASE} | base64)"

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

YAML_DIR=${YAML_DIR:-$(dirname $(readlink -f "$0"))}

# Now deploy all the Kiali components to OpenShift
# If we are missing one or more of the yaml files, download them
echo Deploying Kiali to OpenShift project ${NAMESPACE}
for yaml in secret configmap serviceaccount clusterrole clusterrolebinding deployment service route ingress
do
  yaml_file="${yaml}.yaml"
  yaml_path="${YAML_DIR}/${yaml}.yaml"
  if [ -f "${yaml_path}" ]; then
    echo "Using YAML file: ${yaml_path}"
    cat ${yaml_path} | envsubst | oc create -n ${NAMESPACE} -f -
  else
    yaml_url="https://raw.githubusercontent.com/kiali/kiali/${VERSION_LABEL}/deploy/openshift/${yaml_file}"
    echo "Using YAML downloaded from: ${yaml_url}"
    curl ${yaml_url} | envsubst | oc create -n ${NAMESPACE} -f -
  fi
  if [ "$?" != "0" ]; then
    echo "Failed to deploy to OpenShift. Aborting."
    exit 1
  fi
done
