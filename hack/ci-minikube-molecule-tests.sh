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

if ! ${hack_dir}/k8s-minikube status; then
  ${hack_dir}/k8s-minikube.sh --dex-enabled true start
  if ! ${hack_dir}/k8s-minikube status; then
    echo "Failed to install the minikube cluster."
    exit 1
  fi
  ${hack_dir}/k8s-minikube.sh istio
fi

${hack_dir}/run-molecule-tests.sh --cluster-type minikube -at openid-test #MAZZ remove -at

