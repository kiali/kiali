#!/bin/sh

##############################################################################
# env-openshift.sh
#
# Defines variables used by the scripts to build, start, and stop OpenShift.
# This will be used to work with OpenShift source on your local machine.
##############################################################################

# This is the GOPATH where you want the OpenShift Origin project to go
OPENSHIFT_GOPATH=${HOME}/source/go/openshift

# This is the IP address where OpenShift will bind its master.
# This should be a valid IP address for the machine where OpenShift is installed.
# NOTE: Do not use any IP address within the loopback range of 127.0.0.x.
OPENSHIFT_IP_ADDRESS=$(ip -f inet addr | grep 'state UP' -A1 | tail -n1 | awk '{print $2}' | cut -f1 -d'/')

# If you want to run the last release of OpenShift, use "latest" or "master".
# If you want to run with a specific version, set it to the branch you want.
OPENSHIFT_BRANCH_NAME="release-3.7"

# If you want to persist data across restarts of OpenShift, uncomment this
# line and set the host data directory to the place where you want the data stored.
OPENSHIFT_PERSISTENCE_DIR="/var/lib/origin/persistent.data"

# How to tell oc cluster up what version to use
#OPENSHIFT_VERSION_ARG="--version=latest"

#-----------------------------------------------------------------------------
# Variables below have values derived from the user-defined variables above.
# These variables below are not meant for users to change.
#-----------------------------------------------------------------------------

# This is where the OpenShift Origin github source code will live when building from source.
OPENSHIFT_GITHUB_SOURCE_DIR=${OPENSHIFT_GOPATH}/src/github.com/openshift/origin

# This is where the OpenShift Origin binaries will be after the source is built
OPENSHIFT_BINARY_DIR=${OPENSHIFT_GITHUB_SOURCE_DIR}/_output/local/bin/`go env GOHOSTOS`/`go env GOARCH`

#
# See if sudo is required. It is required if the user is not in the docker group.
#
if groups ${USER} | grep >/dev/null 2>&1 '\bdocker\b'; then
  DOCKER_SUDO=
else
  DOCKER_SUDO=sudo
fi

# This is the full path to the 'oc' executable
OPENSHIFT_EXE_OC="sudo ${OPENSHIFT_BINARY_DIR}/oc"

# If we are to persist data across restarts, set the proper arguments
if [ "${OPENSHIFT_PERSISTENCE_DIR}" != "" ]; then
   OPENSHIFT_PERSISTENCE_ARGS="--use-existing-config --host-data-dir=${OPENSHIFT_PERSISTENCE_DIR}"
fi

#
# Make sure the environment is as expected
#

go env > /dev/null 2>&1
if [ "$?" != "0" ]; then
  echo Go is not in your PATH. Aborting.
  exit 1
fi

# Loads user env configuration
DIR="$( cd "$(dirname "${BASH_SOURCE[0]}")" && pwd )"
[ -f $DIR/env-openshift.local.sh ] && . $DIR/env-openshift.local.sh || true
