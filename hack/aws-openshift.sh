#!/bin/bash

##############################################################################
# aws-openshift.sh
#
# Run this script to create/destroy an OpenShift 4 cluster on AWS.
#
# This script takes one command whose value is one of the following:
#       create: starts the OpenShift environment
#      destroy: deletes the OpenShift environment removing persisted data
#       status: outputs the current status of the OpenShift environment
#       routes: outputs all known route URLs
#     services: outputs all known service endpoints (excluding internal openshift services)
#       oc-env: used to configure a shell for 'oc'
#
# This script accepts several options - see --help for details.
#
##############################################################################

########################################
# START FUNCTIONS

infomsg() {
  echo "HACK: $1"
}

warnmsg() {
  echo "HACK: $1" >&2
}

debug() {
  if [ "$_VERBOSE" == "true" ]; then
    infomsg "DEBUG: $1"
  fi
}

get_downloader() {
  if [ -z "$DOWNLOADER" ] ; then
    # Use wget command if available, otherwise try curl
    if which wget > /dev/null 2>&1 ; then
      DOWNLOADER="wget -O"
    else
      if which curl > /dev/null 2>&1 ; then
        DOWNLOADER="curl -L -o"
      fi
    fi

    if [ ! "$DOWNLOADER" ] ; then
      infomsg "ERROR: You must install either curl or wget to allow downloading."
      exit 1
    fi
  fi
  debug "Downloader command to be used: ${DOWNLOADER}"
}

get_installer() {
  if [ -z "$INSTALLER" ] ; then
    # Use dnf command if available, otherwise try yum
    if which dnf > /dev/null 2>&1 ; then
      INSTALLER="sudo dnf"
    else
      if which yum > /dev/null 2>&1 ; then
        INSTALLER="sudo yum"
      fi
    fi

    if [ ! "$INSTALLER" ] ; then
      infomsg "ERROR: Cannot determine your machine's installer (cannot find dnf or yum)."
      exit 1
    fi
  fi
  debug "Installer command to be used: ${INSTALLER}"
}

check_is_running() {
  if ${OC} status > /dev/null 2>&1; then
    _IS_RUNNING="true"
  else
    _IS_RUNNING="false"
  fi
}

oc_login() {
  ${OC} login -u system:admin > /dev/null 2>&1
}

get_console_url() {
  CONSOLE_URL="$(${OC} get console cluster -o jsonpath='{.status.consoleURL}' 2>/dev/null)"
  if [ "$?" != "0" -o "$CONSOLE_URL" == "" ]; then
    CONSOLE_URL="console-not-available"
  fi
}

get_api_server_url() {
  OPENSHIFT_API_SERVER_URL="$(${OC} whoami --show-server)"
}

check_aws_config() {
  if [ -f "${HOME}/.aws/config" -a -f "${HOME}/.aws/credentials" ]; then
    export AWS_PROFILE="$(cat ${HOME}/.aws/credentials | head -n 1 | sed ${SEDOPTIONS} -E 's/\[(.*)\]/\1/')"
  else
    if ! which aws > /dev/null 2>&1 ; then
      infomsg "You need the AWS CLI - installing the awscli package"
      get_installer
      eval ${INSTALLER} install awscli
    fi
    infomsg "===== AWS IS NOT CONFIGURED ====="
    infomsg "You must configure AWS first."
    infomsg "Run this command:"
    infomsg "  aws configure --profile=openshift-dev"
    infomsg "Once you complete that step,"
    infomsg "you can re-run this hack script."
    infomsg "================================="
    exit 1
  fi
}

