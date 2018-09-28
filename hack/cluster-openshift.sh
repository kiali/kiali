#!/bin/bash

##############################################################################
# cluster-openshift.sh
#
# Run this script to start/stop OpenShift cluster with Istio.
# This can also optionally install Kiali.
#
# This script takes one command whose value is one of the following:
#       up: starts the OpenShift environment
#     down: stops the OpenShift environment
#   status: outputs the current status of the OpenShift environment
#
# This script accepts several options - see --help for details.
#
# This script utilizes openshift-istio/origin and its istiooc tool.
# If you do not have it, this script will download it for you.
#
##############################################################################

debug() {
  if [ "$_VERBOSE" == "true" ]; then
    echo "DEBUG: $1"
  fi
}

# Change to the directory where this script is and set our env
cd "$(dirname "${BASH_SOURCE[0]}")"

# The default version of the istiooc command to be downloaded
DEFAULT_MAISTRA_ISTIO_OC_DOWNLOAD_VERSION="v3.10.0+maistra-0.1.0-3"

# The default installation custom resource used to define what to install
DEFAULT_MAISTRA_INSTALL_YAML="https://raw.githubusercontent.com/Maistra/openshift-ansible/maistra-0.1.0-ocp-3.1.0-istio-1.0.0/istio/cr-minimal.yaml"

# set the default openshift address here so that it can be used for the usage text
#
# This is the IP address where OpenShift will bind its master.
# This should be a valid IP address for the machine where OpenShift is installed.
if which ip > /dev/null ; then
  DEFAULT_OPENSHIFT_IP_ADDRESS=`echo $(ip -f inet addr | grep 'state UP' -A1 | tail -n1 | awk '{print $2}' | cut -f1 -d'/')`
else
  DEFAULT_OPENSHIFT_IP_ADDRESS="127.0.0.1"
fi

# process command line args to override environment
_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    up)
      _CMD="up"
      shift
      ;;
    down)
      _CMD="down"
      shift
      ;;
    status)
      _CMD="status"
      shift
      ;;
    -v|--verbose)
      _VERBOSE=true
      shift
      ;;
    -b|--bin-dir)
      OPENSHIFT_BIN_PATH="$2"
      shift;shift
      ;;
    -a|--address)
      OPENSHIFT_IP_ADDRESS="$2"
      shift;shift
      ;;
    -ie|--istio-enabled)
      ISTIO_ENABLED="$2"
      shift;shift
      ;;
    -iv|--istio-version)
      ISTIO_VERSION="$2"
      shift;shift
      ;;
    -iov|--istiooc-version)
      MAISTRA_ISTIO_OC_DOWNLOAD_VERSION="$2"
      shift;shift
      ;;
    -iop|--istiooc-platform)
      MAISTRA_ISTIO_OC_DOWNLOAD_PLATFORM="$2"
      shift;shift
      ;;
    -ioy|--istiooc-install-yaml)
      MAISTRA_INSTALL_YAML="$2"
      shift;shift
      ;;
    -p|--persistence-dir)
      OPENSHIFT_PERSISTENCE_DIR="$2"
      shift;shift
      ;;
    -ke|--kiali-enabled)
      KIALI_ENABLED="$2"
      shift;shift
      ;;
    -kv|--kiali-version)
      KIALI_VERSION="$2"
      shift;shift
      ;;
    -ku|--kiali-username)
      KIALI_USERNAME="$2"
      shift;shift
      ;;
    -kp|--kiali-password)
      KIALI_PASSWORD="$2"
      shift;shift
      ;;
    --cluster-options)
      CLUSTER_OPTIONS="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG

$0 [option...] command

