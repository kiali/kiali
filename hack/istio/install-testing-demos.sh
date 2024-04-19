#!/bin/bash

##############################################################################
# install-testing-demos.sh
#
# Installs all the demo applications needed for cypress testing.
# Works on both openshift and non-openshift environments.
##############################################################################

set -eu
  
# Given a namepace, prepare it for inclusion in Maistra's control plane
# This means:
# 1. Create a SMM
# 2. Annotate all of the namespace's Deployments with the sidecar injection annotation if enabled
prepare_maistra() {
  local ns="${1}"

  cat <<EOM | ${CLIENT_EXE} apply -f -
apiVersion: maistra.io/v1
kind: ServiceMeshMember
metadata:
  name: default
  namespace: ${ns}
spec:
  controlPlaneRef:
    namespace: ${ISTIO_NAMESPACE}
    name: "$(${CLIENT_EXE} get smcp -n ${ISTIO_NAMESPACE} -o jsonpath='{.items[0].metadata.name}' )"
EOM

  # let's wait for smmr to be Ready before enabling sidecar injection
  ${CLIENT_EXE} wait --for condition=Ready -n ${ISTIO_NAMESPACE} smmr/default --timeout 300s
  # enable sidecar injection
  for d in $(${CLIENT_EXE} get deployments -n ${ns} -o name)
  do
    echo "Enabling sidecar injection for deployment: ${d}"
    ${CLIENT_EXE} patch ${d} -n ${ns} -p '{"spec":{"template":{"metadata":{"annotations":{"sidecar.istio.io/inject": "true"}}}}}' --type=merge
  done
}

install_sleep_app() {

  if [ "${ISTIO_DIR}" == "" ]; then
    ISTIO_DIR=$(ls -dt1 ${SCRIPT_DIR}/../../_output/istio-* | head -n1)
  fi

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} get project "sleep" || ${CLIENT_EXE} new-project "sleep"
  else
    ${CLIENT_EXE} get ns sleep || ${CLIENT_EXE} create ns sleep
  fi

  ${CLIENT_EXE} label namespace "sleep" istio-injection=enabled --overwrite=true

  # For OpenShift 4.11, adds default service account in the current ns to use as a user
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} adm policy add-scc-to-user anyuid system:serviceaccount:sleep:sleep
  fi

  if [ "${IS_OPENSHIFT}" == "true" ]; then
      cat <<NAD | $CLIENT_EXE -n sleep apply -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
    cat <<SCC | $CLIENT_EXE apply -n sleep -f -
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: sleep-scc
runAsUser:
  type: RunAsAny
seLinuxContext:
  type: RunAsAny
supplementalGroups:
  type: RunAsAny
users:
- "system:serviceaccount:sleep:default"
- "system:serviceaccount:sleep:sleep"
SCC
  fi
  if [ "${ARCH}" == "s390x" ]; then
    echo "Using s390x specific images for curl in sleep.yaml"
    sed -i.bak -E '/curlimages\/curl:8\.4\.0/! s;curlimages/curl;curlimages/curl:8.4.0;g' ${ISTIO_DIR}/samples/sleep/sleep.yaml 
  fi
  ${CLIENT_EXE} apply -n sleep -f ${ISTIO_DIR}/samples/sleep/sleep.yaml

  if [ "${IS_MAISTRA}" == "true" ]; then
    prepare_maistra "sleep"
  fi
}

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"

# install the Istio release that was last downloaded (that's the -t option to ls)
ISTIO_DIR=$(ls -dt1 ${SCRIPT_DIR}/../../_output/istio-* | head -n1)

# only used when cluster is minikube
MINIKUBE_PROFILE="minikube"

