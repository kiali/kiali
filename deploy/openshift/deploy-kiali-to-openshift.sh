#!/bin/bash

##############################################################################
# deploy-kiali-to-openshift.sh
#
# This script deploys the Kiali components into OpenShift.
#
# To use this script, the "oc" command must be in your PATH.
# This script utilizes "envsubst" - make sure that command line tool
# is installed and in your PATH.
#
# This script assumes all the OpenShift YAML files exist in the same
# directory where this script is found. If an expected YAML file is missing,
# an attempt will be made to download it.
#
# To customize the behavior of this script, you can set one or more of the
# following environment variables:
#
# KIALI_USERNAME
#    This is the username that will be required when logging into Kiali.
#    If this is not set, or if it is set to an empty string, you will be prompted
#    to enter a username.
#    Default: ""
#
# KIALI_PASSPHRASE
#    This is the passphrase that will be required when logging into Kiali.
#    If this is not set, or if it is set to an empty string, you will be prompted
#    to enter a passphrase.
#    Default: ""
#
# KIALI_USERNAME_BASE64
#    If you wish to provide Kiali's username in base64 encoding, set this env var with
#    a value of the desired username in base64 format.
#    If this is set, KIALI_USERNAME is ignored.
#    Default: this is not set by default
#
# KIALI_PASSPHRASE_BASE64
#    If you wish to provide Kiali's passphrase in base64 encoding, set this env var with
#    a value of the desired passphrase in base64 format.
#    If this is set, KIALI_PASSPHRASE is ignored.
#    Default: this is not set by default
#
# JAEGER_URL
#    The Jaeger URL that Kiali will use when integrating with Jaeger.
#    This URL must be accessible to clients external to the cluster
#    in order for the integration to work properly.
#    Default: "http://jaeger-query-istio-system.127.0.0.1.nip.io"
#
# GRAFANA_URL
#    The Grafana URL that Kiali will use when integrating with Grafana.
#    This URL must be accessible to clients external to the cluster
#    in order for the integration to work properly.
#    Default: "http://grafana-istio-system.127.0.0.1.nip.io"
#
# IMAGE_NAME
#    Determines which image to download and install.
#    Default: "kiali/kiali"
#
# IMAGE_VERSION
#    Determines which version of Kiali to install.
#    This can be set to "latest" in which case the latest image is installed (which may or
#    may not be a released version of Kiali).
#    This can be set to "lastrelease" in which case the last Kiali release is installed.
#    Otherwise, you can set to this any valid Kiali version (such as "v0.12").
#    Default: "lastrelease"
#
# VERSION_LABEL
#    Kiali resources will be assigned a "version" label when they are deployed.
#    This env var determines what value those "version" labels will be.
#    If the IMAGE_VERSION env var is "latest", this VERSION_LABEL will be fixed to "master".
#    If the IMAGE_VERSION env var is "lastrelease", this VERSION_LABEL will be fixed to
#    the last Kiali release version string.
#    If the IMAGE_VERSION env var is anything else, you can assign VERSION_LABEL to anything
#    and it will be used for the value of Kiali's "version" labels, otherwise it will default
#    to the value of IMAGE_VERSION env var value.
#    Default: See above for how the default value is determined
#
# IMAGE_PULL_POLICY_TOKEN
#    The Kubernetes pull policy tag for the Kiali deployment.
#    Default: "imagePullPolicy: Always"
#
# NAMESPACE
#    The namespace into which Kiali is to be installed.
#    Default: "istio-system"
#
# ISTIO_NAMESPACE
#    The namespace where Istio is installed.
#    Default: The value of the NAMESPACE env var
#
# VERBOSE_MODE
#    Determines which priority levels of log messages Kiali will output.
#    Typical values are "3" for INFO and higher priority, "4" for DEBUG and higher priority.
#    Default: "3"
#
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
  KIALI_USERNAME="${KIALI_USERNAME=}" # note: the "=" inside ${} is on purpose
  if [ "$KIALI_USERNAME" == "" ]; then
    KIALI_USERNAME=$(read -p 'What do you want to use for the Kiali Username: ' val && echo -n $val)
  fi
  KIALI_USERNAME_BASE64="$(echo -n ${KIALI_USERNAME} | base64)"
fi

if [ "${KIALI_PASSPHRASE_BASE64}" == "" ]; then
  KIALI_PASSPHRASE="${KIALI_PASSPHRASE=}" # note: the "=" inside ${} is on purpose
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
export AUTH_STRATEGY="${AUTH_STRATEGY:-login}"

# Make sure we have access to all required tools

