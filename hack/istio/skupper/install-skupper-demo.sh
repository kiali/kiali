#!/bin/bash

##############################################################################
# install-skupper-demo.sh
#
# This installs two minikube clusters - one with MySQL and Mongo databases
# and one with Istio, Kiali and Bookinfo demo. The Mongo database will
# be accessed over a Skupper virtual application network.
#
##############################################################################

set -eu

errormsg() {
  echo -e "\U0001F6A8 ERROR: ${1}"
}

infomsg() {
  echo -e "\U0001F4C4 ${1}"
}

# Some defaults

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
ROOT_DIR="${SCRIPT_DIR}/../../.."
HACK_SCRIPTS_DIR="${ROOT_DIR}/hack"
OUTPUT_DIR="${ROOT_DIR}/_output"
SKUPPER_EXE="${OUTPUT_DIR}/skupper"
CLIENT_EXE="kubectl"
MONGONS="mongons"
MYSQLNS="mysqlns"
MONGOSKUPPERNS="mongoskupperns"
SKUPPER_TOKEN_FILE="${OUTPUT_DIR}/skupper.token"

# Process command line args

_CMD=""
while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    install)       _CMD="install"          ;shift ;;
    delete)        _CMD="delete"           ;shift ;;
    iprom)         _CMD="iprom"            ;shift ;;
    kui)           _CMD="kui"              ;shift ;;
    smetrics)      _CMD="smetrics"         ;shift ;;
    sprom)         _CMD="sprom"            ;shift ;;
    sstatus)       _CMD="sstatus"          ;shift ;;
    sui)           _CMD="sui"              ;shift ;;
    -c|--client)   CLIENT_EXE="$2"   ;shift;shift ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client <path to k8s client>: The path to your k8s client such as "kubectl".
  -h|--help : This message.

Valid commands:
  install: Installs the demo that consists of two minikube clusters with Istio, Kiali, Bookinfo demo, and Skupper
  delete: Uninstalls the demo by shutting down the two minikube clusters
  iprom: Open a browser window to the Istio Prometheus UI
  kui: Open a browser window to the Kiali UI
  smetrics: Dumps the live metrics from the Skupper metrics endpoint
  sprom: Open a browser window to the Skupper Prometheus UI
  sstatus: Prints the Skupper status for both ends of the pipe
  sui: Open a browser window to the Skupper UI
HELPMSG
      exit 1
      ;;
    *)
      errormsg "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# Make sure we have what we need

[ "${SCRIPT_DIR}" == "" ] && errormsg "Cannot determine the directory where this script is found" && exit 1
[ ! -f "${HACK_SCRIPTS_DIR}/k8s-minikube.sh" ] && errormsg "Missing hack script: ${HACK_SCRIPTS_DIR}/k8s-minikube.sh" && exit 1

if ! which "${CLIENT_EXE}" &> /dev/null ; then
  errormsg "Missing client executable: ${CLIENT_EXE}"
  exit 1
fi
infomsg "Client executable: ${CLIENT_EXE}"

if [ ! -x "${SKUPPER_EXE}" ]; then
  infomsg "Downloading the Skupper binary..."
  curl https://skupper.io/install.sh | TEST_INSTALL_PREFIX="${SCRIPT_DIR}" sh
  mv $(find ${SCRIPT_DIR} -name skupper | tail -n1) ${SKUPPER_EXE}
  rm -rf ${SCRIPT_DIR}/home
fi
infomsg "Skupper binary installed at location: ${SKUPPER_EXE}"
infomsg "Skupper version information:"
${SKUPPER_EXE} version

#
# FUNCTIONS TO DO THE IMPORTANT STUFF
#

