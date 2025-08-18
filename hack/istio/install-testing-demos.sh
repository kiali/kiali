#!/bin/bash

##############################################################################
# install-testing-demos.sh
#
# Installs all the demo applications needed for cypress testing.
# Works on both openshift and non-openshift environments.
##############################################################################

set -eu
HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${HACK_SCRIPT_DIR}/functions.sh

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"

# install the Istio release that was last downloaded (that's the -t option to ls)
ISTIO_DIR=$(ls -dt1 ${SCRIPT_DIR}/../../_output/istio-* | head -n1)

# only used when cluster is minikube
MINIKUBE_PROFILE="minikube"

: ${CLIENT_EXE:=oc}
: ${AMBIENT_ENABLED:="false"}
: ${ARCH:=amd64}
: ${DELETE_DEMOS:=false}
: ${ENABLE_INJECTION:=true}
: ${GATEWAY_HOST:=""}
: ${USE_GATEWAY_API:=false}
ISTIO_NAMESPACE="istio-system"

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -a|--arch)
      ARCH="$2"
      shift;shift
      ;;
    -ab|--ambient)
      AMBIENT_ENABLED="$2"
      shift;shift
      ;;
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -d|--delete)
      DELETE_DEMOS="$2"
      shift;shift
      ;;
    -g|--gateway-host)
      GATEWAY_HOST="$2"
      shift;shift
      ;;
    -mp|--minikube-profile)
      MINIKUBE_PROFILE="$2"
      shift;shift
      ;;
    -in|--istio-namespace)
      ISTIO_NAMESPACE="$2"
      shift;shift
      ;;
    -gw|--use-gateway-api)
      USE_GATEWAY_API="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -a|--arch <amd64|ppc64le|s390x|arm64>: Images for given arch will be used (default: amd64).
  -ab|--ambient: Istio Ambient enabled
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: if 'true' demos will be deleted; otherwise, they will be installed
  -g|--gateway-host: host to use for the ingress gateway
  -gw|--use-gateway-api: if 'true' gateway API CRs will be used instead of istio CRs (default: false).
  -mp|--minikube-profile <name>: If using minikube, this is the minikube profile name (default: minikube).
  -in|--istio-namespace <name>: Where the Istio control plane is installed (default: istio-system).
  -h|--help: this text
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# check arch values
if [ "${ARCH}" != "ppc64le" ] && [ "${ARCH}" != "s390x" ] && [ "${ARCH}" != "amd64" ] && [ "${ARCH}" != "arm64" ]; then
  echo "${ARCH} is not supported. Exiting."
  exit 1
fi

IS_OPENSHIFT="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
fi

echo "CLIENT_EXE=${CLIENT_EXE}"
echo "ARCH=${ARCH}"
echo "IS_OPENSHIFT=${IS_OPENSHIFT}"

# Waits for workloads in the specified namespace to be ready
wait_for_workloads () {
  local namespace=$1
  local workloads=$(${CLIENT_EXE} get deployments -n $namespace -o jsonpath='{.items[*].metadata.name}')
  for workload in ${workloads}
  do
    echo "Waiting for workload: '${workload}' to be ready"
    ${CLIENT_EXE} rollout status deployment "${workload}" -n "${namespace}"
  done
}

if [ "${DELETE_DEMOS}" != "true" ]; then

  AMBIENT_ARGS_BOOKINFO=""
  AMBIENT_ARGS_ERROR_RATES=""
  if [ "${AMBIENT_ENABLED}" == "true" ]; then
    echo "Installing testing demos with Ambient enabled"
    AMBIENT_ARGS_BOOKINFO="--auto-injection false"
    AMBIENT_ARGS_ERROR_RATES="-ei false"
  fi

  gateway_yaml=""
  if [ "${USE_GATEWAY_API}" == "true" ]; then
    gateway_yaml="${ISTIO_DIR}/samples/bookinfo/gateway-api/bookinfo-gateway.yaml"
  elif ! [ -z "$GATEWAY_HOST" ]; then
    # TODO: Ideally this wouldn't go in istio-system. It'd either go in the same namespace as the app
    # or in its own namespace but doing that would require rewriting some tests and this is faster...
    ${CLIENT_EXE} apply -n ${ISTIO_NAMESPACE} -f "${SCRIPT_DIR}/istio-gateway.yaml"
    gateway_yaml=$(mktemp)
    cat << EOF > "${gateway_yaml}"
