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
# Environment variables that affect the overall behavior of this script:
#
# DRY_RUN
#    If set to a file path, the script will not create any objects in the cluster but will instead
#    write to that file all the YAML for the resources that would have been created.
#    Dry run will be disabled when set to an empty string.
#    Default: ""
#
# UNINSTALL_EXISTING_KIALI
#    If true, this script first will attempt to uninstall any currently existing Kiali resources.
#    Note that if Kiali is already installed and you opt not to uninstall it, this script
#    will abort and the operator will not be installed.
#    This will only remove resources from Kiali itself, not a previously installed
#    Kiali Operator. If you have a previously installed Kiali that was installed by
#    a Kiali Operator, you can use that operator to uninstall that Kiali by deleting the Kiali CR.
#    If UNINSTALL_EXISTING_OPERATOR is true, this value is ignored since Kiali will be uninstalled
#    when the operator is uninstalled.
#    If UNINSTALL_MODE is true, this value is ignored.
#    Default: "false"
#
# UNINSTALL_EXISTING_OPERATOR
#    If true, this script will attempt to uninstall any currently existing operator resources.
#    If the operator is already installed and you opt not to uninstall it, this script will abort.
#    Uninstalling the operator will also uninstall any existing Kiali installation as well.
#    If UNINSTALL_MODE is true, this value is ignored.
#    Default: "false"
#
# UNINSTALL_MODE
#    When set to true, this script will uninstall the operator and Kiali, and it will not install anything.
#    Default: "false"
#
# Environment variables that affect the Kiali operator installation:
#
# OPERATOR_IMAGE_NAME
#    Determines which image of the operator to download and install.
#    To control what image name of Kiali to install, see KIALI_IMAGE_NAME.
#    Default: "quay.io/kiali/kiali-operator"
#
# OPERATOR_IMAGE_PULL_POLICY
#    The Kubernetes pull policy for the Kiali operator deployment.
#    This is overridden to be "Always" if OPERATOR_IMAGE_VERSION is set to "latest".
#    Default: "IfNotPresent"
#
# OPERATOR_IMAGE_VERSION
#    Determines which version of the operator to install.
#    To control what image version of Kiali to install, see KIALI_IMAGE_VERSION.
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
# OPERATOR_WATCH_NAMESPACE
#    The namespace in which the operator looks for the Kiali CR.
#    Default: The configured OPERATOR_NAMESPACE
#
# -----------
# Environment variables that affect Kiali installation:
#
# ACCESSIBLE_NAMESPACES
#   These are the namespaces that Kiali will be granted access to. These should be the namespaces
#   that make up the service mesh - it will be those namespaces Kiali will observe and manage.
#   The format of the value of this environment variable is a space-separated list (no commas).
#   The namespaces can be regular expressions or explicit namespace names.
#   NOTE! If this is the special value of "**" (two asterisks), that will denote you want Kiali to be
#   given access to all namespaces as a cluster admin. When given this value, the operator will
#   be given permission to create cluster roles and cluster role bindings so it can in turn
#   assign Kiali a cluster role and cluster role binding to access all namespaces. Therefore,
#   be very careful when setting this value to "**" because of the superpowers this will grant
#   to the Kiali operator.
#   Default: "^((?!(istio-operator|kube.*|openshift.*|ibm.*|kiali-operator)).)*$"
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
#    Secrets are only created when AUTH_STRATEGY is "login".
#    If Kiali is to be uninstalled and this value is "true", then any Kiali secret found will be deleted.
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
#    If empty, Kiali will attempt to auto-detect it.
#    Default: ""
#
# KIALI_CR
#    A local file containing a customized Kiali CR that you want to install once the operator
#    is deployed. This will override most all other settings because you are declaring
#    to this script that you want to control the Kiali configuration through this file
#    and not through the command line options or environment variables.
#    Default: ""
#
# KIALI_IMAGE_NAME
#    Determines which image of Kiali to download and install.
#    Default: "kiali/kiali"
#
# KIALI_IMAGE_PULL_POLICY
#    The Kubernetes pull policy for the Kiali deployment.
#    The operator will overide this to be "Always" if KIALI_IMAGE_VERSION is set to "latest".
#    Default: "IfNotPresent"
#
# KIALI_IMAGE_VERSION
#    Determines which version of Kiali to install.
#    This can be set to "latest" in which case the latest image is installed (which may or
#    may not be a released version of Kiali). This is normally for developer use only.
#    This can be set to "lastrelease" in which case the last Kiali release is installed.
#    Otherwise, you can set to this any valid Kiali version (such as "v0.12").
#    NOTE: If this is set to "latest" then the KIALI_IMAGE_PULL_POLICY will be "Always".
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
#    If empty, Kiali will attempt to auto-detect it.
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
##############################################################################

