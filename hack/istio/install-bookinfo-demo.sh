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

HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${HACK_SCRIPT_DIR}/functions.sh

# ISTIO_DIR is where the Istio download is installed and thus where the bookinfo demo files are found.
# CLIENT_EXE_NAME is going to either be "oc" or "kubectl"
AMBIENT_ENABLED="false" # the script will set this to true only if Ambient is enabled and no sidecars are injected
ARCH="amd64"
AUTO_INJECTION="true"
AUTO_INJECTION_LABEL="istio-injection=enabled"
CLIENT_EXE_NAME="oc"
DELETE_BOOKINFO="false"
ISTIO_NAMESPACE="istio-system"
INGRESS_NAMESPACE=${ISTIO_NAMESPACE}
ISTIO_DIR=
MANUAL_INJECTION="false"
MINIKUBE_PROFILE="minikube"
NAMESPACE="bookinfo"
RATE=1
SERVICE_VERSIONS="false"
WAIT_TIMEOUT="0" # can be things like "60s" or "30m"
WAYPOINT="false"


# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -a|--arch)
      ARCH="$2"
      shift;shift
      ;;
    -ai|--auto-injection)
      AUTO_INJECTION="$2"
      shift;shift
      ;;
    -ail|--auto-injection-label)
      AUTO_INJECTION_LABEL="$2"
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
    -ign|--ingress-gateway-namespace)
      INGRESS_NAMESPACE="$2"
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
    -mi|--manual-injection)
      MANUAL_INJECTION="$2"
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
    --service-versions)
      SERVICE_VERSIONS="$2"
      shift;shift
      ;;
    -tg|--traffic-generator)
      TRAFFIC_GENERATOR_ENABLED="true"
      shift;
      ;;
    -w|--waypoint)
      WAYPOINT="$2"
      shift;shift
      ;;
    -wt|--wait-timeout)
      WAIT_TIMEOUT="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -a|--arch <amd64|ppc64le|s390x|arm64>: Images for given arch will be used (default: amd64). Custom bookinfo yaml file provided via '-b' argument is ignored when using different arch than the default.
  -ai|--auto-injection <true|false>: If you want sidecars to be auto-injected (default: true).
  -ail|--auto-injection-label <name=value>: If auto-injection is enabled, this is the label added to the namespace. For revision-based installs, you can use something like "istio.io/rev=default-v1-23-0". default: istio-injection=enabled).
  -db|--delete-bookinfo <true|false>: If true, uninstall bookinfo. If false, install bookinfo. (default: false).
  -id|--istio-dir <dir>: Where Istio has already been downloaded. If not found, this script aborts.
  -in|--istio-namespace <name>: Where the Istio control plane is installed (default: istio-system).
  -ign|--ingress-gateway-namespace: Namespace where the ingress gateway is located (default: same as istio-namespace). (Use for traffic generator)
  -c|--client-exe <name>: Cluster client executable name - valid values are "kubectl" or "oc"
  -mi|--manual-injection <true|false>: If you want sidecars to be manually injected via istioctl (default: false).
  -mp|--minikube-profile <name>: If using minikube, this is the minikube profile name (default: minikube).
  -n|--namespace <name>: Install the demo in this namespace (default: bookinfo)
  -b|--bookinfo.yaml <file>: A custom yaml file to deploy the bookinfo demo. This is ignored when not using default arch via '-a' argument.
  -g|--gateway.yaml <file>: A custom yaml file to deploy the bookinfo-gateway resources
  --mongo: Install a Mongo DB that a ratings service will access
  --mysql: Install a MySQL DB that a ratings service will access
  --service-versions: Install bookinfo service versions and http routes. By default is false.
  -w|--waypoint: Install a waypoint proxy in bookinfo namespace when Ambient is enabled. By default is false.
  -wt|--wait-timeout <timeout>: If not "0", then this script will wait for all pods in the new bookinfo namespace to be Ready before exiting. This value can be things like "60s" or "30m". (default: 0)
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
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
fi