get_status() {
  echo "====================================================================="
  echo "oc: ${OC}"
  echo "To configure your shell to use 'oc', set these environment variables:"
  echo "  export KUBECONFIG=\"${KUBECONFIG}\""
  echo "  export PATH=\"${OPENSHIFT_DOWNLOAD_PATH}:\$PATH\""
  echo "To do this, you can run this command:"
  echo "  eval \$($0 oc-env)"
  echo "====================================================================="

  check_is_running
  if [ "${_IS_RUNNING}" == "true" ]; then
    if ! ${OC} whoami > /dev/null 2>&1; then
      oc_login
    fi
    get_registry_names
    check_insecure_registry
    get_console_url
    get_api_server_url
    get_worker_node_count
    echo "Version from oc command [${OC}]"
    ${OC} version
    echo "====================================================================="
    echo "Number of worker nodes in cluster: ${OPENSHIFT_WORKER_NODE_COUNT}"
    echo "Age of cluster: $(${OC} get namespace kube-system --no-headers | tr -s ' ' | cut -d ' ' -f3)"
    echo "====================================================================="
    echo "whoami: $(${OC} whoami)"
    echo "====================================================================="
    echo "Status from oc command [${OC}]"
    ${OC} status
    echo "====================================================================="
    echo "Console:    ${CONSOLE_URL}"
    echo "API URL:    ${OPENSHIFT_API_SERVER_URL}"
    echo "Image Repo: ${EXTERNAL_IMAGE_REGISTRY} (${INTERNAL_IMAGE_REGISTRY})"
    echo "====================================================================="
    echo "kubeadmin password: $(cat ${AWS_KUBEADMIN_PASSWORD_FILE})"
    echo "kiali password:     kiali"
    echo "johndoe password:   johndoe"
    echo "====================================================================="
    echo "To push images to the image repo you need to log in."
    echo "You can use docker or podman, and you can use kubeadmin or kiali user."
    echo "  oc login -u kubeadmin -p $(cat ${AWS_KUBEADMIN_PASSWORD_FILE}) ${OPENSHIFT_API_SERVER_URL}"
    echo '  docker login -u kubeadmin -p $(oc whoami -t)' ${EXTERNAL_IMAGE_REGISTRY}
    echo "or"
    echo "  oc login -u kiali -p kiali ${OPENSHIFT_API_SERVER_URL}"
    echo '  podman login --tls-verify=false -u kiali -p $(oc whoami -t)' ${EXTERNAL_IMAGE_REGISTRY}
    echo "====================================================================="
  else
    echo "Cluster appears to be down."
  fi
}

get_registry_names() {
  local ext=$(${OC} get image.config.openshift.io/cluster -o custom-columns=EXT:.status.externalRegistryHostnames[0] --no-headers 2>/dev/null)
  local int=$(${OC} get image.config.openshift.io/cluster -o custom-columns=INT:.status.internalRegistryHostname --no-headers 2>/dev/null)
  EXTERNAL_IMAGE_REGISTRY=${ext:-<unknown>}
  INTERNAL_IMAGE_REGISTRY=${int:-<unknown>}
}

check_insecure_registry() {
  # make sure docker insecure registry is defined
  pgrep -a dockerd | grep "[-]-insecure-registry.*${EXTERNAL_IMAGE_REGISTRY}" > /dev/null 2>&1
  if [ "$?" != "0" ]; then
    grep "OPTIONS=.*--insecure-registry.*${EXTERNAL_IMAGE_REGISTRY}" /etc/sysconfig/docker > /dev/null 2>&1
    if [ "$?" != "0" ]; then
      grep "insecure-registries.*${EXTERNAL_IMAGE_REGISTRY}" /etc/docker/daemon.json > /dev/null 2>&1
      if [ "$?" != "0" ]; then
        infomsg "WARNING: You must tell Docker about the insecure image registry (e.g. --insecure-registry ${EXTERNAL_IMAGE_REGISTRY})."
      else
        debug "/etc/docker/daemon.json has the insecure-registry setting. This is good."
      fi
    else
      debug "/etc/sysconfig/docker has defined the insecure-registry setting. This is good."
    fi
  else
    debug "Docker daemon is running with --insecure-registry setting. This is good."
  fi
}

get_route_url() {
  # takes as input "routeName:routeNamespace"
  local routename=$(echo ${1} | cut -d: -f1)
  local routenamespace=$(echo ${1} | cut -d: -f2)
  local protocol="https"
  local termination=$(${OC} get route ${routename} -n ${routenamespace} -o custom-columns=T:spec.tls.termination --no-headers)
  if [ "${termination}" == "<none>" ]; then
    protocol="http"
  fi
  local host=$(${OC} get route ${routename} -n ${routenamespace} -o custom-columns=H:spec.host --no-headers)

  ROUTE_URL="${protocol}://${host}"
}

print_all_route_urls() {
  allnames_namespaces="$(${OC} get routes --all-namespaces --no-headers -o custom-columns=NAME:.metadata.name,NS:.metadata.namespace | sed ${SEDOPTIONS} 's/  */:/g')"
  for n in ${allnames_namespaces}
  do
    get_route_url ${n}
    printf '=====\n%s\n  %s\n' "${n}" "${ROUTE_URL}"
  done
}

get_service_endpoint() {
  # TODO this needs to be fixed - the host is not right
  # takes as input "serviceName:serviceNamespace"
  local servicename=$(echo ${1} | cut -d: -f1)
  local servicenamespace=$(echo ${1} | cut -d: -f2)
  local data="$(${OC} get service ${servicename} -n ${servicenamespace} -o custom-columns=I:spec.clusterIP,T:spec.type,NP:spec.ports[*].nodePort,P:spec.ports[*].port --no-headers | sed ${SEDOPTIONS} 's/  */:/g')"
  local clusterIP=$(echo ${data} | cut -d: -f1)
  local servicetype=$(echo ${data} | cut -d: -f2)
  local nodeports=$(echo ${data} | cut -d: -f3)
  local ports=$(echo ${data} | cut -d: -f4)
  local host="${AWS_CLUSTER_NAME}.${AWS_BASE_DOMAIN}"
  # only NodePort services are exposed outside so we just show those
  if [ ${servicetype} == "NodePort" ]; then
    SERVICE_ENDPOINT="${host}:${nodeports}"
  else
    if [ "${nodeports}" == "<none>" ]; then
      SERVICE_ENDPOINT="inaccessible - (${servicetype}) ${clusterIP}, ports=${ports}"
    else
      SERVICE_ENDPOINT="inaccessible - (${servicetype}) ${clusterIP}, ports=${nodeports}"
    fi
  fi
}

