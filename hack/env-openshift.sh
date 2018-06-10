#!/bin/sh

##############################################################################
# env-openshift.sh
#
# Defines variables used by the scripts to start and stop OpenShift.
# This will be used to work with OpenShift source on your local machine.
# This will work with the openshift-istio/origin fork in order to also get
# Istio in your OpenShift cluster. You can also optionally install a specific
# version of Kiali into the OpenShift cluster.
##############################################################################

# This is where you want the OpenShift binaries to go
OPENSHIFT_BIN_PATH="${OPENSHIFT_BIN_PATH:=${HOME}/bin}"

# This is the IP address where OpenShift will bind its master.
# This should be a valid IP address for the machine where OpenShift is installed.
# NOTE: Do not use any IP address within the loopback range of 127.0.0.x.
OPENSHIFT_IP_ADDRESS=${OPENSHIFT_IP_ADDRESS:-`echo $(ip -f inet addr | grep 'state UP' -A1 | tail -n1 | awk '{print $2}' | cut -f1 -d'/')`}

# The version is the tag from the openshift-istio/origin release builds.
# The platform is either "linux" or "darwin".
#OS_ISTIO_OC_DOWNLOAD_VERSION="${OS_ISTIO_OC_DOWNLOAD_VERSION:-istio-3.9-0.7.1-alpha8}"
OS_ISTIO_OC_DOWNLOAD_VERSION="${OS_ISTIO_OC_DOWNLOAD_VERSION:-istio-3.9-0.8.0-alpha2}"
OS_ISTIO_OC_DOWNLOAD_PLATFORM="${OS_ISTIO_OC_DOWNLOAD_PLATFORM:-linux}"

# If you want to persist data across restarts of OpenShift, set to the persistence directory.
# If you set this to "" then no persistence will be used
# Note: ${v=d} is used on purpose so we do not persist if the directory was explicitly set to "".
OPENSHIFT_PERSISTENCE_DIR="${OPENSHIFT_PERSISTENCE_DIR=/var/lib/origin/persistent.data}"

# If you set KIALI_ENABLED=true, then the istiooc command will install a version of Kiali for you.
# If that is set to false, the other KIALI_ environment variables will be ignored.
# This is ONLY supported in OS_ISTIO_OC_DOWNLOAD_PLATFORM versions of istio-3.9-0.8.0.alpha2 or higher.
KIALI_ENABLED="${KIALI_ENABLED:-false}"
KIALI_VERSION="${KIALI_VERSION:-0.3.1.Alpha}"
KIALI_USERNAME="${KIALI_USERNAME:-admin}"
KIALI_PASSWORD="${KIALI_PASSWORD:-admin}"

# How to tell oc cluster up what version to use
#OPENSHIFT_VERSION_ARG="--version=latest"

#-----------------------------------------------------------------------------
# Variables below have values derived from the user-defined variables above.
# These variables below are not meant for users to change.
#-----------------------------------------------------------------------------

# See if sudo is required. It is required if the user is not in the docker group.
if groups ${USER} | grep >/dev/null 2>&1 '\bdocker\b'; then
  DOCKER_SUDO=
else
  DOCKER_SUDO=sudo
fi

# Determine where to get the binary executable and its full path and how to execute it.
# This download URL is where to the binary is on the github release page.
OS_ISTIO_OC_DOWNLOAD_LOCATION="https://github.com/openshift-istio/origin/releases/download/${OS_ISTIO_OC_DOWNLOAD_VERSION}/istiooc_${OS_ISTIO_OC_DOWNLOAD_PLATFORM}"
OS_ISTIO_OC_EXE_NAME=istiooc
OS_ISTIO_OC_EXE_PATH="${OPENSHIFT_BIN_PATH}/${OS_ISTIO_OC_EXE_NAME}"
OS_ISTIO_OC_COMMAND="${OS_ISTIO_OC_EXE_PATH}"

# If we are to persist data across restarts, set the proper arguments
if [ "${OPENSHIFT_PERSISTENCE_DIR}" != "" ]; then
  OPENSHIFT_PERSISTENCE_ARGS="--use-existing-config --host-data-dir=${OPENSHIFT_PERSISTENCE_DIR}"
fi

# If Kiali is to be installed, set the proper istiooc arguments that will be needed.
if [ "${KIALI_ENABLED}" == "true" ]; then
  KIALI_ARGS="--istio-kiali-version=${KIALI_VERSION} --istio-kiali-username=${KIALI_USERNAME} --istio-kiali-password=${KIALI_PASSWORD}"
fi

#
# Make sure the environment is as expected
#

go env > /dev/null 2>&1
if [ "$?" != "0" ]; then
  echo Go is not in your PATH. Aborting.
  exit 1
fi
