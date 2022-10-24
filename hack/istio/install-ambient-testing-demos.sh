#!/bin/bash

##############################################################################
# install-istio-ambient
#
# Installs testing demos for istio ambient
#
##############################################################################

CLIENT_EXE="kubectl"
ISTIOCTL="$HOME/Downloads/istio-ambient/bin/istioctl"
ISTIO_DIR="$HOME/Downloads/istio-ambient"
NAMESPACE="istio-system"
TRAFFIC="false"
WAYPOINT="true"
BOOKINFO_NAMESPACE="bookinfo"
DELETE="false"
NAMESPACE_ALPHA="alpha"
NAMESPACE_BETA="beta"
SOURCE="https://raw.githubusercontent.com/kiali/demos/master"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ic|--istioctl)
      ISTIOCTL="$2"
      shift;shift
      ;;
    -id|--istiodir)
      ISTIO_DIR="$2"
      shift;shift
      ;;
    -d|--delete)
      DELETE="$2"
      shift;shift
      ;;
    -n|--namespace)
      NAMESPACE="$2"
      shift;shift
      ;;
    -t|--traffic)
      TRAFFIC="$2"
      shift;shift
      ;;
    -w|--waypoint)
      WAYPOINT="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Installs istio ambient and environment to be tested
Requirements:
 - Istio ambient must be downloaded
   https://gcsweb.istio.io/gcs/istio-build/dev/0.0.0-ambient.191fe680b52c1754ee72a06b3e0d3f9d116f2e82
 - kind installed
Valid command line arguments:
  -ic|--istioctl <path to istioctl binary>:
       Where the istioctl executable is found. Use this when developing Istio installer and testing it.
       Default: $ISTIOCTL
  -id|--istiodir <path to istiodir directory>:
       Where the istioctl executable is found. Use this when developing Istio installer and testing it.
       Default: $ISTIO_DIR
  -n|--namespace <name>:
       Install Istio in this namespace.
       Default: istio-system
  -t|--traffic (true|false)
       Generate traffic
       Default: false
  -w|--waypoint (true|false)
       Install waypoint proxy to get L7 features
       Default: false
  -h|--help:
       this message
HELPMSG
      exit 1
      ;;
    *)
      echo "ERROR: Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

install_waypoint() {

OP=$1
NS=$2

    # Create a waypoint proxy per SA or application
  kubectl ${OP} -n ${NS} -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1alpha2
kind: Gateway
metadata:
 name: default
spec:
 gatewayClassName: istio-mesh
 listeners:
 - name: default
   port: 80
   protocol: HTTP
   allowedRoutes:
     namespaces:
       from: All
EOF
}


send_traffic() {
  printf "\nSending some test traffic\n"
  while [ 1 ]
  do
    ${CLIENT_EXE} exec deploy/sleep -n ${BOOKINFO_NAMESPACE} -- curl -s http://istio-ingressgateway.istio-system/productpage | head -n1
    ${CLIENT_EXE} exec deploy/sleep -n ${BOOKINFO_NAMESPACE} -- curl -s http://productpage:9080/ | head -n1
    ${CLIENT_EXE} exec deploy/notsleep -n ${BOOKINFO_NAMESPACE} -- curl -s http://productpage:9080/ | head -n1
    sleep 5
  done
}

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

install_bookinfo() {
  printf "\nInstalling Bookinfo demo\n"

  ${CLIENT_EXE} create namespace ${BOOKINFO_NAMESPACE}
  ${CLIENT_EXE} apply -f ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo.yaml -n ${BOOKINFO_NAMESPACE}
  ${CLIENT_EXE} apply -f https://raw.githubusercontent.com/linsun/sample-apps/main/sleep/sleep.yaml -n ${BOOKINFO_NAMESPACE}
  ${CLIENT_EXE} apply -f https://raw.githubusercontent.com/linsun/sample-apps/main/sleep/notsleep.yaml -n ${BOOKINFO_NAMESPACE}

 wait_for_workloads "bookinfo"

  printf "\nApply gateway and label dataplane mode\n"
  ${CLIENT_EXE} apply -f ${ISTIO_DIR}/samples/bookinfo/networking/bookinfo-gateway.yaml -n ${BOOKINFO_NAMESPACE}
  ${CLIENT_EXE} label namespace ${BOOKINFO_NAMESPACE} istio.io/dataplane-mode=ambient

  if [ "${WAYPOINT}" == "true" ]; then

    install_waypoint "apply" ${BOOKINFO_NAMESPACE}

  fi
}

