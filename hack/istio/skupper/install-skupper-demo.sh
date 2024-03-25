#!/bin/bash

##############################################################################
# install-skupper-demo.sh
#
# This installs a Istio-Skupper demo. The demo will consist of 2 clusters
# (either minikube or OpenShift). In cluster #1 (the "istio" cluster),
# this script will install an Istio control plane, Kiali, and Bookinfo demo.
# In cluster #2 (the "db" cluster), this script will install
# two databases - MySQL and Mongo. Finally, the script will prepare
# a Skupper virtual application network (what we will call a "pipe") between
# the two clusters allowing the "istio" cluster to communicate with the
# Mongo database over that pipe. The MySQL database will be exposed externally
# using a LoadBalancer (if on minikube) and the NodePort (if on OpenShift).
#
# If you are using minikube, this script will start 2 minikube clusters.
# If you are using OpenShift, you are responsible for starting the two
# clusters and telling this script how to connect to those clusters
# (see the --openshift1-X and --openshift2-X command line options).
#
##############################################################################

set -eu

errormsg() {
  echo -e "\U0001F6A8 ERROR: ${1}"
}

infomsg() {
  echo -e "\U0001F4C4 ${1}"
}

# the two cluster names - cluster #1 is "istio" and cluster #2 is "db".

CLUSTER1_ISTIO="istio"
CLUSTER2_DB="db"

# Some defaults

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
ROOT_DIR="${SCRIPT_DIR}/../../.."
OUTPUT_DIR="${ROOT_DIR}/_output"

CLIENT_EXE="kubectl"
CLUSTER_TYPE="minikube"
HACK_SCRIPTS_DIR="${ROOT_DIR}/hack"
KIALI_DEV_BUILD="true"
KIALI_VERSION="dev"
MONGONS="mongons"
MONGOSKUPPERNS="mongoskupperns"
MYSQLNS="mysqlns"
OPENSHIFT1_API=""
OPENSHIFT1_USERNAME="kiali"
OPENSHIFT1_PASSWORD="kiali"
OPENSHIFT2_API=""
OPENSHIFT2_USERNAME="kiali"
OPENSHIFT2_PASSWORD="kiali"
SKUPPER_EXE="${OUTPUT_DIR}/skupper"
SKUPPER_TOKEN_FILE="${OUTPUT_DIR}/skupper.token"
VALIDATE_ENVIRONMENT="true"

# Process command line args

