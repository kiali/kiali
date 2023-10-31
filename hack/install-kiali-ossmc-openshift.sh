#!/bin/bash
#
# This script installs the current release of Kiali Operator, Kiali Server, and OSSMC.
# If you are not already logged into an OpenShift cluster, one will be created via CRC.
#
# This script will not utilize any helm charts but instead use an OLM Subscription
# to install the Kiali Operator, then creates a Kiali CR to install the Server, and
# creates a OSSMConsole CR to install OSSMC.

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
cd ${SCRIPT_DIR}

OC="$(which oc)"
echo "Using 'oc' from PATH here: ${OC}"

ISTIO_NAMESPACE="istio-system"
echo "Istio control plane namespace is: ${ISTIO_NAMESPACE}"

OSSMC_NAMESPACE="ossmconsole"
echo "OSSMC namespace is: ${OSSMC_NAMESPACE}"

install_openshift() {
  if ${OC} whoami &> /dev/null; then
    echo "You are logged into an OpenShift cluster; that cluster will be used for this smoke test."
  else
    echo "Starting OpenShift cluster"
    ${SCRIPT_DIR}/crc-openshift.sh start
  fi
}

install_istio() {
  if (${OC} get pods -n ${ISTIO_NAMESPACE} -l app=istiod -o jsonpath='{.items[*].metadata.name}' | grep -q ""); then
    echo "Istio is already installed in [${ISTIO_NAMESPACE}]; it will be used for this smoke test."
  else
    echo "Install Istio and all addons"
    ${SCRIPT_DIR}/istio/install-istio-via-istioctl.sh -c oc
  fi
}

install_kiali_operator() {
  echo "Installing the Kiali Operator"
  cat <<EOM | ${OC} apply -f -
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: kiali
  namespace: openshift-operators
spec:
  channel: stable
  installPlanApproval: Automatic
  name: kiali
  source: community-operators
  sourceNamespace: openshift-marketplace
EOM
# to customize the operator, you can put config in the subscription spec like this:
#  config:
#    env:
#    - name: ALLOW_ALL_ACCESSIBLE_NAMESPACES
#      value: "true"
}

install_kiali_cr() {
  wait_for_crd "kialis.kiali.io"

  echo "Installing the Kiali CR"
  local kiali_namespace="${ISTIO_NAMESPACE}"
  ${OC} get namespace ${kiali_namespace} &> /dev/null || ${OC} create namespace ${kiali_namespace}

  cat <<EOM | ${OC} apply -f -
apiVersion: kiali.io/v1alpha1
kind: Kiali
metadata:
  name: kiali
  namespace: ${kiali_namespace}
EOM
}

install_ossmconsole_cr() {
  # cannot install OSSMC until Kiali is installed
  wait_for_kiali

  wait_for_crd "ossmconsoles.kiali.io"

  echo "Installing the OSSMConsole CR"
  local ossmc_namespace="${OSSMC_NAMESPACE}"
  ${OC} get namespace ${ossmc_namespace} &> /dev/null || ${OC} create namespace ${ossmc_namespace}
  cat <<EOM | ${OC} apply -f -
apiVersion: kiali.io/v1alpha1
kind: OSSMConsole
metadata:
  name: ossmconsole
  namespace: ${ossmc_namespace}
EOM
}

wait_for_crd() {
  local crd="${1}"
  echo -n "Waiting for the CRD [${crd}] to be established"
  local i=0
  set +e
  until [ ${i} -eq 60 ] || ${OC} get crd ${crd} &> /dev/null; do
    echo -n '.'
    sleep 2
    (( i++ ))
  done
  set -e
  echo
  [ ${i} -lt 60 ] || (echo "The CRD [${crd} does not exist." && exit 1)
  ${OC} wait --for condition=established --timeout=60s crd ${crd}
}

wait_for_labeled_pod() {
  local pod_title="${1}"
  local pod_name_label_value="${2}"
  local namespace="${3}"

  echo -n "Waiting for [${pod_title}] pod to start"
  local i=0
  set +e
  until [ ${i} -eq 60 ] || (${OC} get pods -l app.kubernetes.io/name=${pod_name_label_value} -n ${namespace} --no-headers 2>/dev/null | grep -q Running); do
    echo -n '.'
    sleep 2
    (( i++ ))
  done
  set -e
  echo
  ${OC} wait --for condition=Ready --timeout=60s pod -l app.kubernetes.io/name=${pod_name_label_value} -n ${namespace}
  echo "[${pod_title}] is running"
}

wait_for_kiali() {
  wait_for_labeled_pod "Kiali" "kiali" "${ISTIO_NAMESPACE}"
}

wait_for_ossmconsole() {
  wait_for_labeled_pod "OSSMC" "ossmconsole" "${OSSMC_NAMESPACE}"
}

#
# INSTALL EVERYTHING
#

install_openshift
install_istio
install_kiali_operator
install_kiali_cr
install_ossmconsole_cr

#
# ONCE OSSMC IS RUNNING, WE KNOW EVERYTHING ELSE IS RUNNING
#

wait_for_ossmconsole

#
# TELL USER ABOUT THE URLS
#

echo "=========="
echo "Installation is complete."
CLUSTER_URL="$(${OC} get console cluster -o jsonpath='{.status.consoleURL}')"
echo "* OSSMC URL: ${CLUSTER_URL}/ossmconsole/overview"
ROUTE_URL="$(${OC} get route -n istio-system -l app.kubernetes.io/name=kiali -o jsonpath='https://{..spec.host}/')"
echo "* Kiali URL: ${ROUTE_URL}"
echo "=========="
