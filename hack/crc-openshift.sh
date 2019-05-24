#!/bin/bash

##############################################################################
# crc-openshift.sh
#
# Run this script to start/stop an OpenShift 4 cluster.
# This can also optionally install Istio and Kiali.
#
# This script takes one command whose value is one of the following:
#    start: starts the OpenShift environment
#     stop: stops the OpenShift environment
#   delete: deletes the OpenShift environment removing persisted data
#   status: outputs the current status of the OpenShift environment
#      ssh: logs into the CRC VM via ssh so you can probe in the VM
#
# This script accepts several options - see --help for details.
#
# This script utilizes the crc tool and its bundle.
# If you do not have it, this script will download it for you.
# Downloading will take some time, the images are large.
#
##############################################################################

debug() {
  if [ "$_VERBOSE" == "true" ]; then
    echo "DEBUG: $1"
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
      echo "ERROR: You must install either curl or wget to allow downloading."
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
      echo "ERROR: Cannot determine your machine's installer (cannot find dnf or yum)."
      exit 1
    fi
  fi
  debug "Installer command to be used: ${INSTALLER}"
}

# Change to the directory where this script is and set our environment
SCRIPT_ROOT="$( cd "$(dirname "$0")" ; pwd -P )"
cd ${SCRIPT_ROOT}

# The default version of the crc tool to be downloaded
DEFAULT_CRC_DOWNLOAD_VERSION="0.86.0"

# The default version of the crc bundle to be downloaded
DEFAULT_CRC_LIBVIRT_DOWNLOAD_VERSION="4.1.0-rc.5"

# The default version of the istiooc command to be downloaded
DEFAULT_MAISTRA_ISTIO_OC_DOWNLOAD_VERSION="v3.11.0+maistra-0.10.0"

# The default installation custom resource used to define what to install
DEFAULT_MAISTRA_INSTALL_YAML="https://raw.githubusercontent.com/Maistra/openshift-ansible/maistra-0.10/istio/istio-installation-minimal.yaml"

# The default virtual CPUs assigned to the CRC VM
DEFAULT_CRC_CPUS="5"

# The default memory (in GB) assigned to the CRC VM
DEFAULT_CRC_MEMORY="16"

# The default virtual disk size (in GB) assigned to the CRC VM
DEFAULT_CRC_VIRTUAL_DISK_SIZE="30"

# set the default openshift address here so that it can be used for the usage text
# This is the IP address where OpenShift will bind its master.
# This should be a valid IP address for the machine where OpenShift is installed.
# TODO: Today, this is not used with CRC. Leaving this here in case a future version of CRC lets you configure this
if which ip > /dev/null 2>&1 ; then
  DEFAULT_OPENSHIFT_IP_ADDRESS=`echo $(ip -f inet addr | grep 'state UP' -A1 | tail -n1 | awk '{print $2}' | cut -f1 -d'/')`
else
  DEFAULT_OPENSHIFT_IP_ADDRESS="127.0.0.1"
fi

# process command line args to override environment
_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    start|up)
      _CMD="start"
      shift
      ;;
    stop|down)
      _CMD="stop"
      shift
      ;;
    delete)
      _CMD="delete"
      shift
      ;;
    status)
      _CMD="status"
      shift
      ;;
    ssh)
      _CMD="ssh"
      shift
      ;;
    -a|--address)
      OPENSHIFT_IP_ADDRESS="$2"
      shift;shift
      ;;
    -b|--bin-dir)
      OPENSHIFT_BIN_PATH="$2"
      shift;shift
      ;;
    -ca|--crc-arch)
      CRC_DOWNLOAD_ARCH="$2"
      shift;shift
      ;;
    -clv|--crc-libvirt-version)
      CRC_LIBVIRT_DOWNLOAD_VERSION="$2"
      shift;shift
      ;;
    -ccpus|--crc-cpus)
      CRC_CPUS="$2"
      shift;shift
      ;;
    -cmem|--crc-memory)
      CRC_MEMORY="$2"
      shift;shift
      ;;
    -cp|--crc-platform)
      CRC_DOWNLOAD_PLATFORM="$2"
      shift;shift
      ;;
    -cv|--crc-version)
      CRC_DOWNLOAD_VERSION="$2"
      shift;shift
      ;;
    -cvdisk|--crc-virtual-disk-size)
      CRC_VIRTUAL_DISK_SIZE="$2"
      shift;shift
      ;;
    -ie|--istio-enabled)
      ISTIO_ENABLED="$2"
      shift;shift
      ;;
    -iop|--istiooc-platform)
      MAISTRA_ISTIO_OC_DOWNLOAD_PLATFORM="$2"
      shift;shift
      ;;
    -iov|--istiooc-version)
      MAISTRA_ISTIO_OC_DOWNLOAD_VERSION="$2"
      shift;shift
      ;;
    -ioy|--istiooc-install-yaml)
      MAISTRA_INSTALL_YAML="$2"
      shift;shift
      ;;
    -iv|--istio-version)
      ISTIO_VERSION="$2"
      shift;shift
      ;;
    -kas|--kiali-auth-strategy)
      KIALI_AUTH_STRATEGY="$2"
      shift;shift
      ;;
    -ke|--kiali-enabled)
      KIALI_ENABLED="$2"
      shift;shift
      ;;
    -kp|--kiali-passphrase)
      KIALI_PASSPHRASE="$2"
      shift;shift
      ;;
    -ku|--kiali-username)
      KIALI_USERNAME="$2"
      shift;shift
      ;;
    -kv|--kiali-version)
      KIALI_VERSION="$2"
      shift;shift
      ;;
    -nj|--no-jaeger)
      REMOVE_JAEGER=true
      shift
      ;;
    -nw|--no-wait-for-istio)
      WAIT_FOR_ISTIO=false
      shift
      ;;
    -v|--verbose)
      _VERBOSE=true
      shift
      ;;
    -h|--help)
      cat <<HELPMSG