_CMD=""
while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    install)                  _CMD="install"                       ;shift ;;
    delete)                   _CMD="delete"                        ;shift ;;
    iprom)                    _CMD="iprom"                         ;shift ;;
    kui)                      _CMD="kui"                           ;shift ;;
    smetrics)                 _CMD="smetrics"                      ;shift ;;
    sprom)                    _CMD="sprom"                         ;shift ;;
    sstatus)                  _CMD="sstatus"                       ;shift ;;
    sui)                      _CMD="sui"                           ;shift ;;
    -c|--client)              CLIENT_EXE="$2"                ;shift;shift ;;
    -ct|--cluster-type)       CLUSTER_TYPE="$2"              ;shift;shift ;;
    -kdb|--kiali-dev-build)   KIALI_DEV_BUILD="$2"           ;shift;shift ;;
    -kv|--kiali-version)      KIALI_VERSION="$2"             ;shift;shift ;;
    -os1a|--openshift1-api)   OPENSHIFT1_API="$2"            ;shift;shift ;;
    -os1u|--openshift1-user)  OPENSHIFT1_USERNAME="$2"       ;shift;shift ;;
    -os1p|--openshift1-pass)  OPENSHIFT1_PASSWORD="$2"       ;shift;shift ;;
    -os2a|--openshift2-api)   OPENSHIFT2_API="$2"            ;shift;shift ;;
    -os2u|--openshift2-user)  OPENSHIFT2_USERNAME="$2"       ;shift;shift ;;
    -os2p|--openshift2-pass)  OPENSHIFT2_PASSWORD="$2"       ;shift;shift ;;
    -ve|--validate-env)       VALIDATE_ENVIRONMENT="$2"      ;shift;shift ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client <path to k8s client>: The path to your k8s client such as "kubectl".
  -ct|--cluster-type <minikube|openshift>: The type of cluster to use.
                                           If "minikube", this script creates its own clusters.
                                           If "openshift", the clusters must be started already.
                                           Default: "minikube"
  -kdb|--kiali-dev-build [true|false]: If "true" and --kiali-version is "dev", a dev image will be
                                       built. If "false" and --kiali-version is "dev", you must
                                       have previously built a dev image prior to running this script.
                                       This option is ignored if --kiali-version is not "dev".
                                       Default: "true"
  -kv|--kiali-version <version>: The version of Kiali Server to install. If "dev", then the locally
                                 built dev image will be pushed and installed. The dev image will be
                                 locally built via make unless --kiali-dev-build is "false".
                                 If this value is not "dev" then helm will be used to install that
                                 version of Kiali (e.g. "v1.79.0").
                                 Default: "dev"
  -os1a|--openshift1-api <api URL>: The URL to the first OpenShift API server.
  -os1u|--openshift1-user <username>: The username of the user for the first OpenShift cluster. (default: kiali)
  -os1p|--openshift1-pass <password>: The password of the user for the first OpenShift cluster. (default: kiali)
  -os2a|--openshift2-api <api URL>: The URL to the second OpenShift API server.
  -os2u|--openshift2-user <username>: The username of the user for the second OpenShift cluster. (default: kiali)
  -os2p|--openshift2-pass <password>: The password of the user for the second OpenShift cluster. (default: kiali)
  -ve|--validate-env <true|false>: if true, check that the environment has everything we need. Set this to false
                                   to speed up initialization of the script at the expense of not being able to
                                   fail-fast on obvious errors (default: true)
  -h|--help : This message.

Valid commands:
  install: Installs the demo that consists of Istio, Kiali, Bookinfo demo, and Skupper.
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

#
# FUNCTIONS TO DO THE IMPORTANT STUFF
#

# download_istio will download the latest version of Istio if there are no Istio downloads.
# This will exit if more than one Istio versions are already downloaded - you must have no more than 1.
download_istio() {
  if [ "$(ls -1d ${OUTPUT_DIR}/istio* 2>/dev/null | wc -l)" == "0" ]; then
    ${HACK_SCRIPTS_DIR}/istio/download-istio.sh
  fi
  if [ "$(ls -1d ${OUTPUT_DIR}/istio* 2>/dev/null | wc -l)" != "1" ]; then
    errormsg "You must have one and only one Istio version downloaded in ${OUTPUT_DIR}"
    ls -1d ${OUTPUT_DIR}/istio*
    exit 1
  fi
}

