#!/bin/bash

##############################################################################
# build-istio.sh
#
# This clones the Istio repo and builds it.
#
# By default, the master branch will be built.
# By default, the output/clone directory will be ../../_output.
#
# See the --help output for details.
##############################################################################

# process command line args
while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -b|--branch)
      BRANCH="$2"
      shift;shift
      ;;
    -c|--clean)
      CLEAN="true"
      shift
      ;;
    -d|--docker)
      DOCKER="true"
      shift
      ;;
    -m|--make-target)
      MAKE_TARGET="$2"
      shift;shift
      ;;
    -o|--output)
      OUTPUT_DIR="$2"
      shift;shift
      ;;
    -y|--generate-yaml)
      GENERATE_YAML="true"
      shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -b|--branch <name>: The branch to checkout and build.
  -d|--docker: When specified, images will be pushed to your local docker after the build.
  -c|--clean: When specified, will perform a clean prior to running make.
  -m|--make-target <target>: Optional make target to run. e.g. Pass "istioctl" to build just istioctl.
  -o|--output <dir> : Output directory where the build GOPATH will be. Istio will be git cloned under here.
  -y|--generate-yaml: When specified, after the build the YAML will be generated.
  -h|--help : This message.
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# What branch to check out and build
BRANCH="${BRANCH:-master}"

# Go to the main output directory - this will be the main GOPATH
HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-${HACK_SCRIPT_DIR}/../../_output/gopath-istio-build}"
mkdir -p "$OUTPUT_DIR"
cd "$OUTPUT_DIR"
OUTPUT_DIR="$(pwd)" # remove the .. references

# Set some variables required by the Istio build scripts
export GOPATH="${OUTPUT_DIR}"
export ISTIO="${GOPATH}/src/istio.io"
export PATH=${GOPATH}/bin:${PATH}
echo "Output Directory/Istio build GOPATH: ${GOPATH}"
echo "Git clone of Istio will be here: ${ISTIO}/istio"

# Git clone Istio
mkdir -p "$ISTIO"
cd "$ISTIO"

if [ -d "istio" ]; then
  echo "Looks like there is already a git clone of Istio at ${ISTIO}/istio"
else
  git clone git@github.com:istio/istio.git
fi

# Switch to the branch we want to build and make sure it is up to date
cd istio
git checkout ${BRANCH}
git pull

# Clean old build files
if [ "${CLEAN}" == "true" ]; then
  echo "Cleaning old build files."
  make clean
  if [ "$?" != "0" ]; then
    echo "CLEAN FAILED!"
  fi
fi

make ${MAKE_TARGET}

if [ "$?" != "0" ]; then
  echo "ISTIO BUILD FAILED!"
  exit 1
fi

# Generate yaml
if [ "${GENERATE_YAML}" == "true" ]; then
  echo "Generating YAML"
  make generate_yaml
  if [ "$?" != "0" ]; then
    echo "GENERATING YAML FAILED!"
  fi
fi

# Build the containers in local docker
if [ "${DOCKER}" == "true" ]; then
  echo "Pushing images to local docker"
  make docker
  if [ "$?" != "0" ]; then
    echo "PUTTING ISTIO IMAGES IN DOCKER FAILED!"
  fi
fi

# Provide some final information
echo "============================================"
echo "Binaries:"
ls -l ${GOPATH}/out/linux_amd64/release
echo "============================================"
echo "istioctl softlink can be created by executing this command:"
echo "ln -si ${GOPATH}/out/linux_amd64/release/istioctl ${HOME}/bin/istioctl"
echo "============================================"
