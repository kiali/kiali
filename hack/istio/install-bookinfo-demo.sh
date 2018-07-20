#!/bin/sh

##############################################################################
# install-bookinfo-demo.sh
#
# Installs the Istio Bookinfo Sample Demo Application into your cluster
# (either Kubernetes or OpenShift).
#
# If you do not yet have it, this script will download a copy of Istio.
#
# See --help for more details on options to this script.
#
##############################################################################

# ISTIO_DIR is where the Istio download is installed and thus where the bookinfo demo files are found.
# CLIENT_EXE_NAME is going to either be "oc", "kubectl", or "istiooc" (which is the default since it will be installed via cluster-openshift.sh hack script).
ISTIO_DIR=
CLIENT_EXE_NAME="istiooc"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -id|--istio-dir)
      ISTIO_DIR="$2"
      shift;shift
      ;;
    -c|--client-exe)
      CLIENT_EXE_NAME="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -id|--istio-dir <dir>: Where Istio has already been downloaded. If not found, this script aborts.
  -c|--client-exe <name>: Cluster client executable name - valid values are "kubectl" or "oc" or "istiooc"
  -h|--help : this message
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

if [ "${ISTIO_DIR}" == "" ]; then
  # Go to the main output directory and try to find an Istio there.
  # The bookinfo demo files rarely change - should be the same no matter what Istio version we find.
  HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
  OUTPUT_DIR="${OUTPUT_DIR:-${HACK_SCRIPT_DIR}/../../_output}"
  ALL_ISTIOS=$(ls -d1 ${OUTPUT_DIR}/istio-*)
  if [ "$?" != "0" ]; then
    ${HACK_SCRIPT_DIR}/download-istio.sh
    if [ "$?" != "0" ]; then
      echo "ERROR: You do not have Istio installed and it cannot be downloaded"
      exit 1
    fi
  fi
  ISTIO_DIR=$(ls -d1 ${OUTPUT_DIR}/istio-* | head -n1)
fi

if [ ! -d "${ISTIO_DIR}" ]; then
   echo "ERROR: Istio cannot be found at: ${ISTIO_DIR}"
   exit 1
fi

echo "Istio is found here: ${ISTIO_DIR}"
if [[ -x "${ISTIO_DIR}/bin/istioctl" ]]; then
  echo "istioctl is found here: ${ISTIO_DIR}/bin/istioctl"
  ISTIOCTL="${ISTIO_DIR}/bin/istioctl"
  ${ISTIOCTL} version
else
  echo "ERROR: istioctl is NOT found at ${ISTIO_DIR}/bin/istioctl"
  exit 1
fi

CLIENT_EXE=`which ${CLIENT_EXE_NAME}`
if [ "$?" = "0" ]; then
  echo "The cluster client executable is found here: ${CLIENT_EXE}"
else
  echo "You must install the cluster client ${CLIENT_EXE_NAME} in your PATH before you can continue"
  exit 1
fi

# If OpenShift, we need to do some additional things
if [[ "$CLIENT_EXE" = *"oc" ]]; then
  $CLIENT_EXE new-project bookinfo
  $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n bookinfo
  $CLIENT_EXE adm policy add-scc-to-user privileged -z default -n bookinfo
else
  $CLIENT_EXE create namespace bookinfo
fi

$ISTIOCTL kube-inject -f ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo.yaml | $CLIENT_EXE apply -n bookinfo -f -
# This is only if automatic injection of sidecars is enabled
# $CLIENT_EXE apply -n bookinfo -f ${ISTIO_DIR}/samples/bookinfo/kube/bookinfo.yaml
$ISTIOCTL create -n bookinfo -f ${ISTIO_DIR}/samples/bookinfo/networking/bookinfo-gateway.yaml

sleep 4

echo "Bookinfo Demo should be installed and starting up - here are the pods and services"
$CLIENT_EXE get services -n bookinfo
$CLIENT_EXE get pods -n bookinfo

# If OpenShift, we need to do some additional things
if [[ "$CLIENT_EXE" = *"oc" ]]; then
  $CLIENT_EXE expose svc productpage
fi