# minikube_install_basic_demo will install the two minikube clusters, the two databases, Istio, Kiali, and Bookinfo demo.
# It will not install Skupper, so the ratings-v2 app will not work after this function is run because it cannot access Mongo.
# Execute the minikube_install_skupper function after this function finishes.
minikube_install_basic_demo() {
  if ${HACK_SCRIPTS_DIR}/k8s-minikube.sh --minikube-profile ${CLUSTER2_DB} status &>/dev/null ; then
    errormsg "There appears to already be a minikube cluster running with profile [${CLUSTER2_DB}]. Aborting."
    exit 1
  fi
  if ${HACK_SCRIPTS_DIR}/k8s-minikube.sh --minikube-profile ${CLUSTER1_ISTIO} status &>/dev/null ; then
    errormsg "There appears to already be a minikube cluster running with profile [${CLUSTER1_ISTIO}]. Aborting."
    exit 1
  fi

  download_istio

  infomsg "Installing cluster [${CLUSTER2_DB}] ..."
  ${HACK_SCRIPTS_DIR}/k8s-minikube.sh --load-balancer-addrs '70-89' --minikube-profile ${CLUSTER2_DB} --minikube-flags '--network mk-demo' start

  infomsg "Installing cluster [${CLUSTER1_ISTIO}] ..."
  ${HACK_SCRIPTS_DIR}/k8s-minikube.sh --load-balancer-addrs '50-69' --minikube-profile ${CLUSTER1_ISTIO} --minikube-flags '--network mk-demo' start

  infomsg "Installing Istio ..."
  ${HACK_SCRIPTS_DIR}/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE}

  infomsg "Installing Bookinfo demo ..."
  ${HACK_SCRIPTS_DIR}/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE} --minikube-profile ${CLUSTER1_ISTIO} --traffic-generator --wait-timeout 5m

  if [ "${KIALI_VERSION}" == "dev" ]; then
    infomsg "Installing Kiali ..."
    if [ "${KIALI_DEV_BUILD}" == "true" ]; then
      local make_build_targets="build build-ui"
    fi
    make --directory "${ROOT_DIR}" -e OC="$(which ${CLIENT_EXE})" -e CLUSTER_TYPE=minikube -e MINIKUBE_PROFILE=${CLUSTER1_ISTIO} ACCESSIBLE_NAMESPACES=bookinfo SERVICE_TYPE=LoadBalancer ${make_build_targets:-} cluster-push operator-create kiali-create
  else
    infomsg "Installing Kiali [${KIALI_VERSION}] via Helm ..."
    if ! helm repo update kiali 2> /dev/null; then
      helm repo add kiali https://kiali.org/helm-charts
    fi
    helm --kube-context ${CLUSTER1_ISTIO} upgrade --install --namespace istio-system --version ${KIALI_VERSION} --set auth.strategy=anonymous kiali-server kiali/kiali-server
  fi

  infomsg "Exposing Prometheus UI via LoadBalancer ..."
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n istio-system patch svc prometheus --type=merge --patch '{"spec":{"type":"LoadBalancer"}}'

  infomsg "Installing MySQL in [${CLUSTER2_DB}] cluster"
  ${CLIENT_EXE} --context ${CLUSTER2_DB} create namespace ${MYSQLNS}
  ${CLIENT_EXE} --context ${CLUSTER2_DB} -n ${MYSQLNS} apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-mysql.yaml
  ${CLIENT_EXE} --context ${CLUSTER2_DB} -n ${MYSQLNS} patch svc mysqldb --type=merge --patch '{"spec":{"type":"LoadBalancer"}}'
  MYSQL_IP="$(${CLIENT_EXE} --context ${CLUSTER2_DB} -n ${MYSQLNS} get svc mysqldb -o jsonpath='{.status.loadBalancer.ingress[0].ip}')"
  infomsg "MySQL available at IP: ${MYSQL_IP}"

  infomsg "Installing Mongo in [${CLUSTER2_DB}] cluster"
  ${CLIENT_EXE} --context ${CLUSTER2_DB} create namespace ${MONGONS}
  ${CLIENT_EXE} --context ${CLUSTER2_DB} -n ${MONGONS} apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-db.yaml

  infomsg "Creating Istio ServiceEntry resource for MySQL access"
  cat <<EOM | ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n bookinfo apply -f -
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

  infomsg "Creating ratings-v2-mysql app and pointing it to the MySQL server in the [${CLUSTER2_DB}] cluster"
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n bookinfo apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql.yaml
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n bookinfo set env deployment/ratings-v2-mysql MYSQL_DB_HOST="${MYSQL_IP}"

  infomsg "Creating ratings-v2 app - this will use Mongo but will not be correctly configured yet"
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n bookinfo apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-ratings-v2.yaml
}