# process command line args to override environment
_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -an|--accessible-namespaces)
      ACCESSIBLE_NAMESPACES="$2"
      shift;shift
      ;;
    -as|--auth-strategy)
      AUTH_STRATEGY="$2"
      shift;shift
      ;;
    -ccs|--credentials-create-secret)
      CREDENTIALS_CREATE_SECRET="$2"
      shift;shift
      ;;
    -cp|--credentials-passphrase)
      CREDENTIALS_PASSPHRASE="$2"
      shift;shift
      ;;
    -cu|--credentials-username)
      CREDENTIALS_USERNAME="$2"
      shift;shift
      ;;
    -dr|--dry-run)
      DRY_RUN="$2"
      shift;shift
      ;;
    -gu|--grafana-url)
      GRAFANA_URL="$2"
      shift;shift
      ;;
    -kcr|--kiali-cr)
      KIALI_CR="$2"
      shift;shift
      ;;
    -kin|--kiali-image-name)
      KIALI_IMAGE_NAME="$2"
      shift;shift
      ;;
    -kipp|--kiali-image-pull-policy)
      KIALI_IMAGE_PULL_POLICY="$2"
      shift;shift
      ;;
    -kiv|--kiali-image-version)
      KIALI_IMAGE_VERSION="$2"
      shift;shift
      ;;
    -in|--istio-namespace)
      ISTIO_NAMESPACE="$2"
      shift;shift
      ;;
    -ju|--jaeger-url)
      JAEGER_URL="$2"
      shift;shift
      ;;
    -n|--namespace)
      NAMESPACE="$2"
      shift;shift
      ;;
    -oin|--operator-image-name)
      OPERATOR_IMAGE_NAME="$2"
      shift;shift
      ;;
    -oipp|--operator-image-pull-policy)
      OPERATOR_IMAGE_PULL_POLICY="$2"
      shift;shift
      ;;
    -oiv|--operator-image-version)
      OPERATOR_IMAGE_VERSION="$2"
      shift;shift
      ;;
    -oik|--operator-install-kiali)
      OPERATOR_INSTALL_KIALI="$2"
      shift;shift
      ;;
    -on|--operator-namespace)
      OPERATOR_NAMESPACE="$2"
      shift;shift
      ;;
    -osw|--operator-skip-wait)
      OPERATOR_SKIP_WAIT="$2"
      shift;shift
      ;;
    -ovl|--operator-version-label)
      OPERATOR_VERSION_LABEL="$2"
      shift;shift
      ;;
    -own|--operator-watch-namespace)
      OPERATOR_WATCH_NAMESPACE="$2"
      shift;shift
      ;;
    -sn|--secret-name)
      SECRET_NAME="$2"
      shift;shift
      ;;
    -uek|--uninstall-existing-kiali)
      UNINSTALL_EXISTING_KIALI="$2"
      shift;shift
      ;;
    -ueo|--uninstall-existing-operator)
      UNINSTALL_EXISTING_OPERATOR="$2"
      shift;shift
      ;;
    -um|--uninstall-mode)
      UNINSTALL_MODE="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG

$0 [option...]

Valid options for overall script behavior:
  -dr|--dry-run
      If set to a file path, the script will not create any objects in the cluster but will instead
      write to that file all the YAML for the resources that would have been created.
      Default: ""
  -uek|--uninstall-existing-kiali
      If true, this script will attempt to uninstall any currently existing Kiali resources.
      Note that if Kiali is already installed and you opt not to uninstall it, this script
      will abort and the operator will not be installed.
      If -ueo=true, this option is ignored since Kiali will be uninstalled along with the operator.
      If -um=true, this option is ignored.
      Default: "false"
  -ueo|--uninstall-existing-operator
      If true, this script will attempt to uninstall any currently existing operator resources.
      If the operator is already installed and you opt not to uninstall it, this script will abort.
      Uninstalling the operator will uninstall any existing Kiali installation as well.
      If -um=true, this option is ignored.
      Default: "false"
  -um|--uninstall-mode
      When set to true, this script will uninstall the operator and Kiali, and it will not install anything.
      Default: "false"

Valid options for the operator installation:
  -oin|--operator-image-name
      Image of the Kiali operator to download and install.
      Default: "quay.io/kiali/kiali-operator"
  -oipp|--operator-image-pull-policy
      The Kubernetes pull policy for the Kiali operator deployment.
      Default: "IfNotPresent"
  -oiv|--operator-image-version
      The version of the Kiali operator to install.
      Can be a version string or "latest" or "lastrelease".
      Default: "lastrelease"
  -oik|--operator-install-kiali
      If "true" this script will immediately command the Kiali operator to install Kiali.
      Default: "true"
  -on|--operator-namespace
      The namespace into which the Kiali operator is to be installed.
      Default: "kiali-operator"
  -osw|--operator-skip-wait
      Indicates if this script should not wait for the Kiali operator to be fully started.
      Default: "false"
  -ovl|--operator-version-label
      A Kubernetes label named "version" will be set on the Kiali operator resources.
      The value of this label is determined by this setting.
      Default: Determined by the operator image version being installed
  -own|--operator-watch-namespace
      The namespace in which the operator looks for the Kiali CR.
      Default: The configured operator namespace (-on)

