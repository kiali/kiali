#!/bin/bash

##############################################################################
# install-scale-mesh-demo.sh
#
# Installs the kiali topology-generator demo application
# https://github.com/kiali/demos/tree/master/topology-generator
# Works on both openshift and non-openshift environments.
##############################################################################

: ${AUTO_INJECTION:=true}
: ${AUTO_INJECTION_LABEL:="istio-injection=enabled"}
: ${CLIENT_EXE:=oc}
: ${DELETE_DEMOS:=false}
: ${DELETE_CONFIG:=false}
: ${TOPO:=topology-generator}
: ${BASE_URL:=https://raw.githubusercontent.com/kiali/demos/master}
: ${NUM_NS:=1}

apply_network_attachment() {
  NAME=$1
  cat <<NAD | $CLIENT_EXE -n ${NAME} apply -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
  labels:
   generated-by: mimik
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

install_topology_generator_demo() {
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} new-project ${TOPO}
  else
    ${CLIENT_EXE} create ns ${TOPO}
  fi

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    apply_network_attachment ${TOPO}
    $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${TOPO}
  fi

  if [ "${AUTO_INJECTION}" == "true" ]; then
    ${CLIENT_EXE} label namespace  ${TOPO} ${AUTO_INJECTION_LABEL} --overwrite=true
  fi
  ${CLIENT_EXE} apply -n ${TOPO}  -f ${BASE_URL}/topology-generator/deploy/generator.yaml
}

generate_config() {
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    for (( i=1; i<=$NUM_NS; i++ ))
    do
      apply_network_attachment n${i}
    done
  fi
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
    -n|--num_ns)
      NUM_NS="$2"
      shift;shift
      ;;
    -g|--generate-config)
      GENERATE_CONFIG="$2"
      shift;shift
      ;;
    -d|--delete)
      DELETE_DEMOS="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -ai|--auto-injection <true|false>: If you want sidecars to be auto-injected (default: true).
  -ail|--auto-injection-label <name=value>: If auto-injection is enabled, this is the label added to the namespace. For revision-based installs, you can use something like "istio.io/rev=default-v1-23-0". default: istio-injection=enabled).
  -c|--client: either 'oc' or 'kubectl'
  -n|--namespaces: number of namespaces to be created in the generator to apply the network policies
  -d|--delete: if 'true' demos will be deleted; otherwise, they will be installed
  -g|--generate-config: Generate configuration of the topology based in the number of namespaces (-n)
  -h|--help: this text

Usage:
  1) Run with no args - or -c - to install the topology generator
  2) Run the proxy: CLIENT port-forward svc/topology-generator 8080:8080 -n topology-generator
  3) Go to the app and generate the topology
  4) Run -g to configure the demo to work on OpenShift along with -n argument.
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

if [ "${GENERATE_CONFIG}" == "true" ]; then

    echo "Configuring the ${TOPO} app in the ${NUM_NS} namespaces..."
    generate_config

else
  if [ "${DELETE_DEMOS}" != "true" ]; then

    echo "Installing the ${TOPO} app in the ${TOPO} namespace..."
    install_topology_generator_demo

  else

    echo "Deleting the '${TOPO}' app in the '${TOPO}' namespace..."

    if [ "${IS_OPENSHIFT}" == "true" ]; then
      $CLIENT_EXE delete network-attachment-definition istio-cni -n ${TOPO}
      $CLIENT_EXE delete scc ${TOPO}-scc

      ${CLIENT_EXE} delete project ${TOPO}
    else
      ${CLIENT_EXE} delete ns --selector=generated-by=mimik
      ${CLIENT_EXE} delete ns ${TOPO}
    fi
  fi
fi