# minikube_install_skupper will create the Skupper pipe so Bookinfo access talk to the Mongo database on the db cluster.
# This function should only be executed after the minikube_install_basic_demo function successfully completes.
minikube_install_skupper() {
  infomsg "Creating the Skupper link so Bookinfo can access Mongo"
  rm -f "${SKUPPER_TOKEN_FILE}"
  ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${MONGONS} init
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} create namespace ${MONGOSKUPPERNS}
  ${SKUPPER_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} init --enable-console --enable-flow-collector
  ${SKUPPER_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} token create "${SKUPPER_TOKEN_FILE}"
  ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${MONGONS} link create "${SKUPPER_TOKEN_FILE}"
  ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${MONGONS} expose deployment/mongodb-v1 --port 27017

  infomsg "Wait for the mongodb-v1 service to be created by Skupper in the [${CLUSTER1_ISTIO}] cluster"
  while ! ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} get svc mongodb-v1 &> /dev/null ; do echo -n '.'; sleep 1; done; echo

  SKUPPER_MONGO_IP="$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} get svc mongodb-v1 -o jsonpath='{.spec.clusterIPs[0]}')"
  infomsg "Mongo IP over the Skupper link: ${SKUPPER_MONGO_IP}"

  infomsg "Configuring Bookinfo ratings-v2 to talk to Mongo over the Skupper link"
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n bookinfo set env deployment/ratings-v2 MONGO_DB_URL="mongodb://${SKUPPER_MONGO_IP}:27017/test"

  infomsg "Exposing Skupper Prometheus so its UI can be accessed"
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} patch svc skupper-prometheus --type=merge --patch '{"spec":{"type":"LoadBalancer"}}'
}

# openshift_install_basic_demo will install the two databases, Istio, Kiali, and Bookinfo demo in the two existing OpenShift clusters.
# It will not install Skupper, so the ratings-v2 app will not work after this function is run because it cannot access Mongo.
# Execute the openshift_install_skupper function after this function finishes.
openshift_install_basic_demo() {

  download_istio

  # LOGIN TO CLUSTER 1
  openshift_login ${CLUSTER1_ISTIO}

  infomsg "Installing Istio ..."
  ${HACK_SCRIPTS_DIR}/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE}

  infomsg "Installing Bookinfo demo ..."
  ${HACK_SCRIPTS_DIR}/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE} --traffic-generator --wait-timeout 5m

  infomsg "Logging into the image registry..."
  eval $(make --directory "${ROOT_DIR}" -e OC="$(which ${CLIENT_EXE})" -e CLUSTER_TYPE=openshift cluster-status | grep "Image Registry login:" | sed 's/Image Registry login: \(.*\)$/\1/')

  if [ "${KIALI_VERSION}" == "dev" ]; then
    infomsg "Installing Kiali ..."
    if [ "${KIALI_DEV_BUILD}" == "true" ]; then
      local make_build_targets="build build-ui"
    fi
    make --directory "${ROOT_DIR}" -e OC="$(which ${CLIENT_EXE})" -e CLUSTER_TYPE=openshift ACCESSIBLE_NAMESPACES=bookinfo ${make_build_targets:-} cluster-push operator-create kiali-create
  else
    infomsg "Installing Kiali [${KIALI_VERSION}] via Helm ..."
    if ! helm repo update kiali 2> /dev/null; then
      helm repo add kiali https://kiali.org/helm-charts
    fi
    helm upgrade --install --namespace istio-system --version ${KIALI_VERSION} --set auth.strategy=anonymous kiali-server kiali/kiali-server
  fi


  infomsg "Exposing Prometheus UI via Route ..."
  ${CLIENT_EXE} -n istio-system expose svc prometheus

  # LOGIN TO CLUSTER 2
  openshift_login ${CLUSTER2_DB}

  infomsg "Installing MySQL in [${CLUSTER2_DB}] cluster"
  ${CLIENT_EXE} create namespace ${MYSQLNS}
  ${CLIENT_EXE} -n ${MYSQLNS} apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-mysql.yaml
  ${CLIENT_EXE} -n ${MYSQLNS} patch svc mysqldb --type=merge --patch '{"spec":{"type":"NodePort"}}'
  MYSQL_NODENAME="$(${CLIENT_EXE} -n ${MYSQLNS} get pod -l app=mysqldb -o jsonpath='{..spec.nodeName}')"
  NODE_HOSTNAME="$(${CLIENT_EXE} get node ${MYSQL_NODENAME} -o jsonpath='{..metadata.labels.kubernetes\.io/hostname}')"
  MYSQL_IP="$(getent hosts ${NODE_HOSTNAME} | awk '{print $1}')"
  MYSQL_PORT="$(${CLIENT_EXE} -n ${MYSQLNS} get svc mysqldb -o jsonpath='{.spec.ports[0].nodePort}')"
  infomsg "MySQL available at nodeIP:nodePort: ${MYSQL_IP}:${MYSQL_PORT}"

  infomsg "Installing Mongo in [${CLUSTER2_DB}] cluster"
  ${CLIENT_EXE} create namespace ${MONGONS}
  ${CLIENT_EXE} -n ${MONGONS} apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-db.yaml

  # LOGIN TO CLUSTER 1
  openshift_login ${CLUSTER1_ISTIO}

  infomsg "Creating Istio ServiceEntry resource for MySQL access"
  cat <<EOM | ${CLIENT_EXE} -n bookinfo apply -f -
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
  - number: ${MYSQL_PORT}
    name: tcp
    protocol: TCP
