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

# Given a namepace, prepare it for inclusion in Maistra's control plane
# This means:
# 1. Create a SMM
# 2. Annotate all of the namespace's Deployments with the sidecar injection annotation if enabled
prepare_maistra() {
  local ns="${1}"

  cat <<EOM | ${CLIENT_EXE} apply -f -
apiVersion: maistra.io/v1
kind: ServiceMeshMember
metadata:
  name: default
  namespace: ${ns}
spec:
  controlPlaneRef:
    namespace: ${ISTIO_NAMESPACE}
    name: "$(${CLIENT_EXE} get smcp -n ${ISTIO_NAMESPACE} -o jsonpath='{.items[0].metadata.name}' )"
EOM

  if [ "${AUTO_INJECTION}" == "true" ]; then
    for d in $(${CLIENT_EXE} get deployments -n ${ns} -o name)
    do
      echo "Enabling sidecar injection for deployment: ${d}"
      ${CLIENT_EXE} patch ${d} -n ${ns} -p '{"spec":{"template":{"metadata":{"annotations":{"sidecar.istio.io/inject": "true"}}}}}' --type=merge
    done
  fi
}

# ISTIO_DIR is where the Istio download is installed and thus where the bookinfo demo files are found.
# CLIENT_EXE_NAME is going to either be "oc" or "kubectl"
ISTIO_DIR=
CLIENT_EXE_NAME="oc"
NAMESPACE="bookinfo"
ISTIO_NAMESPACE="istio-system"
RATE=1
AUTO_INJECTION="true"
DELETE_BOOKINFO="false"
MINIKUBE_PROFILE="minikube"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ai|--auto-injection)
      AUTO_INJECTION="$2"
      shift;shift
      ;;
    -db|--delete-bookinfo)
      DELETE_BOOKINFO="$2"
      shift;shift
      ;;
    -id|--istio-dir)
      ISTIO_DIR="$2"
      shift;shift
      ;;
    -in|--istio-namespace)
      ISTIO_NAMESPACE="$2"
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
    -mp|--minikube-profile)
      MINIKUBE_PROFILE="$2"
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
  -ai|--auto-injection <true|false>: If you want sidecars to be auto-injected or manually injected (default: true).
  -db|--delete-bookinfo <true|false>: If true, uninstall bookinfo. If false, install bookinfo. (default: false).
  -id|--istio-dir <dir>: Where Istio has already been downloaded. If not found, this script aborts.
  -in|--istio-namespace <name>: Where the Istio control plane is installed (default: istio-system).
  -c|--client-exe <name>: Cluster client executable name - valid values are "kubectl" or "oc"
  -mp|--minikube-profile <name>: If using minikube, this is the minikube profile name (default: minikube).
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

IS_OPENSHIFT="false"
IS_MAISTRA="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
  IS_MAISTRA=$([ "$(oc get crd | grep servicemesh | wc -l)" -gt "0" ] && echo "true" || echo "false")
fi

echo "IS_OPENSHIFT=${IS_OPENSHIFT}"
echo "IS_MAISTRA=${IS_MAISTRA}"

if [ "${BOOKINFO_YAML}" == "" ]; then
  BOOKINFO_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo.yaml"
fi

if [ "${GATEWAY_YAML}" == "" ]; then
  GATEWAY_YAML="${ISTIO_DIR}/samples/bookinfo/networking/bookinfo-gateway.yaml"
fi

# If we are to delete, remove everything and exit immediately after
if [ "${DELETE_BOOKINFO}" == "true" ]; then
  echo "====== UNINSTALLING ANY EXISTING BOOKINFO DEMO ====="
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    if [ "${IS_MAISTRA}" != "true" ]; then
      $CLIENT_EXE delete network-attachment-definition istio-cni -n ${NAMESPACE}
    else
      $CLIENT_EXE delete smm default -n ${NAMESPACE}
    fi
    $CLIENT_EXE delete scc bookinfo-scc
    $CLIENT_EXE delete project ${NAMESPACE}
  else
    $CLIENT_EXE delete namespace ${NAMESPACE}
  fi
  echo "====== BOOKINFO UNINSTALLED ====="
  exit 0
fi

# If OpenShift, we need to do some additional things
if [ "${IS_OPENSHIFT}" == "true" ]; then
  $CLIENT_EXE new-project ${NAMESPACE}
else
  $CLIENT_EXE create namespace ${NAMESPACE}
fi

if [ "${AUTO_INJECTION}" == "true" ]; then
  $CLIENT_EXE label namespace ${NAMESPACE} "istio-injection=enabled"
  $CLIENT_EXE apply -n ${NAMESPACE} -f ${BOOKINFO_YAML}