apiVersion: networking.istio.io/v1
kind: Gateway
metadata:
  name: bookinfo-gateway
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 8080
      name: http
      protocol: HTTP
    hosts:
    - "${GATEWAY_HOST}"
---
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: bookinfo
spec:
  hosts:
  - "${GATEWAY_HOST}"
  gateways:
  - bookinfo-gateway
  http:
  - match:
    - uri:
        exact: /productpage
    - uri:
        prefix: /static
    - uri:
        exact: /login
    - uri:
        exact: /logout
    - uri:
        prefix: /api/v1/products
    route:
    - destination:
        host: productpage
        port:
          number: 9080
EOF
  fi
  # Installed demos should be the exact same for both environments.
  # Only the args passed to the scripts differ from each other.
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    echo "Deploying bookinfo demo ..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" -tg -in ${ISTIO_NAMESPACE} -a ${ARCH} ${gateway_yaml:+-g ${gateway_yaml}} ${AMBIENT_ARGS_BOOKINFO}
    # Install just bookinfo for now for Ambient
    if [ "${AMBIENT_ENABLED}" != "true" ]; then
      echo "Deploying error rates demo ..."
      "${SCRIPT_DIR}/install-error-rates-demo.sh" -in ${ISTIO_NAMESPACE} -a ${ARCH} ${AMBIENT_ARGS_ERROR_RATES}
    else
      ${CLIENT_EXE} apply -f "${SCRIPT_DIR}/ambient/resources/waypoint.yaml" -n bookinfo
      echo "Deploying waypoint proxies ..."
      "${SCRIPT_DIR}/ambient/install-waypoints.sh" -c ${CLIENT_EXE}

      echo "Deploying sidecar-ambient ..."
      "${SCRIPT_DIR}/ambient/install-sidecars-ambient.sh" -c ${CLIENT_EXE}
    fi
    echo "Deploying sleep demo ..."
    "${SCRIPT_DIR}/install-sleep-demo.sh" -in ${ISTIO_NAMESPACE} -a ${ARCH} ${AMBIENT_ARGS_BOOKINFO}

  elif [ "${AMBIENT_ENABLED}" == "true" ]; then
    echo "Deploying bookinfo demo..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" -c ${CLIENT_EXE} -mp ${MINIKUBE_PROFILE} -tg ${AMBIENT_ARGS_BOOKINFO}
    ${CLIENT_EXE} apply -f "${SCRIPT_DIR}/ambient/resources/waypoint.yaml" -n bookinfo

    echo "Deploying sleep demo ..."
    "${SCRIPT_DIR}/install-sleep-demo.sh" -c kubectl -in ${ISTIO_NAMESPACE} -a ${ARCH} ${AMBIENT_ARGS_BOOKINFO}

    echo "Deploying waypoint proxies ..."
    "${SCRIPT_DIR}/ambient/install-waypoints.sh" -c ${CLIENT_EXE}

    echo "Deploying sidecar-ambient ..."
    "${SCRIPT_DIR}/ambient/install-sidecars-ambient.sh" -c ${CLIENT_EXE}

  else
    echo "Deploying bookinfo demo..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" -c kubectl -mp ${MINIKUBE_PROFILE} -tg -in ${ISTIO_NAMESPACE} -a ${ARCH} ${gateway_yaml:+-g ${gateway_yaml}} ${AMBIENT_ARGS_BOOKINFO}

    echo "Deploying error rates demo..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh" -c kubectl -in ${ISTIO_NAMESPACE} -a ${ARCH} ${AMBIENT_ARGS_ERROR_RATES}

    echo "Deploying sleep demo ..."
    "${SCRIPT_DIR}/install-sleep-demo.sh" -c kubectl -in ${ISTIO_NAMESPACE} -a ${ARCH} ${AMBIENT_ARGS_BOOKINFO}
  fi

  echo "Deploying loggers demo..."
  "${SCRIPT_DIR}/install-loggers-demo.sh" -ab ${AMBIENT_ENABLED} -c ${CLIENT_EXE}

  if [[ -z "$GATEWAY_HOST" && "${USE_GATEWAY_API}" != "true" ]]; then
    # Assume that the '*' is used for hosts if the gateway host is not specified.
    # Some front-end tests have conflicts with the wildcard host in the bookinfo-gateway. Patch it with the host resolved for the traffic generator.
    ISTIO_INGRESS_HOST=$(${CLIENT_EXE} get cm -n bookinfo traffic-generator-config -o jsonpath='{.data.route}' | sed 's|.*//\([^\:]*\).*/.*|\1|')
    ${CLIENT_EXE} patch VirtualService bookinfo -n bookinfo --type json -p "[{\"op\": \"replace\", \"path\": \"/spec/hosts/0\", \"value\": \"${ISTIO_INGRESS_HOST}\"}]"
  fi

  for namespace in bookinfo alpha beta gamma
  do
    wait_for_workloads "${namespace}"
  done

