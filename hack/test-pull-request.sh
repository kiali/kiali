#!/bin/sh

###############################################
#
# This will deploy Kiali to a cluster via OLM. It will pull the source code
# from the master branches or from PR branches that are passed in via command
# line arguments.
#
# Before running this script you must:
#   1. Have a cluster already installed.
#   2. Be connected to/logged into the cluster.
#   3. Install Istio in the cluster.
#
# After this script is run, you will know the Kiali operator and server have been
# successfully built and installed when, after a few minutes, the Kiali server pod
# is running. You can test this via a command like this:
#   $ kubectl get pods -n istio-system -l app.kubernetes.io/name=kiali
#
# Here's how you can use this in three different cluster implementations
# (minikube, OpenShift, KinD). Note that these examples assume the branches
# are called "DELETEME" in the forks of kiali/kiali and kiali/operator repos.
# You can use whatever forks/branches you want (e.g. pick a PR and use the
# developer's fork/branch for that PR).
#
# == MINIKUBE
#
# 1. Install minikube:
#      $ hack/k8s-minikube.sh start
# 2. Install Istio:
#      $ hack/k8s-minikube.sh istio
# 3. Use this script to deploy the server and operator built from the source code
#    found in the forks' DELETEME branches:
#      $ hack/test-pull-request.sh -kb DELETEME -kf my-kiali-repo-name -kob DELETEME -kof my-op-repo-name -ce $(which kubectl)
#
# == OPENSHIFT
#
# 1. Install OpenShift:
#      $ hack/crc-openshift.sh start
# 2. Install Istio:
#      $ hack/istio/install-istio-via-istioctl.sh
# 3. Use this script to deploy the server and operator built from the source code
#    found in the forks' DELETEME branches:
#      $ hack/test-pull-request.sh -kb DELETEME -kf my-kiali-repo-name -kob DELETEME -kof my-op-repo-name -ce $(which oc)
#
# == KIND
#
# 1. Install KinD cluster:
#      $ hack/start-kind.sh --enable-image-registry true --name test
# 2. Install Istio:
#      $ hack/istio/install-istio-via-istioctl.sh -c kubectl
# 3. Use this script to deploy the server and operator built from the source code
#    found in the forks' DELETEME branches. Note: you must use "docker" with KinD, thus -dorp docker argument is required.
#      $ hack/test-pull-request.sh -kb DELETEME -kf my-kiali-repo-name -kob DELETEME -kof my-op-repo-name -ce $(which kubectl) -kn test -dorp docker
#
###############################################

set -eu

helpmsg() {
  cat <<HELP

This script will download the Kiali source code, and then build and deploy the Kiali operator and server via OLM.

Options:

-ce|--client-exe <path to kubectl>
    The 'kubectl' or 'oc' command, if not in PATH then must be a full path.
    Default: oc

-dorp|--docker-or-podman <docker|podman>
    Container environment to use.
    Default: podman

-kb|--kiali-branch <branch name>
    The kiali branch to clone.
    Default: master

-kf|--kiali-fork <name>
    The kiali fork/org to clone.
    Default: kiali

-kn|--kind-name <name>
    If the cluster type is KinD, set the KinD name here. If you do not know the name,
    specify 'kind' since that is the KinD default name.
    Default: ""

-kob|--kiali-operator-branch <branch name>
    The kiali-operator branch to clone.
    Default: master

-kof|--kiali-operator-fork <name>
    The kiali-operator fork/org to clone.
    Default: kiali

-mp|--minikube-profile <name>
    If the cluster type is minikube, set the profile name here. If you do not know the profile name,
    specify 'minikube' since that is the minikube default name.
    Default: ""

-ov|--olm-version <version>
    The OLM version to install. If on OpenShift this is ignored since the OLM that comes with OpenShift will be used.
    Default: latest

-sd|--source-dir <directory>
    The root directory where all source code will be downloaded to.
    Default: /tmp/kiali-test-pr-source"
HELP
}

# Process command line arguments

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ce|--client-exe)             CLIENT_EXE="$2";            shift;shift; ;;
    -dorp|--docker-or-podman)     DORP="$2";                  shift;shift; ;;
    -h|--help)                    helpmsg;                    exit 1       ;;
    -kb|--kiali-branch)           KIALI_BRANCH="$2";          shift;shift; ;;
    -kf|--kiali-fork)             KIALI_FORK="$2";            shift;shift; ;;
    -kn|--kind-name)              KIND_NAME="$2";             shift;shift; ;;
    -kob|--kiali-operator-branch) KIALI_OPERATOR_BRANCH="$2"; shift;shift; ;;
    -kof|--kiali-operator-fork)   KIALI_OPERATOR_FORK="$2";   shift;shift; ;;
    -mp|--minikube-profile)       MINIKUBE_PROFILE="$2";      shift;shift; ;;
    -ov|--olm-version)            OLM_VERSION="$2";           shift;shift; ;;
    -sd|--source-dir)             SRC_DIR="$2";               shift;shift; ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

CLIENT_EXE="${CLIENT_EXE:-$(which oc)}"
DORP="${DORP:-podman}"
KIND_NAME="${KIND_NAME:-}"
MINIKUBE_PROFILE="${MINIKUBE_PROFILE:-}"
OLM_VERSION="${OLM_VERSION:-latest}"
SRC_DIR="${SRC_DIR:-/tmp/kiali-test-pr-source}"