# install_basic_demo will install the two minikube clusters, the two databases, Istio, Kiali, and Bookinfo demo.
# It will not install Skupper, so the ratings-v2 app will not work after this function is run because it cannot access Mongo.
# Execute the install_skupper function after this function finishes.
install_basic_demo() {
  if ${HACK_SCRIPTS_DIR}/k8s-minikube.sh --minikube-profile db status &>/dev/null ; then
    errormsg "There appears to already be a minikube cluster running with profile 'db'. Aborting."
    exit 1
  fi
  if ${HACK_SCRIPTS_DIR}/k8s-minikube.sh --minikube-profile istio status &>/dev/null ; then
    errormsg "There appears to already be a minikube cluster running with profile 'istio'. Aborting."
    exit 1
  fi
  [ "$(ls -1d ${OUTPUT_DIR}/istio* 2>/dev/null | wc -l)" != "1" ] && errormsg "You must have one and only one Istio version downloaded in ${OUTPUT_DIR}" && ls -1d ${OUTPUT_DIR}/istio* && exit 1

  infomsg "Installing cluster 'db' ..."
  ${HACK_SCRIPTS_DIR}/k8s-minikube.sh --load-balancer-addrs '70-89' --minikube-profile db --minikube-flags '--network mk-demo' start

  infomsg "Installing cluster 'istio' ..."
  ${HACK_SCRIPTS_DIR}/k8s-minikube.sh --load-balancer-addrs '50-69' --minikube-profile istio --minikube-flags '--network mk-demo' start

  infomsg "Installing Istio ..."
  ${HACK_SCRIPTS_DIR}/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE}

  infomsg "Installing Bookinfo demo ..."
  ${HACK_SCRIPTS_DIR}/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE} --minikube-profile istio --traffic-generator --wait-timeout 5m

  infomsg "Building and Installing Kiali ..."
  make --directory "${ROOT_DIR}" -e CLUSTER_TYPE=minikube -e MINIKUBE_PROFILE=istio ACCESSIBLE_NAMESPACES=bookinfo SERVICE_TYPE=LoadBalancer build build-ui cluster-push operator-create kiali-create

  infomsg "Exposing Prometheus UI via LoadBalancer ..."
  ${CLIENT_EXE} --context istio -n istio-system patch svc prometheus --type=merge --patch '{"spec":{"type":"LoadBalancer"}}'

  infomsg "Installing MySQL in db cluster"
  ${CLIENT_EXE} --context db create ns ${MYSQLNS}
  ${CLIENT_EXE} --context db apply -n ${MYSQLNS} -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-mysql.yaml
  ${CLIENT_EXE} --context db -n ${MYSQLNS} patch svc mysqldb --type=merge --patch '{"spec":{"type":"LoadBalancer"}}'
  MYSQL_IP="$(${CLIENT_EXE} --context db -n ${MYSQLNS} get svc mysqldb -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
  infomsg "MySQL available at IP: ${MYSQL_IP}"

  infomsg "Installing Mongo in db cluster"
  ${CLIENT_EXE} --context db create ns ${MONGONS}
  ${CLIENT_EXE} --context db apply -n ${MONGONS} -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-db.yaml


  infomsg "Creating Istio ServiceEntry resource for MySQL access"
  cat <<EOM | ${CLIENT_EXE} --context istio -n bookinfo apply -f -
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: mysqldb.test
spec:
  addresses:
  - "${MYSQL_IP}"
  endpoints:
  - address: "${MYSQL_IP}"
  hosts:
  - mysqldb.test
  location: MESH_EXTERNAL
  resolution: STATIC
  ports:
  - number: 3306
    name: tcp
    protocol: TCP
EOM

  infomsg "Creating ratings-v2-mysql app and pointing it to the MySQL server in the db cluster"
  ${CLIENT_EXE} --context istio -n bookinfo apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql.yaml
  ${CLIENT_EXE} --context istio -n bookinfo set env deployment/ratings-v2-mysql MYSQL_DB_HOST="${MYSQL_IP}"

  infomsg "Creating ratings-v2 app - this will use Mongo but will not be correctly configured yet"
  ${CLIENT_EXE} --context istio -n bookinfo apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-ratings-v2.yaml
}

# install_skupper will create the Skupper pipe so Bookinfo access talk to the Mongo database on the db cluster.
# This function should only be executed after the install_basic_demo function successfully completes.
install_skupper() {
  infomsg "Creating the Skupper link so Bookinfo can access Mongo"
  rm -f "${SKUPPER_TOKEN_FILE}"
  ${SKUPPER_EXE} --context db -n ${MONGONS} init
  ${CLIENT_EXE} --context istio create namespace ${MONGOSKUPPERNS}
  ${SKUPPER_EXE} --context istio -n ${MONGOSKUPPERNS} init --enable-console --enable-flow-collector
  ${SKUPPER_EXE} --context istio -n ${MONGOSKUPPERNS} token create "${SKUPPER_TOKEN_FILE}"
  ${SKUPPER_EXE} --context db -n ${MONGONS} link create "${SKUPPER_TOKEN_FILE}"
  ${SKUPPER_EXE} --context db -n ${MONGONS} expose deployment/mongodb-v1 --port 27017

  infomsg "Wait for the mongodb-v1 service to be created by Skupper in the istio cluster"
  while ! ${CLIENT_EXE} -n ${MONGOSKUPPERNS} get svc mongodb-v1 &> /dev/null ; do echo -n '.'; sleep 1; done; echo

  SKUPPER_MONGO_IP="$(${CLIENT_EXE} --context istio -n ${MONGOSKUPPERNS} get svc mongodb-v1 -o jsonpath='{.spec.clusterIPs[0]}')"
  infomsg "Mongo IP over the Skupper link: ${SKUPPER_MONGO_IP}"

  infomsg "Configuring Bookinfo ratings-v2 to talk to Mongo over the Skupper link"
  ${CLIENT_EXE} --context istio -n bookinfo set env deployment/ratings-v2 MONGO_DB_URL="mongodb://${SKUPPER_MONGO_IP}:27017/test"

  infomsg "Exposing Skupper Prometheus so its UI can be accessed"
  ${CLIENT_EXE} --context istio -n ${MONGOSKUPPERNS} patch svc skupper-prometheus --type=merge --patch '{"spec":{"type":"LoadBalancer"}}'
}