Valid options:
  -v|--verbose
      Enable logging of debug messages from this script.
  -b|--bin-dir <dir>
      Directory where the OpenShift binaries are or will be stored when downloaded.
      Default: ${HOME}/bin
  -h|--help : this message
  -a|--address <address>
      The public IP or named address bound to by the OpenShift cluster.
      Default: ${DEFAULT_OPENSHIFT_IP_ADDRESS}
      Used only for the 'up' command.
  -ie|--istio-enabled (true|false)
      When set to true, Istio will be installed in OpenShift.
      Default: true
      Used only for the 'up' command.
  -iv|--istio-version <version>
      The version of Istio that the istiooc binary will install.
      If this is not specified, this will be whatever the istiooc binary installs by default.
      Default: none
  -iov|--istiooc-version <version>
      The version of the istiooc binary to use.
      If one does not exist in the bin directory, it will be downloaded there.
      Default: ${DEFAULT_MAISTRA_ISTIO_OC_DOWNLOAD_VERSION}
  -iop|--istiooc-platform (linux|darwin)
      The platform indicator to determine what istiooc binary executable to download.
      Default: linux (darwin if Mac is detected)
  -ioy|--istiooc-install-yaml <file or url>
      Points to the YAML file that defines the Installation custom resource which declares what to install.
      Default: ${DEFAULT_MAISTRA_INSTALL_YAML}
  -ke|--kiali-enabled (true|false)
      When set to true, Kiali will be installed in OpenShift.
      Default: false
      Used only for the 'up' command.
  -ku|--kiali-username <username>
      The username needed when logging into Kiali.
      Default: admin
      Used only for the 'up' command.
  -kp|--kiali-password <password>
      The password needed when logging into Kiali.
      Default: admin
      Used only for the 'up' command.
  -kv|--kiali-version <version>
      The Kiali version to be installed in OpenShift.
      Default: v0.5.0
      Used only for the 'up' command.
  -p|--persistence-dir <dir>
      When set, OpenShift will persist data to this directory.
      Restarting OpenShift will restore its previous state when this is set.
      If not set, OpenShift will start clean every time.
      Default: /var/lib/origin/persistent.data
  --cluster-options <options>
      These are additional custom options you want to pass to the cluster.
      Used only for the 'up' command.
      Default: none

The command must be either: up, down, or status
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

########################################
# Environment setup section starts here.

#--------------------------------------------------------------
# Variables below have values that can be overridden by
# command line options (see above) or by environment variables.
#--------------------------------------------------------------

# This is where you want the OpenShift binaries to go
OPENSHIFT_BIN_PATH="${OPENSHIFT_BIN_PATH:=${HOME}/bin}"

# This is the IP address where OpenShift will bind its master.
# This should be a valid IP address for the machine where OpenShift is installed.

if [ ! "$OPENSHIFT_IP_ADDRESS" ] ; then
  OPENSHIFT_IP_ADDRESS=${DEFAULT_OPENSHIFT_IP_ADDRESS}
fi

# The version is the tag from the openshift-istio/origin release builds.
# The platform is either "linux" or "darwin".
MAISTRA_ISTIO_OC_DOWNLOAD_VERSION="${MAISTRA_ISTIO_OC_DOWNLOAD_VERSION:-${DEFAULT_MAISTRA_ISTIO_OC_DOWNLOAD_VERSION}}"
DEFAULT_OS_VERSION=linux
DETECTED_OS_VERSION=`uname | tr '[:upper:]' '[:lower:]'`
if [ "${DETECTED_OS_VERSION}" = "linux" -o "${DETECTED_OS_VERSION}" = "darwin" ] ; then
  DEFAULT_OS_VERSION=${DETECTED_OS_VERSION}
  debug "The operating system has been detected as ${DEFAULT_OS_VERSION}"
fi
MAISTRA_ISTIO_OC_DOWNLOAD_PLATFORM="${MAISTRA_ISTIO_OC_DOWNLOAD_PLATFORM:-${DEFAULT_OS_VERSION}}"

# Defines where the Installation yaml is to be found.
MAISTRA_INSTALL_YAML="${MAISTRA_INSTALL_YAML:-${DEFAULT_MAISTRA_INSTALL_YAML}}"

# if sed is gnu-sed then set option to work in posix mode to be compatible with non-gnu-sed versions
if sed --posix 's/ / /' < /dev/null > /dev/null 2>&1 ; then
  SEDOPTIONS="--posix"
fi