print_all_service_endpoints() {
  # we do filter out services from the internal openshift* and default namespaces
  allnames_namespaces="$(${OC} get services --all-namespaces --no-headers -o custom-columns=NAME:.metadata.name,NS:.metadata.namespace | sed ${SEDOPTIONS} 's/  */:/g' | grep -v ':openshift*' | grep -v ':default')"
  for n in ${allnames_namespaces}
  do
    get_service_endpoint ${n}
    printf '=====\n%s\n  %s\n' "${n}" "${SERVICE_ENDPOINT}"
  done
}

get_worker_node_count() {
  OPENSHIFT_WORKER_NODE_COUNT="$(${OC} get nodes 2>/dev/null | grep worker | wc -l)"
}

scale_worker_nodes() {
  if [ -z "${1}" ]; then
    infomsg "ERROR: did not provide the number of worker nodes that are desired"
    return
  fi

  local desired_worker_nodes=${1}
  get_worker_node_count
  if [ "${OPENSHIFT_WORKER_NODE_COUNT}" -ge "${desired_worker_nodes}" ]; then
    infomsg "Cluster has [${OPENSHIFT_WORKER_NODE_COUNT}] worker nodes which is enough to satify the requested [${desired_worker_nodes}] worker nodes. No new nodes will be created."
  else
    local additional_worker_nodes_needed=$(expr ${desired_worker_nodes} - ${OPENSHIFT_WORKER_NODE_COUNT})
    infomsg "Cluster has [${OPENSHIFT_WORKER_NODE_COUNT}] worker nodes but [${desired_worker_nodes}] worker nodes are desired. [${additional_worker_nodes_needed}] new nodes will be created."
    if [ "${additional_worker_nodes_needed}" -gt "9" ]; then
      infomsg "WARNING: This hack script will not request more than 9 additional new nodes. You must do so manually."
      return
    fi
    local machineset=$(${OC} get machinesets -n openshift-machine-api -o name 2>/dev/null | head -n 1)
    if [ -z "${machineset}" ]; then
      infomsg "WARNING: Cannot determine a valid machine set - cannot create new nodes"
      return
    fi
    local current_replicas=$(${OC} get ${machineset} -n openshift-machine-api -o jsonpath='{.spec.replicas}')
    local additional_replicas_needed=$(expr ${current_replicas} + ${additional_worker_nodes_needed})
    debug "Will scale the machine set [${machineset}] from [${current_replicas}] to [${additional_replicas_needed}] replicas"
    if [ -z "${additional_replicas_needed}" ]; then
      infomsg "WARNING: Cannot determine how many additional replicas are needed - cannot create new nodes"
      return
    fi
    ${OC} scale --replicas=${additional_replicas_needed} ${machineset} -n openshift-machine-api
  fi
}

# END FUNCTIONS
########################################

# Change to the directory where this script is and set our environment
SCRIPT_ROOT="$( cd "$(dirname "$0")" ; pwd -P )"
cd ${SCRIPT_ROOT}

# The default version of OpenShift to be downloaded
DEFAULT_OPENSHIFT_DOWNLOAD_VERSION="4.8.11"

# The default path under mirror.openshift.com/pub/openshift-v4 where the version downloads are found
DEFAULT_OCP_URL_PATH="ocp"

# The default number of worker nodes that should be in the cluster.
DEFAULT_OPENSHIFT_REQUIRED_WORKER_NODES="4"

# The default domain for the AWS OpenShift cluster
DEFAULT_AWS_BASE_DOMAIN="devcluster.openshift.com"

# The name of the OpenShift cluster - Kerberos username must be the prefix
DEFAULT_AWS_CLUSTER_NAME="${USER}-dev"

# The AWS region where the cluster will be installed.
DEFAULT_AWS_REGION="us-east-1"

# If true, will ignore the version check (use this if the installer or client releases do not report correct versions).
IGNORE_VERSION_CHECK="false"