else
  $ISTIOCTL kube-inject -f ${BOOKINFO_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
fi

$CLIENT_EXE apply -n ${NAMESPACE} -f ${GATEWAY_YAML}

if [ "${MONGO_ENABLED}" == "true" ]; then
  echo "Installing Mongo DB and a ratings service that uses it"
  MONGO_DB_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-db.yaml"
  MONGO_SERVICE_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2.yaml"

  if [ "${AUTO_INJECTION}" == "true" ]; then
    $CLIENT_EXE apply -n ${NAMESPACE} -f ${MONGO_DB_YAML}
    $CLIENT_EXE apply -n ${NAMESPACE} -f ${MONGO_SERVICE_YAML}
  else
    $ISTIOCTL kube-inject -f ${MONGO_DB_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
    $ISTIOCTL kube-inject -f ${MONGO_SERVICE_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
  fi
fi

if [ "${MYSQL_ENABLED}" == "true" ]; then
  echo "Installing MySql DB and a ratings service that uses it"
  MYSQL_DB_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-mysql.yaml"
  MYSQL_SERVICE_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql.yaml"

  if [ "${AUTO_INJECTION}" == "true" ]; then
    $CLIENT_EXE apply -n ${NAMESPACE} -f ${MYSQL_DB_YAML}
    $CLIENT_EXE apply -n ${NAMESPACE} -f ${MYSQL_SERVICE_YAML}
  else
    $ISTIOCTL kube-inject -f ${MYSQL_DB_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
    $ISTIOCTL kube-inject -f ${MYSQL_SERVICE_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
  fi
fi

if [ "${IS_MAISTRA}" == "true" ]; then
  prepare_maistra "${NAMESPACE}"
fi

sleep 4

echo "Bookinfo Demo should be installed and starting up - here are the pods and services"
$CLIENT_EXE get services -n ${NAMESPACE}
$CLIENT_EXE get pods -n ${NAMESPACE}

# If OpenShift, we need to do some additional things
if [ "${IS_OPENSHIFT}" == "true" ]; then
  $CLIENT_EXE expose svc/productpage -n ${NAMESPACE}
  $CLIENT_EXE expose svc/istio-ingressgateway --port http2 -n ${ISTIO_NAMESPACE}
  if [ "${IS_MAISTRA}" != "true" ]; then
    cat <<NAD | $CLIENT_EXE -n ${NAMESPACE} apply -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
  fi  
  cat <<SCC | $CLIENT_EXE apply -f -
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: bookinfo-scc
runAsUser:
  type: RunAsAny
seLinuxContext:
  type: RunAsAny
supplementalGroups:
  type: RunAsAny
users:
- "system:serviceaccount:${NAMESPACE}:bookinfo-details"
- "system:serviceaccount:${NAMESPACE}:bookinfo-productpage"
- "system:serviceaccount:${NAMESPACE}:bookinfo-ratings"
- "system:serviceaccount:${NAMESPACE}:bookinfo-ratings=v2"
- "system:serviceaccount:${NAMESPACE}:bookinfo-reviews"
- "system:serviceaccount:${NAMESPACE}:default"
SCC
fi

if [ "${TRAFFIC_GENERATOR_ENABLED}" == "true" ]; then
  echo "Installing Traffic Generator"
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    INGRESS_ROUTE=$(${CLIENT_EXE} get route istio-ingressgateway -o jsonpath='{.spec.host}{"\n"}' -n ${ISTIO_NAMESPACE})
    echo "Traffic Generator will use the OpenShift ingress route of: ${INGRESS_ROUTE}"
  else
    # Important note for minikube users
    # Ingress and Egress configuration depend on the platform
    # Check your "minikube tunnel" and/or Istio mesh config i.e. meshConfig.outboundTrafficPolicy.mode=REGISTRY_ONLY
    # if you experiment some weird behaviour compared with the CI results

    # for now, we only support minikube k8s environments and maybe a good guess otherwise (e.g. for kind clusters)
    if minikube -p ${MINIKUBE_PROFILE} status > /dev/null 2>&1 ; then
      INGRESS_HOST=$(minikube -p ${MINIKUBE_PROFILE} ip)
      INGRESS_PORT=$($CLIENT_EXE -n ${ISTIO_NAMESPACE} get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="http2")].nodePort}')
      INGRESS_ROUTE=$INGRESS_HOST:$INGRESS_PORT
      echo "Traffic Generator will use the Kubernetes (minikube) ingress route of: ${INGRESS_ROUTE}"
    else
      echo "Failed to get minikube ip. If you are using minikube, make sure it is up and your profile is defined properly (--minikube-profile option)"
      echo "Will try to get the ingressgateway IP in case you are running 'kind' and we can access it directly."
      INGRESS_HOST=$($CLIENT_EXE get service -n ${ISTIO_NAMESPACE} istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
      INGRESS_PORT="80"
      INGRESS_ROUTE=$INGRESS_HOST:$INGRESS_PORT
    fi
  fi

  if [ "${INGRESS_ROUTE}" != "" ] ; then
    # TODO - these access the "openshift" yaml files - but there are no kubernetes specific versions. using --validate=false
    curl https://raw.githubusercontent.com/kiali/kiali-test-mesh/master/traffic-generator/openshift/traffic-generator-configmap.yaml | DURATION='0s' ROUTE="http://${INGRESS_ROUTE}/productpage" RATE="${RATE}" envsubst | $CLIENT_EXE apply -n ${NAMESPACE} -f -
    curl https://raw.githubusercontent.com/kiali/kiali-test-mesh/master/traffic-generator/openshift/traffic-generator.yaml | $CLIENT_EXE apply --validate=false -n ${NAMESPACE} -f -
  fi
fi
