#/bin/bash

##############################################################################
# k8s-minikube.sh
#
# This script can be used to help run Kubernetes via minikube.
# The typical order of commands used is the following:
#   up - starts the Kubernetes cluster via minikube
#   istio - installs Istio using Kiali's install hack script
#   docker - shows what is needed to put images in minikube's docker daemon
#   (at this point, you can install Kiali into your Kubernetes environment)
#   dashboard - shows the Kubernetes GUI console
#   port-forward - forward a local port to the Kiali server
#   ingress - shows the Ingress URL which can get you to the Kiali GUI
#   bookinfo - installs bookinfo demo into your cluster
#   down - shuts down the Kubernetes cluster, you can start it up again
#   delete - if you don't want your cluster anymore, this deletes it
#
##############################################################################

DEFAULT_K8S_CPU="4"
DEFAULT_K8S_DISK="40g"
DEFAULT_K8S_DRIVER="virtualbox"
DEFAULT_K8S_MEMORY="16384"
DEFAULT_K8S_VERSION="v1.14.2"

debug() {
  if [ "$_VERBOSE" == "true" ]; then
    echo "DEBUG: $1"
  fi
}

ensure_minikube_is_running() {
  if ! minikube status > /dev/null 2>&1 ; then
    echo 'Minikube must be running in order to continue. Aborting.'
    exit 1
  fi
}

get_gateway_url() {
  if [ "$1" == "" ] ; then
    INGRESS_PORT="<port>"
  else
    jsonpath="{.spec.ports[?(@.name==\"$1\")].nodePort}"
    INGRESS_PORT=$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath=${jsonpath})
  fi

  INGRESS_HOST=$(minikube ip)
  GATEWAY_URL=$INGRESS_HOST:${INGRESS_PORT:-?}
}

print_all_gateway_urls() {
  echo "Gateway URLs for all known ports are:"
  allnames=$(kubectl -n istio-system get service istio-ingressgateway -o jsonpath={.spec.ports['*'].name})
  for n in ${allnames}
  do
    get_gateway_url ${n}
    echo ${n}: ${GATEWAY_URL}
  done
}

# Change to the directory where this script is and set our env
cd "$(dirname "${BASH_SOURCE[0]}")"

_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    up)
      _CMD="up"
      shift
      ;;
    down)
      _CMD="down"
      shift
      ;;
    status)
      _CMD="status"
      shift
      ;;
    delete)
      _CMD="delete"
      shift
      ;;
    docker)
      _CMD="docker"
      shift
      ;;
    dashboard)
      _CMD="dashboard"
      shift
      ;;
    port-forward)
      _CMD="port-forward"
      shift
      ;;
    ingress)
      _CMD="ingress"
      shift
      ;;
    istio)
      _CMD="istio"
      shift
      ;;
    bookinfo)
      _CMD="bookinfo"
      shift
      ;;
    gwurl)
      _CMD="gwurl"
      if [ "$2" != "" ]; then
        _CMD_OPT="$2"
        shift
      fi
      shift
      ;;
    -kc|--kubernetes-cpu)
      K8S_CPU="$2"
      shift;shift
      ;;
    -kd|--kubernetes-disk)
      K8S_DISK="$2"
      shift;shift
      ;;
    -kdr|--kubernetes-driver)
      K8S_DRIVER="$2"
      shift;shift
      ;;
    -km|--kubernetes-memory)
      K8S_MEMORY="$2"
      shift;shift
      ;;
    -kv|--kubernetes-version)
      K8S_VERSION="$2"
      shift;shift
      ;;
    -v|--verbose)
      _VERBOSE=true
      shift
      ;;
    -h|--help)
      cat <<HELPMSG

$0 [option...] command

Valid options:
  -kc|--kubernetes-cpu
      The number of CPUs to give to Kubernetes at startup.
      Only used for the 'up' command.
      Default: ${DEFAULT_K8S_CPU}
  -kd|--kubernetes-disk
      The amount of disk space to give to Kubernetes at startup.
      Only used for the 'up' command.
      Default: ${DEFAULT_K8S_DISK}
  -kdr|--kubernetes-driver
      The hypervisor to use. Examples of valid values: virtualbox, hyperkit, kvm2, none.
      Only used for the 'up' command.
      Default: ${DEFAULT_K8S_DRIVER}
  -km|--kubernetes-memory
      The amount of memory to give to Kubernetes at startup.
      Only used for the 'up' command.
      Default: ${DEFAULT_K8S_MEMORY}
  -kv|--kubernetes-version
      The version of Kubernetes to start.
      Only used for the 'up' command.
      Default: ${DEFAULT_K8S_VERSION}
  -v|--verbose
      Enable logging of debug messages from this script.