# process command line args to override environment
_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in

    # COMMANDS

    create|start|up)
      _CMD="create"
      shift
      ;;
    destroy|delete|stop|down)
      _CMD="destroy"
      shift
      ;;
    status)
      _CMD="status"
      shift
      ;;
    routes)
      _CMD="routes"
      shift
      ;;
    services)
      _CMD="services"
      shift
      ;;
    oc-env)
      _CMD="oc-env"
      shift
      ;;
    kubeadmin-pw)
      _CMD="kubeadmin-pw"
      shift
      ;;
    api-host)
      _CMD="api-host"
      shift
      ;;

    # OPTIONS CONFIGURING THE HACK SCRIPT ITSELF AND THE CLUSTER

    -ar|--aws-region)
      AWS_REGION="$2"
      shift;shift
      ;;
    -bd|--base-domain)
      AWS_BASE_DOMAIN="$2"
      shift;shift
      ;;
    -cn|--cluster-name)
      AWS_CLUSTER_NAME="$2"
      shift;shift
      ;;
    -dd|--download-dir)
      OPENSHIFT_DOWNLOAD_BASEPATH="$2"
      shift;shift
      ;;
    -ivc|--ignore-version-check)
      IGNORE_VERSION_CHECK="$2"
      shift;shift
      ;;
    -kuca|--kiali-user-cluster-admin)
      KIALI_USER_IS_CLUSTER_ADMIN="$2"
      shift;shift
      ;;
    -lp|--local-platform)
      LOCAL_PLATFORM="$2"
      shift;shift
      ;;
    -odp|--ocp-dev-preview)
      OCP_URL_PATH="ocp-dev-preview"
      shift
      ;;
    -ov|--openshift-version)
      OPENSHIFT_DOWNLOAD_VERSION="$2"
      shift;shift
      ;;
    -p|--pull-secret-file)
      PULL_SECRET_FILE="$2"
      if [ ! -f ${PULL_SECRET_FILE} ]; then
        infomsg "ERROR: Pull secret file is invalid: ${PULL_SECRET_FILE}"
        exit 1
      fi
      shift;shift
      ;;
    -rn|--required-nodes)
      OPENSHIFT_REQUIRED_WORKER_NODES="$2"
      shift;shift
      ;;
    -sk|--ssh-key)
      SSH_PUBLIC_KEY_FILE="$2"
      if [ ! -f ${SSH_PUBLIC_KEY_FILE} ]; then
        infomsg "ERROR: SSH public key file is invalid: ${SSH_PUBLIC_KEY_FILE}"
        exit 1
      fi
      shift;shift
      ;;
    -v|--verbose)
      _VERBOSE=true
      shift
      ;;

    # HELP

    -h|--help)
      cat <<HELPMSG

$0 [option...] command

Valid options that configure the hack script itself and the cluster:

  -ar|--aws-region <name>
      The AWS region where the cluster will be deployed.
      Options: us-east-1, us-east-2, us-west-1, us-west-2, eu-west-2, eu-west-3, sa-east-1
      Default: ${DEFAULT_AWS_REGION}
  -bd|--base-domain <name>
      The base domain name for the OpenShift cluster.
      Default: ${DEFAULT_AWS_BASE_DOMAIN}
  -cn|--cluster-name <name>
      The name of the OpenShift cluster.
      Default: ${DEFAULT_AWS_CLUSTER_NAME}
  -dd|--download-dir <dir>
      Directory where the OpenShift binaries are or will be stored when downloaded.
      Default: ${HOME}/openshift
  -ivc|--ignore-version-check (true|false)
      If true, this script will continue even if it detects you have installed a different
      version than the one asked for (--openshift-version).
      Default: false
  -kuca|--kiali-user-cluster-admin (true|false)
      Determines if the "kiali" OpenShift user is to be given cluster admin rights.
      Default: not set - you will be prompted during startup
      Used only for the 'create' command.
  -lp|--local-platform <platform>
      The platform indicator to determine what binaries to download.
      Default: linux (mac if MacOS is detected)
  -odp|--ocp-dev-preview
      If specified, the OCP installer and client will be downloaded from the ocp-dev-preview download location.
      This assumes the version specified (-ov) is a dev preview version and not a released version.
  -ov|--openshift-version <version>
      The version of OpenShift to use.
      Default: ${DEFAULT_OPENSHIFT_DOWNLOAD_VERSION}
  -p|--pull-secret-file <filename>
      Specifies the file containing your Image pull secret.
      You can download it from https://cloud.redhat.com/openshift/install/metal/user-provisioned
      Used only for the 'create' command.
      Default: not set (you will be prompted for the pull secret json at startup if it does not exist yet)
  -rn|--required-nodes <node count>
      The number of required worker nodes in the cluster. If the number of worker nodes in the cluster is less than
      the given value, new nodes will be requested to bring it up to the number of nodes specified by the given value.
      Default: ${DEFAULT_OPENSHIFT_REQUIRED_WORKER_NODES}
      Used only for the 'create' command.
  -sk|--ssh-key <path to SSH public key file>
      If provided, this is a file containing the SSH public key that will be used when performing installation
      debugging. This is optional, but without it you may have difficulty debugging installation errors.
      Used only for the 'create' command.
  -v|--verbose
      Enable logging of debug messages from this script.