Valid options for Kiali installation (if Kiali is to be installed):
  -an|--accessible-namespaces
      The namespaces that Kiali will be given permission to observe and manage.
      The format of the value of this option is a space-separated list (no commas).
      The namespaces can be regular expressions or explicit namespace names.
      NOTE! If this is the special value of "**" (two asterisks), that will denote you want
      Kiali to be given access to all namespaces via a single cluster role. When given this
      value, the operator will be given permission to create cluster roles and cluster
      role bindings so it can in turn assign Kiali a cluster role to access all namespaces.
      Therefore, be very careful when setting this value to "**" because of the
      superpowers this will grant to the Kiali operator.
      Default: "^((?!(istio-operator|kube.*|openshift.*|ibm.*|kiali-operator)).)*$"
  -as|--auth-strategy
      Determines what authentication strategy to use.
      Valid values are "login", "anonymous", and "openshift"
      Default: "openshift" (when using OpenShift), "login" (when using Kubernetes)
  -ccs|--credentials-create-secret
      When "true" a secret will be created with the credentials provided to this script.
      Only used when the authentication strategy is set to "login".
      Default: "true"
  -cp|--credentials-passphrase
      When this script creates a secret, this will be the passphrase stored in the secret.
  -cu|--credentials-username
      When this script creates a secret, this will be the username stored in the secret.
  -gu|--grafana-url
      The Grafana URL that Kiali will use when integrating with Grafana.
      This URL must be accessible to clients external to the cluster.
      If not set, Kiali will attempt to auto-detect it.
  -kcr|--kiali-cr
      A local file containing a customized Kiali CR that you want to install once the operator
      is deployed. This will override most all other settings because you are declaring
      to this script that you want to control the Kiali configuration through this file
      and not through the command line options or environment variables.
      Default: ""
  -kin|--kiali-image-name
      Determines which image of Kiali to download and install.
      Default: "kiali/kiali"
  -kipp|--kiali-image-pull-policy
      The Kubernetes pull policy for the Kiali deployment.
      Default: "IfNotPresent"
  -kiv|--kiali-image-version
      Determines which version of Kiali to install.
      Can be a version string or "latest" or "lastrelease".
      Default: "lastrelease"
  -in|--istio-namespace
      The namespace where Istio is installed.
      If empty, assumes the value of the namespace option.
  -ju|--jaeger-url
      The Jaeger URL that Kiali will use when integrating with Jaeger.
      This URL must be accessible to clients external to the cluster.
      If not set, Kiali will attempt to auto-detect it.
  -n|--namespace
      The namespace into which Kiali is to be installed.
      Default: "istio-system"
  -sn|--secret-name
      The name of the secret that contains the credentials that will be
      required when logging into Kiali. This is only needed when the
      authentication strategy is "login".
      Default: "kiali"

HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# Make sure the dry run file does not exist
if [ "${DRY_RUN}" != "" ]; then
  if [ -f ${DRY_RUN} ]; then
    echo "ERROR: The dry run output file exists. Delete it or move it out of the way: ${DRY_RUN}"
    exit 1
  fi
  touch ${DRY_RUN}
  if [ ! -f ${DRY_RUN} ]; then
    echo "ERROR: The dry run output file could not be created. Make sure this filepath is valid: ${DRY_RUN}"
    exit 1
  fi
  DRY_RUN_ARG="--dry-run"
  OPERATOR_SKIP_WAIT="true"
fi

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
    echo "Using 'kubectl' located here: ${CLIENT_EXE}"
    _AUTH_STRATEGY_DEFAULT="login"
    _AUTH_STRATEGY_PROMPT="Choose a login strategy of either 'login' or 'anonymous'. Use 'anonymous' at your own risk. [${_AUTH_STRATEGY_DEFAULT}]: "
  else
    echo "ERROR: You do not have 'oc' or 'kubectl' in your PATH. Please install it and retry."
    exit 1
  fi
fi

# Some environment variables we need set to their defaults if not set already
CREDENTIALS_CREATE_SECRET=${CREDENTIALS_CREATE_SECRET:-true}
NAMESPACE="${NAMESPACE:-istio-system}"
SECRET_NAME="${SECRET_NAME:-kiali}"

# The YAML really needs an empty string denoted with two double-quote characters.
# We just support "**" because its easier to specify on the command line.
if [ "${OPERATOR_WATCH_NAMESPACE}" == "**" ]; then
  OPERATOR_WATCH_NAMESPACE='""'
fi

# Export all possible variables for envsubst to be able to process operator resources
export OPERATOR_IMAGE_NAME="${OPERATOR_IMAGE_NAME:-quay.io/kiali/kiali-operator}"
export OPERATOR_IMAGE_PULL_POLICY="${OPERATOR_IMAGE_PULL_POLICY:-IfNotPresent}"
export OPERATOR_IMAGE_VERSION="${OPERATOR_IMAGE_VERSION:-lastrelease}"
export OPERATOR_INSTALL_KIALI=${OPERATOR_INSTALL_KIALI:-true}
export OPERATOR_NAMESPACE="${OPERATOR_NAMESPACE:-kiali-operator}"
export OPERATOR_SKIP_WAIT="${OPERATOR_SKIP_WAIT:-false}"
export OPERATOR_VERSION_LABEL="${OPERATOR_VERSION_LABEL:-$OPERATOR_IMAGE_VERSION}"
export OPERATOR_WATCH_NAMESPACE="${OPERATOR_WATCH_NAMESPACE:-$OPERATOR_NAMESPACE}"
export OPERATOR_ROLE_CLUSTERROLEBINDINGS="# The operator does not have permission to manage cluster role bindings"
export OPERATOR_ROLE_CLUSTERROLES="# The operator does not have permission to manage cluster roles"

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