# If you want to persist data across restarts of OpenShift, set to the persistence directory.
# If you set this to "" then no persistence will be used
# Note: ${v=d} is used on purpose so we do not persist if the directory was explicitly set to "".
OPENSHIFT_PERSISTENCE_DIR="${OPENSHIFT_PERSISTENCE_DIR=/var/lib/origin/persistent.data}"

# If ISTIO_ENABLED=true, then the istiooc command will install a version of Istio for you.
ISTIO_ENABLED="${ISTIO_ENABLED:-true}"

# If you set KIALI_ENABLED=true, then the istiooc command will install a version of Kiali for you.
# If that is set to false, the other KIALI_ environment variables will be ignored.
# NOTE: The USERNAME and PASSWORD settings are not used today. For future use.
KIALI_ENABLED="${KIALI_ENABLED:-false}"
KIALI_VERSION="${KIALI_VERSION:-v0.7}"
KIALI_USERNAME="${KIALI_USERNAME:-admin}"
KIALI_PASSWORD="${KIALI_PASSWORD:-admin}"

#--------------------------------------------------------------
# Variables below have values derived from the variables above.
# These variables below are not meant for users to change.
#--------------------------------------------------------------

# See if sudo is required. It is required if the user is not in the docker group.
if groups ${USER} | grep >/dev/null 2>&1 '\bdocker\b'; then
  DOCKER_SUDO=
else
  DOCKER_SUDO=sudo
fi

# Determine where to get the binary executable and its full path and how to execute it.
# This download URL is where to the binary is on the github release page.
MAISTRA_ISTIO_OC_DOWNLOAD_LOCATION="https://github.com/Maistra/origin/releases/download/${MAISTRA_ISTIO_OC_DOWNLOAD_VERSION}/istiooc_${MAISTRA_ISTIO_OC_DOWNLOAD_PLATFORM}"
MAISTRA_ISTIO_OC_EXE_NAME=istiooc
MAISTRA_ISTIO_OC_EXE_PATH="${OPENSHIFT_BIN_PATH}/${MAISTRA_ISTIO_OC_EXE_NAME}"
MAISTRA_ISTIO_OC_COMMAND="${MAISTRA_ISTIO_OC_EXE_PATH}"

# If Istio is to be installed, set the proper istiooc enable option value that will be needed.
# Note that the --enable option is only used if the cluster was never initialized. Do not use it otherwise.
if [ ! -d "${OPENSHIFT_PERSISTENCE_DIR}" ]; then
  if [ "${ISTIO_ENABLED}" == "true" ]; then
    ENABLE_ARG="--enable=*,istio"
  else
    ENABLE_ARG="--enable=*,-istio"
  fi
fi

# If we are to persist data across restarts, set the proper arguments
if [ "${OPENSHIFT_PERSISTENCE_DIR}" != "" ]; then
  OPENSHIFT_PERSISTENCE_ARGS="--base-dir=${OPENSHIFT_PERSISTENCE_DIR}"
fi

# If Kiali is to be installed, set up some things that may be needed
if [ "${KIALI_ENABLED}" == "true" ]; then
  echo Kiali is enabled and will be installed.
fi

# Operator Tempate Variables - export these so the template can see them
export OPENSHIFT_ISTIO_MASTER_PUBLIC_URL="https://${OPENSHIFT_IP_ADDRESS}:8443"
if [ "${ISTIO_VERSION}" != "" ]; then
  export OPENSHIFT_ISTIO_VERSION="${ISTIO_VERSION}"
fi

# Environment setup section stops here.
########################################