The command must be one of:

  * create: Starts OpenShift.
  * destroy: Stops OpenShift and removes all persistent data.
  * status: Information about the OpenShift cluster.
  * routes: Outputs URLs for all known routes.
  * services: Outputs URLs for all known service endpoints (excluding internal openshift services).
  * oc-env: Used to configure a shell for 'oc'.
  * kubeadmin-pw: Prints the kubeadmin password.
  * api-host: Prints the expected hostname for the cluster API endpoint. This is used by the 'oc login' command.

HELPMSG
      exit 1
      ;;
    *)
      infomsg "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

########################################
# Environment setup section starts here.

# This avoids some timeout problems during cluster create
unset SSH_AUTH_SOCK

#--------------------------------------------------------------
# Variables below have values that can be overridden by
# command line options (see above) or by environment variables.
#--------------------------------------------------------------

# if sed is gnu-sed then set option to work in posix mode to be compatible with non-gnu-sed versions
if sed --posix 's/ / /' < /dev/null > /dev/null 2>&1 ; then
  SEDOPTIONS="--posix"
fi

# the OpenShift binaries are available for linux and mac platforms
if [ "${LOCAL_PLATFORM}" == "" ]; then
  LOCAL_PLATFORM="linux"
  if [ "$(uname | tr '[:upper:]' '[:lower:]')" == "darwin" ]; then
    LOCAL_PLATFORM="mac"
  fi
fi
debug "The local operating system platform: ${LOCAL_PLATFORM}"

# This is where you want the OpenShift binaries to go
OPENSHIFT_DOWNLOAD_BASEPATH="${OPENSHIFT_DOWNLOAD_BASEPATH:-${HOME}/openshift}"

# Settings for the install-config.yaml configuration settings
AWS_BASE_DOMAIN="${AWS_BASE_DOMAIN:-${DEFAULT_AWS_BASE_DOMAIN}}"
AWS_CLUSTER_NAME="${AWS_CLUSTER_NAME:-${DEFAULT_AWS_CLUSTER_NAME}}"
AWS_REGION="${AWS_REGION:-${DEFAULT_AWS_REGION}}"

# The minimum number of worker nodes the cluster needs to have
OPENSHIFT_REQUIRED_WORKER_NODES=${OPENSHIFT_REQUIRED_WORKER_NODES:-${DEFAULT_OPENSHIFT_REQUIRED_WORKER_NODES}}

#--------------------------------------------------------------
# Variables below have values derived from the variables above.
# These variables below are not meant for users to change.
#--------------------------------------------------------------

OPENSHIFT_DOWNLOAD_VERSION="${OPENSHIFT_DOWNLOAD_VERSION:-${DEFAULT_OPENSHIFT_DOWNLOAD_VERSION}}"
OPENSHIFT_DOWNLOAD_PATH="${OPENSHIFT_DOWNLOAD_BASEPATH}/${OPENSHIFT_DOWNLOAD_VERSION}"
mkdir -p "${OPENSHIFT_DOWNLOAD_PATH}" 2> /dev/null
if [ ! -d "${OPENSHIFT_DOWNLOAD_PATH}" ]; then
  infomsg "ERROR: Cannot find or create the download directory. It is currently set to: ${OPENSHIFT_DOWNLOAD_PATH}"
  exit 1
fi
OPENSHIFT_INSTALL_PATH="${OPENSHIFT_DOWNLOAD_PATH}/install_dir"
mkdir -p "${OPENSHIFT_INSTALL_PATH}"
debug "The OpenShift binaries will be downloaded into directory: ${OPENSHIFT_DOWNLOAD_PATH}"
debug "The OpenShift installer install directory will be: ${OPENSHIFT_INSTALL_PATH}"

# Determine where to get the binaries and their full paths and how to execute them.
OPENSHIFT_INSTALLER_DOWNLOAD_LOCATION="https://mirror.openshift.com/pub/openshift-v4/clients/${OCP_URL_PATH:-${DEFAULT_OCP_URL_PATH}}/${OPENSHIFT_DOWNLOAD_VERSION}/openshift-install-${LOCAL_PLATFORM}-${OPENSHIFT_DOWNLOAD_VERSION}.tar.gz"
OPENSHIFT_CLIENT_DOWNLOAD_LOCATION="https://mirror.openshift.com/pub/openshift-v4/clients/${OCP_URL_PATH:-${DEFAULT_OCP_URL_PATH}}/${OPENSHIFT_DOWNLOAD_VERSION}/openshift-client-${LOCAL_PLATFORM}-${OPENSHIFT_DOWNLOAD_VERSION}.tar.gz"

OPENSHIFT_INSTALLER_EXE="${OPENSHIFT_DOWNLOAD_PATH}/openshift-install"
OC="${OPENSHIFT_DOWNLOAD_PATH}/oc"

