#!/bin/bash

##############################################################################
# install-music-store-demo.sh
#
# Installs the kiali music store demo application
# https://github.com/kiali/demos/tree/master/music-store
# Works on both openshift and non-openshift environments.
##############################################################################

: ${CLIENT_EXE:=oc}
: ${DELETE_DEMOS:=false}
: ${MSTORE:=music-store}
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

install_mstore_app() {

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} get project ${MSTORE} || ${CLIENT_EXE} new-project ${MSTORE}
  else
    ${CLIENT_EXE} get ns ${MSTORE} || ${CLIENT_EXE} create ns ${MSTORE}
  fi

  ${CLIENT_EXE} label namespace ${MSTORE} istio-injection=enabled --overwrite=true
  ${CLIENT_EXE} apply -f https://raw.githubusercontent.com/leandroberetta/demos/master/music-store/ui.yaml -n ${MSTORE}
  ${CLIENT_EXE} apply -f https://raw.githubusercontent.com/leandroberetta/demos/master/music-store/backend.yaml -n ${MSTORE}

  ${CLIENT_EXE} wait --timeout 60s --for condition=available deployment/music-store-backend-v1 -n music-store
  ${CLIENT_EXE} wait --timeout 60s --for condition=available deployment/music-store-ui-v1 -n music-store

  export INGRESS_PORT=$(${CLIENT_EXE} -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="http2")].nodePort}')
  if [ "${IS_OPENSHIFT}" == "true" ]; then
       export INGRESS_HOST=$(crc ip)
    else
       export INGRESS_HOST=$(minikube ip)
  fi

  export GATEWAY_URL=$INGRESS_HOST:$INGRESS_PORT
  export MUSIC_STORE_UI=http://$GATEWAY_URL/
  export MUSIC_STORE_BACKEND=http://$GATEWAY_URL/api

  cat <<EOF | $CLIENT_EXE apply -f -
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: music-store
  namespace: music-store
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 80
        name: http
        protocol: HTTP
      hosts:
        - "*"
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: music-store-ui
  namespace: music-store
spec:
  hosts:
    - "*"
  gateways:
    - music-store
  http:
    - match:
        - uri:
            exact: /
      route:
        - destination:
            host: music-store-ui
            port:
              number: 8080
    - match:
        - uri:
            prefix: /api
      route:
        - destination:
            host: music-store-backend
            port:
              number: 8080
EOF

  if [ "${IS_OPENSHIFT}" == "true" ]; then
      apply_network_attachment ${MSTORE}
  fi

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

    echo "Installing the ${MSTORE} app in the ${MSTORE} namespace..."
    install_mstore_app
    echo "You should be able to access the API with the url: ${MUSIC_STORE_BACKEND} "
    echo "You should be able to access the UI with the url: ${MUSIC_STORE_UI} "
else

    echo "Deleting the '${MSTORE}' app in the '${MSTORE}' namespace..."
    ${CLIENT_EXE} delete -f https://raw.githubusercontent.com/leandroberetta/demos/master/music-store/ui.yaml -n ${MSTORE}
    ${CLIENT_EXE} delete -f https://raw.githubusercontent.com/leandroberetta/demos/master/music-store/backend.yaml -n ${MSTORE}

    ${CLIENT_EXE} delete ns ${MSTORE} --ignore-not-found=true
    if [ "${IS_OPENSHIFT}" == "true" ]; then
      ${CLIENT_EXE} delete project ${MSTORE}
      ${CLIENT_EXE} delete SecurityContextConstraints ${MSTORE}-scc
    fi
fi


