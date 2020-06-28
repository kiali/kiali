#!/bin/bash

#
# This script is designed to be run via a cronjob so the latest Kiali images
# can be tested periodically using the molecule tests.
#
# This will start a minikube cluster via the hack script k8s-minikube.sh.
#

# Where this script is - all our hack files are assumed to be in here
script_root="$( cd "$(dirname "$0")" ; pwd -P )"
hack_dir="$script_root"

# the minikube hack script command
minikube_profile="ci"
minikube_sh="${hack_dir}/k8s-minikube.sh --minikube-profile ${minikube_profile}"

if ! ${minikube_sh} status; then
  ${minikube_sh} start --dex-enabled true -kv 1.18.0
  if ! ${minikube_sh} status; then
    echo "Failed to install the minikube cluster."
    exit 1
  fi
  ${minikube_sh} istio
fi

${hack_dir}/run-molecule-tests.sh --cluster-type minikube -at openid-test #MAZZ remove -at

