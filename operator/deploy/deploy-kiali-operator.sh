#!/bin/bash

##############################################################################
# deploy-kiali-operator.sh
#
# This script can be used to deploy the Kiali operator into an OpenShift
# or Kubernetes cluster.
#
# This script can also optionally install Kiali after it installs the operator.
# See OPERATOR_INSTALL_KIALI below.
#
# To use this script, either "oc" or "kubectl" must be in your PATH.
# This script utilizes "envsubst" - make sure that command line tool
# is installed and in your PATH.
#
# This script assumes all the operator yaml files exist in the same
# directory where this script is found. If an expected yaml file is missing,
# an attempt will be made to download it.
#
# To customize the behavior of this script, you can set one or more of the
# following environment variables.
#
# -----------
# Environment variables that affect the Kiali Operator:
#
# OPERATOR_IMAGE_NAME
#    Determines which image of the operator to download and install.
#    To control what image name of Kiali to install, see IMAGE_NAME.
#    Default: "quay.io/kiali/kiali-operator"
#
# OPERATOR_IMAGE_PULL_POLICY
#    The Kubernetes pull policy for the Kiali Operator deployment.
#    This is overridden to be "Always" if OPERATOR_IMAGE_VERSION is set to "latest".
#    Default: "IfNotPresent"
#
# OPERATOR_IMAGE_VERSION
#    Determines which version of the operator to install.
#    To control what image version of Kiali to install, see IMAGE_VERSION.
#    This can be set to "latest" in which case the latest image is installed (which may or
#    may not be a released version of Kiali operator).
#    This can be set to "lastrelease" in which case the last Kiali operator release is installed.
#    Otherwise, you can set to this any valid Kiali version (such as "v0.12").
#    Default: "lastrelease"
#
# OPERATOR_INSTALL_KIALI
#    If "true" this script will immediately command the operator to install Kiali as configured
#    by the other environment variables (as documented below).
#    Default: "true"
#
# OPERATOR_NAMESPACE
#    The namespace into which Kiali operator is to be installed.
#    Default: "kiali-operator"
#
# OPERATOR_SKIP_WAIT
#    If you do not want this script to wait for the operator to start in order to confirm
#    it successfully installed, set this to "true".
#    Default: "false"
#
# OPERATOR_VERSION_LABEL
#    Kiali operator resources will be assigned a "version" label when they are deployed.
#    To control what version label to use for Kiali resources, see VERSION_LABEL.
#    This env var determines what value those "version" labels will be.
#    If the OPERATOR_IMAGE_VERSION env var is "latest", this OPERATOR_VERSION_LABEL will be fixed to "master".
#    If the OPERATOR_IMAGE_VERSION env var is "lastrelease", this OPERATOR_VERSION_LABEL will be fixed to
#    the last Kiali release version string.
#    If the OPERATOR_IMAGE_VERSION env var is anything else, you can assign OPERATOR_VERSION_LABEL to anything
#    and it will be used for the value of Kiali's "version" labels, otherwise it will default
#    to the value of OPERATOR_IMAGE_VERSION env var value.
#    Default: See above for how the default value is determined
#
# -----------
# Environment variables that affect Kiali:
#
# AUTH_STRATEGY
#    Determines what authentication strategy to use.
#    Choose "login" to use a username and password.
#    Choose "anonymous" to allow full access to Kiali without requiring any credentials.
#    Choose "openshift" to use the OpenShift OAuth login which controls access
#    based on the individual's RBAC roles in OpenShift.
#    Default: "openshift" (when using OpenShift), "login" (when using Kubernetes)
#
# CREDENTIALS_CREATE_SECRET
#    When "true" a secret will be created with the credentials provided to this script.
#    Only used when AUTH_STRATEGY is "login".
#    Default: "true"
#
# CREDENTIALS_USERNAME
# CREDENTIALS_PASSPHRASE
#    The credentials that will be required when logging into Kiali.
#    Only used when AUTH_STRATEGY is "login".
#    If you want to create the secret yourself, set CREDENTIALS_CREATE_SECRET to "false".
#    When not set (and when AUTH_STRATEGY="login" and CREDENTIALS_CREATE_SECRET is "true")
#    you will be prompted for a username and passphrase.
#
# GRAFANA_URL
#    The Grafana URL that Kiali will use when integrating with Grafana.
#    This URL must be accessible to clients external to the cluster
#    in order for the integration to work properly.
#    If empty, the operator will attempt to auto-detect it.
#    Default: ""
#
# IMAGE_NAME
#    Determines which image of Kiali to download and install.
#    Default: "kiali/kiali"
#
# IMAGE_PULL_POLICY
#    The Kubernetes pull policy for the Kiali deployment.
#    The operator will overide this to be "Always" if IMAGE_VERSION is set to "latest".
#    Default: "IfNotPresent"
#
# IMAGE_VERSION
#    Determines which version of Kiali to install.
#    This can be set to "latest" in which case the latest image is installed (which may or
#    may not be a released version of Kiali). This is normally for developer use only.
#    This can be set to "lastrelease" in which case the last Kiali release is installed.
#    Otherwise, you can set to this any valid Kiali version (such as "v0.12").
#    NOTE: If this is set to "latest" then the IMAGE_PULL_POLICY will be "Always".
#    Default: "lastrelease"
#
# ISTIO_NAMESPACE
#    The namespace where Istio is installed. If empty, assumes the value of NAMESPACE.
#    Default: ""
#
# JAEGER_URL
#    The Jaeger URL that Kiali will use when integrating with Jaeger.
#    This URL must be accessible to clients external to the cluster
#    in order for the integration to work properly.
#    If empty, the operator will attempt to auto-detect it.
#    Default: ""
#
# NAMESPACE
#    The namespace into which Kiali is to be installed.
#    If a secret is to be created, it will be created in this namespace.
#    Default: "istio-system"
#
# SECRET_NAME
#    The name of the secret that contains the credentials that will be required
#    when logging into Kiali. This is only needed when auth_strategy is "login".
#    If the CREDENTIALS_USERNAME/PASSPHRASE environment variables
#    are specified, this secret will be created for you, unless
#    CREDENTIALS_CREATE_SECRET is "false". If CREDENTIALS_CREATE_SECRET is "false",
#    this SECRET_NAME setting is still needed - it is the name of the secret that
#    already (or will) contain the credentials (i.e. the secret you must create manually).
#    Default: kiali
#
# UNINSTALL_EXISTING_KIALI
#    If true, when installing Kiali, this script first will attempt to
#    uninstall any currently existing Kiali resources.
#    This will only remove resources from Kiali itself, not a previously installed
#    Kiali Operator. If you have a previously installed Kiali that was installed by
#    a Kiali Operator, use that operator to uninstall that Kiali (i.e. remove the Kiali CR).
#    Default: false
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

