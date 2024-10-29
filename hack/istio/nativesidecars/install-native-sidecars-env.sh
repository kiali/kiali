#!/bin/bash

##############################################################################
# install-nativesidecars-env
#
# Installs the environment in kind with native sidecars enabled.
#
# See --help for more details on options to this script.
#
##############################################################################

CLIENT_EXE="kubectl"
DELETE_ALL="false"
INSTALL_BOOKINFO="true"
INSTALL_ISTIO="true"
INSTALL_KIALI="true"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -da|--delete-all)
      DELETE_ALL="$2"
      shift;shift
      ;;
    -ib|--install-bookinfo)
      INSTALL_BOOKINFO="$2"
      shift;shift
      ;;
    -ii|--install-istio)
      INSTALL_ISTIO="$2"
      shift;shift
      ;;
    -ik|--install-kiali)
      INSTALL_KIALI="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client:
       client exe. Just kubectl is supported at the moment.
  -da|--delete-all:
       Delete the cluster created in kind.
  -ib|--install-bookinfo:
       If bookinfo should be installed. true by default.
  -ii|--install-istio:
       If istio should be installed. true by default.
  -ik|--install-kiali:
       If Kiali should be installed. true by default.
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

SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"

if [ "${DELETE_ALL}" == "true" ]; then
  echo "Deleting cluster"
  kind delete cluster --name sidecars
else
  echo "Creating a cluster in kind with native sidecars"
  cat <<EOF | kind create cluster --name sidecars --image gcr.io/istio-testing/kind-node:v1.28.0 --config=-
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
featureGates:
  SidecarContainers: true
EOF

  echo "Script Directory: ${SCRIPT_DIR}"

  if [ "${INSTALL_ISTIO}" == "true" ]; then
    echo "Installing istio with values.pilot.env.ENABLE_NATIVE_SIDECARS=true option"
    ${SCRIPT_DIR}/../install-istio-via-istioctl.sh -c ${CLIENT_EXE} -a "prometheus grafana jaeger" -nsc true
  fi

  if [ "${INSTALL_KIALI}" == "true" ]; then
    OUTPUT_DIR="${OUTPUT_DIR:-${SCRIPT_DIR}/../../../_output}"
    ISTIO_DIR=$(ls -dt1 ${OUTPUT_DIR}/istio-* | head -n1)
    echo "Istio directory where the Kiali addon yaml should be found: ${ISTIO_DIR}"
    ${CLIENT_EXE} apply -f ${ISTIO_DIR}/samples/addons/kiali.yaml
  fi

  if [ "${INSTALL_BOOKINFO}" == "true" ]; then
    echo "Installing bookinfo"
    ${SCRIPT_DIR}/../install-bookinfo-demo.sh -c ${CLIENT_EXE} -tg
  fi

  echo "Installation finished. You can port forward the services with:"
  echo "./run-kiali.sh -pg 13000:3000 -pp 19090:9090 -app 8080 -es false -iu http://127.0.0.1:15014"

fi
