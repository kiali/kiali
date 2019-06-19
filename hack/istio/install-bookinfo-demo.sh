#!/bin/bash

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
NAMESPACE="bookinfo"
RATE=1

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
    -n|--namespace)
      NAMESPACE="$2"
      shift;shift
      ;;
    -b|--bookinfo.yaml)
      BOOKINFO_YAML="$2"
      shift;shift
      ;;
    -g|--gateway.yaml)
      GATEWAY_YAML="$2"
      shift;shift
      ;;
    --mongo)
      MONGO_ENABLED="true"
      shift;
      ;;
    --mysql)
      MYSQL_ENABLED="true"
      shift;
      ;;
    -tg|--traffic-generator)
      TRAFFIC_GENERATOR_ENABLED="true"
      shift;
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -id|--istio-dir <dir>: Where Istio has already been downloaded. If not found, this script aborts.
  -c|--client-exe <name>: Cluster client executable name - valid values are "kubectl" or "oc" or "istiooc"
  -n|--namespace <name>: Install the demo in this namespace (default: bookinfo)
  -b|--bookinfo.yaml <file>: A custom yaml file to deploy the bookinfo demo
  -g|--gateway.yaml <file>: A custom yaml file to deploy the bookinfo-gateway resources
  --mongo: Install a Mongo DB that a ratings service will access
  --mysql: Install a MySQL DB that a ratings service will access
  -tg|--traffic-generator: Install Kiali Traffic Generator on Bookinfo
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
  ALL_ISTIOS=$(ls -dt1 ${OUTPUT_DIR}/istio-*)
  if [ "$?" != "0" ]; then
    ${HACK_SCRIPT_DIR}/download-istio.sh
    if [ "$?" != "0" ]; then
      echo "ERROR: You do not have Istio installed and it cannot be downloaded"
      exit 1
    fi
  fi
  # use the Istio release that was last downloaded (that's the -t option to ls)
  ISTIO_DIR=$(ls -dt1 ${OUTPUT_DIR}/istio-* | head -n1)
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
  $CLIENT_EXE new-project ${NAMESPACE}
  $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${NAMESPACE}
  $CLIENT_EXE adm policy add-scc-to-user anyuid -z bookinfo-details -n ${NAMESPACE}
  $CLIENT_EXE adm policy add-scc-to-user anyuid -z bookinfo-productpage -n ${NAMESPACE}
  $CLIENT_EXE adm policy add-scc-to-user anyuid -z bookinfo-ratings -n ${NAMESPACE}
  $CLIENT_EXE adm policy add-scc-to-user anyuid -z bookinfo-reviews -n ${NAMESPACE}
  $CLIENT_EXE adm policy add-scc-to-user privileged -z default -n ${NAMESPACE}
  $CLIENT_EXE adm policy add-scc-to-user privileged -z bookinfo-details -n ${NAMESPACE}
  $CLIENT_EXE adm policy add-scc-to-user privileged -z bookinfo-productpage -n ${NAMESPACE}
  $CLIENT_EXE adm policy add-scc-to-user privileged -z bookinfo-ratings -n ${NAMESPACE}
  $CLIENT_EXE adm policy add-scc-to-user privileged -z bookinfo-reviews -n ${NAMESPACE}
else
  $CLIENT_EXE create namespace ${NAMESPACE}
fi

if [ "${BOOKINFO_YAML}" == "" ]; then
  BOOKINFO_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo.yaml"
fi

if [ "${GATEWAY_YAML}" == "" ]; then
  GATEWAY_YAML="${ISTIO_DIR}/samples/bookinfo/networking/bookinfo-gateway.yaml"
fi

$ISTIOCTL kube-inject -f ${BOOKINFO_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
# This is only if automatic injection of sidecars is enabled
# $CLIENT_EXE apply -n ${NAMESPACE} -f ${BOOKINFO_YAML}

$ISTIOCTL create -n ${NAMESPACE} -f ${GATEWAY_YAML}

if [ "${MONGO_ENABLED}" == "true" ]; then
  echo "Installing Mongo DB and a ratings service that uses it"
  MONGO_DB_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-db.yaml"
  MONGO_SERVICE_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2.yaml"
  $ISTIOCTL kube-inject -f ${MONGO_DB_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
  $ISTIOCTL kube-inject -f ${MONGO_SERVICE_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
fi

if [ "${MYSQL_ENABLED}" == "true" ]; then
  echo "Installing MySql DB and a ratings service that uses it"
  MYSQL_DB_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-mysql.yaml"
  MYSQL_SERVICE_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql.yaml"
  $ISTIOCTL kube-inject -f ${MYSQL_DB_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
  $ISTIOCTL kube-inject -f ${MYSQL_SERVICE_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
fi

sleep 4

echo "Bookinfo Demo should be installed and starting up - here are the pods and services"
$CLIENT_EXE get services -n ${NAMESPACE}
$CLIENT_EXE get pods -n ${NAMESPACE}

# If OpenShift, we need to do some additional things
if [[ "$CLIENT_EXE" = *"oc" ]]; then
  $CLIENT_EXE expose svc productpage -n ${NAMESPACE}
  $CLIENT_EXE expose svc istio-ingressgateway -n istio-system
fi

if [ "${TRAFFIC_GENERATOR_ENABLED}" == "true" ]; then
  echo "Installing Traffic Generator"
  if [[ "$CLIENT_EXE" = *"oc" ]]; then
    INGRESS_ROUTE=$(${CLIENT_EXE} get route istio-ingressgateway -o jsonpath='{.spec.host}{"\n"}' -n istio-system)
    echo "Traffic Generator will use the OpenShift ingress route of: ${INGRESS_ROUTE}"
  else
    # for now, we only support minikube k8s environments
    if minikube status > /dev/null 2>&1 ; then
      INGRESS_HOST=$(minikube ip)
      INGRESS_PORT=$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="http2")].nodePort}')
      INGRESS_ROUTE=$INGRESS_HOST:$INGRESS_PORT
      echo "Traffic Generator will use the Kubernetes (minikube) ingress route of: ${INGRESS_ROUTE}"
    fi
  fi

  if [ "${INGRESS_ROUTE}" != "" ] ; then
    # TODO - these access the "openshift" yaml files - but there are no kubernetes specific versions. using --validate=false
    curl https://raw.githubusercontent.com/kiali/kiali-test-mesh/master/traffic-generator/openshift/traffic-generator-configmap.yaml | DURATION='0s' ROUTE="http://${INGRESS_ROUTE}/productpage" RATE="${RATE}"  envsubst | $CLIENT_EXE create -n ${NAMESPACE} -f -
    curl https://raw.githubusercontent.com/kiali/kiali-test-mesh/master/traffic-generator/openshift/traffic-generator.yaml | $CLIENT_EXE create --validate=false -n ${NAMESPACE} -f -
  fi
fi