OC_TOOL_PATH=$(which istiooc 2>/dev/null || which oc 2>/dev/null)
if [ "$?" == "0" ]; then
  echo "oc is here: ${OC_TOOL_PATH}"
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
  github_api_url="https://api.github.com/repos/kiali/kiali/releases/latest"
  kiali_version_we_want=$(${downloader} ${github_api_url} 2> /dev/null |\
    grep  "tag_name" | \
    sed -e 's/.*://' -e 's/ *"//' -e 's/",//')
  if [ -z "${kiali_version_we_want}" ]; then
    echo "ERROR: Failed to determine the version of the last Kiali release."
    echo "Make sure this URL is accessible and returning valid results:"
    echo ${github_api_url}
    exit 1
  fi
  echo "Will use the last Kiali release: ${kiali_version_we_want}"
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

echo "=== SETTINGS ==="
echo IMAGE_NAME=$IMAGE_NAME
echo IMAGE_VESRION=$IMAGE_VERSION
echo VERSION_LABEL=$VERSION_LABEL
echo IMAGE_PULL_POLICY_TOKEN=$IMAGE_PULL_POLICY_TOKEN
echo NAMESPACE=$NAMESPACE
echo ISTIO_NAMESPACE=$ISTIO_NAMESPACE
echo JAEGER_URL=$JAEGER_URL
echo GRAFANA_URL=$GRAFANA_URL
echo VERBOSE_MODE=$VERBOSE_MODE
echo "=== SETTINGS ==="

# It is assumed the yaml files are in the same location as this script.
# Figure out where that is using a method that is valid for bash and sh.

YAML_DIR=${YAML_DIR:-$(cd "$(dirname "$0")" && pwd -P)}

apply_yaml() {
  local yaml_file="${1}.yaml"
  local yaml_path="${YAML_DIR}/${yaml_file}"
  local yaml_url="https://raw.githubusercontent.com/kiali/kiali/${VERSION_LABEL}/deploy/openshift/${yaml_file}"

  if [ -f "${yaml_path}" ]; then
    echo "Using YAML file: ${yaml_path}"
    cat ${yaml_path} | envsubst | ${OC_TOOL_PATH} apply -n ${NAMESPACE} -f -
  else
    get_downloader
    echo "Downloading YAML via: ${downloader} ${yaml_url}"
    ${downloader} ${yaml_url} | envsubst | ${OC_TOOL_PATH} apply -n ${NAMESPACE} -f -
  fi
}

# Now deploy all the Kiali components to OpenShift
# If we are missing one or more of the yaml files, download them
echo "Deploying Kiali to OpenShift project ${NAMESPACE}"
for yaml in secret configmap serviceaccount clusterrole clusterrolebinding deployment service route ingress crds
do
  apply_yaml ${yaml}

  if [ "$?" != "0" ]; then
    echo "ERROR: Failed to deploy to OpenShift. Aborting."
    exit 1
  fi
done

# Next step, we enable oAuth, because we need stuff like routes to be well
# defined before creating the OAuthClients.
PROTOCOL="$(if [[ $(oc get routes -n ${NAMESPACE} kiali -o jsonpath=\"{.spec.tls.termination}\") != '' ]]; then echo https; else echo http; fi)" \
  REDIRECT_URL="${PROTOCOL}://$(oc get routes -n ${NAMESPACE} kiali -o jsonpath={.spec.host})" \
  apply_yaml "oauth"

# Deploy Kiali MonitoringDashboards to OpenShift
# Note for undeploy script: dashboards are implicitly undeployed when the related CRD is removed
echo "Deploying Kiali dashboards to OpenShift project ${NAMESPACE}"
for dashboard in nodejs thorntail vertx-client vertx-eventbus vertx-pool vertx-server
do
  yaml_path="${YAML_DIR}/../dashboards/${dashboard}.yaml"
  if [ -f "${yaml_path}" ]; then
    echo "Using YAML file: ${yaml_path}"
    cat ${yaml_path} | envsubst | ${OC_TOOL_PATH} apply -n ${NAMESPACE} -f -
  else
    get_downloader
    yaml_url="https://raw.githubusercontent.com/kiali/kiali/${VERSION_LABEL}/deploy/dashboards/${dashboard}.yaml"
    echo "Downloading YAML via: ${downloader} ${yaml_url}"
    ${downloader} ${yaml_url} | envsubst | ${OC_TOOL_PATH} apply -n ${NAMESPACE} -f -
  fi
  if [ "$?" != "0" ]; then
    echo "WARNING: Failed to deploy runtimes dashboards. They are not mandatory and won't prevent Kiali to work. If you want to monitor your application runtimes, you can still deploy dashboards manually."
  fi
done