$0 [option...] command

Valid options:
  -a|--address <address>
      The public IP or named address bound to by the OpenShift cluster.
      THIS IS NOT USED TODAY
      Default: ${DEFAULT_OPENSHIFT_IP_ADDRESS}
      Used only for the 'start' command.
  -b|--bin-dir <dir>
      Directory where the OpenShift binaries are or will be stored when downloaded.
      Default: ${HOME}/bin
  -ca|--crc-arch <architecture>
      The architecture of the crc binary to use.
      Default: amd64
  -clv|--crc-libvirt-version <version>
      The version of the crc libvirt bundle to use.
      If one does not exist in the bin directory, it will be downloaded there.
      Default: ${DEFAULT_CRC_LIBVIRT_DOWNLOAD_VERSION}
  -ccpus|--crc-cpus <num CPUs>
      Number of virtual CPUs to assign to the VM.
      Default: ${DEFAULT_CRC_CPUS}
      Used only for the 'start' command.
  -cmem|--crc-memory <memory size>
      Amount of memory (in GB) to assign to the VM.
      Default: ${DEFAULT_CRC_MEMORY}
      Used only for the 'start' command.
  -cp|--crc-platform <platform>
      The platform indicator to determine what crc binary to download.
      Default: linux (darwin if Mac is detected)
  -cv|--crc-version <version>
      The version of the crc binary to use.
      If one does not exist in the bin directory, it will be downloaded there.
      Default: ${DEFAULT_CRC_DOWNLOAD_VERSION}
  -cvdisk|--crc-virtual-disk-size <disk size>
      The size of the virtual disk (in GB) to assign to the VM.
      Default: ${DEFAULT_CRC_VIRTUAL_DISK_SIZE}
      Used only for the 'start' command.
  -h|--help : this message
  -ie|--istio-enabled (true|false)
      When set to true, Istio will be installed in OpenShift.
      Default: true
      Used only for the 'start' command.
  -iop|--istiooc-platform (linux|darwin)
      The platform indicator to determine what istiooc binary executable to download.
      Default: linux (darwin if Mac is detected)
  -iov|--istiooc-version <version>
      The version of the istiooc binary to use.
      If one does not exist in the bin directory, it will be downloaded there.
      Default: ${DEFAULT_MAISTRA_ISTIO_OC_DOWNLOAD_VERSION}
  -ioy|--istiooc-install-yaml <file or url>
      Points to the YAML file that defines the Installation custom resource which declares what to install.
      Default: ${DEFAULT_MAISTRA_INSTALL_YAML}
  -iv|--istio-version <version>
      The version of Istio that the istiooc binary will install.
      If this is not specified, this will be whatever the istiooc binary installs by default.
      Default: none
  -kas|--kiali-auth-strategy (openshift,login,anonymous)
      Determines what authentication strategy Kiali will use. See docs for what each auth-strategy does.
      Default: openshift
      Used only for the 'start' command.
  -ke|--kiali-enabled (true|false)
      When set to true, Kiali will be installed in OpenShift.
      Default: false
      Used only for the 'start' command.
  -kp|--kiali-passphrase <passphrase>
      The passphrase needed when logging into Kiali.
      Default: admin
      Used only for the 'start' command.
  -ku|--kiali-username <username>
      The username needed when logging into Kiali.
      Default: admin
      Used only for the 'start' command.
  -kv|--kiali-version <version>
      The Kiali version to be installed in OpenShift.
      Used only for the 'start' command.
  -nj|--no-jaeger
      When specified, this script will remove Jaeger and Elasticsearch installations from the
      cluster after start-up.
      Used only for the 'start' command.
  -nw|--no-wait-for-istio
      When specified, this script will not wait for Istio to be up and running before exiting.
      Note that waiting is required when --kiali-enabled is true - the Kiali install
      will not start until after all Istio components are up and running. Thus this option
      is ignored when --kiali-enabled is true.
      This will also be ignored when --istio-enabled is false.
      Used only for the 'start' command.
  -v|--verbose
      Enable logging of debug messages from this script.

