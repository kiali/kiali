#/bin/bash

##############################################################################
# os-minishift.sh
#
# This script can be used to help run OpenShift via minishift.
# The typical order of commands used is the following:
#   up - starts the OpenShift cluster via minishift
#   oc - shows how to put oc in your environment
#   admin - give cluster admin rights to admin user
#   login - log in using the admin credentials
#   istio - installs Istio using Kiali's install hack script
#   docker - shows what is needed to put images in minishift's docker daemon
#   (at this point, you can install Kiali into your OpenShift environment)
#   dashboard - shows the OpenShift GUI console
#   bookinfo - installs bookinfo demo into your cluster
#   down - shuts down the OpenShift cluster, you can start it up again
#   delete - if you don't want your cluster anymore, this deletes it
#   expose - exposes services
#   knative - installs Knative into your cluster
#
##############################################################################

debug() {
  if [ "$_VERBOSE" == "true" ]; then
    echo "DEBUG: $1"
  fi
}

ensure_minishift_is_running() {
  if ! minishift ssh -- ls > /dev/null 2>&1 ; then
    echo 'minishift must be running in order to continue. Aborting.'
    exit 1
  fi

  # put minishift 'oc' in PATH
  get_oc_env
}

get_oc_env() {
  eval $(minishift oc-env)
  debug "Using this 'oc': $(which oc)"
}

oc_login() {
  oc login $(minishift ip):8443 -u admin -p admin
  debug "Currently logged in as: $(oc whoami)"
}

get_gateway_url() {
  if [ "$1" == "" ] ; then
    INGRESS_PORT="<port>"
  else
    jsonpath="{.spec.ports[?(@.name==\"$1\")].nodePort}"
    INGRESS_PORT=$(oc -n istio-system get service istio-ingressgateway -o jsonpath=${jsonpath})
  fi

  INGRESS_HOST=$(minishift ip)
  GATEWAY_URL=$INGRESS_HOST:${INGRESS_PORT:-?}
}

print_all_gateway_urls() {
  echo "Gateway URLs for all known ports are:"
  allnames=$(oc -n istio-system get service istio-ingressgateway -o jsonpath={.spec.ports['*'].name})
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
    oc)
      _CMD="oc"
      shift
      ;;
    dashboard)
      _CMD="dashboard"
      shift
      ;;
    admin)
      _CMD="admin"
      shift
      ;;
    expose)
      _CMD="expose"
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
    knative)
      _CMD="knative"
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
    login)
      _CMD="login"
      shift
      ;;
    -v|--verbose)
      _VERBOSE=true
      shift
      ;;
    -h|--help)
      cat <<HELPMSG

$0 [option...] command

Valid options:
  -v|--verbose
      Enable logging of debug messages from this script.

The command must be either:
  up:        starts the minishift cluster
  down:      stops the minishift cluster
  status:    gets the status of the minishift cluster
  delete:    completely removes the minishift cluster VM destroying all state
  docker:    information on the minishift docker environment
  oc:        information on the minishift oc environment
  dashboard: enables access to the OpenShift GUI within minishift
  ingress:   enables access to the OpenShift ingress URL within minishift
  admin:     gives cluster admin rights to admin user
  expose:    exposes some Istio services
  istio:     installs Istio into the minishift cluster
  bookinfo:  installs Istio's bookinfo demo (make sure Istio is installed first)
  login:     logs into OpenShift using admin credentials
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

# If minishift is not in PATH, abort.
if ! which minishift > /dev/null 2>&1 ; then
  echo 'You do not have minishift installed in your $PATH. Aborting.'
  exit 1
fi

debug "This script is located at $(pwd)"
debug "minishift is located at $(which minishift)"

debug "Setting the minishift profile to 'kialihack'"
minishift profile set kialihack

if [ "$_CMD" = "up" ]; then
  echo 'Configurating Minishift and enabling addons'
  minishift config set disk-size 40GB
  minishift config set memory 8GB
  minishift config set cpus 3
  minishift config set vm-driver virtualbox
  minishift config set image-caching true
  minishift addon enable admin-user
  minishift addon enable anyuid
  minishift addon enable admissions-webhook
  minishift config set openshift-version v3.11.0

  echo 'Starting minishift with 8gig RAM and 40gig disk space (disk space for docker images)'
  minishift start

elif [ "$_CMD" = "down" ]; then
  ensure_minishift_is_running
  echo 'Stopping minishift'
  minishift stop

elif [ "$_CMD" = "status" ]; then
  ensure_minishift_is_running
  echo 'Status report for minishift'
  minishift status

