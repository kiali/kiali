#!/bin/bash

##############################################################################
# install-federated-travels-demo.sh
#
# Installs federated travels kiali demo application
# https://github.com/kiali/demos/tree/master/federated-travels
# Works on both openshift and non-openshift environments.
##############################################################################

: ${AUTO_INJECTION:=true}
: ${AUTO_INJECTION_LABEL:="istio-injection=enabled"}
: ${CLIENT_EXE:=oc}
: ${DELETE_DEMOS:=false}
: ${FTRAVELS:=federated-travels}
: ${BASE_URL:=https://raw.githubusercontent.com/kiali/demos/master}

apply_network_attachment() {
  NAME=$1
cat <<NAD | $CLIENT_EXE -n ${NAME} apply -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
    cat <<SCC | $CLIENT_EXE apply -f -
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: ${NAME}-scc
runAsUser:
  type: RunAsAny
seLinuxContext:
  type: RunAsAny
supplementalGroups:
  type: RunAsAny
priority: 9
users:
- "system:serviceaccount:${NAME}:default"
- "system:serviceaccount:${NAME}:${NAME}"
SCC
}

install_ftravels_app() {
  APP="federated-travels"

  declare -a arr=("east-mesh-system" "west-mesh-system" "east-travel-agency" "east-travel-portal" "east-travel-control" "west-travel-agency")

  for i in "${arr[@]}"
  do
    if [ "${IS_OPENSHIFT}" == "true" ]; then
      ${CLIENT_EXE} new-project ${i}
    else
      ${CLIENT_EXE} create namespace ${i}
    fi
    if [ "${AUTO_INJECTION}" == "true" ]; then
      ${CLIENT_EXE} label namespace ${i} ${AUTO_INJECTION_LABEL} --overwrite
    fi
  done

  ${CLIENT_EXE} apply -f ${BASE_URL}/${APP}/ossm-subs.yaml

  ${CLIENT_EXE} apply -n east-mesh-system -f ${BASE_URL}/${APP}/east/east-ossm.yaml
  ${CLIENT_EXE} apply -n west-mesh-system -f ${BASE_URL}/${APP}/west/west-ossm.yaml

  ${CLIENT_EXE} wait --for condition=Ready -n east-mesh-system smmr/default --timeout 300s
  ${CLIENT_EXE} wait --for condition=Ready -n west-mesh-system smmr/default --timeout 300s

  ${CLIENT_EXE} get configmap istio-ca-root-cert -o jsonpath='{.data.root-cert\.pem}' -n east-mesh-system > east-cert.pem
  ${CLIENT_EXE} create configmap east-ca-root-cert --from-file=root-cert.pem=east-cert.pem -n west-mesh-system

  ${CLIENT_EXE} get configmap istio-ca-root-cert -o jsonpath='{.data.root-cert\.pem}' -n west-mesh-system > west-cert.pem
  ${CLIENT_EXE} create configmap west-ca-root-cert --from-file=root-cert.pem=west-cert.pem -n east-mesh-system

  ${CLIENT_EXE} apply -n east-mesh-system -f ${BASE_URL}/${APP}/east/east-federation.yaml
  ${CLIENT_EXE} apply -n west-mesh-system -f ${BASE_URL}/${APP}/west/west-federation.yaml

  ${CLIENT_EXE} apply -n east-travel-agency -f ${BASE_URL}/${APP}/east/east-travel-agency.yaml
  ${CLIENT_EXE} apply -n east-travel-portal -f ${BASE_URL}/${APP}/east/east-travel-portal.yaml
  ${CLIENT_EXE} apply -n east-travel-control -f ${BASE_URL}/${APP}/east/east-travel-control.yaml
  ${CLIENT_EXE} apply -n west-travel-agency -f ${BASE_URL}/${APP}/west/west-travel-agency.yaml
}

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -ai|--auto-injection)
      AUTO_INJECTION="$2"
      shift;shift
      ;;
    -ail|--auto-injection-label)
      AUTO_INJECTION_LABEL="$2"
      shift;shift
      ;;
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -d|-delete)
      DELETE_DEMOS="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -ai|--auto-injection <true|false>: If you want sidecars to be auto-injected (default: true).
  -ail|--auto-injection-label <name=value>: If auto-injection is enabled, this is the label added to the namespace. For revision-based installs, you can use something like "istio.io/rev=default-v1-23-0". default: istio-injection=enabled).
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: if 'true' demos will be deleted; otherwise, they will be installed.
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

IS_OPENSHIFT="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
fi

echo "CLIENT_EXE=${CLIENT_EXE}"
echo "IS_OPENSHIFT=${IS_OPENSHIFT}"

if [ "${DELETE_DEMOS}" != "true" ]; then
  echo "Installing the ${FTRAVELS} app in the ${FTRAVELS} namespace..."
  install_ftravels_app
else
  echo "Deleting the '${FTRAVELS}' app in the '${FTRAVELS}' namespace..."
  ${CLIENT_EXE} delete -n east-mesh-system -f ${BASE_URL}/${FTRAVELS}/east/east-ossm.yaml
  ${CLIENT_EXE} delete -n west-mesh-system -f ${BASE_URL}/${FTRAVELS}/west/west-ossm.yaml
  ${CLIENT_EXE} delete configmap east-ca-root-cert --from-file=root-cert.pem=east-cert.pem -n west-mesh-system
  ${CLIENT_EXE} delete configmap west-ca-root-cert --from-file=root-cert.pem=west-cert.pem -n east-mesh-system
  ${CLIENT_EXE} delete -n east-mesh-system -f ${BASE_URL}/${FTRAVELS}/east/east-federation.yaml
  ${CLIENT_EXE} delete -n west-mesh-system -f ${BASE_URL}/${FTRAVELS}/west/west-federation.yaml

  ${CLIENT_EXE} delete -n east-travel-agency -f ${BASE_URL}/${FTRAVELS}/east/east-travel-agency.yaml
  ${CLIENT_EXE} delete -n east-travel-portal -f ${BASE_URL}/${FTRAVELS}/east/east-travel-portal.yaml
  ${CLIENT_EXE} delete -n east-travel-control -f ${BASE_URL}/${FTRAVELS}/east/east-travel-control.yaml
  ${CLIENT_EXE} delete -n west-travel-agency -f ${BASE_URL}/${FTRAVELS}/west/west-travel-agency.yaml

  declare -a arr=("east-mesh-system" "west-mesh-system" "east-travel-agency" "east-travel-portal" "east-travel-control" "west-travel-agency")

  for i in "${arr[@]}"
  do
    if [ "${IS_OPENSHIFT}" == "true" ]; then
      ${CLIENT_EXE} delete project ${i}
    else
      ${CLIENT_EXE} delete ns ${i} --ignore-not-found=true
    fi
  done
fi