delete_kiali_resources() {
  echo "Deleting resources for any existing Kiali installation"

  ${CLIENT_EXE} delete --ignore-not-found=true all,sa,templates,configmaps,deployments,roles,rolebindings,clusterroles,clusterrolebindings,ingresses,customresourcedefinitions --selector="app=kiali" -n "${NAMESPACE}"

  # Note we do not delete any existing secrets unless this script was told the user wants his own secret
  if [ "${CREDENTIALS_CREATE_SECRET}" == "true" ]; then
    ${CLIENT_EXE} delete --ignore-not-found=true secrets --selector="app=kiali" -n "${NAMESPACE}"
  fi

  # purge OpenShift specific resources
  ${CLIENT_EXE} delete --ignore-not-found=true oauthclients.oauth.openshift.io --selector="app=kiali" -n "${NAMESPACE}"
}

# Determine what cluster client tool we are using.
# While we have this knowledge here, determine some information about auth_strategy we might need later.
CLIENT_EXE=$(which istiooc 2>/dev/null || which oc 2>/dev/null)
if [ "$?" == "0" ]; then
  echo "Using 'oc' located here: ${CLIENT_EXE}"
  _AUTH_STRATEGY_DEFAULT="openshift"
  _AUTH_STRATEGY_PROMPT="Choose a login strategy of either 'login', 'openshift' or 'anonymous'. Use 'anonymous' at your own risk. [${_AUTH_STRATEGY_DEFAULT}]: "
