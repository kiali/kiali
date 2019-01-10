#!/bin/bash

##############################################################################
# install-rh-tutorial.sh
#
# Installs the Red Hat Istio Tutorial into your cluster.
#
# This requires java and maven in your PATH.
#
# See --help for more details on options to this script.
#
##############################################################################

# ISTIO_DIR is where the Istio download is installed
# CLIENT_EXE_NAME is going to either be "oc", "kubectl", or "istiooc"
# RATE is the rate of requests pushed into the mesh via the traffic generator (if enabled)
# TUTORIAL_DIR is the parent directory where the tutorial files will be git cloned
ISTIO_DIR=
CLIENT_EXE_NAME="oc"
NAMESPACE="tutorial"
RATE=1
TUTORIAL_DIR="/tmp"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -id|--istio-dir)
      ISTIO_DIR="$2"
      shift;shift
      ;;
    -td|--tutorial-dir)
      TUTORIAL_DIR="$2"
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
    -tg|--traffic-generator)
      TRAFFIC_GENERATOR_ENABLED="true"
      shift;
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -id|--istio-dir <dir>: Where Istio has already been downloaded. If not found, this script aborts.
  -td|--tutorial-dir <dir>: Where the tutorial files will be git cloned. Default: /tmp
  -c|--client-exe <name>: Cluster client executable name - valid values are "kubectl" or "oc" or "istiooc"
  -n|--namespace <name>: Install the demo in this namespace (default: tutorial)
  -tg|--traffic-generator: Install Kiali Traffic Generator
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
  $CLIENT_EXE new-project ${NAMESPACE}
  $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${NAMESPACE}
  $CLIENT_EXE adm policy add-scc-to-user privileged -z default -n ${NAMESPACE}
else
  $CLIENT_EXE create namespace ${NAMESPACE}
fi

# Git clone the tutorial
cd ${TUTORIAL_DIR}
git clone https://github.com/redhat-developer-demos/istio-tutorial.git
cd istio-tutorial
git checkout book-1.0.4

# BUILD IMAGES

# customer
echo BUILDING THE CUSTOMER MICROSERVICE
cd customer/java/springboot
mvn clean package && docker build -t example/customer .
if [ "$?" != "0" ]; then
  echo "Failed to build the customer image"
  exit 1
fi
cd ../../..

# preference
echo BUILDING THE PREFERENCE MICROSERVICE
cd preference/java/springboot
mvn clean package && docker build -t example/preference:v1 .
if [ "$?" != "0" ]; then
  echo "Failed to build the preference image"
  exit 1
fi
cd ../../..

# recommendation
echo BUILDING THE RECOMMENDATION MICROSERVICE
cd recommendation/java/vertx
mvn clean package && docker build -t example/recommendation:v1 .
if [ "$?" != "0" ]; then
  echo "Failed to build the recommendation image"
  exit 1
fi
cd ../../..

# DEPLOY IMAGES

echo DEPLOYING THE IMAGES

#customer
$CLIENT_EXE apply -f <(${ISTIOCTL} kube-inject -f customer/kubernetes/Deployment.yml) -n ${NAMESPACE}
$CLIENT_EXE create -f customer/kubernetes/Service.yml -n ${NAMESPACE}

# preference
$CLIENT_EXE apply -f <(${ISTIOCTL} kube-inject -f preference/kubernetes/Deployment.yml) -n ${NAMESPACE}
$CLIENT_EXE create -f preference/kubernetes/Service.yml -n ${NAMESPACE}

# recommendation
$CLIENT_EXE apply -f <(${ISTIOCTL} kube-inject -f recommendation/kubernetes/Deployment.yml) -n ${NAMESPACE}
$CLIENT_EXE create -f recommendation/kubernetes/Service.yml -n ${NAMESPACE}

sleep 4

echo "Tutorial Demo should be installed and starting up - here are the pods and services"
$CLIENT_EXE get services -n ${NAMESPACE}
$CLIENT_EXE get pods -n ${NAMESPACE}

# If OpenShift, we need to do some additional things
if [[ "$CLIENT_EXE" = *"oc" ]]; then
  $CLIENT_EXE expose svc customer -n ${NAMESPACE}
  $CLIENT_EXE expose svc istio-ingressgateway -n istio-system
fi

if [ "${TRAFFIC_GENERATOR_ENABLED}" == "true" ]; then
  echo "Installing Traffic Generator"
  if [[ "$CLIENT_EXE" = *"oc" ]]; then
    INGRESS_ROUTE=$(${CLIENT_EXE} get route customer -o jsonpath='{.spec.host}{"\n"}' -n ${NAMESPACE})
    echo "Traffic Generator will use the OpenShift ingress route of: ${INGRESS_ROUTE}"
  else
    echo "Traffic Generator not configured for use with Kubernetes (yet)"
  fi

  if [ "${INGRESS_ROUTE}" != "" ] ; then
    # TODO - these access the "openshift" yaml files - but there are no kubernetes specific versions. using --validate=false
    curl https://raw.githubusercontent.com/kiali/kiali-test-mesh/master/traffic-generator/openshift/traffic-generator-configmap.yaml | DURATION='0s' ROUTE="http://${INGRESS_ROUTE}" RATE="${RATE}"  envsubst | $CLIENT_EXE create -n ${NAMESPACE} -f -
    curl https://raw.githubusercontent.com/kiali/kiali-test-mesh/master/traffic-generator/openshift/traffic-generator.yaml | $CLIENT_EXE create --validate=false -n ${NAMESPACE} -f -
  fi
fi

