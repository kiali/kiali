#!/bin/sh

# change to the directory where this script is
cd "$(dirname "${BASH_SOURCE[0]}")"

# make sure we are logged in first
kubectl auth can-i read namespaces > /dev/null 2>&1
if [ "$?" != 0 ]; then
  echo "Please log in to Kubernetes"
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

istioctl kube-inject -f samples/bookinfo/kube/bookinfo.yaml | kubectl apply -n istio-system -f -

echo Services and Pods
kubectl get services
kubectl get pods

GATEWAY_URL=$(kubectl get po -l istio=ingress -n istio-system -o 'jsonpath={.items[0].status.hostIP}'):$(kubectl get svc istio-ingress -n istio-system -o 'jsonpath={.spec.ports[0].nodePort}')
echo "Gateway URL:" $GATEWAY_URL
echo ""
echo "At this point, the bookinfo demo is deployed."
echo "To generate workload for the application, run the following:"
echo "watch -n 1 curl -o /dev/null -s -w %{http_code}\n $GATEWAY_URL/productpage"