EOM

  infomsg "Creating ratings-v2-mysql app and pointing it to the MySQL server in the [${CLUSTER2_DB}] cluster"
  ${CLIENT_EXE} -n bookinfo apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql.yaml
  ${CLIENT_EXE} -n bookinfo set env deployment/ratings-v2-mysql MYSQL_DB_HOST="${MYSQL_IP}" MYSQL_DB_PORT="${MYSQL_PORT}"

  infomsg "Creating ratings-v2 app - this will use Mongo but will not be correctly configured yet"
  ${CLIENT_EXE} -n bookinfo apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-ratings-v2.yaml
}

# openshift_install_skupper will create the Skupper pipe so Bookinfo access talk to the Mongo database on the db cluster.
# This function should only be executed after the openshift_install_basic_demo function successfully completes.
openshift_install_skupper() {
  infomsg "Creating the Skupper link so Bookinfo can access Mongo"
  rm -f "${SKUPPER_TOKEN_FILE}"

  # LOGIN TO CLUSTER 2
  openshift_login ${CLUSTER2_DB}

  ${SKUPPER_EXE} -n ${MONGONS} init

  # LOGIN TO CLUSTER 1
  openshift_login ${CLUSTER1_ISTIO}

  ${CLIENT_EXE} create namespace ${MONGOSKUPPERNS}
  ${SKUPPER_EXE} -n ${MONGOSKUPPERNS} init --enable-console --enable-flow-collector
  ${SKUPPER_EXE} -n ${MONGOSKUPPERNS} token create "${SKUPPER_TOKEN_FILE}"

  # LOGIN TO CLUSTER 2
  openshift_login ${CLUSTER2_DB}

  ${SKUPPER_EXE} -n ${MONGONS} link create "${SKUPPER_TOKEN_FILE}"
  ${SKUPPER_EXE} -n ${MONGONS} expose deployment/mongodb-v1 --port 27017

  # LOGIN TO CLUSTER 1
  openshift_login ${CLUSTER1_ISTIO}

  infomsg "Wait for the mongodb-v1 service to be created by Skupper in the [${CLUSTER1_ISTIO}] cluster"
  while ! ${CLIENT_EXE} -n ${MONGOSKUPPERNS} get svc mongodb-v1 &> /dev/null ; do echo -n '.'; sleep 1; done; echo

  SKUPPER_MONGO_IP="$(${CLIENT_EXE} -n ${MONGOSKUPPERNS} get svc mongodb-v1 -o jsonpath='{.spec.clusterIPs[0]}')"
  infomsg "Mongo IP over the Skupper link: ${SKUPPER_MONGO_IP}"

  infomsg "Configuring Bookinfo ratings-v2 to talk to Mongo over the Skupper link"
  ${CLIENT_EXE} -n bookinfo set env deployment/ratings-v2 MONGO_DB_URL="mongodb://${SKUPPER_MONGO_IP}:27017/test"

  infomsg "Exposing Skupper Prometheus so its UI can be accessed"
  ${CLIENT_EXE} -n ${MONGOSKUPPERNS} expose svc skupper-prometheus
}

