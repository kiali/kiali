#!/bin/sh

# make sure we are logged in first
oc whoami > /dev/null 2>&1
if [ "$?" != 0 ]; then
  echo "Please log in to OpenShift using 'oc login'"
  exit 1
fi

# put istio files in the output directory
INSTALL_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )/_output/istio"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# download istio
curl -L https://git.io/getLatestIstio | sh -
cd ${INSTALL_DIR}/istio-*
ISTIO_DIR="$(pwd)"
echo "Istio has been downloaded here: $ISTIO_DIR"
echo "You may want to put its bin/ directory in your path to pick up istioctl"


# from https://github.com/redhat-developer-demos/istio-tutorial
oc adm policy add-scc-to-user anyuid -z istio-ingress-service-account -n istio-system
oc adm policy add-scc-to-user anyuid -z istio-egress-service-account -n istio-system
oc adm policy add-scc-to-user anyuid -z default -n istio-system
oc create -f install/kubernetes/istio.yaml
oc project istio-system
oc expose svc istio-ingress
oc apply -f install/kubernetes/addons/prometheus.yaml
oc apply -f install/kubernetes/addons/grafana.yaml
oc apply -f install/kubernetes/addons/servicegraph.yaml
## Workaround for servicegraph bug https://github.com/istio/issues/issues/179
oc set image deploy/servicegraph servicegraph="docker.io/istio/servicegraph:0.4.0"
oc expose svc servicegraph
oc expose svc grafana
oc expose svc prometheus
oc process -f https://raw.githubusercontent.com/jaegertracing/jaeger-openshift/master/all-in-one/jaeger-all-in-one-template.yml | oc create -f -

# Show the routes
echo "Prometheus route:"
oc get route prometheus -o jsonpath='{.spec.host}{"\n"}'
echo "Grafana route:"
oc get route grafana -o jsonpath='{.spec.host}{"\n"}'
echo "Servicegraph route:"
oc get route servicegraph -o jsonpath='{.spec.host}{"\n"}'

