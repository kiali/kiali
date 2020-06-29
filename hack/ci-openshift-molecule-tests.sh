#!/bin/bash

#
# This script is designed to be run via a cronjob so the latest Kiali images
# can be tested periodically using the molecule tests.
#
# If you want to run the molecule tests against a specific OpenShift cluster, you first
# must "oc login" to that cluster and then run this script.
#
# If you do not have an OpenShift cluster, then when this script runs it will attempt
# to install one on AWS. In this case, you must have an AWS account set up and an OpenShift
# pull secret available. See the aws-openshift.sh and aws-openshift-istio.sh hack scripts for details.
# WARNING! If you are not logged into an AWS cluster but you already have an AWS cluster deployed,
# this script will destroy that cluster and rebuild a new one.
#

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ism|--install-service-mesh)
      INSTALL_SERVICE_MESH="$2"
      shift;shift
      ;;
    -iui|--install-upstream-istio)
      INSTALL_UPSTREAM_ISTIO="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG

$0 [option...] command

-ism|--install-service-mesh: If Service Mesh should be installed. default: "false"
-iui|--install-upstream-istio: If upstream Istio should be installed. default: "false"
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown option: [$key]. Aborting."
      exit 1
      ;;
  esac
done

INSTALL_SERVICE_MESH="${INSTALL_SERVICE_MESH:-false}"
INSTALL_UPSTREAM_ISTIO="${INSTALL_UPSTREAM_ISTIO:-false}"

# Where this script is - all our hack files are assumed to be in here
script_root="$( cd "$(dirname "$0")" ; pwd -P )"
hack_dir="$script_root"

if ! oc whoami > /dev/null 2>&1; then
  if [ "${INSTALL_SERVICE_MESH}" == "false" -a "${INSTALL_UPSTREAM_ISTIO}" == "false" ]; then
    echo "Molecule tests require either Service Mesh or upstream Istio to be installed."
    exit 1
  fi

  ${hack_dir}/aws-openshift-istio.sh \
    --install-service-mesh "${INSTALL_SERVICE_MESH}" \
    --install-upstream-istio "${INSTALL_UPSTREAM_ISTIO}" \
    --install-bookinfo "false"
  if [ "$?" != "0" ]; then
    echo "Failed to install the AWS cluster."
    exit 1
  fi

  # If we are installing Service Mesh, uninstall Kiali since the molecule tests will want to install its own
  if [ "${INSTALL_SERVICE_MESH}" == "true" ]; then
    ${hack_dir}/istio/install-sm11.sh k-uninstall
  fi

  oc login -u kiali -p kiali https://$(${hack_dir}/aws-openshift.sh api-host)
  if [ "$?" != "0" ]; then
    echo "Failed to log into the AWS cluster as the kiali user."
    exit 1
  fi
fi

${hack_dir}/run-molecule-tests.sh
