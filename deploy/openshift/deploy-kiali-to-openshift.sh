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

# Determine what tool to use to download files. This supports environments that have either wget or curl.
# After return, $downloader will be a command to stream a URL's content to stdout.
get_downloader() {
  if [ ! "$downloader" ] ; then
    # Use wget command if available, otherwise try curl
    if which wget > /dev/null 2>&1 ; then
      downloader="wget -q -O -"
    fi
    if [ ! "$downloader" ] ; then
      if which curl > /dev/null 2>&1 ; then
        downloader="curl -s"
      fi
    fi
    if [ ! "$downloader" ] ; then
      echo "ERROR: You must install either curl or wget to allow downloading"
      exit 1
    else
      echo "Using downloader: $downloader"
    fi
  fi
}

# The credentials can be specified either as already base64 encoded, or in plain text.
# If the username or passphrase plain text variable is set but empty, the user will be asked for a value.
if [ "${KIALI_USERNAME_BASE64}" == "" ]; then
  KIALI_USERNAME="${KIALI_USERNAME=admin}" # note: the "=" inside ${} is on purpose
  if [ "$KIALI_USERNAME" == "" ]; then
    KIALI_USERNAME=$(read -p 'What do you want to use for the Kiali Username: ' val && echo -n $val)
  fi
  KIALI_USERNAME_BASE64="$(echo -n ${KIALI_USERNAME} | base64)"
fi

if [ "${KIALI_PASSPHRASE_BASE64}" == "" ]; then
  KIALI_PASSPHRASE="${KIALI_PASSPHRASE=admin}" # note: the "=" inside ${} is on purpose
  if [ "$KIALI_PASSPHRASE" == "" ]; then
    KIALI_PASSPHRASE=$(read -sp 'What do you want to use for the Kiali Passphrase: ' val && echo -n $val)
    echo
  fi
  KIALI_PASSPHRASE_BASE64="$(echo -n ${KIALI_PASSPHRASE} | base64)"
fi

export IMAGE_NAME="${IMAGE_NAME:-kiali/kiali}"
export IMAGE_VERSION="${IMAGE_VERSION:-lastrelease}"
export VERSION_LABEL="${VERSION_LABEL:-$IMAGE_VERSION}"
export IMAGE_PULL_POLICY_TOKEN="${IMAGE_PULL_POLICY_TOKEN:-imagePullPolicy: Always}"
export NAMESPACE="${NAMESPACE:-istio-system}"
export ISTIO_NAMESPACE="${ISTIO_NAMESPACE:-$NAMESPACE}"
export JAEGER_URL="${JAEGER_URL:-http://jaeger-query-istio-system.127.0.0.1.nip.io}"
export GRAFANA_URL="${GRAFANA_URL:-http://grafana-istio-system.127.0.0.1.nip.io}"
export VERBOSE_MODE="${VERBOSE_MODE:-3}"
export KIALI_USERNAME_BASE64
export KIALI_PASSPHRASE_BASE64

# Make sure we have access to all required tools

if which 'oc' > /dev/null 2>&1 ; then
  echo "oc is here: $(which oc)"
else
  echo "ERROR: You do not have 'oc' in your PATH. Please install it and retry."
  exit 1
fi

if which 'envsubst' > /dev/null 2>&1 ; then
  echo "envsubst is here: $(which envsubst)"
else
  echo "ERROR: You do not have 'envsubst' in your PATH. Please install it and retry."
  echo "If you are on MacOS, you can get this by installing the gettext package"
  exit 1
fi

# If asking for the last release (which is the default), then pick up the latest release.
# Note that you could ask for "latest" - that would pick up the current image built from master.
if [ "${IMAGE_VERSION}" == "lastrelease" ]; then
  get_downloader
  kiali_version_we_want=$(${downloader} https://api.github.com/repos/kiali/kiali/releases/latest 2> /dev/null |\
    grep  "tag_name" | \
    sed -e 's/.*://' -e 's/ *"//' -e 's/",//')
  echo "Will use the last Kiali release: $kiali_version_we_want"
  IMAGE_VERSION=${kiali_version_we_want}
  if [ "${VERSION_LABEL}" == "lastrelease" ]; then
    VERSION_LABEL=${kiali_version_we_want}
  fi
else
  if [ "${IMAGE_VERSION}" == "latest" ]; then
    echo "Will use the latest Kiali image from master branch"
    VERSION_LABEL="master"
  fi
fi

# It is assumed the yaml files are in the same location as this script.
# Figure out where that is using a method that is valid for bash and sh.

YAML_DIR=${YAML_DIR:-$(cd "$(dirname "$0")" && pwd -P)}

# Now deploy all the Kiali components to OpenShift
# If we are missing one or more of the yaml files, download them
echo "Deploying Kiali to OpenShift project ${NAMESPACE}"
for yaml in secret configmap serviceaccount clusterrole clusterrolebinding deployment service route ingress crds
do
  yaml_file="${yaml}.yaml"
  yaml_path="${YAML_DIR}/${yaml}.yaml"
  if [ -f "${yaml_path}" ]; then
    echo "Using YAML file: ${yaml_path}"
    cat ${yaml_path} | envsubst | oc create -n ${NAMESPACE} -f -
  else
    get_downloader
    yaml_url="https://raw.githubusercontent.com/kiali/kiali/${VERSION_LABEL}/deploy/openshift/${yaml_file}"
    echo "Downloading YAML via: ${downloader} ${yaml_url}"
    ${downloader} ${yaml_url} | envsubst | oc create -n ${NAMESPACE} -f -
  fi
  if [ "$?" != "0" ]; then
    echo "ERROR: Failed to deploy to OpenShift. Aborting."
    exit 1
  fi
done