elif [ "$_CMD" = "delete" ]; then
  echo 'Deleting the entire minishift VM'
  minishift delete

elif [ "$_CMD" = "admin" ]; then
  echo 'Giving cluster admin rights to admin user'
  ensure_minishift_is_running
  oc login -u system:admin
  oc adm policy add-cluster-role-to-user cluster-admin admin
  # log in via the admin user now that it has cluster admin rights
  oc_login

elif [ "$_CMD" = "expose" ]; then
  ensure_minishift_is_running
  oc_login
  echo 'Exposing Services'
  oc expose svc prometheus -n istio-system
  oc expose svc tracing -n istio-system
  oc expose svc grafana -n istio-system

  # display all the routes we created
  oc get routes -n istio-system

elif [ "$_CMD" = "dashboard" ]; then
  ensure_minishift_is_running
  echo 'Accessing the OpenShift console GUI.'
  minishift dashboard

elif [ "$_CMD" = "ingress" ]; then
  ensure_minishift_is_running
  echo 'Accessing the OpenShift Ingress URL.'
  xdg-open "http://$(minishift ip)"

elif [ "$_CMD" = "istio" ]; then
  ensure_minishift_is_running
  oc_login
  echo 'Installing Istio'
  ./istio/install-istio-kiali-via-helm.sh -ud true -c oc

elif [ "$_CMD" = "bookinfo" ]; then
  ensure_minishift_is_running
  oc_login
  echo 'Installing Bookinfo'
  ./istio/install-bookinfo-demo.sh --mongo -tg -c oc
  get_gateway_url http2
  echo 'To access the Bookinfo application, access this URL:'
  echo "http://${GATEWAY_URL}/productpage"
  echo 'To push requests into the Bookinfo application, execute this command:'
  echo "watch -n 1 curl -o /dev/null -s -w '%{http_code}' http://${GATEWAY_URL}/productpage"

elif [ "$_CMD" = "gwurl" ]; then
  ensure_minishift_is_running
  oc_login
  if [ "$_CMD_OPT" == "all" ]; then
    print_all_gateway_urls
  else
    get_gateway_url $_CMD_OPT
    echo 'The Gateway URL is:'
    echo "${GATEWAY_URL}"
  fi

elif [ "$_CMD" = "docker" ]; then
  ensure_minishift_is_running
  echo 'Your current minishift docker environment is the following:'
  minishift docker-env
  echo 'Run the above command in your shell before building docker images so your images will go in the minishift docker daemon'

elif [ "$_CMD" = "oc" ]; then
  ensure_minishift_is_running
  echo 'Your current minishift oc environment is the following:'
  minishift oc-env
  echo 'Run the above command in your shell to obtain the minishift oc command in your PATH'

elif [ "$_CMD" = "login" ]; then
  ensure_minishift_is_running
  oc_login

elif [ "$_CMD" = "knative" ]; then
  ensure_minishift_is_running
  oc_login

  echo 'Configuring necessary privileges to the service accounts used by Knative'
  oc adm policy add-scc-to-user anyuid -z controller -n knative-serving
  oc adm policy add-scc-to-user anyuid -z autoscaler -n knative-serving
  oc adm policy add-cluster-role-to-user cluster-admin -z controller -n knative-serving

  echo 'Installing Knative Serving'
  oc apply -f https://github.com/knative/serving/releases/download/v0.4.1/serving.yaml
  oc apply -f https://raw.githubusercontent.com/knative/serving/v0.4.1/third_party/config/build/clusterrole.yaml

  echo "Waiting for Knative to become ready"
  sleep 5; while oc get pods -n knative-serving | grep -v -E "(Running|Completed|STATUS)"; do sleep 5; done

  echo "Knative is installed!"

  echo "Creating a new project for knative examples"
  oc new-project knative-examples || true

  echo "Applying default domain to knative pods"

  oc expose svc istio-ingressgateway -n istio-system || true
  export DOMAIN=$(oc get route -n istio-system istio-ingressgateway --output=custom-columns=ROUTE:.spec.host | grep -v ROUTE | sed "s/istio-ingressgateway-istio-system.//g")
  cat ./knative/config-domain.yaml | envsubst | oc apply -f -

  echo "Using domain: *.knative.${DOMAIN}"

  oc adm policy add-scc-to-user privileged -z default -n knative-examples
  oc label --overwrite namespace knative-examples istio-injection=enabled

  echo "Installing a sample application for knative..."
  oc delete -n knative-examples -f ./knative/service.yaml || true
  oc apply -n knative-examples -f ./knative/service.yaml
else
  echo "ERROR: Missing required command"
  exit 1
fi
