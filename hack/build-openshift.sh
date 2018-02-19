#!/bin/sh

##############################################################################
# build-openshift.sh
#
# This will download the OpenShift Origin source code and build it.
# You can start it via "cluster-openshift.sh up"
# You can stop it via "cluster-openshift.sh down"
# You can get version and status information via "cluster-openshift.sh status"
##############################################################################

# Before we do anything, make sure all software prerequisites are available.

WHERE_IS_MAKE=`which make`
if [ "$?" = "0" ]; then
  echo Make installed: $WHERE_IS_MAKE
else
  echo You must install Make
  exit 1
fi

WHERE_IS_GO=`which go`
if [ "$?" = "0" ]; then
  echo Go installed: $WHERE_IS_GO
else
  echo You must install the Go Programming Language.
  exit 1
fi

WHERE_IS_GIT=`which git`
if [ "$?" = "0" ]; then
  echo Git installed: $WHERE_IS_GIT
else
  echo You must install Git.
  exit 1
fi

WHERE_IS_DOCKER=`which docker`
if [ "$?" = "0" ]; then
  echo Docker installed: $WHERE_IS_DOCKER
else
  echo You must install Docker.
  exit 1
fi

# Software prerequisites have been met so we can continue.

source ./env-openshift.sh

echo Will build OpenShift here: ${OPENSHIFT_GITHUB_SOURCE_DIR}

if [ ! -d "${OPENSHIFT_GITHUB_SOURCE_DIR}" ]; then
  echo The OpenShift Origin source code repository has not been cloned yet - doing that now.

  # Create the location where the source code will live.

  PARENT_DIR=`dirname ${OPENSHIFT_GITHUB_SOURCE_DIR}`
  mkdir -p ${PARENT_DIR}

  if [ ! -d "${PARENT_DIR}" ]; then
    echo Aborting. Cannot create the parent source directory: ${PARENT_DIR}
    exit 1
  fi

  # Clone the OpenShift Origin source code repository via git.

  cd ${PARENT_DIR}
  git clone git@github.com:openshift/origin.git
else
  echo The OpenShift Origin source code repository exists - it will be updated now.
fi

# Build OpenShift Origin.

cd ${OPENSHIFT_GITHUB_SOURCE_DIR}
git fetch origin

if [ ! -z "${OPENSHIFT_BRANCH_NAME}" ]; then
  if [ "${OPENSHIFT_BRANCH_NAME}" == "latest" ]; then
    echo "Switching to the master branch to build the latest version"
    git checkout origin/master
  else
    echo "Switching to the origin/${OPENSHIFT_BRANCH_NAME} branch"
    git checkout origin/${OPENSHIFT_BRANCH_NAME}
    if [ "$?" != "0" ]; then
      echo "Cannot build - there is no branch for the version you want: ${OPENSHIFT_BRANCH_NAME}"
      exit 1
    fi
  fi
else
  # pull whatever branch we are on
  git pull
fi

export GOPATH=${OPENSHIFT_GOPATH}

echo Building OpenShift Origin binaries ...
hack/env make clean build

echo Building OpenShift Origin images...
hack/build-local-images.py

if [ "$?" = "0" ]; then
  echo OpenShift Origin build is complete!
  echo You can start it via: cluster-openshift.sh up
  echo You can stop it via: cluster-openshift.sh down
  echo You can get version and status information via: cluster-openshift.sh status

  systemctl show --property=ExecStart docker | grep insecure-registry > /dev/null 2>&1
  if [ "$?" != "0" ]; then
     echo 'WARNING: If you are running Docker as a service via systemd then you must add the --insecure-registry argument with an appropriate value to its options (usually "--insecure-registry 172.30.0.0/16") and restart the Docker service. Otherwise, make sure that argument is passed to your running Docker daemon. See the OpenShift Origin documentation for more details: https://github.com/openshift/origin/blob/master/CONTRIBUTING.adoc'
  fi
fi