The command must be either: start, stop, delete, status, or ssh
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
# TODO: Today, this is not used with CRC. Leaving this here in case a future version of CRC lets you configure this
if [ ! "$OPENSHIFT_IP_ADDRESS" ] ; then
  OPENSHIFT_IP_ADDRESS=${DEFAULT_OPENSHIFT_IP_ADDRESS}
fi

# The version is the tag from the openshift-istio/origin release builds.
# The platform is either "linux" or "darwin".
DEFAULT_OS_PLATFORM=linux
DETECTED_OS_PLATFORM=`uname | tr '[:upper:]' '[:lower:]'`
if [ "${DETECTED_OS_PLATFORM}" = "linux" -o "${DETECTED_OS_PLATFORM}" = "darwin" ] ; then
  DEFAULT_OS_PLATFORM=${DETECTED_OS_PLATFORM}
  debug "The operating system has been detected as ${DEFAULT_OS_PLATFORM}"
fi
MAISTRA_ISTIO_OC_DOWNLOAD_VERSION="${MAISTRA_ISTIO_OC_DOWNLOAD_VERSION:-${DEFAULT_MAISTRA_ISTIO_OC_DOWNLOAD_VERSION}}"
MAISTRA_ISTIO_OC_DOWNLOAD_PLATFORM="${MAISTRA_ISTIO_OC_DOWNLOAD_PLATFORM:-${DEFAULT_OS_PLATFORM}}"
CRC_DOWNLOAD_VERSION="${CRC_DOWNLOAD_VERSION:-${DEFAULT_CRC_DOWNLOAD_VERSION}}"
CRC_DOWNLOAD_PLATFORM="${CRC_DOWNLOAD_PLATFORM:-${DEFAULT_OS_PLATFORM}}"
CRC_DOWNLOAD_ARCH="${CRC_DOWNLOAD_ARCH:-amd64}"
CRC_LIBVIRT_DOWNLOAD_VERSION="${CRC_LIBVIRT_DOWNLOAD_VERSION:-${DEFAULT_CRC_LIBVIRT_DOWNLOAD_VERSION}}"
CRC_ROOT_DIR="${HOME}/.crc"
CRC_KUBECONFIG="${CRC_ROOT_DIR}/cache/crc_libvirt_${CRC_LIBVIRT_DOWNLOAD_VERSION}/kubeconfig"
CRC_MACHINE_IMAGE="${CRC_ROOT_DIR}/machines/crc/crc"

# Defines where the Installation yaml is to be found.
MAISTRA_INSTALL_YAML="${MAISTRA_INSTALL_YAML:-${DEFAULT_MAISTRA_INSTALL_YAML}}"

# The version of Maistra
MAISTRA_VERSION="$(echo -n ${MAISTRA_ISTIO_OC_DOWNLOAD_VERSION} | sed --posix 's/^v.*\+\(.*\)$/\1/')"

# if sed is gnu-sed then set option to work in posix mode to be compatible with non-gnu-sed versions
if sed --posix 's/ / /' < /dev/null > /dev/null 2>&1 ; then
  SEDOPTIONS="--posix"
fi

# If ISTIO_ENABLED=true, then the istiooc command will install a version of Istio for you.
ISTIO_ENABLED="${ISTIO_ENABLED:-true}"

# By default, wait for Istio to be up and running before the script ends.
WAIT_FOR_ISTIO="${WAIT_FOR_ISTIO:-true}"

# If you set KIALI_ENABLED=true, then the istiooc command will install a version of Kiali for you.
# If that is set to false, the other KIALI_ environment variables will be ignored.
KIALI_ENABLED="${KIALI_ENABLED:-false}"
KIALI_VERSION="${KIALI_VERSION:-lastrelease}"
KIALI_AUTH_STRATEGY="${KIALI_AUTH_STRATEGY:-openshift}"
KIALI_USERNAME="${KIALI_USERNAME:-admin}"
KIALI_PASSPHRASE="${KIALI_PASSPHRASE:-admin}"

# VM configuration
CRC_CPUS=${CRC_CPUS:-${DEFAULT_CRC_CPUS}}
CRC_MEMORY=${CRC_MEMORY:-${DEFAULT_CRC_MEMORY}}
CRC_VIRTUAL_DISK_SIZE=${CRC_VIRTUAL_DISK_SIZE:-${DEFAULT_CRC_VIRTUAL_DISK_SIZE}}

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