# If no sidecars are to be injected, then see if Ambient is enabled.
# Look everywhere for a "ztunnel" daemonset (in case it is in a kube internal namespace and not just istio-system)
if [ "${AUTO_INJECTION}" == "false" -a "${MANUAL_INJECTION}" == "false" ]; then
  for n in $(${CLIENT_EXE} get daemonset --all-namespaces -o jsonpath='{.items[*].metadata.name}')
  do
    if [ "${n}" == "ztunnel" ]; then
      AMBIENT_ENABLED="true"
      # Verify Gateway API
      echo "Verifying that Gateway API is installed; if it is not then it will be installed now."
      $CLIENT_EXE get crd gateways.gateway.networking.k8s.io &> /dev/null || \
        { $CLIENT_EXE kustomize "github.com/kubernetes-sigs/gateway-api/config/crd/experimental?ref=v1.2.0" | $CLIENT_EXE apply -f -; }
      break
    fi
  done
  if [ "${AMBIENT_ENABLED}" == "false" ] && [ "${WAYPOINT}" == "true" ]; then
   echo "Waypoint proxy cannot be installed as Ambient is not enabled."
   exit 1
  fi
fi

echo "IS_OPENSHIFT=${IS_OPENSHIFT}"
echo "AMBIENT_ENABLED=${AMBIENT_ENABLED}"
echo "SERVICE_VERSIONS=${SERVICE_VERSIONS}"

# check arch values and prepare new bookinfo-arch.yaml with matching images
if [ "${ARCH}" == "ppc64le" ]; then
  cp ${HACK_SCRIPT_DIR}/kustomization/bookinfo-ppc64le.yaml ${ISTIO_DIR}/samples/bookinfo/platform/kube/kustomization.yaml
  ${CLIENT_EXE} kustomize ${ISTIO_DIR}/samples/bookinfo/platform/kube > ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ppc64le.yaml
  BOOKINFO_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ppc64le.yaml"
elif [ "${ARCH}" == "s390x" ]; then
  cp ${HACK_SCRIPT_DIR}/kustomization/bookinfo-s390x.yaml ${ISTIO_DIR}/samples/bookinfo/platform/kube/kustomization.yaml
  ${CLIENT_EXE} kustomize ${ISTIO_DIR}/samples/bookinfo/platform/kube > ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-s390x.yaml
  BOOKINFO_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-s390x.yaml"
elif [ "${ARCH}" != "amd64" ] && [ "${ARCH}" != "arm64" ]; then
  echo "${ARCH} is not supported. Exiting."
  exit 1
fi

# use default bookinfo.yaml when there was no custom file provided or different arch selected
if [ "${BOOKINFO_YAML}" == "" ]; then
  BOOKINFO_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo.yaml"
fi
if [ "${GATEWAY_YAML}" == "" ]; then
  if [ "${AMBIENT_ENABLED}" == "true" ]; then
    GATEWAY_YAML="${ISTIO_DIR}/samples/bookinfo/gateway-api/bookinfo-gateway.yaml"
  else
    ${CLIENT_EXE} apply -n ${ISTIO_NAMESPACE} -f "${HACK_SCRIPT_DIR}/istio-gateway.yaml"
    GATEWAY_YAML="${ISTIO_DIR}/samples/bookinfo/networking/bookinfo-gateway.yaml"
  fi
fi

# If we are to delete, remove everything and exit immediately after
if [ "${DELETE_BOOKINFO}" == "true" ]; then
  echo "====== UNINSTALLING ANY EXISTING BOOKINFO DEMO ====="
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE delete network-attachment-definition istio-cni -n ${NAMESPACE}
    $CLIENT_EXE delete project ${NAMESPACE}
    # oc delete project does not wait for a namespace to be removed, we need to also call 'oc delete namespace'
    $CLIENT_EXE delete namespace ${NAMESPACE}
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


# If OpenShift, we need to do some additional things
if [ "${IS_OPENSHIFT}" == "true" ]; then
  cat <<NAD | $CLIENT_EXE -n ${NAMESPACE} apply -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
NAD
fi

if [ "${AUTO_INJECTION}" == "true" ]; then
  $CLIENT_EXE label namespace ${NAMESPACE} "${AUTO_INJECTION_LABEL}"
  $CLIENT_EXE apply -n ${NAMESPACE} -f ${BOOKINFO_YAML}