KIALI_FORK="${KIALI_FORK:-kiali}"
KIALI_BRANCH="${KIALI_BRANCH:-master}"
KIALI_OPERATOR_FORK="${KIALI_OPERATOR_FORK:-kiali}"
KIALI_OPERATOR_BRANCH="${KIALI_OPERATOR_BRANCH:-master}"

GITHUB_PROTOCOL="https://github.com/" # could use "git@github.com:" if we want authenticated access
KIALI_GITCLONE_URL="${GITHUB_PROTOCOL}${KIALI_FORK}/kiali.git"
KIALI_OPERATOR_GITCLONE_URL="${GITHUB_PROTOCOL}${KIALI_OPERATOR_FORK}/kiali-operator.git"

# Print out settings for debug purposes

cat <<EOM
=== SETTINGS ===
CLIENT_EXE=$CLIENT_EXE
DORP=$DORP
KIND_NAME=$KIND_NAME
MINIKUBE_PROFILE=$MINIKUBE_PROFILE
OLM_VERSION=$OLM_VERSION
SRC_DIR=$SRC_DIR

KIALI_FORK=$KIALI_FORK
KIALI_BRANCH=$KIALI_BRANCH
KIALI_OPERATOR_FORK=$KIALI_OPERATOR_FORK
KIALI_OPERATOR_BRANCH=$KIALI_OPERATOR_BRANCH

KIALI_GITCLONE_URL=$KIALI_GITCLONE_URL
KIALI_OPERATOR_GITCLONE_URL=$KIALI_OPERATOR_GITCLONE_URL
=== SETTINGS ===
EOM

# Make sure we have the tools that we need

which ${CLIENT_EXE} > /dev/null || (echo "[${CLIENT_EXE}] is missing"; exit 1)
which ${DORP} > /dev/null || (echo "[${DORP}] is missing"; exit 1)
which go > /dev/null || (echo "Go is not in the PATH - you must install Go and put the Go executable in PATH"; exit 1)

# Set some cluster-specific env vars

if ${CLIENT_EXE} api-versions | grep --quiet "route.openshift.io"; then
  IS_OPENSHIFT="true"
  echo "You are connecting to an OpenShift cluster"
  CLUSTER_TYPE="openshift"
  OLM_BUNDLE_PACKAGE="kiali-ossm"
else
  IS_OPENSHIFT="false"
  echo -n "You are connecting to a (non-OpenShift) Kubernetes cluster; cluster type is "
  if [ -n "${MINIKUBE_PROFILE}" ]; then
    echo "[minikube]"
    CLUSTER_TYPE="minikube"
    OLM_BUNDLE_PACKAGE="kiali"
    export MINIKUBE_PROFILE
  elif [ -n "${KIND_NAME}" ]; then
    echo "[kind]"
    CLUSTER_TYPE="kind"
    OLM_BUNDLE_PACKAGE="kiali"
    export KIND_NAME
  else
    echo "[unknown]"
    echo "You must specify either --minikube-profile (if on minikube) or --kind-name (if on KinD)"
    exit 1
  fi
fi

# Export the env vars we want "make" to know about

export OC=${CLIENT_EXE}
export DORP=${DORP}
export GOPATH="${GOPATH:-/tmp}"
export CLUSTER_TYPE
export OLM_BUNDLE_PACKAGE

# Prepare a clean slate for downloading the source code

echo "Create a clean location for the source code"
test -d ${SRC_DIR}/kiali && rm -rf ${SRC_DIR}/kiali
test -d ${SRC_DIR}/kiali-operator && rm -rf ${SRC_DIR}/kiali-operator
mkdir -p ${SRC_DIR}

echo "Change to the directory where all source code will be pulled"
cd ${SRC_DIR}

# Download the source code from the desired forks and branches

echo "Cloning kiali [${KIALI_FORK}/kiali:${KIALI_BRANCH}] from [${KIALI_GITCLONE_URL}]..."
git clone --single-branch --branch ${KIALI_BRANCH} ${KIALI_GITCLONE_URL}
echo "Cloning kiali-operator [${KIALI_OPERATOR_FORK}/kiali-operator:${KIALI_OPERATOR_BRANCH}] from [${KIALI_OPERATOR_GITCLONE_URL}]..."
git clone --single-branch --branch ${KIALI_OPERATOR_BRANCH} ${KIALI_OPERATOR_GITCLONE_URL}

ln -s ${SRC_DIR}/kiali-operator kiali/operator

echo "Change to kiali directory where the main make targets are"
cd kiali

# Build and push the images to the cluster

echo "Building backend server and frontend UI using GOPATH=${GOPATH}..."
make clean build-ui build test

if [ "${IS_OPENSHIFT}" == "true" ]; then
  echo "Logging into the image registry..."
  eval $(make cluster-status | grep "Image Registry login:" | sed 's/Image Registry login: \(.*\)$/\1/')
fi

echo "Pushing the images into the cluster..."
make cluster-push

# Install OLM if it does not already exist in the cluster

if [ "${IS_OPENSHIFT}" != "true" ]; then
  if ! ${CLIENT_EXE} get ns olm &> /dev/null; then
    echo "Installing OLM..."
    # force OLM install script to go through our client exe when it executes 'kubectl'
    kubectl() {
      ${CLIENT_EXE} "$@"
    }
    export CLIENT_EXE
    export -f kubectl
    make olm-install -e OLM_VERSION="${OLM_VERSION}"
    unset -f kubectl
  else
    echo "OLM appears to already be installed."
  fi
fi

echo "Deploying the Kiali Operator via OLM"
make olm-operator-create

echo "Deploying the Kiali Server"
make kiali-create