# If latest Kiali release is to be installed, figure out which version that is
if [ "${KIALI_ENABLED}" == "true" -a "${KIALI_VERSION}" == "lastrelease" ]; then
  get_downloader
  eval ${DOWNLOADER} /tmp/kiali-release-latest.json https://api.github.com/repos/kiali/kiali/releases/latest
  KIALI_VERSION=$(cat /tmp/kiali-release-latest.json |\
    grep  "tag_name" | \
    sed -e 's/.*://' -e 's/ *"//' -e 's/",//')
  if [ "${KIALI_VERSION}" == "" ]; then
    echo "ERROR: Cannot determine the latest Kiali version to install. Set KIALI_VERSION env var to the version you want."
    exit 1
  fi
  echo "The latest Kiali release is: ${KIALI_VERSION}"
fi

# Determine where to get the binaries and their full paths and how to execute them.
MAISTRA_ISTIO_OC_DOWNLOAD_LOCATION="https://github.com/Maistra/origin/releases/download/${MAISTRA_ISTIO_OC_DOWNLOAD_VERSION}/istiooc_${MAISTRA_ISTIO_OC_DOWNLOAD_PLATFORM}"
MAISTRA_ISTIO_OC_EXE_NAME=istiooc
MAISTRA_ISTIO_OC_EXE_PATH="${OPENSHIFT_BIN_PATH}/${MAISTRA_ISTIO_OC_EXE_NAME}"
MAISTRA_ISTIO_OC_COMMAND="${MAISTRA_ISTIO_OC_EXE_PATH}"

CRC_DOWNLOAD_LOCATION="https://github.com/code-ready/crc/releases/download/${CRC_DOWNLOAD_VERSION}/crc-${CRC_DOWNLOAD_VERSION}-${CRC_DOWNLOAD_PLATFORM}-${CRC_DOWNLOAD_ARCH}.tar.xz"
CRC_EXE_NAME=crc
CRC_EXE_PATH="${OPENSHIFT_BIN_PATH}/${CRC_EXE_NAME}"
CRC_COMMAND="${CRC_EXE_PATH}"

CRC_LIBVIRT_DOWNLOAD_LOCATION="http://cdk-builds.usersys.redhat.com/builds/crc/${CRC_LIBVIRT_DOWNLOAD_VERSION}/crc_libvirt_${CRC_LIBVIRT_DOWNLOAD_VERSION}.tar.xz"
CRC_LIBVIRT_PATH="${OPENSHIFT_BIN_PATH}/crc_libvirt_${CRC_LIBVIRT_DOWNLOAD_VERSION}.tar.xz"

# If Kiali is to be installed, set up some things that may be needed
if [ "${KIALI_ENABLED}" == "true" ]; then
  echo Kiali is enabled and will be installed.
fi

# Operator Tempate Variables - export these so the template can see them
if [ "${ISTIO_VERSION}" != "" ]; then
  export OPENSHIFT_ISTIO_VERSION="${ISTIO_VERSION}"
fi

# Environment setup section stops here.
########################################

debug "ENVIRONMENT:
  command=$_CMD
  CRC_COMMAND=$CRC_COMMAND
  CRC_CPUS=$CRC_CPUS
  CRC_DOWNLOAD_LOCATION=$CRC_DOWNLOAD_LOCATION
  CRC_DOWNLOAD_PLATFORM=$CRC_DOWNLOAD_PLATFORM
  CRC_DOWNLOAD_VERSION=$CRC_DOWNLOAD_VERSION
  CRC_EXE_NAME=$CRC_EXE_NAME
  CRC_EXE_PATH=$CRC_EXE_PATH
  CRC_KUBECONFIG=$CRC_KUBECONFIG
  CRC_LIBVIRT_DOWNLOAD_LOCATION=$CRC_LIBVIRT_DOWNLOAD_LOCATION
  CRC_LIBVIRT_DOWNLOAD_VERSION=$CRC_LIBVIRT_DOWNLOAD_VERSION
  CRC_LIBVIRT_PATH=$CRC_LIBVIRT_PATH
  CRC_MACHINE_IMAGE=$CRC_MACHINE_IMAGE
  CRC_MEMORY=$CRC_MEMORY
  CRC_ROOT_DIR=$CRC_ROOT_DIR
  CRC_VIRTUAL_DISK_SIZE=$CRC_VIRTUAL_DISK_SIZE
  DOCKER_SUDO=$DOCKER_SUDO
  ISTIO_ENABLED=$ISTIO_ENABLED
  ISTIO_VERSION=$ISTIO_VERSION
  KIALI_AUTH_STRATEGY=$KIALI_AUTH_STRATEGY
  KIALI_ENABLED=$KIALI_ENABLED
  KIALI_PASSPHRASE=$KIALI_PASSPHRASE
  KIALI_USERNAME=$KIALI_USERNAME
  KIALI_VERSION=$KIALI_VERSION
  MAISTRA_INSTALL_YAML=$MAISTRA_INSTALL_YAML
  MAISTRA_ISTIO_OC_COMMAND=$MAISTRA_ISTIO_OC_COMMAND
  MAISTRA_ISTIO_OC_DOWNLOAD_LOCATION=$MAISTRA_ISTIO_OC_DOWNLOAD_LOCATION
  MAISTRA_ISTIO_OC_DOWNLOAD_PLATFORM=$MAISTRA_ISTIO_OC_DOWNLOAD_PLATFORM
  MAISTRA_ISTIO_OC_DOWNLOAD_VERSION=$MAISTRA_ISTIO_OC_DOWNLOAD_VERSION
  MAISTRA_ISTIO_OC_EXE_NAME=$MAISTRA_ISTIO_OC_EXE_NAME
  MAISTRA_ISTIO_OC_EXE_PATH=$MAISTRA_ISTIO_OC_EXE_PATH
  MAISTRA_VERSION=$MAISTRA_VERSION
  OPENSHIFT_BIN_PATH=$OPENSHIFT_BIN_PATH
  OPENSHIFT_IP_ADDRESS=$OPENSHIFT_IP_ADDRESS
  OPENSHIFT_ISTIO_MASTER_PUBLIC_URL=$OPENSHIFT_ISTIO_MASTER_PUBLIC_URL
  OPENSHIFT_ISTIO_VERSION=$OPENSHIFT_ISTIO_VERSION
  "