confirm_cluster_is_up() {
  local cluster_name="${1}"
  if ! ${CLIENT_EXE} --context ${cluster_name} get ns &>/dev/null ; then
    errormsg "Cluster [${cluster_name}] is not up"
    exit 1
  fi
}

# Process the command

if [ "$_CMD" == "install" ]; then

  infomsg "Installing demo!"
  install_basic_demo
  install_skupper

elif [ "$_CMD" == "delete" ]; then

  infomsg "Shutting down db cluster..."
  ${HACK_SCRIPTS_DIR}/k8s-minikube.sh delete --minikube-profile db
  infomsg "Shutting down istio cluster..."
  ${HACK_SCRIPTS_DIR}/k8s-minikube.sh delete --minikube-profile istio

elif [ "$_CMD" == "iprom" ]; then

  confirm_cluster_is_up "istio"
  infomsg "Opening browser tab to the Istio Prometheus UI"
  xdg-open http://$(${CLIENT_EXE} --context istio -n istio-system get svc prometheus -ojsonpath='{.status.loadBalancer.ingress[0].ip}'):9090

elif [ "$_CMD" == "kui" ]; then

  confirm_cluster_is_up "istio"
  infomsg "Opening browser tab to the Kiali UI"
  xdg-open http://$(${CLIENT_EXE} --context istio -n istio-system get svc kiali -ojsonpath='{.status.loadBalancer.ingress[0].ip}'):20001

elif [ "$_CMD" == "smetrics" ]; then

  confirm_cluster_is_up "istio"
  infomsg "Dumping live metrics from the Skupper service controller"
  ${CLIENT_EXE} --context istio exec -it -n ${MONGOSKUPPERNS} -c service-controller deploy/skupper-service-controller -- curl -k https://localhost:8010/api/v1alpha1/metrics/

elif [ "$_CMD" == "sprom" ]; then

  confirm_cluster_is_up "istio"
  infomsg "Opening browser tab to the Skupper Prometheus UI"
  xdg-open http://$(${CLIENT_EXE} --context istio -n ${MONGOSKUPPERNS} get svc skupper-prometheus -ojsonpath='{.status.loadBalancer.ingress[0].ip}'):9090

elif [ "$_CMD" == "sstatus" ]; then

  confirm_cluster_is_up "db"
  infomsg "Status of Skupper link on db cluster:"
  ${SKUPPER_EXE} --context db -n ${MONGONS} link status
  confirm_cluster_is_up "istio"
  infomsg "Status of Skupper link on istio cluster:"
  ${SKUPPER_EXE} --context istio -n ${MONGOSKUPPERNS} link status

elif [ "$_CMD" == "sui" ]; then

  confirm_cluster_is_up "istio"
  USERNAME="admin"
  PASSWORD="$(${CLIENT_EXE} --context istio get secret -n ${MONGOSKUPPERNS} skupper-console-users -ojsonpath={.data.${USERNAME}} | base64 -d)"
  infomsg "Log into the Skupper UI with these credentials: USERNAME=[${USERNAME}], PASSWORD=[${PASSWORD}]"
  xdg-open https://$(${CLIENT_EXE} --context istio -n ${MONGOSKUPPERNS} get svc skupper -ojsonpath='{.status.loadBalancer.ingress[0].ip}'):8010

elif [ "$_CMD" == "" ]; then
  errormsg "You must specify the command to execute. See --help for more details."
else
  errormsg "Invalid command: $_CMD"
fi