else
  CLIENT_EXE=$(which kubectl 2>/dev/null)
  if [ "$?" == "0" ]; then
    echo "Using 'kubectl' is here: ${CLIENT_EXE}"
    _AUTH_STRATEGY_DEFAULT="login"
    _AUTH_STRATEGY_PROMPT="Choose a login strategy of either 'login' or 'anonymous'. Use 'anonymous' at your own risk. [${_AUTH_STRATEGY_DEFAULT}]: "
  else
    echo "ERROR: You do not have 'oc' or 'kubectl' in your PATH. Please install it and retry."
    exit 1
  fi
fi

# Export all possible variables for envsubst to be able to process
export OPERATOR_IMAGE_NAME="${OPERATOR_IMAGE_NAME:-quay.io/kiali/kiali-operator}"
export OPERATOR_IMAGE_PULL_POLICY="${OPERATOR_IMAGE_PULL_POLICY:-IfNotPresent}"
export OPERATOR_IMAGE_VERSION="${OPERATOR_IMAGE_VERSION:-lastrelease}"
export OPERATOR_INSTALL_KIALI=${OPERATOR_INSTALL_KIALI:-true}
export OPERATOR_NAMESPACE="${OPERATOR_NAMESPACE:-kiali-operator}"
export OPERATOR_SKIP_WAIT="${OPERATOR_SKIP_WAIT:-false}"
export OPERATOR_VERSION_LABEL="${OPERATOR_VERSION_LABEL:-$OPERATOR_IMAGE_VERSION}"

# Make sure we have access to all required tools

if which 'envsubst' > /dev/null 2>&1 ; then
  echo "envsubst is here: $(which envsubst)"
else
  echo "ERROR: You do not have 'envsubst' in your PATH. Please install it and retry."
  echo "If you are on MacOS, you can get this by installing the gettext package"
  exit 1
fi

# If asking for the last release (which is the default), then pick up the latest release.
# Note that you could ask for "latest" - that would pick up the current image built from master.
if [ "${OPERATOR_IMAGE_VERSION}" == "lastrelease" ]; then
  get_downloader
  github_api_url="https://api.github.com/repos/kiali/kiali/releases/latest"
  kiali_version_we_want=$(${downloader} ${github_api_url} 2> /dev/null |\
    grep  "tag_name" | \
    sed -e 's/.*://' -e 's/ *"//' -e 's/",//')
  if [ -z "${kiali_version_we_want}" ]; then
    echo "ERROR: Failed to determine the version of the last Kiali operator release."
    echo "Make sure this URL is accessible and returning valid results:"
    echo ${github_api_url}
    exit 1
  fi
  echo "Will use the last Kiali operator release: ${kiali_version_we_want}"
  OPERATOR_IMAGE_VERSION=${kiali_version_we_want}
  if [ "${OPERATOR_VERSION_LABEL}" == "lastrelease" ]; then
    OPERATOR_VERSION_LABEL=${kiali_version_we_want}
  fi
else
  if [ "${OPERATOR_IMAGE_VERSION}" == "latest" ]; then
    echo "Will use the latest Kiali operator image from master branch"
    OPERATOR_VERSION_LABEL="master"
    OPERATOR_IMAGE_PULL_POLICY="Always"
  fi
fi

echo "=== OPERATOR SETTINGS ==="
echo OPERATOR_IMAGE_NAME=$OPERATOR_IMAGE_NAME
echo OPERATOR_IMAGE_PULL_POLICY=$OPERATOR_IMAGE_PULL_POLICY
echo OPERATOR_IMAGE_VERSION=$OPERATOR_IMAGE_VERSION
echo OPERATOR_INSTALL_KIALI=$OPERATOR_INSTALL_KIALI
echo OPERATOR_SKIP_WAIT=$OPERATOR_SKIP_WAIT
echo OPERATOR_VERSION_LABEL=$OPERATOR_VERSION_LABEL
echo OPERATOR_NAMESPACE=$OPERATOR_NAMESPACE
echo "=== OPERATOR SETTINGS ==="