AWS_KUBEADMIN_PASSWORD_FILE="${OPENSHIFT_INSTALL_PATH}/auth/kubeadmin-password"
AWS_KUBECONFIG="${OPENSHIFT_INSTALL_PATH}/auth/kubeconfig"

check_aws_config

if [ "$_VERBOSE" == "true" ]; then
  LOG_LEVEL_ARG="--log-level debug"
fi

# Environment setup section stops here.
########################################

debug "ENVIRONMENT:
  command=$_CMD
  AWS_BASE_DOMAIN=$AWS_BASE_DOMAIN
  AWS_CLUSTER_NAME=$AWS_CLUSTER_NAME
  AWS_KUBEADMIN_PASSWORD_FILE=$AWS_KUBEADMIN_PASSWORD_FILE
  AWS_KUBECONFIG=$AWS_KUBECONFIG
  AWS_PROFILE=$AWS_PROFILE
  AWS_REGION=$AWS_REGION
  LOCAL_PLATFORM=$LOCAL_PLATFORM
  OC=$OC
  OPENSHIFT_CLIENT_DOWNLOAD_LOCATION=$OPENSHIFT_CLIENT_DOWNLOAD_LOCATION
  OPENSHIFT_DOWNLOAD_BASEPATH=$OPENSHIFT_DOWNLOAD_BASEPATH
  OPENSHIFT_DOWNLOAD_PATH=$OPENSHIFT_DOWNLOAD_PATH
  OPENSHIFT_DOWNLOAD_VERSION=$OPENSHIFT_DOWNLOAD_VERSION
  OPENSHIFT_INSTALL_PATH=$OPENSHIFT_INSTALL_PATH
  OPENSHIFT_INSTALLER_DOWNLOAD_LOCATION=$OPENSHIFT_INSTALLER_DOWNLOAD_LOCATION
  OPENSHIFT_INSTALLER_EXE=$OPENSHIFT_INSTALLER_EXE
  OPENSHIFT_REQUIRED_WORKER_NODES=$OPENSHIFT_REQUIRED_WORKER_NODES
  SEDOPTIONS=$SEDOPTIONS
  SSH_PUBLIC_KEY_FILE=$SSH_PUBLIC_KEY_FILE
  "

# Download the installer if we do not have it yet
if [ -f "${OPENSHIFT_INSTALLER_EXE}" ]; then
  _existingVersion=$(${OPENSHIFT_INSTALLER_EXE} version | head -n 1 | sed ${SEDOPTIONS} 's/^.* v\{0,1\}\([0-9.]*\).*/\1/')
  _desiredVersion=$(echo -n ${OPENSHIFT_DOWNLOAD_VERSION} | sed ${SEDOPTIONS} 's/^\([0-9.]*\).*/\1/')
  if [ "${_existingVersion}" != "${_desiredVersion}" ]; then
    warnmsg "===== WARNING ====="
    warnmsg "You already have the OpenShift installer but it does not match the version you want."
    warnmsg "This appears incorrect: ${OPENSHIFT_INSTALLER_EXE}"
    warnmsg "The version of the installer is: ${_existingVersion}"
    warnmsg "You asked for version: ${_desiredVersion} (${OPENSHIFT_DOWNLOAD_VERSION})"
    warnmsg "===== WARNING ====="
    if [ "${IGNORE_VERSION_CHECK}" != "true" ]; then
      exit 1
    fi
  fi
  debug "Existing OpenShift installer version (${_existingVersion}) matches the desired version (${_desiredVersion}; download version ${OPENSHIFT_DOWNLOAD_VERSION})"
else
  infomsg "Downloading OpenShift installer to ${OPENSHIFT_DOWNLOAD_PATH}"
  get_downloader
  eval ${DOWNLOADER} "${OPENSHIFT_DOWNLOAD_PATH}/installer.tar.gz" "${OPENSHIFT_INSTALLER_DOWNLOAD_LOCATION}"
  if [ "$?" != "0" ]; then
    infomsg "===== WARNING ====="
    infomsg "Could not download the OpenShift installer for the version you want."
    infomsg "Make sure this is valid: ${OPENSHIFT_INSTALLER_DOWNLOAD_LOCATION}"
    infomsg "===== WARNING ====="
    rm "${OPENSHIFT_DOWNLOAD_PATH}/installer.tar.gz"
    exit 1
  fi
  tar xvfz "${OPENSHIFT_DOWNLOAD_PATH}/installer.tar.gz" -C "${OPENSHIFT_DOWNLOAD_PATH}"
  if [ ! -f "${OPENSHIFT_INSTALLER_EXE}" ]; then
    infomsg "===== WARNING ====="
    infomsg "Failed to extract the OpenShift installer."
    infomsg "Expecting: ${OPENSHIFT_INSTALLER_EXE}"
    infomsg "Make sure this is valid: ${OPENSHIFT_DOWNLOAD_PATH}/installer.tar.gz"
    infomsg "===== WARNING ====="
    exit 1
  fi