debug "ENVIRONMENT:
  command=$_CMD
  OPENSHIFT_BIN_PATH=$OPENSHIFT_BIN_PATH
  OPENSHIFT_IP_ADDRESS=$OPENSHIFT_IP_ADDRESS
  OPENSHIFT_PERSISTENCE_DIR=$OPENSHIFT_PERSISTENCE_DIR
  MAISTRA_ISTIO_OC_DOWNLOAD_VERSION=$MAISTRA_ISTIO_OC_DOWNLOAD_VERSION
  MAISTRA_ISTIO_OC_DOWNLOAD_PLATFORM=$MAISTRA_ISTIO_OC_DOWNLOAD_PLATFORM
  MAISTRA_ISTIO_OC_DOWNLOAD_LOCATION=$MAISTRA_ISTIO_OC_DOWNLOAD_LOCATION
  MAISTRA_ISTIO_OC_EXE_NAME=$MAISTRA_ISTIO_OC_EXE_NAME
  MAISTRA_ISTIO_OC_EXE_PATH=$MAISTRA_ISTIO_OC_EXE_PATH
  MAISTRA_ISTIO_OC_COMMAND=$MAISTRA_ISTIO_OC_COMMAND
  MAISTRA_INSTALL_YAML=$MAISTRA_INSTALL_YAML
  DOCKER_SUDO=$DOCKER_SUDO
  KIALI_ENABLED=$KIALI_ENABLED
  KIALI_VERSION=$KIALI_VERSION
  KIALI_USERNAME=$KIALI_USERNAME
  KIALI_PASSWORD=$KIALI_PASSWORD
  ISTIO_ENABLED=$ISTIO_ENABLED
  ISTIO_VERSION=$ISTIO_VERSION
  ENABLE_ARG=$ENABLE_ARG
  OPENSHIFT_PERSISTENCE_ARGS=$OPENSHIFT_PERSISTENCE_ARGS
  CLUSTER_OPTIONS=$CLUSTER_OPTIONS
  OPENSHIFT_ISTIO_MASTER_PUBLIC_URL=$OPENSHIFT_ISTIO_MASTER_PUBLIC_URL
  OPENSHIFT_ISTIO_VERSION=$OPENSHIFT_ISTIO_VERSION
  "

# Fail fast if we don't even have the correct location where the oc client should be
if [ ! -d "${OPENSHIFT_BIN_PATH}" ]; then
  echo "ERROR: You must define OPENSHIFT_BIN_PATH to an existing location where you want the oc client tool to be. It is currently set to: ${OPENSHIFT_BIN_PATH}"
  exit 1
fi

# Download the oc client if we do not have it yet
if [[ -f "${MAISTRA_ISTIO_OC_EXE_PATH}" ]]; then
  _existingVersion=$(${MAISTRA_ISTIO_OC_EXE_PATH} --request-timeout=2s version | head -n 1 | sed ${SEDOPTIONS}  "s/^oc \([A-Za-z0-9.-]*+[A-Za-z0-9.-]*\)\+[a-z0-9 ]*$/\1/")
  if [ "$_existingVersion" != "${MAISTRA_ISTIO_OC_DOWNLOAD_VERSION}" ]; then
    echo "===== WARNING ====="
    echo "You already have the client binary but it does not match the version you want."
    echo "Either delete your existing client binary and let this script download another one,"
    echo "or change the version passed to this script to match the version of your client binary."
    echo "Client binary is here: ${MAISTRA_ISTIO_OC_EXE_PATH}"
    echo "The version of the client binary is: ${_existingVersion}"
    echo "You asked for version: ${MAISTRA_ISTIO_OC_DOWNLOAD_VERSION}"
    echo "===== WARNING ====="
    exit 1
  fi
else
   echo "Downloading binary to ${MAISTRA_ISTIO_OC_EXE_PATH}"

   # Use wget command if available, otherwise try curl
   if which wget > /dev/null ; then
     DOWNLOADER="wget -O"
   fi
   if [ ! "$DOWNLOADER" ] ; then
     if which curl > /dev/null ; then
       DOWNLOADER="curl -L -o"
     fi
   fi
   if [ ! "$DOWNLOADER" ] ; then
     echo "ERROR: You must install either curl or wget to allow downloading"
     exit 1
   fi

   eval ${DOWNLOADER} ${MAISTRA_ISTIO_OC_EXE_PATH} ${MAISTRA_ISTIO_OC_DOWNLOAD_LOCATION}
   if [ "$?" != "0" ]; then
     echo "===== WARNING ====="
     echo "Could not download the client binary for the version you want."
     echo "Make sure this is valid: ${MAISTRA_ISTIO_OC_DOWNLOAD_LOCATION}"
     echo "===== WARNING ====="
     rm ${MAISTRA_ISTIO_OC_EXE_PATH}
     exit 1
   fi
   chmod +x ${MAISTRA_ISTIO_OC_EXE_PATH}