confirm_cluster_is_up() {
  local cluster_name="${1}"

  case ${CLUSTER_TYPE} in
    minikube)
      if ! ${CLIENT_EXE} --context ${cluster_name} get namespace &>/dev/null ; then
        errormsg "Cluster [${cluster_name}] is not up"
        exit 1
      fi
      ;;
    openshift)
      openshift_login "${cluster_name}"
      ;;
    *)
      errormsg "Invalid cluster type - cannot confirm cluster is up"
      exit 1
      ;;
  esac
}

openshift_login() {
  local cluster_name="${1}"
  case ${cluster_name} in
    ${CLUSTER1_ISTIO})
      if ! ${CLIENT_EXE} login --server "${OPENSHIFT1_API}" -u "${OPENSHIFT1_USERNAME}" -p "${OPENSHIFT1_PASSWORD}" &> /dev/null ; then
        errormsg "Cannot log into OpenShift cluster #1 [${OPENSHIFT1_API}]. Make sure the credentials for user [${OPENSHIFT1_USERNAME}] is correct."
        exit 1
      fi
      if ! (${CLIENT_EXE} whoami --show-server | grep -q ${OPENSHIFT1_API}); then
        errormsg "The login did not seem to work: [$(${CLIENT_EXE} whoami --show-server)] does not seem to be cluster #1 [${OPENSHIFT1_API}]"
        exit 1
      fi
      ;;
    ${CLUSTER2_DB})
      if ! ${CLIENT_EXE} login --server "${OPENSHIFT2_API}" -u "${OPENSHIFT2_USERNAME}" -p "${OPENSHIFT2_PASSWORD}" &> /dev/null ; then
        errormsg "Cannot log into OpenShift cluster #2 [${OPENSHIFT2_API}]. Make sure the credentials for user [${OPENSHIFT2_USERNAME}] is correct."
        exit 1
      fi
      if ! (${CLIENT_EXE} whoami --show-server | grep -q ${OPENSHIFT2_API}); then
        errormsg "The login did not seem to work: [$(${CLIENT_EXE} whoami --show-server)] does not seem to be cluster #2 [${OPENSHIFT2_API}]"
        exit 1
      fi
      ;;
    *)
      errormsg "Invalid cluster name [${cluster_name}]. Aborting."
      exit 1
  esac
  infomsg "Logged into cluster [${cluster_name}]"
}

open_browser() {
  local url=${1}
  infomsg "URL: ${url}"
  xdg-open ${url}
}

# Make sure we have what we need

[ "${SCRIPT_DIR}" == "" ] && errormsg "Cannot determine the directory where this script is found" && exit 1
[ "${CLUSTER_TYPE}" != "openshift" -a "${CLUSTER_TYPE}" != "minikube" ] && errormsg "[${CLUSTER_TYPE}] is an invalid cluster type. --cluster-type must be one of: minikube, openshift " && exit 1