fi

debug "OpenShift installer that will be used: ${OPENSHIFT_INSTALLER_EXE}"
debug "$(${OPENSHIFT_INSTALLER_EXE} version)"

# Download the client tarball if we do not have it yet
if [ -f "${OC}" ]; then
  _existingVersion=$(${OC} version --client | head -n 1 | sed ${SEDOPTIONS} 's/^[^0-9]*\([0-9.]*\).*/\1/')
  _desiredVersion=$(echo -n ${OPENSHIFT_DOWNLOAD_VERSION} | sed ${SEDOPTIONS} 's/^\([0-9.]*\).*/\1/')
  if [ "${_existingVersion}" != "${_desiredVersion}" ]; then
    warnmsg "===== WARNING ====="
    warnmsg "You already have the OpenShift oc client but it does not match the version you want."
    warnmsg "This appears incorrect: ${OC}"
    warnmsg "The version of the oc client is: ${_existingVersion}"
    warnmsg "You asked for version: ${_desiredVersion} (${OPENSHIFT_DOWNLOAD_VERSION})"
    warnmsg "===== WARNING ====="
    if [ "${IGNORE_VERSION_CHECK}" != "true" ]; then
      exit 1
    fi
  fi
  debug "Existing OpenShift oc client version (${_existingVersion}) matches the desired version (${_desiredVersion}; download version ${OPENSHIFT_DOWNLOAD_VERSION})"
else
  infomsg "Downloading OpenShift oc client to ${OPENSHIFT_DOWNLOAD_PATH}"
  get_downloader
  eval ${DOWNLOADER} "${OPENSHIFT_DOWNLOAD_PATH}/client.tar.gz" "${OPENSHIFT_CLIENT_DOWNLOAD_LOCATION}"
  if [ "$?" != "0" ]; then
    infomsg "===== WARNING ====="
    infomsg "Could not download the OpenShift oc client for the version you want."
    infomsg "Make sure this is valid: ${OPENSHIFT_CLIENT_DOWNLOAD_LOCATION}"
    infomsg "===== WARNING ====="
    rm "${OPENSHIFT_DOWNLOAD_PATH}/client.tar.gz"
    exit 1
  fi
  tar xvfz "${OPENSHIFT_DOWNLOAD_PATH}/client.tar.gz" -C "${OPENSHIFT_DOWNLOAD_PATH}"
  if [ ! -f "${OC}" ]; then
    infomsg "===== WARNING ====="
    infomsg "Failed to extract the OpenShift oc client."
    infomsg "Expecting: ${OC}"
    infomsg "Make sure this is valid: ${OPENSHIFT_DOWNLOAD_PATH}/client.tar.gz"
    infomsg "===== WARNING ====="
    exit 1
  fi
fi

debug "OpenShift oc client that will be used: ${OC}"
debug "$(${OC} version --client)"

cd ${OPENSHIFT_DOWNLOAD_PATH}
export KUBECONFIG="${AWS_KUBECONFIG}"

if [ "$_CMD" = "create" ]; then

  check_is_running
  if [ "${_IS_RUNNING}" == "true" ]; then
    infomsg "The OpenShift cluster is already up - nothing to do."
    exit 0
  fi

  infomsg "Starting the OpenShift cluster..."

  if [ -f "${PULL_SECRET_FILE}" ]; then
    _PULL_SECRET="$(cat ${PULL_SECRET_FILE})"
  else
    _PULL_SECRET="$(read -sp 'Enter your pull secret - get it from https://cloud.redhat.com/openshift/install/aws/installer-provisioned : ' val && echo -n $val)"
    echo "${_PULL_SECRET}" | sed ${SEDOPTIONS} 's/./*/g'
  fi

  if [ "${SSH_PUBLIC_KEY_FILE}" != "" ]; then
    _SSH_KEY_YAML="sshKey: $(cat ${SSH_PUBLIC_KEY_FILE})"
  fi

  cat <<EOM > ${OPENSHIFT_INSTALL_PATH}/install-config.yaml
apiVersion: v1
baseDomain: ${AWS_BASE_DOMAIN}
metadata:
  name: ${AWS_CLUSTER_NAME}
platform:
  aws:
    region: ${AWS_REGION}
