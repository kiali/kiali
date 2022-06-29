#!/bin/bash

##############################################################################
# install-scale-mesh-demo.sh
#
# Installs the kiali topology-generator demo application
# https://github.com/kiali/demos/tree/master/topology-generator
# Works on both openshift and non-openshift environments.
##############################################################################

: ${CLIENT_EXE:=oc}
: ${DELETE_DEMOS:=false}
: ${TOPO:=topology-generator}
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
    ${CLIENT_EXE} label namespace  ${TOPO} istio-injection=enabled --overwrite=true
    apply_network_attachment ${TOPO}

    ${CLIENT_EXE} apply -n ${TOPO}  -f ${BASE_URL}/topology-generator/deploy/generator.yaml
}

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
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
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: if 'true' demos will be deleted; otherwise, they will be installed
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

    echo "Installing the ${TOPO} app in the ${TOPO} namespace..."
    install_topology_generator_demo

else

    echo "Deleting the '${TOPO}' app in the '${TOPO}' namespace..."

    if [ "${IS_OPENSHIFT}" == "true" ]; then
            ${CLIENT_EXE} delete project ${TOPO}
            ${CLIENT_EXE} delete SecurityContextConstraints ${TOPO}
            ${CLIENT_EXE} delete ns --selector=generated-by=mimik
            ${CLIENT_EXE} delete ns ${TOPO}
    fi

fi


