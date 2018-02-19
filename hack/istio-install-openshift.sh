#!/bin/sh

set -e

# make sure we are logged in first
oc whoami > /dev/null 2>&1
if [ "$?" != 0 ]; then
  echo "Please log in to OpenShift using 'oc login'"
  exit 1
fi

if [ "$1" = "" ]; then
  echo "Will download and install the latest Istio."
  echo "If you want a specific version, pass the version as an argument to this script."
else
  echo "Will download and install Istio version $1"
fi

# put istio files in the output directory
INSTALL_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )/_output/istio"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# download istio
curl -L https://git.io/getLatestIstio | ISTIO_VERSION=$1 sh -
cd ${INSTALL_DIR}/istio-*
ISTIO_DIR="$(pwd)"
echo "Istio has been downloaded here: $ISTIO_DIR"
echo "You may want to put its bin/ directory in your path to pick up istioctl"

# from https://github.com/redhat-developer-demos/istio-tutorial
# from https://blog.openshift.com/evaluate-istio-openshift/
# from https://istio.io/docs/setup/kubernetes/quick-start.html

oc new-project istio-system
oc project istio-system
oc adm policy add-scc-to-user anyuid -z istio-ingress-service-account
oc adm policy add-scc-to-user privileged -z istio-ingress-service-account
oc adm policy add-scc-to-user anyuid -z istio-egress-service-account
oc adm policy add-scc-to-user privileged -z istio-egress-service-account
oc adm policy add-scc-to-user anyuid -z istio-pilot-service-account
oc adm policy add-scc-to-user privileged -z istio-pilot-service-account
oc adm policy add-scc-to-user anyuid -z default
oc adm policy add-scc-to-user privileged -z default
oc adm policy add-cluster-role-to-user cluster-admin -z default
oc adm policy add-scc-to-user anyuid -z istio-grafana-service-account
oc adm policy add-scc-to-user privileged -z istio-pilot-service-account
oc adm policy add-scc-to-user anyuid -z istio-prometheus-service-account
oc adm policy add-scc-to-user privileged -z istio-prometheus-service-account

oc apply -f install/kubernetes/istio.yaml
oc expose svc istio-ingress

oc create -f install/kubernetes/addons/prometheus.yaml
oc create -f install/kubernetes/addons/grafana.yaml
oc create -f install/kubernetes/addons/servicegraph.yaml
## Workaround for servicegraph bug https://github.com/istio/issues/issues/179
oc set image deploy/servicegraph servicegraph="docker.io/istio/servicegraph:0.4.0"

oc process -f https://raw.githubusercontent.com/jaegertracing/jaeger-openshift/master/all-in-one/jaeger-all-in-one-template.yml | oc create -f -

oc expose svc servicegraph
oc expose svc grafana
oc expose svc prometheus

# Show the routes
echo "Prometheus route:" "$(oc get route prometheus -o jsonpath='{.spec.host}{"\n"}')"
echo "Grafana route:" "$(oc get route grafana -o jsonpath='{.spec.host}{"\n"}')"
echo "Servicegraph route:" "$(oc get route servicegraph -o jsonpath='{.spec.host}{"\n"}')"

