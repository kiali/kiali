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

helpmsg() {
  cat <<HELP
This script will run the Kiali molecule tests in minikube.

You can use this as a cronjob to test Kiali periodically.

Options:

-ce|--client-exe <path to kubectl>
    The 'kubectl' command, if not in PATH then must be a full path.
    Default: kubectl

-dorp|--docker-or-podman <docker|podman>
    Container environment to use.
    Default: ${DORP:-docker}

-me|--minikube-exe <path to minikube>
    The 'minikube' command, if not in PATH then must be a full path.
    Default: minikube
HELP
}

# process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ce|--client-exe)             CLIENT_EXE="$2";     shift;shift; ;;
    -dorp|--docker-or-podman)     DORP="$2";           shift;shift; ;;
    -me|--minikube-exe)           MINIKUBE_EXE="$2";   shift;shift; ;;
    -h|--help)                    helpmsg; exit 1;     shift; ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

CLIENT_EXE="${CLIENT_EXE:-kubectl}"
DORP="${DORP:-docker}"
MINIKUBE_EXE="${MINIKUBE_EXE:-minikube}"

# the minikube hack script command
minikube_profile="ci"
minikube_sh="${hack_dir}/k8s-minikube.sh --minikube-profile ${minikube_profile} --minikube-exe ${MINIKUBE_EXE} --client-exe ${CLIENT_EXE}"

# make sure we switch contexts if we can so we are pointing to the current cluster
if [ "$(${CLIENT_EXE} config current-context)" != "${minikube_profile}" ]; then
  if ! ${CLIENT_EXE} config use-context ${minikube_profile}; then
    echo "There is no kubectl context named [${minikube_profile}]. This likely means we will start one next."
  fi
fi

if ! ${minikube_sh} status; then
  ${minikube_sh} start --dex-enabled true
  if ! ${minikube_sh} status; then
    echo "Failed to install the minikube cluster."
    exit 1
  fi
  ${minikube_sh} istio
else
  ${minikube_sh} resetclock
fi

${hack_dir}/run-molecule-tests.sh --cluster-type minikube --minikube-profile ${minikube_profile} --color false --minikube-exe ${MINIKUBE_EXE} --client-exe ${CLIENT_EXE} -dorp ${DORP}