resolve_latest_kiali_release() {
  get_downloader
  github_api_url="https://api.github.com/repos/kiali/kiali/releases"
  kiali_version_we_want=$(${downloader} ${github_api_url} 2> /dev/null |\
    grep  "tag_name" | \
    sed -e 's/.*://' -e 's/ *"//' -e 's/",//' | \
    grep -v "snapshot" | \
    sort -t "." -k 1.2g,1 -k 2g,2 -k 3g | \
    tail -n 1)
  if [ -z "${kiali_version_we_want}" ]; then
    echo "ERROR: Failed to determine latest Kiali release."
    echo "Make sure this URL is accessible and returning valid results:"
    echo ${github_api_url}
    exit 1
  fi
}

delete_kiali_cr() {
  local _name="$1"
  local _ns="$2"
  echo "Deleting Kiali CR [${_name}] in namespace [${_ns}]"

  # Clear finalizer list to avoid k8s possibly hanging (there was a bug in older versions of k8s where this happens).
  # We know we are going to delete all Kiali resources later, so this is OK.
  if [ "${DRY_RUN}" == "" ]; then
    ${CLIENT_EXE} patch kiali ${_name} -n "${_ns}" -p '{"metadata":{"finalizers": []}}' --type=merge
    ${CLIENT_EXE} delete kiali ${_name} -n "${_ns}"
  fi
}

delete_kiali_resources() {
  echo "Deleting resources for any existing Kiali installation"

  if [ "${DRY_RUN}" == "" ]; then
    ${CLIENT_EXE} delete --ignore-not-found=true all,sa,templates,configmaps,deployments,roles,rolebindings,clusterroles,clusterrolebindings,ingresses --selector="app=kiali" -n "${NAMESPACE}"

    # Note we do not delete any existing secrets unless this script was told the user wants his own secret
    if [ "${CREDENTIALS_CREATE_SECRET}" == "true" ]; then
      ${CLIENT_EXE} delete --ignore-not-found=true secrets --selector="app=kiali" -n "${NAMESPACE}"
    fi

    # purge OpenShift specific resources
    ${CLIENT_EXE} delete --ignore-not-found=true routes --selector="app=kiali" -n "${NAMESPACE}"
    ${CLIENT_EXE} delete --ignore-not-found=true oauthclients.oauth.openshift.io "kiali-${NAMESPACE}"
  fi
}

delete_operator_resources() {
  echo "Deleting resources for any existing Kiali operator installation"

  # delete CRDs with app=kiali (e.g. monitoring dashboard CRD)
  if [ "${DRY_RUN}" == "" ]; then
    ${CLIENT_EXE} delete --ignore-not-found=true customresourcedefinitions --selector="app=kiali"
  fi

  # explicitly delete the Kiali CRs
  local ns_arg="-n ${OPERATOR_WATCH_NAMESPACE}"
  if [ "${OPERATOR_WATCH_NAMESPACE}" == '""' ]; then
    ns_arg="--all-namespaces"
  fi
  local all_crs=($(${CLIENT_EXE} get kiali ${ns_arg} -o custom-columns=N:.metadata.name,NS:.metadata.namespace --no-headers))
  while [ "${#all_crs[@]}" -gt 0 ]; do
    delete_kiali_cr "${all_crs[0]}" "${all_crs[1]}"
    all_crs=(${all_crs[@]:2})
  done

  # delete the operator CRD which should trigger an uninstall of any existing Kiali
  if [ "${DRY_RUN}" == "" ]; then
    ${CLIENT_EXE} delete --ignore-not-found=true customresourcedefinitions --selector="app=kiali-operator"

    # now purge all operator resources
    ${CLIENT_EXE} delete --ignore-not-found=true all,sa,deployments,roles,rolebindings,clusterroles,clusterrolebindings --selector="app=kiali-operator" -n "${OPERATOR_NAMESPACE}"
  fi

  # Clean up the operator namespace entirely but only if there are no pods running in it.
  # This avoids removing a namespace in use for other things.
  local _pod_count=$(${CLIENT_EXE} get pods --no-headers -n ${OPERATOR_NAMESPACE} 2>/dev/null | wc -l)
  if [ "${_pod_count}" -eq "0" ]; then
    if [ "${DRY_RUN}" == "" ]; then
      ${CLIENT_EXE} delete --ignore-not-found=true namespace "${OPERATOR_NAMESPACE}"
    fi
  else
    echo "There appears to be pods running in the operator namespace [${OPERATOR_NAMESPACE}]; namespace will not be deleted."
  fi
}