# It is assumed the yaml files are in the same location as this script.
# Figure out where that is using a method that is valid for bash and sh.

_OP_YAML_DIR="$(cd "$(dirname "$0")" && pwd -P)"

apply_yaml() {
  local yaml_path="${1}"
  local yaml_url="${2}"
  local yaml_namespace="${3}"

  if [ -f "${yaml_path}" ]; then
    echo "Applying yaml file [${yaml_path}] to namespace [${yaml_namespace}]"
    cat ${yaml_path} | envsubst | ${CLIENT_EXE} apply -n ${yaml_namespace} -f -
  else
    get_downloader
    echo "Applying yaml from URL via: [${downloader} ${yaml_url}] to namespace [${yaml_namespace}]"
    ${downloader} ${yaml_url} | envsubst | ${CLIENT_EXE} apply -n ${yaml_namespace} -f -
  fi
}

apply_operator_resource() {
  local yaml_file="${1}.yaml"
  local yaml_path="${_OP_YAML_DIR}/${yaml_file}"
  local yaml_url="https://raw.githubusercontent.com/kiali/kiali/${OPERATOR_VERSION_LABEL}/operator/deploy/${yaml_file}"
  apply_yaml ${yaml_path} ${yaml_url} ${OPERATOR_NAMESPACE}
}

# Now deploy all the Kiali operator components.
echo "Deploying Kiali operator to namespace [${OPERATOR_NAMESPACE}]"

for yaml in namespace crd service_account role role_binding operator
do
  apply_operator_resource ${yaml}

  if [ "$?" != "0" ]; then
    echo "ERROR: Failed to deploy Kiali operator. Aborting."
    exit 1
  fi
done

if [ "${OPERATOR_SKIP_WAIT}" != "true" ]; then
  # Wait for the operator to start up so we can confirm it is OK.
  echo -n "Waiting for the operator to start."
  for run in {1..60}
  do
    ${CLIENT_EXE} get pods -l app=kiali-operator -n ${OPERATOR_NAMESPACE} 2>/dev/null | grep "^kiali-operator.*Running" > /dev/null && _OPERATOR_STARTED=true && break
    echo -n "."
    sleep 5
  done
  echo

  if [ -z ${_OPERATOR_STARTED} ]; then
    echo "ERROR: The Kiali Operator is not running yet. Please make sure it was deployed successfully."
    exit 1
  else
    echo "The Kiali operator is installed!"
  fi
else
  echo "The Kiali operator has been created but you have opted not to wait for it to start. It will take some time for the image to be pulled and start."
fi

# Now deploy Kiali if we were asked to do so.

if [ "${OPERATOR_INSTALL_KIALI}" != "true" ]; then
  _BRANCH="${OPERATOR_VERSION_LABEL}"
  if [ "${_BRANCH}" == "dev" ]; then
    _BRANCH="master"
  fi
  echo "=========================================="
  echo "Skipping the automatic Kiali installation."
  echo "To install Kiali, create a Kiali custom resource in the namespace [${OPERATOR_NAMESPACE}]."
  echo "An example Kiali CR with all settings documented can be found here:"
  echo "  https://raw.githubusercontent.com/kiali/kiali/${_BRANCH}/operator/deploy/kiali/kiali_cr.yaml"
  echo "To install Kiali with all default settings, you can run:"
  echo "  ${CLIENT_EXE} apply -n ${OPERATOR_NAMESPACE} -f https://raw.githubusercontent.com/kiali/kiali/${_BRANCH}/operator/deploy/kiali/kiali_cr.yaml"
  echo "Do not forget to create a secret if you wish to use an auth strategy of 'login' (This is"
  echo "the default setting when installing in Kubernetes but not OpenShift)."
  echo "An example would be:"
  echo "  ${CLIENT_EXE} create secret generic ${SECRET_NAME:-kiali} -n ${NAMESPACE:-istio-system} --from-literal 'username=admin' --from-literal 'passphrase=admin'"
  echo "=========================================="
  echo "Done."
  exit 0