: ${CLIENT_EXE:=oc}
: ${ARCH:=amd64}
: ${DELETE_DEMOS:=false}
ISTIO_NAMESPACE="istio-system"

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -a|--arch)
      ARCH="$2"
      shift;shift
      ;;
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -d|--delete)
      DELETE_DEMOS="$2"
      shift;shift
      ;;
    -mp|--minikube-profile)
      MINIKUBE_PROFILE="$2"
      shift;shift
      ;;
    -in|--istio-namespace)
      ISTIO_NAMESPACE="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -a|--arch <amd64|ppc64le|s390x>: Images for given arch will be used (default: amd64).
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: if 'true' demos will be deleted; otherwise, they will be installed
  -mp|--minikube-profile <name>: If using minikube, this is the minikube profile name (default: minikube).
  -in|--istio-namespace <name>: Where the Istio control plane is installed (default: istio-system).
  -h|--help: this text
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# check arch values
if [ "${ARCH}" != "ppc64le" ] && [ "${ARCH}" != "s390x" ] && [ "${ARCH}" != "amd64" ]; then
  echo "${ARCH} is not supported. Exiting."
  exit 1
fi

IS_OPENSHIFT="false"
IS_MAISTRA="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
  IS_MAISTRA=$([ "$(${CLIENT_EXE} get crd | grep servicemesh | wc -l)" -gt "0" ] && echo "true" || echo "false")
fi

echo "CLIENT_EXE=${CLIENT_EXE}"
echo "ARCH=${ARCH}"
echo "IS_OPENSHIFT=${IS_OPENSHIFT}"
echo "IS_MAISTRA=${IS_MAISTRA}"

# Waits for workloads in the specified namespace to be ready
wait_for_workloads () {
  local namespace=$1
  local workloads=$(${CLIENT_EXE} get deployments -n $namespace -o jsonpath='{.items[*].metadata.name}')
  for workload in ${workloads}
  do
    echo "Waiting for workload: '${workload}' to be ready"
    ${CLIENT_EXE} rollout status deployment "${workload}" -n "${namespace}"
  done
}

if [ "${DELETE_DEMOS}" != "true" ]; then

  # Installed demos should be the exact same for both environments.
  # Only the args passed to the scripts differ from each other.
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    echo "Deploying bookinfo demo ..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" -tg -in ${ISTIO_NAMESPACE} -a ${ARCH}
    echo "Deploying error rates demo ..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh" -in ${ISTIO_NAMESPACE} -a ${ARCH}

  else
    echo "Deploying bookinfo demo..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" -c kubectl -mp ${MINIKUBE_PROFILE} -tg -in ${ISTIO_NAMESPACE} -a ${ARCH}

    echo "Deploying error rates demo..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh" -c kubectl -in ${ISTIO_NAMESPACE} -a ${ARCH}
  fi

  echo "Installing the 'sleep' app in the 'sleep' namespace..."
  install_sleep_app

  # Some front-end tests have conflicts with the wildcard host in the bookinfo-gateway. Patch it with the host resolved for the traffic generator.
  ISTIO_INGRESS_HOST=$(${CLIENT_EXE} get cm -n bookinfo traffic-generator-config -o jsonpath='{.data.route}' | sed 's|.*//\([^\:]*\).*/.*|\1|')
  ${CLIENT_EXE} patch VirtualService bookinfo -n bookinfo --type json -p "[{\"op\": \"replace\", \"path\": \"/spec/hosts/0\", \"value\": \"${ISTIO_INGRESS_HOST}\"}]"

  for namespace in bookinfo alpha beta
  do
    wait_for_workloads "${namespace}"
  done

else
  # Delete everything - don't abort on error, just keep going and try to delete everything
  set +e

  echo "Deleting the 'sleep' app in the 'sleep' namespace..."
  ${CLIENT_EXE} delete -n sleep -f ${ISTIO_DIR}/samples/sleep/sleep.yaml
  if [ "${IS_MAISTRA}" == "true" ]; then
    ${CLIENT_EXE} delete smm default -n "sleep" --ignore-not-found=true
  fi
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} delete network-attachment-definition istio-cni -n sleep
    ${CLIENT_EXE} delete scc sleep-scc
    ${CLIENT_EXE} delete project sleep
  fi
  ${CLIENT_EXE} delete namespace sleep

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    echo "Deleting bookinfo demo ..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" --delete-bookinfo true
    echo "Deleting error rates demo ..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh" --delete true
  else
    echo "Deleting bookinfo demo..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" --delete-bookinfo true -c kubectl
    echo "Deleting error rates demo..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh" --delete true -c kubectl
  fi
fi