fi

debug "oc command that will be used: ${MAISTRA_ISTIO_OC_COMMAND}"
debug "$(${MAISTRA_ISTIO_OC_COMMAND} version)"

cd ${OPENSHIFT_BIN_PATH}

if [ "$_CMD" = "up" ]; then

  # Create and set ownership of the persistence dir, if there is one
  if [ "${OPENSHIFT_PERSISTENCE_DIR}" != "" ]; then
    echo "SUDO ACCESS: Creating persistence dir and giving ownership to $(whoami):"
    sudo mkdir -p ${OPENSHIFT_PERSISTENCE_DIR} && sudo chown $(whoami):$(whoami) ${OPENSHIFT_PERSISTENCE_DIR}
    ls -ld ${OPENSHIFT_PERSISTENCE_DIR}
  fi

  # The OpenShift docs say to define docker with an insecure registry setting. This checks such a setting is enabled.
  pgrep -a dockerd | grep '[-]-insecure-registry' > /dev/null 2>&1
  if [ "$?" != "0" ]; then
    grep 'OPTIONS=.*--insecure-registry' /etc/sysconfig/docker > /dev/null 2>&1
    if [ "$?" != "0" ]; then
      grep 'insecure-registries' /etc/docker/daemon.json > /dev/null 2>&1
      if [ "$?" != "0" ]; then
        echo 'WARNING: You must run Docker with the --insecure-registry argument with an appropriate value (usually "--insecure-registry 172.30.0.0/16"). See the OpenShift Origin documentation for more details: https://github.com/openshift/origin/blob/master/docs/cluster_up_down.md#linux'
      else
        debug "/etc/docker/daemon.json has the insecure-registry setting. This is good."
      fi
    else
      debug "/etc/sysconfig/docker has defined the insecure-registry setting. This is good."
    fi
  else
    debug "Docker daemon is running with --insecure-registry setting. This is good."
  fi

  # The OpenShift docs say to disable firewalld for now. Just in case it is running, stop it now.
  # If firewalld was running and is shutdown, it changes the iptable rules and screws up docker,
  # so we must restart docker in order for it to rebuild its iptable rules.
  echo "SUDO ACCESS: Determine status of firewalld"
  sudo systemctl status firewalld > /dev/null 2>&1
  if [ "$?" == "0" ]; then
    echo "SUDO ACCESS: Turning off firewalld as per OpenShift recommendation and then restarting docker to rebuild iptable rules"
    sudo systemctl stop firewalld
    sudo systemctl restart docker.service
  fi

  echo "Starting the OpenShift cluster..."
  debug "${MAISTRA_ISTIO_OC_COMMAND} cluster up ${ENABLE_ARG} --public-hostname=${OPENSHIFT_IP_ADDRESS} ${OPENSHIFT_PERSISTENCE_ARGS} ${CLUSTER_OPTIONS}"
  ${MAISTRA_ISTIO_OC_COMMAND} cluster up ${ENABLE_ARG} --public-hostname=${OPENSHIFT_IP_ADDRESS} ${OPENSHIFT_PERSISTENCE_ARGS} ${CLUSTER_OPTIONS}

  if [ "$?" != "0" ]; then
    echo "ERROR: failed to start OpenShift"
    exit 1
  fi

  echo 'Do you want the admin user to be assigned the cluster-admin role?'
  echo 'NOTE: This could expose your machine to root access!'
  echo '      If you elect not to do this and Istio is not already installed,'
  echo '      you will be required to perform additional steps later.'
  echo 'Select "1" for Yes and "2" for No:'
  select yn in "Yes" "No"; do
    case $yn in
      Yes )
        echo Will assign the cluster-admin role to the admin user.
        ${MAISTRA_ISTIO_OC_COMMAND} login -u system:admin
        ${MAISTRA_ISTIO_OC_COMMAND} adm policy add-cluster-role-to-user cluster-admin admin
        _CREATE_INSTALLATION_RESOURCE="true"
        break;;
      No )
        echo Admin user will not be assigned the cluster-admin role.
        echo If Istio is not already installed then you will be required to perform additional steps later.
        _CREATE_INSTALLATION_RESOURCE="false"
        break;;
    esac
  done

  ${MAISTRA_ISTIO_OC_COMMAND} get -n istio-operator Installation istio-installation > /dev/null 2>&1
  if [ "$?" != "0" ]; then
    if [ "${ISTIO_ENABLED}" == "true" ] ; then
      if [ "${_CREATE_INSTALLATION_RESOURCE}" == "true" ] ; then
        echo "Installing Istio via Installation Custom Resource"
        debug "${MAISTRA_ISTIO_OC_COMMAND} create -n istio-operator -f ${MAISTRA_INSTALL_YAML}"
        ${MAISTRA_ISTIO_OC_COMMAND} create -n istio-operator -f ${MAISTRA_INSTALL_YAML}
      else
        echo "It appears Istio has not yet been installed - after you have ensured that your OpenShift user has the proper"
        echo "permissions, you will need to run the following command:"
        echo "  ${MAISTRA_ISTIO_OC_COMMAND} create -n istio-operator -f ${MAISTRA_INSTALL_YAML}"
      fi
    else
      echo "You asked that Istio not be enabled - will not create the Installation Custom Resource."
    fi
  else
    if [ "${ISTIO_ENABLED}" == "true" ] ; then
      echo "It appears Istio has already been installed - will not create the Installation Custom Resource again."
    else
      echo "You asked that Istio not be enabled, but it appears Istio has already been installed. You might want to uninstall it."
    fi
  fi

  if [ "${KIALI_ENABLED}" == "true" ]; then
    echo "Deleting any previously existing Kiali..."
    ${MAISTRA_ISTIO_OC_COMMAND} delete all,secrets,sa,templates,configmaps,deployments,clusterroles,clusterrolebindings,virtualservices,destinationrules --selector=app=kiali -n istio-system
    echo "Deploying Kiali..."
    curl https://raw.githubusercontent.com/kiali/kiali/${KIALI_VERSION}/deploy/openshift/kiali-configmap.yaml | \
      VERSION_LABEL=${KIALI_VERSION} envsubst | oc create -n istio-system -f -
    curl https://raw.githubusercontent.com/kiali/kiali/${KIALI_VERSION}/deploy/openshift/kiali-secrets.yaml | \
      VERSION_LABEL=${KIALI_VERSION} envsubst | oc create -n istio-system -f -
    curl https://raw.githubusercontent.com/kiali/kiali/${KIALI_VERSION}/deploy/openshift/kiali.yaml | \
      VERSION_LABEL=${KIALI_VERSION} \
      IMAGE_NAME=kiali/kiali \
      IMAGE_VERSION=${KIALI_VERSION}  \
      NAMESPACE=istio-system \
      VERBOSE_MODE=4 \
      IMAGE_PULL_POLICY_TOKEN="imagePullPolicy: Always" envsubst | oc create -n istio-system -f -
  fi

elif [ "$_CMD" = "down" ];then

  echo "Will shutdown the OpenShift cluster"
  ${MAISTRA_ISTIO_OC_COMMAND} cluster down
  echo "SUDO ACCESS: unmounting openshift local volumes"
  mount | grep "openshift.local.volumes" | awk '{ print $3}' | while read FILESYSTEM
  do
    if [ "${FILESYSTEM}" ] ; then
      sudo umount "${FILESYSTEM}"
    fi
  done  
  # only purge these if we do not want persistence
  if [ "${OPENSHIFT_PERSISTENCE_ARGS}" == "" ]; then
    echo "SUDO ACCESS: Purging /var/lib/origin files"
    sudo rm -rf /var/lib/origin/* && sudo rmdir /var/lib/origin
  else
    echo "OpenShift has left your persisted data here: ${OPENSHIFT_PERSISTENCE_DIR}"
  fi

elif [ "$_CMD" = "status" ];then

  ${MAISTRA_ISTIO_OC_COMMAND} version
  ${MAISTRA_ISTIO_OC_COMMAND} cluster status

else
  echo "ERROR: Required command must be either: up, down, or status"
  exit 1
fi