The command must be either:
  up:           starts the minikube cluster
  down:         stops the minikube cluster
  status:       gets the status of the minikube cluster
  delete:       completely removes the minikube cluster VM destroying all state
  docker:       information on the minikube docker environment
  dashboard:    enables access to the Kubernetes GUI within minikube
  port-forward: forward a local port to the Kiali server
  ingress:      enables access to the Kubernetes ingress URL within minikube
  istio:        installs Istio into the minikube cluster
  bookinfo:     installs Istio's bookinfo demo (make sure Istio is installed first)
  gwurl [<portName>|'all']:
                displays the Ingress Gateway URL. If a port name is given, the gateway port is also shown.
                If the port name is "all" then all the URLs for all known ports are shown.
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# Prepare some env vars
K8S_CPU=${K8S_CPU:-${DEFAULT_K8S_CPU}}
K8S_DISK=${K8S_DISK:-${DEFAULT_K8S_DISK}}
K8S_DRIVER=${K8S_DRIVER:-${DEFAULT_K8S_DRIVER}}
K8S_VERSION=${K8S_VERSION:-${DEFAULT_K8S_VERSION}}
K8S_MEMORY=${K8S_MEMORY:-${DEFAULT_K8S_MEMORY}}

debug "K8S_CPU=$K8S_CPU"
debug "K8S_DISK=$K8S_DISK"
debug "K8S_DRIVER=$K8S_DRIVER"
debug "K8S_MEMORY=$K8S_MEMORY"
debug "K8S_VERSION=$K8S_VERSION"

# If minikube is not in PATH, abort.
if ! which minikube > /dev/null 2>&1 ; then
  echo 'You do not have minikube installed in your $PATH. Aborting.'
  exit 1
fi

debug "This script is located at $(pwd)"
debug "minikube is located at $(which minikube)"

if [ "$_CMD" = "up" ]; then
  echo 'Starting minikube...'
  minikube start --cpus=${K8S_CPU} --memory=${K8S_MEMORY} --disk-size=${K8S_DISK} --vm-driver=${K8S_DRIVER} --kubernetes-version=${K8S_VERSION}
  echo 'Enabling the ingress addon'
  minikube addons enable ingress

elif [ "$_CMD" = "down" ]; then
  ensure_minikube_is_running
  echo 'Stopping minikube'
  minikube stop

elif [ "$_CMD" = "status" ]; then
  ensure_minikube_is_running
  echo 'Status report for minikube'
  minikube status

elif [ "$_CMD" = "delete" ]; then
  echo 'Deleting the entire minikube VM'
  minikube delete

elif [ "$_CMD" = "dashboard" ]; then
  ensure_minikube_is_running
  echo 'Accessing the Kubernetes console GUI. This runs in foreground, press Control-C to kill it.'
  minikube dashboard

elif [ "$_CMD" = "port-forward" ]; then
  ensure_minikube_is_running
  echo 'Forwarding port 20001 to the Kiali server. This runs in foreground, press Control-C to kill it.'
  echo 'To access Kiali, point your browser to https://localhost:20001/kiali/console'
  kubectl -n istio-system port-forward $(kubectl -n istio-system get pod -l app=kiali -o jsonpath='{.items[0].metadata.name}') 20001:20001

elif [ "$_CMD" = "ingress" ]; then
  ensure_minikube_is_running
  echo 'Accessing the Kubernetes Ingress URL.'
  xdg-open "http://$(minikube ip)"

elif [ "$_CMD" = "istio" ]; then
  ensure_minikube_is_running
  echo 'Installing Istio'
  ./istio/install-istio-via-istioctl.sh -c kubectl

elif [ "$_CMD" = "bookinfo" ]; then
  ensure_minikube_is_running
  echo 'Installing Bookinfo'
  ./istio/install-bookinfo-demo.sh --mongo -tg -c kubectl
  get_gateway_url http2
  echo 'To access the Bookinfo application, access this URL:'
  echo "http://${GATEWAY_URL}/productpage"
  echo 'To push requests into the Bookinfo application, execute this command:'
  echo "watch -n 1 curl -o /dev/null -s -w '%{http_code}' http://${GATEWAY_URL}/productpage"

elif [ "$_CMD" = "gwurl" ]; then
  ensure_minikube_is_running
  if [ "$_CMD_OPT" == "all" ]; then
    print_all_gateway_urls
  else
    get_gateway_url $_CMD_OPT
    echo 'The Gateway URL is:'
    echo "${GATEWAY_URL}"
  fi

elif [ "$_CMD" = "docker" ]; then
  ensure_minikube_is_running
  echo 'Your current minikube docker environment is the following:'
  minikube docker-env
  echo 'Run the above command in your shell before building docker images so your images will go in the minikube docker daemon'

else
  echo "ERROR: Missing required command"
  exit 1
fi