else
  # Delete everything - don't abort on error, just keep going and try to delete everything
  set +e

  if [ "${AMBIENT_ENABLED}" == "true" ]; then
    if [ "${IS_OPENSHIFT}" == "true" ]; then
          echo "Deleting bookinfo demo ..."
          "${SCRIPT_DIR}/install-bookinfo-demo.sh" --delete-bookinfo true
          echo "Deleting waypoints demo ..."
          "${SCRIPT_DIR}/ambient/install-waypoints.sh" --delete true
          echo "Deleting ambient sidecars demo..."
          "${SCRIPT_DIR}/ambient/install-sidecars-ambient.sh" --delete true
    else
          echo "Deleting bookinfo demo..."
          "${SCRIPT_DIR}/install-bookinfo-demo.sh" --delete-bookinfo true -c kubectl
          echo "Deleting waypoints demo ..."
          "${SCRIPT_DIR}/ambient/install-waypoints.sh" --delete true -c kubectl
          echo "Deleting ambient sidecars demo..."
          "${SCRIPT_DIR}/ambient/install-sidecars-ambient.sh" --delete true -c kubectl
    fi
  else
    if [ "${IS_OPENSHIFT}" == "true" ]; then
      echo "Deleting sleep demo ..."
      "${SCRIPT_DIR}/install-sleep-demo.sh" --delete-sleep true
      echo "Deleting bookinfo demo ..."
      "${SCRIPT_DIR}/install-bookinfo-demo.sh" --delete-bookinfo true
      echo "Deleting error rates demo ..."
      "${SCRIPT_DIR}/install-error-rates-demo.sh" --delete true
      echo "Deleting loggers demo..."
      "${SCRIPT_DIR}/install-loggers-demo.sh" --delete true
    else
      echo "Deleting sleep demo ..."
      "${SCRIPT_DIR}/install-sleep-demo.sh" --delete-sleep true -c kubectl
      echo "Deleting bookinfo demo..."
      "${SCRIPT_DIR}/install-bookinfo-demo.sh" --delete-bookinfo true -c kubectl
      echo "Deleting error rates demo..."
      "${SCRIPT_DIR}/install-error-rates-demo.sh" --delete true -c kubectl
      echo "Deleting loggers demo..."
      "${SCRIPT_DIR}/install-loggers-demo.sh" --delete true -c kubectl
    fi
  fi
fi