else
  echo "Kiali will now be installed."
fi

# Give the user an opportunity to tell us if they want to uninstall if they did not set the envar yet.
# The default to the prompt is "yes" because the user will normally want to uninstall an already existing Kiali.
if [ -z "${UNINSTALL_EXISTING_KIALI}" ]; then
  if ${CLIENT_EXE} get deployment kiali -n "${NAMESPACE}" > /dev/null 2>&1 ; then
    read -p 'It appears Kiali has already been installed. Do you want to uninstall it? [Y/n]: ' _yn
    case "${_yn}" in
      [yY][eE][sS]|[yY]|"")
        echo "The existing Kiali will be uninstalled."
        UNINSTALL_EXISTING_KIALI="true"
        ;;
      *)
        echo "The existing Kiali will NOT be uninstalled."
        UNINSTALL_EXISTING_KIALI="false"
        ;;
    esac
  fi
fi

# Some settings specific to Kiali installations
NAMESPACE="${NAMESPACE:-istio-system}"
SECRET_NAME="${SECRET_NAME:-kiali}"
CREDENTIALS_CREATE_SECRET=${CREDENTIALS_CREATE_SECRET:-true}
UNINSTALL_EXISTING_KIALI=${UNINSTALL_EXISTING_KIALI:-false}

# Check the login strategy. If using "openshift" there is no other checks to perform,
# but if we are using "login" then we need to make sure there is a username and password set
if [ "${AUTH_STRATEGY}" == "" ]; then
  AUTH_STRATEGY=$(read -p "${_AUTH_STRATEGY_PROMPT}" val && echo -n $val)
  AUTH_STRATEGY=${AUTH_STRATEGY:-${_AUTH_STRATEGY_DEFAULT}}
fi

# Verify the AUTH_STRATEGY is a proper known value
if [ "${AUTH_STRATEGY}" != "login" ] && [ "${AUTH_STRATEGY}" != "openshift" ] && [ "${AUTH_STRATEGY}" != "anonymous" ]; then
  echo "ERROR: unknown AUTH_STRATEGY must be either 'login', 'openshift' or 'anonymous'"
  exit 1
fi

if [ "${AUTH_STRATEGY}" == "login" ]; then
  # If the secret already exists, we will not create another one
  ${CLIENT_EXE} get secret ${SECRET_NAME} -n ${NAMESPACE} > /dev/null 2>&1
  if [ "$?" == "0" ]; then
    _SECRET_EXISTS="true"
    CREDENTIALS_CREATE_SECRET="false"
  fi

  if [ "${CREDENTIALS_CREATE_SECRET}" == "true" ]; then
    # If the username or passphrase is set but empty, the user will be asked for a value.
    CREDENTIALS_USERNAME="${CREDENTIALS_USERNAME=}" # note: the "=" inside ${} is on purpose
    if [ "$CREDENTIALS_USERNAME" == "" ]; then
      CREDENTIALS_USERNAME=$(read -p 'What do you want to use for the Kiali Username: ' val && echo -n $val)
    fi

    CREDENTIALS_PASSPHRASE="${CREDENTIALS_PASSPHRASE=}" # note: the "=" inside ${} is on purpose
    if [ "$CREDENTIALS_PASSPHRASE" == "" ]; then
      CREDENTIALS_PASSPHRASE=$(read -sp 'What do you want to use for the Kiali Passphrase: ' val && echo -n $val)
      echo
    fi
  fi
else
  echo "Using auth strategy [${AUTH_STRATEGY}] - a secret is not needed so none will be created."
fi

