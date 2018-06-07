#!/bin/sh

# ISTIO_VERSION is the name used by the getLatestIstio script - if empty, gets the latest version
# CLIENT_EXE_NAME is going to either be "oc", "kubectl", or "istioctl" (which is the default since it will be installed via cluster-openshift.sh hack script).
ISTIO_VERSION=
CLIENT_EXE_NAME="istiooc"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -v)
      ISTIO_VERSION="$2"
      shift;shift
      ;;
    -c)
      CLIENT_EXE_NAME="$2"
      shift;shift
      ;;
    -o)
      OUTPUT_DIR="$2"
      shift;shift
      ;;
    -h)
      cat <<HELPMSG
Valid command line arguments:
  -v : Version of Istio to download
  -c : Cluster client executable name - valid values are "kubectl" or "oc" or "istiooc"
  -o : Output directory where Istio is (or will be downloaded to if it doesn't exist)
  -h : this message
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# Go to the main output directory
HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-${HACK_SCRIPT_DIR}/../../_output}"
mkdir -p "$OUTPUT_DIR"
cd "$OUTPUT_DIR"
OUTPUT_DIR="$(pwd)" # remove the .. references
echo "Output Directory: ${OUTPUT_DIR}"

if [ "x${ISTIO_VERSION}" == "x" ]; then
   VERSION_WE_WANT=$(curl https://api.github.com/repos/istio/istio/releases/latest 2> /dev/null |\
         grep  "tag_name" | \
         sed -e 's/.*://' -e 's/ *"//' -e 's/",//')
   echo "Will use the latest Istio version: $VERSION_WE_WANT"
else
   VERSION_WE_WANT="${ISTIO_VERSION}"
   echo "Will use a specific Istio version: $VERSION_WE_WANT"
fi

# See if the latest Istio is downloaded; if not, get it now.
echo "Will look for Istio here: ${OUTPUT_DIR}/istio-${VERSION_WE_WANT}"
if [ ! -d "./istio-${VERSION_WE_WANT}" ]; then
   echo "Cannot find Istio ${VERSION_WE_WANT} - will download it now..."
   export ISTIO_VERSION
   curl -L https://git.io/getLatestIstio | sh -
fi

cd "./istio-${VERSION_WE_WANT}/"
ISTIO_DIR="$(pwd)"
echo "Istio is found here: ${ISTIO_DIR}"
if [[ -x "${ISTIO_DIR}/bin/istioctl" ]]; then
  echo "istioctl is found here: ${ISTIO_DIR}/bin/istioctl"
  ISTIOCTL="${ISTIO_DIR}/bin/istioctl"
  ${ISTIOCTL} version
else
  echo "WARNING: istioctl is NOT found at ${ISTIO_DIR}/bin/istioctl"
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

$ISTIOCTL kube-inject -f ${ISTIO_DIR}/samples/bookinfo/kube/bookinfo.yaml | $CLIENT_EXE apply -n bookinfo -f -
# This is only if automatic injection of sidecars is enabled
# $CLIENT_EXE apply -n bookinfo -f ${ISTIO_DIR}/samples/bookinfo/kube/bookinfo.yaml
$ISTIOCTL create -n bookinfo -f ${ISTIO_DIR}/samples/bookinfo/routing/bookinfo-gateway.yaml

echo "Bookinfo Demo should be installed and starting up - here are the pods and services"
$CLIENT_EXE get services -n bookinfo
$CLIENT_EXE get pods -n bookinfo

# If OpenShift, we need to do some additional things
if [[ "$CLIENT_EXE" = *"oc" ]]; then
  $CLIENT_EXE expose svc productpage
fi
