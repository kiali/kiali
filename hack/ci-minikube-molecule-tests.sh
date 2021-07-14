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

-oe|--olm-enabled <true|false>
    If true, install OLM into the cluster and test the operator as installed by OLM
    This has no effect if the cluster is already built. To ensure OLM is enabled,
    you can pass in "--rebuild-cluster true" to start a new cluster with OLM.
    Default: false

-rc|--rebuild-cluster <true|false>
    If true, any existing cluster will be destroyed and a new one will be rebuilt.
    Default: false
HELP
}

# process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ce|--client-exe)             CLIENT_EXE="$2";      shift;shift; ;;
    -dorp|--docker-or-podman)     DORP="$2";            shift;shift; ;;
    -me|--minikube-exe)           MINIKUBE_EXE="$2";    shift;shift; ;;
    -oe|--olm-enabled)            OLM_ENABLED="$2";     shift;shift; ;;
    -rc|--rebuild-cluster)        REBUILD_CLUSTER="$2"; shift;shift; ;;
    -h|--help)                    helpmsg; exit 1;      shift; ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

CLIENT_EXE="${CLIENT_EXE:-kubectl}"
DORP="${DORP:-docker}"
MINIKUBE_EXE="${MINIKUBE_EXE:-minikube}"
OLM_ENABLED="${OLM_ENABLED:-false}"
REBUILD_CLUSTER="${REBUILD_CLUSTER:-false}"

# the minikube hack script command
minikube_profile="ci"
minikube_sh="${hack_dir}/k8s-minikube.sh --minikube-profile ${minikube_profile} --minikube-exe ${MINIKUBE_EXE} --client-exe ${CLIENT_EXE}"

if [ "${REBUILD_CLUSTER}" == "true" ]; then
  echo "Destroying any existing cluster to ensure a new one will be rebuilt."
  ${minikube_sh} delete
fi

# make sure we switch contexts if we can so we are pointing to the current cluster
if [ "$(${CLIENT_EXE} config current-context)" != "${minikube_profile}" ]; then
  if ! ${CLIENT_EXE} config use-context ${minikube_profile}; then
    echo "There is no kubectl context named [${minikube_profile}]. This likely means we will start one next."
  fi
fi

if [ "${OLM_ENABLED}" == "true" ]; then
  operator_installer_arg="--operator-installer skip"
  olm_enabled_arg="--olm-enabled true"
else
  operator_installer_arg="--operator-installer helm"
  olm_enabled_arg="--olm-enabled false"
fi

if ! ${minikube_sh} status; then

  ${minikube_sh} start --dex-enabled true ${olm_enabled_arg}
  if ! ${minikube_sh} status; then
    echo "Failed to install the minikube cluster."
    exit 1
  fi
  ${minikube_sh} istio

  if [ "${OLM_ENABLED}" == "true" ]; then
    echo "Installing Kiali Operator"
    ${CLIENT_EXE} create -f https://operatorhub.io/install/stable/kiali.yaml

    echo -n "Waiting for Kiali CRD to be created."
    timeout 1h bash -c "until ${CLIENT_EXE} get crd kialis.kiali.io >& /dev/null; do echo -n '.' ; sleep 3; done"
    echo

    echo "Waiting for Kiali CRD to be established."
    ${CLIENT_EXE} wait --for condition=established --timeout=300s crd kialis.kiali.io

    echo "Configuring the Kiali operator to allow ad hoc images and ad hoc namespaces."
    operator_namespace="$(${CLIENT_EXE} get deployments --all-namespaces  | grep kiali-operator | cut -d ' ' -f 1)"
    for env_name in ALLOW_AD_HOC_KIALI_NAMESPACE ALLOW_AD_HOC_KIALI_IMAGE; do
      ${CLIENT_EXE} -n ${operator_namespace} patch $(${CLIENT_EXE} -n ${operator_namespace} get csv -o name | grep kiali) --type=json -p "[{'op':'replace','path':"/spec/install/spec/deployments/0/spec/template/spec/containers/0/env/$(${CLIENT_EXE} -n ${operator_namespace} get $(${CLIENT_EXE} -n ${operator_namespace} get csv -o name | grep kiali) -o jsonpath='{.spec.install.spec.deployments[0].spec.template.spec.containers[0].env[*].name}' | tr ' ' '\n' | cat --number | grep ${env_name} | cut -f 1 | xargs echo -n | cat - <(echo "-1") | bc)/value",'value':"\"true\""}]"
    done

    echo "Waiting for the Kiali Operator to be ready."
    ${CLIENT_EXE} wait -n ${operator_namespace} --for=condition=ready --timeout=300s $(${CLIENT_EXE} get pod -n ${operator_namespace} -l app.kubernetes.io/name=kiali-operator -o name)
  fi
else
  ${minikube_sh} resetclock
fi

${hack_dir}/run-molecule-tests.sh --cluster-type minikube --minikube-profile ${minikube_profile} --color false --minikube-exe ${MINIKUBE_EXE} --client-exe ${CLIENT_EXE} -dorp ${DORP} ${operator_installer_arg}