echo "=== KIALI SETTINGS ==="
echo AUTH_STRATEGY=$AUTH_STRATEGY
echo CREDENTIALS_CREATE_SECRET=$CREDENTIALS_CREATE_SECRET
echo GRAFANA_URL=$GRAFANA_URL
echo IMAGE_NAME=$IMAGE_NAME
echo IMAGE_PULL_POLICY=$IMAGE_PULL_POLICY
echo IMAGE_VERSION=$IMAGE_VERSION
echo ISTIO_NAMESPACE=$ISTIO_NAMESPACE
echo JAEGER_URL=$JAEGER_URL
echo NAMESPACE=$NAMESPACE
echo SECRET_NAME=$SECRET_NAME
echo UNINSTALL_EXISTING_KIALI=$UNINSTALL_EXISTING_KIALI
echo _SECRET_EXISTS=$_SECRET_EXISTS
echo "=== KIALI SETTINGS ==="

# Uninstall any Kiali that already exists if we were asked to do so
if [ "${UNINSTALL_EXISTING_KIALI}" == "true" ]; then
  delete_kiali_resources
fi

# Create the secret when required

if [ "${CREDENTIALS_CREATE_SECRET}" == "true" ]; then
  if [ "${CREDENTIALS_USERNAME}" == "" ]; then
    echo "ERROR: In order to create a secret, you must provide a non-empty username. Aborting Kiali installation."
    exit 1
  fi
  if [ "${CREDENTIALS_PASSPHRASE}" == "" ]; then
    echo "ERROR: In order to create a secret, you must provide a non-empty passphrase. Aborting Kiali installation."
    exit 1
  fi

  ${CLIENT_EXE} create secret generic ${SECRET_NAME} -n ${NAMESPACE} --from-literal "username=${CREDENTIALS_USERNAME}" --from-literal "passphrase=${CREDENTIALS_PASSPHRASE}"

  if [ "$?" != "0" ]; then
    echo "ERROR: Failed to create a secret named [${SECRET_NAME}] in namespace [${NAMESPACE}]. Aborting Kiali installation."
    exit 1
  else
    echo "A secret named [${SECRET_NAME}] in namespace [${NAMESPACE}] was created."
  fi

  ${CLIENT_EXE} label secret ${SECRET_NAME} -n ${NAMESPACE} app=kiali
  if [ "$?" != "0" ]; then
    echo "WARNING: Failed to label the created secret [${SECRET_NAME}] in namespace [${NAMESPACE}]."
  fi
else
  if [ "${AUTH_STRATEGY}" == "login" ]; then
    if [ "${_SECRET_EXISTS}" == "true" ]; then
      echo "NOTE! A secret already exists. To log into Kiali, you must use the credentials found in that secret."
    else
      echo "NOTE! A secret will not be created. You will need to create one yourself before you can log into Kiali."
    fi
  fi
fi

# Now deploy Kiali

echo "Deploying Kiali CR to namespace [${OPERATOR_NAMESPACE}]"

build_spec_value() {
  local var_name=${1}
  local var_value=${!2-_undefined_}
  local var_show_empty=${3:-false}
  if [ "${var_value}" == "_undefined_" -a "${var_show_empty}" == "false" ]; then
    return
  else
    if [ "${var_value}" == "" -o "${var_value}" == "_undefined_" ]; then
      var_value='""'
    fi
    echo "$var_name: $var_value"
  fi
}

cat <<EOF | ${CLIENT_EXE} apply -n ${OPERATOR_NAMESPACE} -f -
apiVersion: kiali.io/v1alpha1
kind: Kiali
metadata:
  name: kiali
spec:
  $(build_spec_value istio_namespace ISTIO_NAMESPACE)
  auth:
    $(build_spec_value strategy AUTH_STRATEGY)
  deployment:
    $(build_spec_value image_name IMAGE_NAME)
    $(build_spec_value image_pull_policy IMAGE_PULL_POLICY)
    $(build_spec_value image_version IMAGE_VERSION)
    $(build_spec_value namespace NAMESPACE)
    $(build_spec_value secret_name SECRET_NAME)
  external_services:
    grafana:
      $(build_spec_value url GRAFANA_URL true)
    jaeger:
      $(build_spec_value url JAEGER_URL true)
EOF

if [ "$?" != "0" ]; then
  echo "ERROR: Failed to deploy Kiali. Aborting."
  exit 1
fi

echo "Done."