# Fail fast if we don't even have the correct location where the oc client should be
if [ ! -d "${OPENSHIFT_BIN_PATH}" ]; then
  echo "ERROR: You must define OPENSHIFT_BIN_PATH to an existing location where you want the istiooc client tool to be. It is currently set to: ${OPENSHIFT_BIN_PATH}"
  exit 1
fi

# Download the istiooc client if we do not have it yet
if [[ -f "${MAISTRA_ISTIO_OC_EXE_PATH}" ]]; then
  _existingVersion=$(${MAISTRA_ISTIO_OC_EXE_PATH} --request-timeout=2s version | head -n 1 | sed ${SEDOPTIONS} "s/^oc \([A-Za-z0-9.-]*+[A-Za-z0-9.-]*\)\+[a-z0-9 ]*$/\1/")
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
  echo "Downloading Maistra binary to ${MAISTRA_ISTIO_OC_EXE_PATH}"

  get_downloader
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

# Download the crc tool if we do not have it yet
if [[ -f "${CRC_EXE_PATH}" ]]; then
  _existingVersion=$(${CRC_EXE_PATH} version | tail -n 1 | sed ${SEDOPTIONS} "s/^version: \([A-Za-z0-9.]*\)-[A-Za-z0-9.-]*+[a-z0-9]*$/\1/")
  if [ "$_existingVersion" != "${CRC_DOWNLOAD_VERSION}" ]; then
    echo "===== WARNING ====="
    echo "You already have the crc tool but it does not match the version you want."
    echo "Either delete your existing binary and let this script download another one,"
    echo "or change the version passed to this script to match the version of your crc tool."
    echo "crc is here: ${CRC_EXE_PATH}"
    echo "The version of the crc binary is: ${_existingVersion}"
    echo "You asked for version: ${CRC_DOWNLOAD_VERSION}"
    echo "===== WARNING ====="
    exit 1
  fi
else
  echo "Downloading crc binary to ${CRC_EXE_PATH}"

  get_downloader
  eval ${DOWNLOADER} "${CRC_EXE_PATH}.tar.xz" ${CRC_DOWNLOAD_LOCATION}
  if [ "$?" != "0" ]; then
    echo "===== WARNING ====="
    echo "Could not download the client binary for the version you want."
    echo "Make sure this is valid: ${CRC_DOWNLOAD_LOCATION}"
    echo "===== WARNING ====="
    rm "${CRC_EXE_PATH}.tar.xz"
    exit 1
  fi
  tar xvf "${CRC_EXE_PATH}.tar.xz" -C "$(dirname ${CRC_EXE_PATH})"
  chmod +x ${CRC_EXE_PATH}
  rm "${CRC_EXE_PATH}.tar.xz"
fi

debug "crc command that will be used: ${CRC_COMMAND}"
debug "$(${CRC_COMMAND} version)"

# Download the crc libvirt image if we do not have it yet
if [[ -f "${CRC_LIBVIRT_PATH}" ]]; then
  debug "crc libvirt bundle that will be used: ${CRC_LIBVIRT_PATH}"