install_error_rates() {
    ${CLIENT_EXE} create namespace ${NAMESPACE_ALPHA}
    ${CLIENT_EXE} create namespace ${NAMESPACE_BETA}

    ${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/error-rates/alpha.yaml") -n ${NAMESPACE_ALPHA}
    ${CLIENT_EXE} apply -f <(curl -L "${SOURCE}/error-rates/beta.yaml") -n ${NAMESPACE_BETA}

    ${CLIENT_EXE} label namespace ${NAMESPACE_ALPHA} istio.io/dataplane-mode=ambient
    ${CLIENT_EXE} label namespace ${NAMESPACE_BETA} istio.io/dataplane-mode=ambient

    wait_for_workloads ${NAMESPACE_ALPHA}
    wait_for_workloads ${NAMESPACE_BETA}

    install_waypoint "apply" ${NAMESPACE_ALPHA}
    install_waypoint "apply" ${NAMESPACE_BETA}
}

install_sleep_app() {

  ${CLIENT_EXE} create ns sleep
  ${CLIENT_EXE} label namespace sleep istio.io/dataplane-mode=ambient

  ${CLIENT_EXE} apply -n sleep -f ${ISTIO_DIR}/samples/sleep/sleep.yaml
  wait_for_workloads sleep

  install_waypoint "apply" sleep
}

delete_bookinfo() {
  printf "\Deleting Bookinfo demo\n"

  ${CLIENT_EXE} delete -f ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo.yaml -n ${BOOKINFO_NAMESPACE}
  ${CLIENT_EXE} delete -f https://raw.githubusercontent.com/linsun/sample-apps/main/sleep/sleep.yaml -n ${BOOKINFO_NAMESPACE}
  ${CLIENT_EXE} delete -f https://raw.githubusercontent.com/linsun/sample-apps/main/sleep/notsleep.yaml -n ${BOOKINFO_NAMESPACE}
  ${CLIENT_EXE} delete -f ${ISTIO_DIR}/samples/bookinfo/networking/bookinfo-gateway.yaml -n ${BOOKINFO_NAMESPACE}

  # Delete the waypoint proxy per SA or application
  install_waypoint "delete" ${BOOKINFO_NAMESPACE}

  ${CLIENT_EXE} delete namespace ${BOOKINFO_NAMESPACE}
}

delete_error_rates() {

    ${CLIENT_EXE} delete -f <(curl -L "${SOURCE}/error-rates/alpha.yaml") -n ${NAMESPACE_ALPHA}
    ${CLIENT_EXE} delete -f <(curl -L "${SOURCE}/error-rates/beta.yaml") -n ${NAMESPACE_BETA}

    wait_for_workloads ${NAMESPACE_ALPHA}
    wait_for_workloads ${NAMESPACE_BETA}

    install_waypoint "delete" ${NAMESPACE_ALPHA}
    install_waypoint "delete" ${NAMESPACE_BETA}

    ${CLIENT_EXE} delete namespace ${NAMESPACE_ALPHA}
    ${CLIENT_EXE} delete namespace ${NAMESPACE_BETA}
}

delete_sleep_app() {

  ${CLIENT_EXE} delete -n sleep -f ${ISTIO_DIR}/samples/sleep/sleep.yaml

  install_waypoint "delete" sleep

  ${CLIENT_EXE} delete ns sleep
}

if [ "${DELETE}" == "true" ]; then
  delete_bookinfo
  delete_error_rates
  delete_sleep_app
else
  if [ "${TRAFFIC}" == "true" ]; then
    send_traffic
  else
    install_bookinfo
    install_error_rates
    install_sleep_app
  fi
fi