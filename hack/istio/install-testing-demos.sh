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
: ${ARCH:=amd64}
: ${DELETE_DEMOS:=false}
: ${ENABLE_INJECTION:=true}
: ${GATEWAY_HOST:="")}
ISTIO_NAMESPACE="istio-system"

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -a|--arch)
      ARCH="$2"
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
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -a|--arch <amd64|ppc64le|s390x>: Images for given arch will be used (default: amd64).
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: if 'true' demos will be deleted; otherwise, they will be installed
  -g|--gateway-host: host to use for the ingress gateway
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
if [ "${ARCH}" != "ppc64le" ] && [ "${ARCH}" != "s390x" ] && [ "${ARCH}" != "amd64" ] && [ "${ARCH}" != "arm" ]; then
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

  # Installed demos should be the exact same for both environments.
  # Only the args passed to the scripts differ from each other.
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    echo "Deploying bookinfo demo ..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" -tg -in ${ISTIO_NAMESPACE} -a ${ARCH}
    echo "Deploying error rates demo ..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh" -in ${ISTIO_NAMESPACE} -a ${ARCH}
    echo "Deploying sleep demo ..."
    "${SCRIPT_DIR}/install-sleep-demo.sh" -in ${ISTIO_NAMESPACE}

  else
    gateway_yaml=""
    if [ -v GATEWAY_HOST ]; then
      gateway_yaml=$(mktemp)
      cat << EOF > "${gateway_yaml}"
apiVersion: networking.istio.io/v1alpha3
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
apiVersion: networking.istio.io/v1alpha3
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
    echo "Deploying bookinfo demo..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" -c kubectl -mp ${MINIKUBE_PROFILE} -tg -in ${ISTIO_NAMESPACE} -a ${ARCH} ${gateway_yaml:+-g ${gateway_yaml}}

    echo "Deploying error rates demo..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh" -c kubectl -in ${ISTIO_NAMESPACE} -a ${ARCH}

    echo "Deploying sleep demo ..."
    "${SCRIPT_DIR}/install-sleep-demo.sh" -c kubectl -in ${ISTIO_NAMESPACE}
  fi

  if [ -v "${GATEWAY_HOST}" ]; then
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

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    echo "Deleting sleep demo ..."
    "${SCRIPT_DIR}/install-sleep-demo.sh" --delete-sleep true
    echo "Deleting bookinfo demo ..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" --delete-bookinfo true
    echo "Deleting error rates demo ..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh" --delete true
  else
    echo "Deleting sleep demo ..."
    "${SCRIPT_DIR}/install-sleep-demo.sh" --delete-sleep true -c kubectl
    echo "Deleting bookinfo demo..."
    "${SCRIPT_DIR}/install-bookinfo-demo.sh" --delete-bookinfo true -c kubectl
    echo "Deleting error rates demo..."
    "${SCRIPT_DIR}/install-error-rates-demo.sh" --delete true -c kubectl
  fi
fi