pullSecret: '${_PULL_SECRET}'
${_SSH_KEY_YAML}
EOM

  ${OPENSHIFT_INSTALLER_EXE} ${LOG_LEVEL_ARG} create cluster --dir "${OPENSHIFT_INSTALL_PATH}"
  if [ "$?" != "0" ]; then
    infomsg "===== ERROR ====="
    infomsg "ERROR: Failed to start the OpenShift cluster."
    infomsg "If you get an error that looks like this:"
    infomsg "  Tried to create resource record set [name='XXX', type='A'] but it already exists"
    infomsg "then you need to remove that record following these instructions:"
    infomsg "  https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-deleting.html"
    infomsg "===== ERROR ====="
    exit 1
  fi

  oc_login
  get_console_url
  echo -n "Waiting for OpenShift console at ${CONSOLE_URL} ..."
  while ! curl --head -s -k ${CONSOLE_URL} | head -n 1 | grep -q "200[[:space:]]*OK"
  do
    sleep 5
    get_console_url
    echo -n "."
  done
  echo "Done."
  infomsg "OpenShift is ready and the console is accessible."

  # see https://docs.openshift.com/container-platform/4.1/authentication/identity_providers/configuring-htpasswd-identity-provider.html
  # we need to be admin in order to create the htpasswd oauth and users
  infomsg "Creating users 'kiali' and 'johndoe'"
  cat <<EOM | ${OC} apply -f -
---
# Secret containing two htpasswd credentials:
#   kiali:kiali
#   johndoe:johndoe
apiVersion: v1
metadata:
  name: htpasswd
  namespace: openshift-config
data:
  htpasswd: a2lhbGk6JDJ5JDA1JHhrV1NNY0ZIUXkwZ2RDMUltLnJDZnVsV2NuYkhDQ2w2bDhEdjFETWEwV1hLRzc4U2tVcHQ2CmpvaG5kb2U6JGFwcjEkRzhhL2x1My4kRnc5RjJUczFKNUFKRUNJc05KN1RWLgo=
kind: Secret
type: Opaque
---
apiVersion: config.openshift.io/v1
kind: OAuth
metadata:
  name: cluster
spec:
  identityProviders:
  - name: htpasswd
    type: HTPasswd
    mappingMethod: claim
    htpasswd:
      fileData:
        name: htpasswd
EOM

  if [ "${KIALI_USER_IS_CLUSTER_ADMIN}" == "" ]; then
    infomsg 'Do you want the kiali user to be assigned the cluster-admin role?'
    infomsg 'Select "1" for Yes and "2" for No:'
    select yn in "Yes" "No"; do
      case $yn in
        Yes )
          KIALI_USER_IS_CLUSTER_ADMIN="true"
          break;;
        No )
          KIALI_USER_IS_CLUSTER_ADMIN="false"
          break;;
      esac
    done
  fi

  if [ "${KIALI_USER_IS_CLUSTER_ADMIN}" == "true" ]; then
    infomsg "Will assign the cluster-admin role to the kiali user."
    ${OC} adm policy add-cluster-role-to-user cluster-admin kiali
  else
    infomsg "Kiali user will not be assigned the cluster-admin role."
  fi

  # Make sure the image registry is exposed via the default route
  if [ "$(${OC} get config.imageregistry.operator.openshift.io/cluster -o jsonpath='{.spec.defaultRoute}')" != "true" ]; then
    infomsg "Manually patching image registry operator to expose the internal image registry"
    ${OC} patch config.imageregistry.operator.openshift.io/cluster --patch '{"spec":{"defaultRoute":true}}' --type=merge
  else
    debug "The image registry operator has exposed the internal image registry"
  fi

  # Ask for the nodes we want
  scale_worker_nodes ${OPENSHIFT_REQUIRED_WORKER_NODES}

  # show the status message
  get_status

elif [ "$_CMD" = "destroy" ]; then

  infomsg "Will delete the OpenShift cluster - this removes all persisted data."
  ${OPENSHIFT_INSTALLER_EXE} ${LOG_LEVEL_ARG} destroy cluster --dir "${OPENSHIFT_INSTALL_PATH}"

elif [ "$_CMD" = "status" ]; then

  get_status
  if [ "${_IS_RUNNING}" != "true" ]; then
    exit 1
  fi

elif [ "$_CMD" = "routes" ]; then

  print_all_route_urls

elif [ "$_CMD" = "services" ]; then

  print_all_service_endpoints

elif [ "$_CMD" = "oc-env" ]; then

  echo "export KUBECONFIG=\"${KUBECONFIG}\""
  echo "export PATH=\"${OPENSHIFT_DOWNLOAD_PATH}:\$PATH\""
  echo "# Run this command to configure your shell:"
  echo "# eval \$($0 oc-env)"

elif [ "$_CMD" = "kubeadmin-pw" ]; then

  if ! cat ${AWS_KUBEADMIN_PASSWORD_FILE}; then
    echo "You must install an AWS cluster in order to have a kubeadmin password."
  fi

elif [ "$_CMD" = "api-host" ]; then

  echo "api.${AWS_CLUSTER_NAME}.${AWS_BASE_DOMAIN}:6443"

else
  infomsg "ERROR: Missing command. See --help for usage."
  exit 1
fi
