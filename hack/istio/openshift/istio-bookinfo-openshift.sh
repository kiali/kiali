#!/bin/sh

# change to the directory where this script is
cd "$(dirname "${BASH_SOURCE[0]}")"

# make sure we are logged in first
oc whoami > /dev/null 2>&1
if [ "$?" != 0 ]; then
  echo "Please log in to OpenShift using 'oc login'"
  exit 1
fi

# find istio that we installed from the install script (cwd is under the hack dir)
INSTALL_DIR="$(pwd)/../../../_output/istio"
if [ ! -d $INSTALL_DIR ]; then
  echo "You did not install Istio using the hack script. Please do that first."
  exit 1
fi
cd $INSTALL_DIR

cd ${INSTALL_DIR}/istio-*
if [ "$?" != "0" ]; then
  echo "You did not install Istio using the hack script. Please do that first."
  exit 1
fi
ISTIO_DIR="$(pwd)"
echo "Istio has been found here: $ISTIO_DIR"

# put the bin in path so istioctl can be found
export PATH="$ISTIO_DIR/bin:$PATH"

which istioctl > /dev/null 2>&1
if [ "$?" != "0" ]; then
  echo "Cannot find istioctl in the istio installation. Aborting."
  exit 1
fi

set -e

# from https://istio.io/docs/guides/bookinfo.html
# from https://blog.openshift.com/evaluate-istio-openshift/

echo "Installing the BookInfo demo to project [$(oc project -q)]"

oc adm policy add-scc-to-user anyuid -z default
oc adm policy add-scc-to-user privileged -z default

istioctl kube-inject -f samples/bookinfo/kube/bookinfo.yaml | oc apply -f -

oc expose svc productpage

PRODUCTPAGE=$(oc get route productpage -o jsonpath='{.spec.host}{"\n"}')
echo "Productpage route:" $PRODUCTPAGE
echo ""
echo "At this point, the bookinfo demo is deployed."
echo "To generate workload for the application, run the following:"
echo "watch -n 1 curl -o /dev/null -s -w %{http_code}\n $PRODUCTPAGE/productpage"