echo "=== UNINSTALL SETTINGS ==="
echo UNINSTALL_EXISTING_KIALI=$UNINSTALL_EXISTING_KIALI
echo UNINSTALL_EXISTING_OPERATOR=$UNINSTALL_EXISTING_OPERATOR
echo UNINSTALL_MODE=$UNINSTALL_MODE
echo "=== UNINSTALL SETTINGS ==="

if [ "${UNINSTALL_MODE}" == "true" ]; then
  echo "Uninstalling Kiali and the Kiali operator..."
  delete_operator_resources
  delete_kiali_resources
  echo "Kiali and the Kiali operator have been uninstalled. Nothing will be installed. Exiting."
  exit 0
fi

# Make sure we have access to all required tools

if which 'envsubst' > /dev/null 2>&1 ; then
  echo "envsubst is here: $(which envsubst)"
else
  echo "ERROR: You do not have 'envsubst' in your PATH. Please install it and retry."
  echo "If you are on MacOS, you can get this by installing the gettext package"
  exit 1
fi

# If asking for the last release of operator (which is the default), then pick up the latest release.
# Note that you could ask for "latest" - that would pick up the current image built from master.
if [ "${OPERATOR_IMAGE_VERSION}" == "lastrelease" ]; then
  resolve_latest_kiali_release
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

# If asking for the last release of Kiali (which is the default), then pick up the latest release.
# Note that you could ask for "latest" - that would pick up the current image built from master.
if [ "${KIALI_IMAGE_VERSION:-lastrelease}" == "lastrelease" ]; then
  resolve_latest_kiali_release
  echo "Will use the last Kiali release: ${kiali_version_we_want}"
  KIALI_IMAGE_VERSION=${kiali_version_we_want}
else
  if [ "${KIALI_IMAGE_VERSION}" == "latest" ]; then
    echo "Will use the latest Kiali image from master branch"
    KIALI_IMAGE_PULL_POLICY="Always"
  fi
fi

# Courtesy of https://github.com/jasperes/bash-yaml
parse_yaml() {
    local yaml_file=$1
    local prefix=$2
    local s
    local w
    local fs

    s='[[:space:]]*'
    w='[a-zA-Z0-9_.-]*'
    fs="$(echo @|tr @ '\034')"

    (
        sed -e '/- [^\“]'"[^\']"'.*: /s|\([ ]*\)- \([[:space:]]*\)|\1-\'$'\n''  \1\2|g' |

        sed -ne '/^--/s|--||g; s|\"|\\\"|g; s/[[:space:]]*$//g;' \
            -e "/#.*[\"\']/!s| #.*||g; /^#/s|#.*||g;" \
            -e "s|^\($s\)\($w\)$s:$s\"\(.*\)\"$s\$|\1$fs\2$fs\3|p" \
            -e "s|^\($s\)\($w\)${s}[:-]$s\(.*\)$s\$|\1$fs\2$fs\3|p" |

        awk -F"$fs" '{
            indent = length($1)/2;
            if (length($2) == 0) { conj[indent]="+";} else {conj[indent]="";}
            vname[indent] = $2;
            for (i in vname) {if (i > indent) {delete vname[i]}}
                if (length($3) > 0) {
                    vn=""; for (i=0; i<indent; i++) {vn=(vn)(vname[i])("_")}
                    printf("%s%s%s%s=(\"%s\")\n", "'"$prefix"'",vn, $2, conj[indent-1],$3);
                }
            }' |

        sed -e 's/_=/+=/g' |

        awk 'BEGIN {
                FS="=";
                OFS="="
            }
            /(-|\.).*=/ {
                gsub("-|\\.", "_", $1)
            }
            { print }'
    ) < "$yaml_file"
}

# If the user provided a customized CR, make sure it exists and parse the yaml to determine some settings.
if [ "${KIALI_CR}" != "" ]; then
  if [ ! -f "${KIALI_CR}" ]; then
    echo "The given Kiali CR file does not exist [${KIALI_CR}]. Aborting."
    exit 1
  fi

  # parse the auth strategy value which may be wrapped with double-quotes, single-quotes, or not wrapped at all
  AUTH_STRATEGY=$(parse_yaml "${KIALI_CR}" | grep -E 'auth[_]+strategy' | sed -e 's/^.*strategy=("\(.*\)")/\1/' | tr -d "\\\'\"")
  if [ "${AUTH_STRATEGY}" == "" ]; then
    # If auth strategy isn't in the yaml, then we need to fallback to the known default the operator will use
    # which is based on cluster type. If the client is "oc" (anything ending with "oc" such as "istiooc" for example)
    # then assume the cluster is OpenShift and the default auth strategy is "openshift"; otherwise assume the
    # cluster is Kubernetes which means the default auth strategy is "login".
    if [[ "$CLIENT_EXE" = *"oc" ]]; then
      AUTH_STRATEGY="openshift"
    else
      AUTH_STRATEGY="login"
    fi
  fi

  # Depending how the accessible_namespace list is indented, the parser might be producing different lines.
  # To detect the "**" value regardless how the indentation is done, just look for ** after deployment_ (since we
  # know "**" isn't a valid value for anything other than accessible_namespace its fine to test it like this)
  parse_yaml "${KIALI_CR}" | grep -E 'deployment.*=.*\*\*' 2>&1 > /dev/null
  if [ "$?" == "0" ]; then
    ACCESSIBLE_NAMESPACES="**"
  fi