else
  echo "Downloading crc libvirt bundle to ${CRC_LIBVIRT_PATH}"

  get_downloader
  eval ${DOWNLOADER} "${CRC_LIBVIRT_PATH}" ${CRC_LIBVIRT_DOWNLOAD_LOCATION}
  if [ "$?" != "0" ]; then
    echo "===== WARNING ====="
    echo "Could not download the crc libvirt bundle."
    echo "Make sure this is valid: ${CRC_LIBVIRT_DOWNLOAD_LOCATION}"
    echo "===== WARNING ====="
    rm "${CRC_LIBVIRT_PATH}"
    exit 1
  fi
fi

cd ${OPENSHIFT_BIN_PATH}
export KUBECONFIG="${CRC_KUBECONFIG}"

if [ "$_CMD" = "start" ]; then

  echo "Setting up the requirements for the OpenShift cluster..."
  debug "${CRC_COMMAND} setup"
  ${CRC_COMMAND} setup

  if [ "$?" != "0" ]; then
    echo "ERROR: failed to setup the requirements for OpenShift."
    exit 1
  fi

  echo "Starting the OpenShift cluster..."
  # if you change the command line here, also change it below during the restart
  debug "${CRC_COMMAND} start -b ${CRC_LIBVIRT_PATH} -m ${CRC_MEMORY}000 -c ${CRC_CPUS}"
  ${CRC_COMMAND} start -b ${CRC_LIBVIRT_PATH} -m ${CRC_MEMORY}000 -c ${CRC_CPUS}

  if [ "$?" != "0" ]; then
    echo "ERROR: failed to start the VM."
    exit 1
  fi

  debug "Checking the memory of the VM..."
  if [ "$(virsh -c qemu:///system dommemstat crc | grep actual | sed  's/actual \([0-9]*\)/\1/')" != "${CRC_MEMORY}000000" ]; then
    echo "Configuring memory for your VM: memory=${CRC_MEMORY}G."
    virsh -c qemu:///system setmaxmem crc ${CRC_MEMORY}000000 --config
    virsh -c qemu:///system setmem crc ${CRC_MEMORY}000000 --config
    _NEED_VM_STOP="true"
    _NEED_VM_START="true"
  else
    debug "VM already configured with ${CRC_MEMORY}G memory."
  fi

  debug "Checking the CPU count of the VM..."
  if [ "$(virsh -c qemu:///system vcpucount crc --live)" != "${CRC_CPUS}" ]; then
    echo "Configuring CPUs for your VM: number of CPUs=${CRC_CPUS}"
    virsh -c qemu:///system setvcpus crc ${CRC_CPUS} --maximum --config
    virsh -c qemu:///system setvcpus crc ${CRC_CPUS} --config
    _NEED_VM_STOP="true"
    _NEED_VM_START="true"
  else
    debug "VM already configured with ${CRC_CPUS} CPUs."
  fi

  # See: https://fatmin.com/2016/12/20/how-to-resize-a-qcow2-image-and-filesystem-with-virt-resize/
  # Do this part as the last configuration change since this will require the VM to be stopped.
  debug "Checking the virtual disk size of the VM image..."
  _CURRENT_VIRTUAL_DISK_SIZE="$(sudo qemu-img info ${CRC_MACHINE_IMAGE} | grep 'virtual size' | sed 's/virtual size: \([0-9]*\)[G].*$/\1/')"
  if [ "${_CURRENT_VIRTUAL_DISK_SIZE}" -lt "${CRC_VIRTUAL_DISK_SIZE}" ]; then
    _INCREASE_VIRTUAL_DISK_SIZE="+$(expr ${CRC_VIRTUAL_DISK_SIZE} - ${_CURRENT_VIRTUAL_DISK_SIZE})G"
    echo "The virtual disk size is currently ${_CURRENT_VIRTUAL_DISK_SIZE}G."
    echo "You asked for a virtual disk size of ${CRC_VIRTUAL_DISK_SIZE}G."
    echo "The virtual disk size will be increased by ${_INCREASE_VIRTUAL_DISK_SIZE}."
    echo "This multi-step process will take a long time. Be patient."

    # cannot resize disk while VM is running, shut it down now
    ${CRC_COMMAND} stop
    _NEED_VM_START="true"

    get_installer
    if ! which virt-resize > /dev/null 2>&1 ; then
      echo "To set the virtual disk size, you need 'virt-resize' installed from the 'libguestfs-tools' package."
      eval ${INSTALLER} install libguestfs-tools
    fi

    if ! ${INSTALLER} list installed libguestfs-xfs > /dev/null 2>&1 ; then
      echo "To resize the filesystem properly, you need to install libguestfs-xfs."
      eval ${INSTALLER} install libguestfs-xfs
    fi

    sudo qemu-img resize ${CRC_MACHINE_IMAGE} ${_INCREASE_VIRTUAL_DISK_SIZE}
    debug "Resizing the underlying file systems."
    sudo cp ${CRC_MACHINE_IMAGE} ${CRC_MACHINE_IMAGE}.ORIGINAL
    sudo virt-resize --expand /dev/sda3 ${CRC_MACHINE_IMAGE}.ORIGINAL ${CRC_MACHINE_IMAGE}
    sudo rm ${CRC_MACHINE_IMAGE}.ORIGINAL
    echo "The new disk image details:"
    sudo qemu-img info ${CRC_MACHINE_IMAGE}
    sudo virt-filesystems --long -h --all -a ${CRC_MACHINE_IMAGE}
  else
    debug "VM already configured with ${CRC_VIRTUAL_DISK_SIZE}G of virtual disk space."
  fi

  if [ "${_NEED_VM_STOP}" == "true" ]; then
    echo "Stopping the VM..."
    ${CRC_COMMAND} stop
  fi

  if [ "${_NEED_VM_START}" == "true" ]; then
    echo "Restarting the VM to pick up the new configuration."
    ${CRC_COMMAND} start -b ${CRC_LIBVIRT_PATH} -m ${CRC_MEMORY}000 -c ${CRC_CPUS}
    if [ "$?" != "0" ]; then
      echo "ERROR: failed to restart the VM."
      exit 1
    fi
    echo -n "Waiting for OpenShift console at https://console-openshift-console.apps-crc.testing ..."
    sleep 5
    while ! curl --head -s -k https://console-openshift-console.apps-crc.testing | head -n 1 | grep -q "200[[:space:]]*OK"
    do
      sleep 5
      echo -n "."
    done
    echo "Done."
    echo "VM has been rebooted with the new configuration and OpenShift is ready."
  fi

  # see https://docs.openshift.com/container-platform/4.1/authentication/identity_providers/configuring-htpasswd-identity-provider.html
  echo "Creating users 'kiali' and 'johndoe'"
  # we need to be admin in order to create the htpasswd oauth and users
  ${MAISTRA_ISTIO_OC_COMMAND} login -u system:admin
  cat <<EOM | ${MAISTRA_ISTIO_OC_COMMAND} apply -f -
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

  echo 'Do you want the kiali user to be assigned the cluster-admin role?'
  echo 'NOTE: This could expose your machine to root access!'
  echo 'Select "1" for Yes and "2" for No:'
  select yn in "Yes" "No"; do
    case $yn in
      Yes )
        echo Will assign the cluster-admin role to the kiali user.
        ${MAISTRA_ISTIO_OC_COMMAND} adm policy add-cluster-role-to-user cluster-admin kiali
        _CREATE_INSTALLATION_RESOURCE="true"
        break;;
      No )
        echo Kiali user will not be assigned the cluster-admin role.
        _CREATE_INSTALLATION_RESOURCE="true" # still try to install Istio, it should work with system:admin logged in
        break;;
    esac
  done

  ${MAISTRA_ISTIO_OC_COMMAND} get -n istio-operator Installation istio-installation > /dev/null 2>&1
  if [ "$?" != "0" ]; then
    if [ "${ISTIO_ENABLED}" == "true" ] ; then
      if [ "${_CREATE_INSTALLATION_RESOURCE}" == "true" ] ; then
        echo "Creating Istio Operator Namespace."
        ${MAISTRA_ISTIO_OC_COMMAND} create namespace istio-operator
        echo "Installing Istio Operator."
        debug ${MAISTRA_ISTIO_OC_COMMAND} create -n istio-operator -f "https://raw.githubusercontent.com/Maistra/istio-operator/${MAISTRA_VERSION}/deploy/maistra-operator.yaml"
        ${MAISTRA_ISTIO_OC_COMMAND} create -n istio-operator -f "https://raw.githubusercontent.com/Maistra/istio-operator/${MAISTRA_VERSION}/deploy/maistra-operator.yaml"
        echo "Installing Istio via Installation Custom Resource."
        debug "${MAISTRA_ISTIO_OC_COMMAND} create -n istio-operator -f ${MAISTRA_INSTALL_YAML}"
        ${MAISTRA_ISTIO_OC_COMMAND} create -n istio-operator -f ${MAISTRA_INSTALL_YAML}
      else
        echo "It appears Istio has not yet been installed - after you have ensured that your OpenShift user has the proper"
        echo "permissions, you will need to install the Maistra operator and then run the following command:"
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

  # If Istio is enabled, it should be installing now - if we need to, wait for it to finish
  if [ "${ISTIO_ENABLED}" == "true" ] ; then
    if [ "${KIALI_ENABLED}" == "true" -o "${WAIT_FOR_ISTIO}" == "true" ]; then
      echo "Wait for Istio to fully start (this is going to take a while)..."

      echo -n "Waiting for Istio Deployments to be created..."
      while [ "$(${MAISTRA_ISTIO_OC_COMMAND} get pods -l job-name=openshift-ansible-istio-installer-job -n istio-system -o jsonpath='{.items..status.conditions[0].reason}' 2> /dev/null)" != "PodCompleted" ]
      do
         sleep 5
         echo -n '.'
      done
      echo "done."

      for app in $(${MAISTRA_ISTIO_OC_COMMAND} get deployment.apps -n istio-system -o jsonpath='{range .items[*]}{.metadata.name}{" "}{end}' 2> /dev/null)
      do
         echo -n "Waiting for ${app} to be ready..."
         readyReplicas="0"
         while [ "$?" != "0" -o "$readyReplicas" == "0" ]
         do
            sleep 1
            echo -n '.'
            readyReplicas="$(${MAISTRA_ISTIO_OC_COMMAND} get deployment.app/${app} -n istio-system -o jsonpath='{.status.readyReplicas}' 2> /dev/null)"
         done
         echo "done."
      done
    fi
  fi

  if [ "${KIALI_ENABLED}" == "true" ]; then
    echo "Deleting any previously existing Kiali..."
    ${MAISTRA_ISTIO_OC_COMMAND} delete --ignore-not-found=true all,secrets,sa,templates,configmaps,deployments,roles,rolebindings,clusterroles,clusterrolebindings,ingresses,customresourcedefinitions,oauthclients.oauth.openshift.io --selector=app=kiali -n istio-system
    echo "Deploying Kiali..."
    get_downloader
    eval ${DOWNLOADER} /tmp/deploy-kiali-operator.sh https://raw.githubusercontent.com/kiali/kiali/${KIALI_VERSION}/operator/deploy/deploy-kiali-operator.sh
    chmod +x /tmp/deploy-kiali-operator.sh
    OPERATOR_VERSION_LABEL=${KIALI_VERSION} \
    OPERATOR_IMAGE_VERSION=${KIALI_VERSION}  \
    VERSION_LABEL=${KIALI_VERSION} \
    IMAGE_VERSION=${KIALI_VERSION}  \
    AUTH_STRATEGY=${KIALI_AUTH_STRATEGY}  \
    CREDENTIALS_USERNAME=${KIALI_USERNAME}  \
    CREDENTIALS_PASSPHRASE=${KIALI_PASSPHRASE} \
    UNINSTALL_EXISTING_KIALI="true" /tmp/deploy-kiali-operator.sh
  fi

  if [ "${REMOVE_JAEGER}" == "true" ]; then
      echo "Removing Jaeger from cluster..."
      ${MAISTRA_ISTIO_OC_COMMAND} delete all,secrets,sa,templates,configmaps,deployments,clusterroles,clusterrolebindings,virtualservices,destinationrules --selector=app=jaeger -n istio-system
      echo "Removing Elasticsearch from cluster..."
      ${MAISTRA_ISTIO_OC_COMMAND} delete all,secrets,sa,templates,configmaps,deployments,clusterroles,clusterrolebindings,virtualservices,destinationrules --selector=app=elasticsearch -n istio-system
  fi

  echo "Make sure you set KUBECONFIG before attempting to access the cluster:"
  echo "export KUBECONFIG=\"${CRC_KUBECONFIG}\""
  echo "NOTE: for some reason, to oc login as the kiali or johndoe user, you need to unset KUBECONFIG instead."

