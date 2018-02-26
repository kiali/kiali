#!/bin/sh

# change to the directory where this script is
cd "$(dirname "${BASH_SOURCE[0]}")"

# make sure we are logged in first
kubectl auth can-i read namespaces > /dev/null 2>&1
if [ "$?" != 0 ]; then
  echo "Please log in to Kubernetes"
  exit 1
fi

if [ "$1" = "" ]; then
  echo "Will download and install the latest Istio."
  echo "If you want a specific version, pass the version as an argument to this script."
else
  echo "Will download and install Istio version $1"
fi

set -e

# put istio files in the output directory (cwd is under the hack dir)
INSTALL_DIR="$(pwd)/../../../_output/istio"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# download istio
curl -L https://git.io/getLatestIstio | ISTIO_VERSION=$1 sh -
cd ${INSTALL_DIR}/istio-*
ISTIO_DIR="$(pwd)"
echo "Istio has been downloaded here: $ISTIO_DIR"
echo "You may want to put its bin/ directory in your path to pick up istioctl"

# from https://istio.io/docs/setup/kubernetes/quick-start.html

kubectl apply -n istio-system -f install/kubernetes/istio.yaml

kubectl create -n istio-system -f install/kubernetes/addons/prometheus.yaml
kubectl create -n istio-system -f install/kubernetes/addons/grafana.yaml
kubectl create -n istio-system -f install/kubernetes/addons/servicegraph.yaml

curl https://raw.githubusercontent.com/jaegertracing/jaeger-kubernetes/master/all-in-one/jaeger-all-in-one-template.yml | kubectl create -n istio-system -f -

# show what we have deployed
kubectl get svc -n istio-system