else
  if [ "${MANUAL_INJECTION}" == "true" ]; then
    $ISTIOCTL kube-inject -f ${BOOKINFO_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
  else
    $CLIENT_EXE apply -n ${NAMESPACE} -f ${BOOKINFO_YAML}
  fi
fi

$CLIENT_EXE apply -n ${NAMESPACE} -f ${GATEWAY_YAML}

if [ "${SERVICE_VERSIONS}" == "true" ]; then
  if [ "${GATEWAY_YAML}" == "${ISTIO_DIR}/samples/bookinfo/networking/bookinfo-gateway.yaml" ]; then
    echo "Services version error: Gateway yaml should be a k8s Gateway"
  else
    echo "Applying services versions"
    $CLIENT_EXE apply -f "${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-versions.yaml" -n ${NAMESPACE}
    $CLIENT_EXE apply -f "${ISTIO_DIR}/samples/bookinfo/gateway-api/route-all-v1.yaml" -n ${NAMESPACE}
    $CLIENT_EXE apply -f "${ISTIO_DIR}/samples/bookinfo/gateway-api/route-reviews-50-v3.yaml" -n ${NAMESPACE}
    $CLIENT_EXE apply -f "${HACK_SCRIPT_DIR}/bookinfo-traffic/http-route-productpage-v1.yaml" -n ${NAMESPACE}
    $CLIENT_EXE label svc/details-v1 -n ${NAMESPACE} app=details
    $CLIENT_EXE label svc/productpage-v1 -n ${NAMESPACE} app=productpage
    $CLIENT_EXE label svc/reviews-v1 -n ${NAMESPACE} app=reviews
    $CLIENT_EXE label svc/reviews-v2 -n ${NAMESPACE} app=reviews
    $CLIENT_EXE label svc/reviews-v3 -n ${NAMESPACE} app=reviews
    $CLIENT_EXE label svc/ratings-v1 -n ${NAMESPACE} app=ratings
  fi
fi

if [ "${AMBIENT_ENABLED}" == "true" ]; then
  $CLIENT_EXE annotate gateway bookinfo-gateway networking.istio.io/service-type=ClusterIP --namespace=${NAMESPACE}
fi

if [ "${MONGO_ENABLED}" == "true" ]; then
  echo "Installing Mongo DB and a ratings service that uses it"
  MONGO_DB_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-db.yaml"
  MONGO_SERVICE_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2.yaml"

  if [ "${ARCH}" == "ppc64le" ]; then
    sed  "s;docker.io/istio.*;quay.io/maistra/examples-bookinfo-mongodb:2.0.0-ibm-p;g" ${MONGO_DB_YAML} > ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-db-ppc64le.yaml
    MONGO_DB_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-db-ppc64le.yaml"
    sed  "s;docker.io/istio.*;quay.io/maistra/examples-bookinfo-ratings-v2:2.0.0-ibm-p-mod;g" ${MONGO_SERVICE_YAML} > ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2-ppc64le.yaml
    MONGO_SERVICE_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2-ppc64le.yaml"
  fi
  if [ "${ARCH}" == "s390x" ]; then
    sed  "s;docker.io/istio.*;quay.io/maistra/examples-bookinfo-mongodb:2.0.0-ibm-z;g" ${MONGO_DB_YAML} > ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-db-s390x.yaml
    MONGO_DB_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-db-s390x.yaml"
    sed  "s;docker.io/istio.*;quay.io/maistra/examples-bookinfo-ratings-v2:2.0.0-ibm-z;g" ${MONGO_SERVICE_YAML} > ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2-s390x.yaml
    MONGO_SERVICE_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2-s390x.yaml"
  fi

  if [ "${AUTO_INJECTION}" == "true" ]; then
    $CLIENT_EXE apply -n ${NAMESPACE} -f ${MONGO_DB_YAML}
    $CLIENT_EXE apply -n ${NAMESPACE} -f ${MONGO_SERVICE_YAML}
  else
    if [ "${MANUAL_INJECTION}" == "true" ]; then
      $ISTIOCTL kube-inject -f ${MONGO_DB_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
      $ISTIOCTL kube-inject -f ${MONGO_SERVICE_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
    else
      $CLIENT_EXE apply -n ${NAMESPACE} -f ${MONGO_DB_YAML}
      $CLIENT_EXE apply -n ${NAMESPACE} -f ${MONGO_SERVICE_YAML}
    fi
  fi

  if [ "${AMBIENT_ENABLED}" == "true" ]; then
    echo "Mongodb service opting out of namespace waypoint"
    $CLIENT_EXE label service mongodb istio.io/use-waypoint=none --namespace=${NAMESPACE}
  fi
fi

if [ "${MYSQL_ENABLED}" == "true" ]; then
  echo "Installing MySql DB and a ratings service that uses it"
  MYSQL_DB_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-mysql.yaml"
  MYSQL_SERVICE_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql.yaml"

  if [ "${ARCH}" == "ppc64le" ]; then
    sed  "s;docker.io/istio.*;quay.io/maistra/examples-bookinfo-mysqldb:2.0.0-ibm-p;g" ${MYSQL_DB_YAML} > ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-mysql-ppc64le.yaml
    MYSQL_DB_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-mysql-ppc64le.yaml"
    sed  "s;docker.io/istio.*;quay.io/maistra/examples-bookinfo-ratings-v2:2.0.0-ibm-p;g" ${MYSQL_SERVICE_YAML} > ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql-ppc64le.yaml
    MYSQL_SERVICE_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql-ppc64le.yaml"
  fi
  if [ "${ARCH}" == "s390x" ]; then
    sed  "s;docker.io/istio.*;quay.io/maistra/examples-bookinfo-mysqldb:2.0.0-ibm-z;g" ${MYSQL_DB_YAML} > ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-mysql-s390x.yaml
    MYSQL_DB_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-mysql-s390x.yaml"
    sed  "s;docker.io/istio.*;quay.io/maistra/examples-bookinfo-ratings-v2:2.0.0-ibm-z;g" ${MYSQL_SERVICE_YAML} > ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql-s390x.yaml
    MYSQL_SERVICE_YAML="${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql-s390x.yaml"
  fi

  if [ "${AUTO_INJECTION}" == "true" ]; then
    $CLIENT_EXE apply -n ${NAMESPACE} -f ${MYSQL_DB_YAML}
    $CLIENT_EXE apply -n ${NAMESPACE} -f ${MYSQL_SERVICE_YAML}
  else
    if [ "${MANUAL_INJECTION}" == "true" ]; then
      $ISTIOCTL kube-inject -f ${MYSQL_DB_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
      $ISTIOCTL kube-inject -f ${MYSQL_SERVICE_YAML} | $CLIENT_EXE apply -n ${NAMESPACE} -f -
    else
      $CLIENT_EXE apply -n ${NAMESPACE} -f ${MYSQL_DB_YAML}
      $CLIENT_EXE apply -n ${NAMESPACE} -f ${MYSQL_SERVICE_YAML}
    fi
  fi

  if [ "${AMBIENT_ENABLED}" == "true" ]; then
    echo "Mysqldb service opting out of namespace waypoint"
    $CLIENT_EXE label service mysqldb istio.io/use-waypoint=none --namespace=${NAMESPACE}
  fi
fi

sleep 4

# Expose the OpenShift routes
if [ "${IS_OPENSHIFT}" == "true" ]; then
  $CLIENT_EXE expose svc/productpage -n ${NAMESPACE}
  $CLIENT_EXE expose svc/istio-ingressgateway --port http -n ${INGRESS_NAMESPACE} --name=istio-ingressgateway
  $CLIENT_EXE expose svc/bookinfo-gateway-istio --port=http -n ${NAMESPACE} --name=bookinfo-gateway-istio
fi

echo "Bookinfo Demo should be installed and starting up - here are the pods and services"
$CLIENT_EXE get services -n ${NAMESPACE}
$CLIENT_EXE get pods -n ${NAMESPACE}

if [ "${AMBIENT_ENABLED}" == "true" ]; then
  echo "Sidecar injection was not performed. Ambient support will be enabled."
  ${CLIENT_EXE} label namespace ${NAMESPACE} istio.io/dataplane-mode=ambient istio.io/dataplane-mode=ambient
  # It could also be applied to service account
  if [ "${WAYPOINT}" == "true" ]; then
    # Create Waypoint proxy
    is_istio_version_eq_greater_than "1.23.0"
    version_greater=$?

    if [ "${version_greater}" == "1" ]; then
      echo "Create Waypoint proxy"
      ${ISTIOCTL} waypoint apply -n ${NAMESPACE} --enroll-namespace
    else
      echo "Create -experimental- Waypoint proxy"
      ${ISTIOCTL} x waypoint apply -n ${NAMESPACE} --enroll-namespace
    fi
  fi
else
  if [ "${AUTO_INJECTION}" == "false" -a "${MANUAL_INJECTION}" == "false" ]; then
    echo "WARNING! Sidecar injection was not performed and there is no Ambient support. This demo may not work until sidecars are injected."
  fi
fi

if [ "${TRAFFIC_GENERATOR_ENABLED}" == "true" ]; then
  echo "Installing Traffic Generator"
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    echo "Determining the route to send traffic to, trying istio-ingressgateway route in ${INGRESS_NAMESPACE} namespace"

    # first, try route for gateway in bookinfo namespace created by gateway-api
    # make sure you have latest kubectl/oc which support JSONPath condition without value
    ${CLIENT_EXE} wait --for=jsonpath='{.status.ingress[].host}' --timeout=10s route bookinfo-gateway-istio -n ${NAMESPACE}
    INGRESS_ROUTE=$(${CLIENT_EXE} get route bookinfo-gateway-istio -o jsonpath='{.spec.host}{"\n"}' -n ${NAMESPACE})
    if [ -z "${INGRESS_ROUTE}" ]; then
      sleep 1
      echo "No bookinfo-gateway-istio route in ${NAMESPACE} namespace, next, trying istio-ingressgateway route in ${INGRESS_NAMESPACE} namespace"

      # next, try istio-ingressgateway in istio-system, wait for a while the host is populated
      ${CLIENT_EXE} wait --for=jsonpath='{.status.ingress[].host}' --timeout=10s route istio-ingressgateway -n ${INGRESS_NAMESPACE}
      INGRESS_ROUTE=$(${CLIENT_EXE} get route istio-ingressgateway -o jsonpath='{.spec.host}{"\n"}' -n ${INGRESS_NAMESPACE})
      if [ -z "${INGRESS_ROUTE}" ]; then
        sleep 1
        echo "No istio-ingressgateway route in ${INGRESS_NAMESPACE} namespace, the route for productpage app will be used dirrectly"

        # nevermind, use productpage route directly
        ${CLIENT_EXE} wait --for=jsonpath='{.status.ingress[].host}' --timeout=10s route productpage -n ${NAMESPACE}
        INGRESS_ROUTE=$(${CLIENT_EXE} get route productpage -o jsonpath='{.spec.host}{"\n"}' -n ${NAMESPACE})
      fi
    fi
    echo
    echo "Traffic Generator will use the OpenShift ingress route of: ${INGRESS_ROUTE}"
  else
    # Important note for minikube users
    # Ingress and Egress configuration depend on the platform
    # Check your "minikube tunnel" and/or Istio mesh config i.e. meshConfig.outboundTrafficPolicy.mode=REGISTRY_ONLY
    # if you experiment some weird behaviour compared with the CI results

    if [ "${AMBIENT_ENABLED}" == "true" ]; then
      INGRESS_ROUTE="bookinfo-gateway-istio.${NAMESPACE}"
    else
      # for now, we only support minikube k8s environments and maybe a good guess otherwise (e.g. for kind clusters)
      if minikube -p ${MINIKUBE_PROFILE} status > /dev/null 2>&1 ; then
        INGRESS_HOST=$(minikube -p ${MINIKUBE_PROFILE} ip)
        INGRESS_PORT=$($CLIENT_EXE -n ${INGRESS_NAMESPACE} get service istio-ingressgateway -o jsonpath='{.spec.ports[?(@.name=="http")].nodePort}')
        INGRESS_ROUTE=$INGRESS_HOST:$INGRESS_PORT

        echo "Wait for productpage to come up to see if it is accessible via minikube ingress"
        $CLIENT_EXE wait pods --all -n ${NAMESPACE} --for=condition=Ready --timeout=5m
        if [ -n "${INGRESS_PORT}" -a -n "${INGRESS_HOST}" ] && curl --fail http://${INGRESS_ROUTE}/productpage &> /dev/null; then
          echo "Traffic Generator will use the Kubernetes (minikube) ingress route of: ${INGRESS_ROUTE}"
        else
          INGRESS_HOST="productpage.${NAMESPACE}"
          INGRESS_PORT="9080"
          INGRESS_ROUTE=$INGRESS_HOST:$INGRESS_PORT
          echo "Ingress does not seem to work. Falling back to using the internal productpage endpoint: ${INGRESS_ROUTE}"
        fi
      else
        echo "Failed to get minikube ip. If you are using minikube, make sure it is up and your profile is defined properly (--minikube-profile option)"
        echo "Will try to get the ingressgateway IP in case you are running 'kind' and we can access it directly."
        INGRESS_HOST=$($CLIENT_EXE get service -n ${INGRESS_NAMESPACE} istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
        INGRESS_PORT="80"
        INGRESS_ROUTE=$INGRESS_HOST:$INGRESS_PORT
        echo "Wait for productpage to come up to see if it is accessible via ingress"
        $CLIENT_EXE wait pods --all -n ${NAMESPACE} --for=condition=Ready --timeout=5m
        if curl --fail http://${INGRESS_ROUTE}/productpage &> /dev/null; then
          echo "Traffic Generator will use the Kubernetes (loadBalancer) route of: ${INGRESS_ROUTE}"
        else
          INGRESS_HOST="productpage.${NAMESPACE}"
          INGRESS_PORT="9080"
          INGRESS_ROUTE=$INGRESS_HOST:$INGRESS_PORT
          echo "Ingress loadBalancer does not seem to work. Falling back to using the internal productpage endpoint: ${INGRESS_ROUTE}"
        fi
      fi
    fi
  fi

  if [ "${INGRESS_ROUTE}" != "" ] ; then
    echo "Ingress route: http://${INGRESS_ROUTE}/productpage"

    if [ "${IS_OPENSHIFT}" == "true" ]; then
      $CLIENT_EXE adm policy add-scc-to-user anyuid -z default -n ${NAMESPACE}
    fi

    # TODO - these access the "openshift" yaml files - but there are no kubernetes specific versions. using --validate=false
    curl https://raw.githubusercontent.com/kiali/kiali-test-mesh/master/traffic-generator/openshift/traffic-generator-configmap.yaml | DURATION='0s' ROUTE="http://${INGRESS_ROUTE}/productpage" RATE="${RATE}" envsubst | $CLIENT_EXE apply -n ${NAMESPACE} -f -
    url="https://raw.githubusercontent.com/kiali/kiali-test-mesh/master/traffic-generator/openshift/traffic-generator.yaml"
    if [ "${ARCH}" == "ppc64le" ]; then
      curl ${url} | sed 's;quay.io/kiali.*;quay.io/maistra/kiali-test-mesh-traffic-generator:0.0-ibm-p;g' | $CLIENT_EXE apply --validate=false -n ${NAMESPACE} -f -
    elif [ "${ARCH}" == "s390x" ]; then
      curl ${url} | sed 's;quay.io/kiali.*;quay.io/maistra/kiali-test-mesh-traffic-generator:0.0-ibm-z;g' | $CLIENT_EXE apply --validate=false -n ${NAMESPACE} -f -
    else
      curl ${url} | $CLIENT_EXE apply --validate=false -n ${NAMESPACE} -f -
    fi

  fi
fi

if [ "${WAIT_TIMEOUT}" != "0" ]; then
  echo "Waiting for all pods to be ready in namespace [${NAMESPACE}]"
  $CLIENT_EXE wait pods --all -n ${NAMESPACE} --for=condition=Ready --timeout=${WAIT_TIMEOUT}
fi
