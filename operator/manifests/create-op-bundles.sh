#!/bin/bash

################################################
# This script creates operator bundles, one
# bundle per version of the operator.
################################################

log() {
  echo "LOG: ${1}"
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
cd ${SCRIPT_DIR}

IMAGE_BUILDER="docker"

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ib|--image-builder)
      IMAGE_BUILDER="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
$0 [option...]

Valid options:
  -ib|--image-builder [docker,podman,buildah]
      The tool that will be used to build the image container.
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key].  Aborting."
      exit 1
      ;;
  esac
done

if [ -d ./operator-registry ]; then
  log "OPM source code has already been cloned - updating it to the latest."
  cd ./operator-registry
  git checkout master
  git pull
else
  log "Cloning OPM source code."
  git clone https://github.com/operator-framework/operator-registry
  cd ./operator-registry
fi

log "Building OPM executable."
if ! go build ./cmd/opm ; then
  log "ERROR: Failed to build the OPM executable"
fi

cd ${SCRIPT_DIR}
OPM="${SCRIPT_DIR}/operator-registry/opm"

if [ ! -x ${OPM} ]; then
  log "ERROR: OPM executable is missing - it should be here: ${OPM}"
  exit 1
fi

for project_dir in kiali-community kiali-upstream kiali-ossm
do
  for version_dir in $(ls -vd1 ${project_dir}/[0-9]*)
  do
    version=$(echo ${version_dir} | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+')
    if [ "${project_dir}" == "kiali-ossm" ]; then
      tag="registry.redhat.io/openshift-service-mesh/kiali-operator-metadata.v${version}:latest"
      package="kiali-ossm"
    elif [ "${project_dir}" == "kiali-community" ]; then
      tag="quay.io/kiali/kiali-operator-community.v${version}:latest"
      package="kiali"
    elif [ "${project_dir}" == "kiali-upstream" ]; then
      tag="quay.io/kiali/kiali-operator-upstream.v${version}:latest"
      package="kiali"
    fi
    echo -n "${tag} found in: ${version_dir} | Building..."
    ${OPM} alpha bundle build --directory ${version_dir} --package ${package} --channels stable --default stable --image-builder ${IMAGE_BUILDER} --tag ${tag} > /dev/null 2>&1
    if [ "$?" != "0" ]; then
      echo "FAIL"
      log "ERROR: failed to build bundle ${tag} in ${version_dir}"
      exit 1
    fi
    echo "done."
  done
done
