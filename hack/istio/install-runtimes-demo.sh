#!/bin/bash

##############################################################################
# install-runtimes-demo.sh
#
# Installs the kiali runtimes demo application
# https://github.com/kiali/demos/tree/master/runtimes-demo
# Works on both openshift and non-openshift environments.
##############################################################################

: ${AUTO_INJECTION:=true}
: ${AUTO_INJECTION_LABEL:="istio-injection=enabled"}
: ${CLIENT_EXE:=oc}
: ${DELETE_DEMOS:=false}
: ${RUNTIMES:=runtimes}
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

  if [ "${AUTO_INJECTION}" == "true" ]; then
    ${CLIENT_EXE} label namespace ${RUNTIMES} ${AUTO_INJECTION_LABEL} --overwrite=true
  fi
  ${CLIENT_EXE} apply -f ${BASE_URL}/runtimes-demo/quickstart.yml -n ${RUNTIMES}

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
  echo "Installing the ${RUNTIMES} app in the ${RUNTIMES} namespace..."
  install_runtimes_demo
else
  echo "Deleting the '${RUNTIMES}' app in the '${RUNTIMES}' namespace..."
  ${CLIENT_EXE} delete -f ${BASE_URL}/runtimes-demo/quickstart.yml -n ${RUNTIMES}

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE delete network-attachment-definition istio-cni -n ${RUNTIMES}
    $CLIENT_EXE delete scc ${RUNTIMES}-scc

    ${CLIENT_EXE} delete project ${RUNTIMES}
  else  
    ${CLIENT_EXE} delete namespace ${RUNTIMES}
  fi
fi