fi

# If Kiali is to be given access to all namespaces, give the operator the ability to create cluster roles/bindings.
if [ "${ACCESSIBLE_NAMESPACES}" == "**" ]; then
  echo "IMPORTANT! The Kiali operator will be given permission to create cluster roles and"
  echo "cluster role bindings in order to grant Kiali access to all namespaces in the cluster."
  OPERATOR_ROLE_CLUSTERROLEBINDINGS="- clusterrolebindings"
  OPERATOR_ROLE_CLUSTERROLES="- clusterroles"
fi

echo "=== OPERATOR SETTINGS ==="
echo OPERATOR_IMAGE_NAME=$OPERATOR_IMAGE_NAME
echo OPERATOR_IMAGE_PULL_POLICY=$OPERATOR_IMAGE_PULL_POLICY
echo OPERATOR_IMAGE_VERSION=$OPERATOR_IMAGE_VERSION
echo OPERATOR_INSTALL_KIALI=$OPERATOR_INSTALL_KIALI
echo OPERATOR_NAMESPACE=$OPERATOR_NAMESPACE
echo OPERATOR_SKIP_WAIT=$OPERATOR_SKIP_WAIT
echo OPERATOR_VERSION_LABEL=$OPERATOR_VERSION_LABEL
echo OPERATOR_WATCH_NAMESPACE=$OPERATOR_WATCH_NAMESPACE
echo OPERATOR_ROLE_CLUSTERROLES=$OPERATOR_ROLE_CLUSTERROLES
echo OPERATOR_ROLE_CLUSTERROLEBINDINGS=$OPERATOR_ROLE_CLUSTERROLEBINDINGS
echo "=== OPERATOR SETTINGS ==="

# Give the user an opportunity to tell us if they want to uninstall the operator if they did not set the envar yet.
# The default to the prompt is "yes" because the user will normally want to uninstall an already existing Operator.
# Note: to allow for non-interactive installations, the user can set UNINSTALL_EXISTING_OPERATOR=true to ensure
# the operator will always be removed if it exists. If the user does not want the operator removed if it exists, that setting
# can be set to false which will cause this script to abort if the operator exists.
if [ "${UNINSTALL_EXISTING_OPERATOR}" != "true" ]; then
  if ${CLIENT_EXE} get deployment kiali-operator -n "${OPERATOR_NAMESPACE}" > /dev/null 2>&1 ; then
    if [ -z "${UNINSTALL_EXISTING_OPERATOR}" ]; then
      read -p 'It appears the operator has already been installed. Do you want to uninstall it? This will uninstall Kiali, too. [Y/n]: ' _yn
      case "${_yn}" in
        [yY][eE][sS]|[yY]|"")
          echo "The existing operator will be uninstalled, along with any existing Kiali installation."
          UNINSTALL_EXISTING_OPERATOR="true"
          ;;
        *)
          echo "The existing operator will NOT be uninstalled. Aborting the operator installation."
          exit 1
          ;;
      esac
    else
      echo "It appears the operator has already been installed. It will NOT be uninstalled. Aborting the operator installation."
      exit 1
    fi
  else
    UNINSTALL_EXISTING_OPERATOR="false"
  fi
fi

# Uninstall any operator that already exists if we were asked to do so
if [ "${UNINSTALL_EXISTING_OPERATOR}" == "true" ]; then
  # This cleans up the CRDs as well as any deployed operator resources
  delete_operator_resources

  # Since the operator CRD has now been removed, the side-effect is any Kiali CR that exists is also removed.
  # This in turn uninstalls Kiali. But let's clean up any remnants of an old Kiali that might still be around.
  UNINSTALL_EXISTING_KIALI="true"
fi

# Give the user an opportunity to tell us if they want to uninstall if they did not set the envar yet.
# The default to the prompt is "yes" because the user will normally want to uninstall an already existing Kiali.
# Note: to allow for non-interactive installations, the user can set UNINSTALL_EXISTING_KIALI=true to ensure
# Kiali will always be removed if it exists. If the user does not want Kiali removed if it exists, that setting
# can be set to false which will cause this script to abort if Kiali exists.
if [ "${UNINSTALL_EXISTING_KIALI}" != "true" ]; then
  if ${CLIENT_EXE} get deployment kiali -n "${NAMESPACE}" > /dev/null 2>&1 ; then
    if [ -z "${UNINSTALL_EXISTING_KIALI}" ]; then
      read -p 'It appears Kiali has already been installed. Do you want to uninstall it? [Y/n]: ' _yn
      case "${_yn}" in
        [yY][eE][sS]|[yY]|"")
          echo "The existing Kiali will be uninstalled."
          UNINSTALL_EXISTING_KIALI="true"
          ;;
        *)
          echo "The existing Kiali will NOT be uninstalled. Aborting the Kiali operator installation."
          exit 1
          ;;
      esac
    else
      echo "It appears Kiali has already been installed. It will NOT be uninstalled. Aborting the Kiali operator installation."
      exit 1
    fi
  else
    UNINSTALL_EXISTING_KIALI="false"
  fi
