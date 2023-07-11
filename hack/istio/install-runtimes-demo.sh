#!/bin/bash

##############################################################################
# install-runtimes-demo.sh
#
# Installs the kiali runtimes demo application
# https://github.com/kiali/demos/tree/master/runtimes-demo
# Works on both openshift and non-openshift environments.
##############################################################################

: ${CLIENT_EXE:=oc}
: ${DELETE_DEMOS:=false}
: ${RUNTIMES:=runtimes}
: ${BASE_URL:=https://raw.githubusercontent.com/kiali/demos/master}

apply_network_attachment() {
  NAME=$1
  if [ "${IS_MAISTRA}" != "true" ]; then
cat <<NAD | $CLIENT_EXE -n ${NAME} apply -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
  fi
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

install_runtimes_demo() {
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} get project ${RUNTIMES} || ${CLIENT_EXE} new-project ${RUNTIMES}
  else
    ${CLIENT_EXE} get ns ${RUNTIMES} || ${CLIENT_EXE} create ns ${RUNTIMES}
  fi

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    apply_network_attachment ${RUNTIMES}
    $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${RUNTIMES}
  fi

  ${CLIENT_EXE} label namespace ${RUNTIMES} istio-injection=enabled --overwrite=true
  ${CLIENT_EXE} apply -f ${BASE_URL}/runtimes-demo/quickstart.yml -n ${RUNTIMES}

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
IS_MAISTRA="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
  IS_MAISTRA=$([ "$(oc get crd | grep servicemesh | wc -l)" -gt "0" ] && echo "true" || echo "false")
fi

echo "CLIENT_EXE=${CLIENT_EXE}"
echo "IS_OPENSHIFT=${IS_OPENSHIFT}"

if [ "${DELETE_DEMOS}" != "true" ]; then
  echo "Installing the ${RUNTIMES} app in the ${RUNTIMES} namespace..."
  install_runtimes_demo
else
  echo "Deleting the '${RUNTIMES}' app in the '${RUNTIMES}' namespace..."
  ${CLIENT_EXE} delete -f ${BASE_URL}/runtimes-demo/quickstart.yml -n ${RUNTIMES}

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    if [ "${IS_MAISTRA}" != "true" ]; then
      $CLIENT_EXE delete network-attachment-definition istio-cni -n ${RUNTIMES}
    else
      $CLIENT_EXE delete smm default -n ${RUNTIMES}
    fi
    $CLIENT_EXE delete scc ${RUNTIMES}-scc

    ${CLIENT_EXE} delete project ${RUNTIMES}
  else  
    ${CLIENT_EXE} delete namespace ${RUNTIMES}
  fi
fi