if [ "${VALIDATE_ENVIRONMENT}" == "true" ]; then
  if ! which "${CLIENT_EXE}" &> /dev/null ; then
    errormsg "Missing client executable: ${CLIENT_EXE}"
    exit 1
  fi
  infomsg "Client executable: ${CLIENT_EXE}"

  if [ "${OPENSHIFT1_API}" != "" -o "${OPENSHIFT2_API}" != "" ]; then
    [ "${OPENSHIFT1_API}" == "" ] && errormsg "You specified the OpenShift cluster #2 but not #1. Check the command line arguments you passed in." && exit 1
    [ "${OPENSHIFT2_API}" == "" ] && errormsg "You specified the OpenShift cluster #1 but not #2. Check the command line arguments you passed in." && exit 1
    if [ "${CLUSTER_TYPE}" != "openshift" ]; then
      errormsg "You specified OpenShift API URLs but did not specify --cluster-type=openshift" && exit 1
    fi
    if [[ ! "${CLIENT_EXE}" = *"oc" ]]; then
     errormsg "--cluster-type is 'openshift' but the --client [${CLIENT_EXE}] is not referring to 'oc'."
     exit 1
    fi
  fi

  if [ "${CLUSTER_TYPE}" == "openshift" ]; then
    if [ "${OPENSHIFT1_API}" == "" -o "${OPENSHIFT2_API}" == "" ]; then
      errormsg "You did not provide the OpenShift API URL for both cluster #1 [${OPENSHIFT1_API}] and cluster #2 [${OPENSHIFT2_API}]".
      exit 1
    fi
    confirm_cluster_is_up "${CLUSTER1_ISTIO}"
    confirm_cluster_is_up "${CLUSTER2_DB}"
  elif [ "${CLUSTER_TYPE}" == "minikube" ]; then
    [ ! -f "${HACK_SCRIPTS_DIR}/k8s-minikube.sh" ] && errormsg "Missing hack script: ${HACK_SCRIPTS_DIR}/k8s-minikube.sh" && exit 1
  fi

  if [ ! -x "${SKUPPER_EXE}" ]; then
    infomsg "Downloading the Skupper binary..."
    curl https://skupper.io/install.sh | TEST_INSTALL_PREFIX="${SCRIPT_DIR}" sh
    mv $(find ${SCRIPT_DIR} -name skupper | tail -n1) ${SKUPPER_EXE}
    rm -rf ${SCRIPT_DIR}/home
  fi
  infomsg "Skupper binary installed at location: ${SKUPPER_EXE}"
  infomsg "Skupper version information:"
  ${SKUPPER_EXE} version
fi

# Process the command

if [ "$_CMD" == "install" ]; then

  case ${CLUSTER_TYPE} in
    minikube)
      infomsg "Installing demo on minikube"
      minikube_install_basic_demo
      minikube_install_skupper
      ;;

    openshift)
      infomsg "Installing demo on OpenShift"
      openshift_install_basic_demo
      openshift_install_skupper
      ;;

    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

  infomsg "Installation complete"

elif [ "$_CMD" == "delete" ]; then

  case ${CLUSTER_TYPE} in
    minikube)
      infomsg "Shutting down [${CLUSTER2_DB}] cluster..."
      ${HACK_SCRIPTS_DIR}/k8s-minikube.sh delete --minikube-profile ${CLUSTER2_DB}
      infomsg "Shutting down [${CLUSTER1_ISTIO}] cluster..."
      ${HACK_SCRIPTS_DIR}/k8s-minikube.sh delete --minikube-profile ${CLUSTER1_ISTIO}
      ;;

    openshift)
      # LOGIN TO CLUSTER 1
      openshift_login ${CLUSTER1_ISTIO}

      infomsg "Uninstalling Kiali ..."
      make --directory "${ROOT_DIR}" -e OC="$(which ${CLIENT_EXE})" -e CLUSTER_TYPE=openshift operator-delete

      infomsg "Uninstalling Bookinfo demo ..."
      ${CLIENT_EXE} get namespace bookinfo && ${HACK_SCRIPTS_DIR}/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE} --delete-bookinfo true
      infomsg "Uninstalling Istio ..."
      ${CLIENT_EXE} get namespace istio-system && ${HACK_SCRIPTS_DIR}/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE} --delete-istio true
      infomsg "Uninstalling Skupper pipe ..."
      ${CLIENT_EXE} get namespace ${MONGOSKUPPERNS} && ${CLIENT_EXE} delete namespace ${MONGOSKUPPERNS}

      # LOGIN TO CLUSTER 2
      openshift_login ${CLUSTER2_DB}

      infomsg "Uninstalling the databases ..."
      ${CLIENT_EXE} get namespace ${MYSQLNS} && ${CLIENT_EXE} delete namespace ${MYSQLNS}
      ${CLIENT_EXE} get namespace ${MONGONS} && ${CLIENT_EXE} delete namespace ${MONGONS}
      ;;

    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

  infomsg "Deletion complete"