fi

# It is assumed the yaml files are in the same location as this script.
# Figure out where that is using a method that is valid for bash and sh.

_OP_YAML_DIR="$(cd "$(dirname "$0")" && pwd -P)"

apply_yaml() {
  local yaml_path="${1}"
  local yaml_url="${2}"
  local yaml_namespace="${3}"

  if [ -f "${yaml_path}" ]; then
    echo "Applying yaml file [${yaml_path}] to namespace [${yaml_namespace}]"
    cat ${yaml_path} | envsubst | ${CLIENT_EXE} apply ${DRY_RUN_ARG} -n ${yaml_namespace} -f -
    if [ "$?" == "0" -a "${DRY_RUN}" != "" ]; then
      cat ${yaml_path} | envsubst >> ${DRY_RUN}
    fi
  else
    get_downloader
    echo "Applying yaml from URL via: [${downloader} ${yaml_url}] to namespace [${yaml_namespace}]"
    ${downloader} ${yaml_url} | envsubst | ${CLIENT_EXE} apply ${DRY_RUN_ARG} -n ${yaml_namespace} -f -
    if [ "$?" == "0" -a "${DRY_RUN}" != "" ]; then
      ${downloader} ${yaml_url} | envsubst >> ${DRY_RUN}
    fi
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
    echo "ERROR: The Kiali operator is not running yet. Please make sure it was deployed successfully."
    exit 1
  else
    echo "The Kiali operator is installed!"
  fi
else
  echo "The Kiali operator has been created but you have opted not to wait for it to start. It will take some time for the image to be pulled and start."
fi

# Now deploy Kiali if we were asked to do so.

print_skip_kiali_create_msg() {
  local _branch="$1"
  local _ns="${OPERATOR_WATCH_NAMESPACE}"
  if [ "${_ns}" == '""' ]; then
    _ns="<any namespace you choose>"
  fi
  echo "=========================================="
  echo "Skipping the automatic Kiali installation."
  echo "To install Kiali, create a Kiali custom resource in the namespace [$_ns]."
  echo "An example Kiali CR with all settings documented can be found here:"
  echo "  https://raw.githubusercontent.com/kiali/kiali/${_branch}/operator/deploy/kiali/kiali_cr.yaml"
  echo "To install Kiali with all default settings, you can run:"
  echo "  ${CLIENT_EXE} apply -n ${_ns} -f https://raw.githubusercontent.com/kiali/kiali/${_branch}/operator/deploy/kiali/kiali_cr.yaml"
  echo "Do not forget to create a secret if you wish to use an auth strategy of 'login' (This is"
  echo "the default setting when installing in Kubernetes but not OpenShift)."
  echo "An example would be:"
  echo "  ${CLIENT_EXE} create secret generic ${SECRET_NAME} -n ${NAMESPACE} --from-literal 'username=admin' --from-literal 'passphrase=admin'"
  echo "=========================================="
}

if [ "${OPERATOR_INSTALL_KIALI}" != "true" ]; then
  if [ "${OPERATOR_VERSION_LABEL}" == "dev" ]; then
    print_skip_kiali_create_msg "master"
  else
    print_skip_kiali_create_msg "${OPERATOR_VERSION_LABEL}"
  fi
  echo "Done."
  exit 0
else
  if [ "${OPERATOR_WATCH_NAMESPACE}" == '""' ]; then
    if [ "${OPERATOR_VERSION_LABEL}" == "dev" ]; then
      print_skip_kiali_create_msg "master"
    else
      print_skip_kiali_create_msg "${OPERATOR_VERSION_LABEL}"
    fi
    echo "Done."
    exit 0
  else
    echo "Kiali will now be installed."
  fi
fi

# Check the login strategy. If using "openshift" there is no other checks to perform,
# but if we are using "login" then we need to make sure there is a username and password set
if [ "${AUTH_STRATEGY}" == "" ]; then
  AUTH_STRATEGY=$(read -p "${_AUTH_STRATEGY_PROMPT}" val && echo -n $val)
  AUTH_STRATEGY=${AUTH_STRATEGY:-${_AUTH_STRATEGY_DEFAULT}}
fi

# Verify the AUTH_STRATEGY is a proper known value
if [ "${AUTH_STRATEGY}" != "login" ] && [ "${AUTH_STRATEGY}" != "openshift" ] && [ "${AUTH_STRATEGY}" != "anonymous" ]; then
  echo "ERROR: unknown AUTH_STRATEGY [$AUTH_STRATEGY] must be either 'login', 'openshift' or 'anonymous'"
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
  CREDENTIALS_CREATE_SECRET="false"
fi

echo "=== KIALI SETTINGS ==="
echo ACCESSIBLE_NAMESPACES=$ACCESSIBLE_NAMESPACES
echo AUTH_STRATEGY=$AUTH_STRATEGY
echo CREDENTIALS_CREATE_SECRET=$CREDENTIALS_CREATE_SECRET
echo GRAFANA_URL=$GRAFANA_URL
echo KIALI_CR=$KIALI_CR
echo KIALI_IMAGE_NAME=$KIALI_IMAGE_NAME
echo KIALI_IMAGE_PULL_POLICY=$KIALI_IMAGE_PULL_POLICY
echo KIALI_IMAGE_VERSION=$KIALI_IMAGE_VERSION
echo ISTIO_NAMESPACE=$ISTIO_NAMESPACE
echo JAEGER_URL=$JAEGER_URL
echo NAMESPACE=$NAMESPACE
echo SECRET_NAME=$SECRET_NAME
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

  ${CLIENT_EXE} create secret generic ${DRY_RUN_ARG} ${SECRET_NAME} -n ${NAMESPACE} --from-literal "username=${CREDENTIALS_USERNAME}" --from-literal "passphrase=${CREDENTIALS_PASSPHRASE}"
  if [ "$?" != "0" ]; then
    echo "ERROR: Failed to create a secret named [${SECRET_NAME}] in namespace [${NAMESPACE}]. Aborting Kiali installation."
    exit 1
  else
    echo "A secret named [${SECRET_NAME}] in namespace [${NAMESPACE}] was created."
  fi
  if [ "${DRY_RUN}" != "" ]; then
    echo "---" >> ${DRY_RUN}
    ${CLIENT_EXE} create secret generic ${DRY_RUN_ARG} ${SECRET_NAME} -n ${NAMESPACE} --from-literal "username=${CREDENTIALS_USERNAME}" --from-literal "passphrase=${CREDENTIALS_PASSPHRASE}" -o yaml >> ${DRY_RUN}
  fi

  ${CLIENT_EXE} label secret ${DRY_RUN_ARG} ${SECRET_NAME} -n ${NAMESPACE} app=kiali
  if [ "$?" != "0" ]; then
    echo "WARNING: Failed to label the created secret [${SECRET_NAME}] in namespace [${NAMESPACE}]."
  fi
  # TODO: Note when doing a dry run we don't actually create the secret so we can't get the secret yaml
  #       with the label using "label secret". So the dry run file will have the secret yaml without the label.
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

echo "Deploying Kiali CR to namespace [${OPERATOR_WATCH_NAMESPACE}]"

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

build_spec_list_value() {
  local var_name=${1}
  local var_value=${!2-_undefined_}
  local var_show_empty=${3:-false}
  if [ "${var_value}" == "_undefined_" -a "${var_show_empty}" == "false" ]; then
    return
  else
    if [ "${var_value}" == "" -o "${var_value}" == "_undefined_" ]; then
      echo "$var_name: []"
    else
      local nl=$'\n'
      local var_name_value="${var_name}:"

      # turn off pathname expansion (set -f) because the namespace regexs may have patterns like ** and *
      set -f
      for item in $var_value
      do
        var_name_value="${var_name_value}${nl}    - \"${item}\""
      done
      set +f

      echo "$var_name_value"
    fi
  fi
}

if [ "${KIALI_CR}" != "" ]; then
  if [ "${DRY_RUN}" != "" ]; then
    echo "---" >> ${DRY_RUN}
    cat "${KIALI_CR}" >> ${DRY_RUN}
  fi
  ${CLIENT_EXE} apply ${DRY_RUN_ARG} -n ${OPERATOR_NAMESPACE} -f "${KIALI_CR}"
  if [ "$?" != "0" ]; then
    echo "ERROR: Failed to deploy Kiali from custom Kiali CR [${KIALI_CR}]. Aborting."
    exit 1
  else
    echo "Deployed Kiali via custom Kiali CR [${KIALI_CR}]"
  fi
else
  _KIALI_CR_YAML=$(cat <<EOF | sed '/^[ ]*$/d'
---
apiVersion: kiali.io/v1alpha1
kind: Kiali
metadata:
  name: kiali
spec:
  $(build_spec_value istio_namespace ISTIO_NAMESPACE)
  auth:
    $(build_spec_value strategy AUTH_STRATEGY)
  deployment:
    $(build_spec_list_value accessible_namespaces ACCESSIBLE_NAMESPACES)
    $(build_spec_value image_name KIALI_IMAGE_NAME)
    $(build_spec_value image_pull_policy KIALI_IMAGE_PULL_POLICY)
    $(build_spec_value image_version KIALI_IMAGE_VERSION)
    $(build_spec_value namespace NAMESPACE)
    $(build_spec_value secret_name SECRET_NAME)
  external_services:
    grafana:
      $(build_spec_value url GRAFANA_URL true)
    jaeger:
      $(build_spec_value url JAEGER_URL true)
EOF
)

  if [ "${DRY_RUN}" != "" ]; then
    echo "${_KIALI_CR_YAML}" >> ${DRY_RUN}
  fi

  echo "${_KIALI_CR_YAML}" | ${CLIENT_EXE} apply ${DRY_RUN_ARG} -n ${OPERATOR_WATCH_NAMESPACE} -f -
  if [ "$?" != "0" ]; then
    echo "ERROR: Failed to deploy Kiali. Aborting."
    exit 1
  fi
fi

echo "Done."