elif [ "$_CMD" = "stop" ];then

  echo "Will shutdown the OpenShift cluster."
  ${CRC_COMMAND} stop

elif [ "$_CMD" = "delete" ];then

  echo "Will delete the OpenShift cluster - this removes all persisted data."
  ${CRC_COMMAND} delete

elif [ "$_CMD" = "status" ];then

  ${MAISTRA_ISTIO_OC_COMMAND} version

  echo ""
  echo "KUBECONFIG should be set via:"
  echo "export KUBECONFIG='${CRC_KUBECONFIG}'"
  echo "NOTE: for some reason, to oc login as the kiali or johndoe user, you need to unset KUBECONFIG instead."
  echo ""

  echo "kubeadmin password:" $(grep "kubeadmin, password: " ${CRC_ROOT_DIR}/crc.log | tail -n 1 | sed 's/^.*password: \(.*\)\"$/\1/')
  echo "kiali password: kiali"
  echo "johndoe password: johndoe"
  echo ""

  echo "CRC does not yet have a status command. This hack script will be updated once this github issue is implemented: https://github.com/code-ready/crc/issues/68"

elif [ "$_CMD" = "ssh" ];then

  echo "Logging into the CRC VM..."
  ssh -i ${CRC_ROOT_DIR}/cache/crc_libvirt_${CRC_LIBVIRT_DOWNLOAD_VERSION}/id_rsa_crc core@192.168.130.11

else
  echo "ERROR: Required command must be either: start, stop, delete, status."
  exit 1
fi