elif [ "$_CMD" == "iprom" ]; then

  confirm_cluster_is_up "${CLUSTER1_ISTIO}"
  infomsg "Opening browser tab to the Istio Prometheus UI"

  case ${CLUSTER_TYPE} in
    minikube) open_browser http://$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n istio-system get svc prometheus -ojsonpath='{.status.loadBalancer.ingress[0].ip}'):9090 ;;
    openshift) open_browser http://$(${CLIENT_EXE} -n istio-system get route prometheus -ojsonpath='{.spec.host}') ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

elif [ "$_CMD" == "kui" ]; then

  confirm_cluster_is_up "${CLUSTER1_ISTIO}"
  infomsg "Opening browser tab to the Kiali UI"

  case ${CLUSTER_TYPE} in
    minikube) open_browser http://$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n istio-system get svc kiali -ojsonpath='{.status.loadBalancer.ingress[0].ip}'):20001 ;;
    openshift) open_browser http://$(${CLIENT_EXE} -n istio-system get route kiali -ojsonpath='{.spec.host}') ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

elif [ "$_CMD" == "smetrics" ]; then

  confirm_cluster_is_up "${CLUSTER1_ISTIO}"
  infomsg "Dumping live metrics from the Skupper service controller"

  case ${CLUSTER_TYPE} in
    minikube) ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} exec -it -n ${MONGOSKUPPERNS} -c service-controller deploy/skupper-service-controller -- curl -k https://localhost:8010/api/v1alpha1/metrics/ ;;
    openshift) ${CLIENT_EXE} exec -it -n ${MONGOSKUPPERNS} -c service-controller deploy/skupper-service-controller -- curl -k https://localhost:8010/api/v1alpha1/metrics/ ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

elif [ "$_CMD" == "sprom" ]; then

  confirm_cluster_is_up "${CLUSTER1_ISTIO}"
  infomsg "Opening browser tab to the Skupper Prometheus UI"

  case ${CLUSTER_TYPE} in
    minikube) open_browser http://$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} get svc skupper-prometheus -ojsonpath='{.status.loadBalancer.ingress[0].ip}'):9090 ;;
    openshift) open_browser http://$(${CLIENT_EXE} -n ${MONGOSKUPPERNS} get route skupper-prometheus -ojsonpath='{.spec.host}') ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

elif [ "$_CMD" == "sstatus" ]; then

  confirm_cluster_is_up "${CLUSTER2_DB}"
  infomsg "Status of Skupper link on [${CLUSTER2_DB}] cluster:"

  case ${CLUSTER_TYPE} in
    minikube) ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${MONGONS} link status ;;
    openshift) ${SKUPPER_EXE} -n ${MONGONS} link status ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

  confirm_cluster_is_up "${CLUSTER1_ISTIO}"
  infomsg "Status of Skupper link on [${CLUSTER1_ISTIO}] cluster:"

  case ${CLUSTER_TYPE} in
    minikube) ${SKUPPER_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} link status ;;
    openshift) ${SKUPPER_EXE} -n ${MONGOSKUPPERNS} link status ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

elif [ "$_CMD" == "sui" ]; then

  confirm_cluster_is_up "${CLUSTER1_ISTIO}"
  USERNAME="admin"

  case ${CLUSTER_TYPE} in
    minikube)
      PASSWORD="$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} get secret -n ${MONGOSKUPPERNS} skupper-console-users -ojsonpath={.data.${USERNAME}} | base64 -d)"
      open_browser https://$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} get svc skupper -ojsonpath='{.status.loadBalancer.ingress[0].ip}'):8010 ;;
    openshift)
      PASSWORD="$(${CLIENT_EXE} get secret -n ${MONGOSKUPPERNS} skupper-console-users -ojsonpath={.data.${USERNAME}} | base64 -d)"
      open_browser https://$(${CLIENT_EXE} -n ${MONGOSKUPPERNS} get route skupper -ojsonpath='{.spec.host}') ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

  infomsg "Log into the Skupper UI with these credentials: USERNAME=[${USERNAME}], PASSWORD=[${PASSWORD}]"

elif [ "$_CMD" == "" ]; then
  errormsg "You must specify the command to execute. See --help for more details."
else
  errormsg "Invalid command: $_CMD"
fi
