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
# As an extra option, you can ask this script to install the basic Skupper
# demo that we will call the east-west demo (see: https://skupper.io/start/).
# Cluster #1 will be "west" and cluster #2 will be "east". All west components
# will be put into the mesh unless you pass in the value "partial" for the
# --east-west-demo option. In that case, the Skupper components themselves
# will not be placed into the mesh; only the frontend app will be in the mesh.
# You can manually take the Skupper components out of the mesh and put them back
# in the mesh by setting the sidecar label to true or false; e.g.:
#   for d in skupper-prometheus skupper-router skupper-service-controller; do
#     kubectl -n west patch deployment $d --type=json -p='[{"op": "add", "path": "/spec/template/metadata/labels/sidecar.istio.io~1inject", "value": "false"}]'
#   done
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

NAMESPACE_WEST="west"
NAMESPACE_EAST="east"

# Some defaults

SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
ROOT_DIR="${SCRIPT_DIR}/../../.."
OUTPUT_DIR="${ROOT_DIR}/_output"

CLIENT_EXE="kubectl"
CLUSTER_TYPE="minikube"
DELETE_MINIKUBE="true"
HACK_SCRIPTS_DIR="${ROOT_DIR}/hack"
INSTALL_EAST_WEST_DEMO="no"
KIALI_DEV_BUILD="true"
KIALI_VERSION="dev"
MONGONS="mongons"
MONGOSKUPPERNS="mongoskupperns"
MYSQLNS="mysqlns"
MYSQLSKUPPERNS="mysqlskupperns"
OPENSHIFT1_API=""
OPENSHIFT1_USERNAME="kiali"
OPENSHIFT1_PASSWORD="kiali"
OPENSHIFT2_API=""
OPENSHIFT2_USERNAME="kiali"
OPENSHIFT2_PASSWORD="kiali"
SINGLE_ROUTER="false"
SKUPPER_EXE="${OUTPUT_DIR}/skupper"
SKUPPER_TOKEN_FILE_MONGO="${OUTPUT_DIR}/skupper-mongo.token"
SKUPPER_TOKEN_FILE_MYSQL="${OUTPUT_DIR}/skupper-mysql.token"
SKUPPER_TOKEN_FILE_EW="${OUTPUT_DIR}/skupper-eastwest.token"
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
    bui)                      _CMD="bui"                           ;shift ;;
    smetricsmongo)            _CMD="smetricsmongo"                 ;shift ;;
    smetricsmysql)            _CMD="smetricsmysql"                 ;shift ;;
    sprommongo)               _CMD="sprommongo"                    ;shift ;;
    sprommysql)               _CMD="sprommysql"                    ;shift ;;
    sstatus)                  _CMD="sstatus"                       ;shift ;;
    suimongo)                 _CMD="suimongo"                      ;shift ;;
    suimysql)                 _CMD="suimysql"                      ;shift ;;
    -c|--client)              CLIENT_EXE="$2"                ;shift;shift ;;
    -ct|--cluster-type)       CLUSTER_TYPE="$2"              ;shift;shift ;;
    -dm|--delete-minikube)    DELETE_MINIKUBE="$2"           ;shift;shift ;;
    -ewd|--east-west-demo)    INSTALL_EAST_WEST_DEMO="$2"    ;shift;shift ;;
    -kdb|--kiali-dev-build)   KIALI_DEV_BUILD="$2"           ;shift;shift ;;
    -kv|--kiali-version)      KIALI_VERSION="$2"             ;shift;shift ;;
    -os1a|--openshift1-api)   OPENSHIFT1_API="$2"            ;shift;shift ;;
    -os1u|--openshift1-user)  OPENSHIFT1_USERNAME="$2"       ;shift;shift ;;
    -os1p|--openshift1-pass)  OPENSHIFT1_PASSWORD="$2"       ;shift;shift ;;
    -os2a|--openshift2-api)   OPENSHIFT2_API="$2"            ;shift;shift ;;
    -os2u|--openshift2-user)  OPENSHIFT2_USERNAME="$2"       ;shift;shift ;;
    -os2p|--openshift2-pass)  OPENSHIFT2_PASSWORD="$2"       ;shift;shift ;;
    -sr|--single-router)      SINGLE_ROUTER="$2"             ;shift;shift ;;
    -ve|--validate-env)       VALIDATE_ENVIRONMENT="$2"      ;shift;shift ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client <path to k8s client>: The path to your k8s client such as "kubectl".
  -ct|--cluster-type <minikube|openshift>: The type of cluster to use.
                                           If "minikube", this script creates its own clusters.
                                           If "openshift", the clusters must be started already.
                                           Default: "minikube"
  -dm|--delete-minikube <true|false>: If true and you are using minikube, the minikube clusters will
                                      be deleted completely. If false, only the things this script
                                      installs will be deleted but the minikube clusters will be left running.
                                      This option is only used with the delete command.
                                      Default: true
  -ewd|--east-west-demo [yes|no|partial]: The east-west demo is the basic Skupper demo. See: https://skupper.io/start/
                                          If this value is "no", the east-west demo will not be installed.
                                          If this value is "yes", the east-west demo will be installed and all
                                          components will be placed into the mesh, including all Skupper components.
                                          If this value is "partial", the east-west demo is installed, however,
                                          only the west cluster "frontend" app is injected into the mesh;
                                          the Skupper components will be installed but will not be part of the mesh.
                                          Default: "no"
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
  -sr|--single-router <true|false>: If true, there will be one router to supply access to both databases.
                                    If false, there will be two routers - one for each database (mongo and mysql).
                                    Default: false
  -ve|--validate-env <true|false>: if true, check that the environment has everything we need. Set this to false
                                   to speed up initialization of the script at the expense of not being able to
                                   fail-fast on obvious errors (default: true)
  -h|--help : This message.

Valid commands:
  install: Installs the Istio/Kiali/Bookinfo/Skupper demo (and optionally the east-west demo)
  delete: Uninstalls the demo by shutting down the two minikube clusters or removing resources from OpenShift
  iprom: Open a browser window to the Istio Prometheus UI
  kui: Open a browser window to the Kiali UI
  bui: Open a browser window to the Bookinfo UI
  smetricsmongo: Dumps the live metrics from the Mongo Skupper metrics endpoint
  smetricsmysql: Dumps the live metrics from the MySQL Skupper metrics endpoint
  sprommongo: Open a browser window to the Skupper Prometheus UI with the Mongo metrics
  sprommysql: Open a browser window to the Skupper Prometheus UI with the MySQL metrics
  sstatus: Prints the Skupper status for both ends of the pipe
  suimongo: Open a browser window to the Mongo Skupper UI
  suimysql: Open a browser window to the MySQL Skupper UI
HELPMSG
      exit 1
      ;;
    *)
      errormsg "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# SET SOME VARIABLES BASED ON COMMAND LINE OPTIONS

if [ "${SINGLE_ROUTER}" == "true" ]; then
  # there will only be one router to be placed in a single namespace on each end of the pipe - both mongo and mysql will be in that single namespace
  MONGONS="database"
  MYSQLNS="database"
  MONGOSKUPPERNS="skupperns"
  MYSQLSKUPPERNS="skupperns"
fi

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
# It will not install Skupper, so the ratings apps will not work after this function is run because it cannot access the databases.
# Execute the minikube_install_skupper function after this function finishes.
minikube_install_basic_demo() {

  download_istio

  if ${HACK_SCRIPTS_DIR}/k8s-minikube.sh --minikube-profile ${CLUSTER2_DB} status &>/dev/null ; then
    infomsg "There appears to already be a minikube cluster running with profile [${CLUSTER2_DB}]. It will be used."
    ${CLIENT_EXE} config use-context ${CLUSTER2_DB}
  else
    infomsg "Installing cluster [${CLUSTER2_DB}] ..."
    ${HACK_SCRIPTS_DIR}/k8s-minikube.sh --load-balancer-addrs '70-89' --minikube-profile ${CLUSTER2_DB} --minikube-flags '--network mk-demo' start
  fi

  if ${HACK_SCRIPTS_DIR}/k8s-minikube.sh --minikube-profile ${CLUSTER1_ISTIO} status &>/dev/null ; then
    infomsg "There appears to already be a minikube cluster running with profile [${CLUSTER1_ISTIO}]. It will be used."
    ${CLIENT_EXE} config use-context ${CLUSTER1_ISTIO}
  else
    infomsg "Installing cluster [${CLUSTER1_ISTIO}] ..."
    ${HACK_SCRIPTS_DIR}/k8s-minikube.sh --load-balancer-addrs '50-69' --minikube-profile ${CLUSTER1_ISTIO} --minikube-flags '--network mk-demo' start
  fi

  infomsg "Installing Istio ..."
  ${HACK_SCRIPTS_DIR}/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE} -s values.meshConfig.outboundTrafficPolicy.mode=REGISTRY_ONLY

  infomsg "Installing Bookinfo demo ..."
  ${HACK_SCRIPTS_DIR}/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE} --minikube-profile ${CLUSTER1_ISTIO} --traffic-generator --wait-timeout 5m

  infomsg "Updating Bookinfo traffic-generator route ..."
  ${CLIENT_EXE} patch configmap traffic-generator-config -n bookinfo --type merge -p '{"data":{"route":"http://productpage:9080/productpage"}}'
  infomsg "Restarting Bookinfo traffic-generator pod ..."
  ${CLIENT_EXE} delete pod -n bookinfo -l app=kiali-traffic-generator

  if [ "${KIALI_VERSION}" == "dev" ]; then
    infomsg "Installing Kiali ..."
    if [ "${KIALI_DEV_BUILD}" == "true" ]; then
      local make_build_targets="build build-ui"
    fi
    make --directory "${ROOT_DIR}" -e OC="$(which ${CLIENT_EXE})" CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${CLUSTER1_ISTIO} SERVICE_TYPE=LoadBalancer ${make_build_targets:-} cluster-push operator-create kiali-create
  else
    infomsg "Installing Kiali [${KIALI_VERSION}] via Helm ..."
    if ! helm repo update kiali 2> /dev/null; then
      helm repo add kiali https://kiali.org/helm-charts
    fi
    helm --kube-context ${CLUSTER1_ISTIO} upgrade --install --namespace istio-system --version ${KIALI_VERSION} --set auth.strategy=anonymous --set deployment.service_type=LoadBalancer kiali-server kiali/kiali-server
  fi

  infomsg "Exposing Prometheus UI via LoadBalancer ..."
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n istio-system patch svc prometheus --type=merge --patch '{"spec":{"type":"LoadBalancer"}}'

  infomsg "Exposing Bookinfo UI via LoadBalancer ..."
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n bookinfo patch svc productpage --type=merge --patch '{"spec":{"type":"LoadBalancer"}}'

  infomsg "Installing MySQL in [${CLUSTER2_DB}] cluster"
  ${CLIENT_EXE} --context ${CLUSTER2_DB} get namespace ${MYSQLNS} 2>/dev/null || ${CLIENT_EXE} --context ${CLUSTER2_DB} create namespace ${MYSQLNS}
  ${CLIENT_EXE} --context ${CLUSTER2_DB} -n ${MYSQLNS} apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-mysql.yaml

  infomsg "Installing Mongo in [${CLUSTER2_DB}] cluster"
  ${CLIENT_EXE} --context ${CLUSTER2_DB} get namespace ${MONGONS} 2>/dev/null || ${CLIENT_EXE} --context ${CLUSTER2_DB} create namespace ${MONGONS}
  ${CLIENT_EXE} --context ${CLUSTER2_DB} -n ${MONGONS} apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-db.yaml

  infomsg "Creating ratings-v2-mysql app - this will use MySQL but will not be correctly configured yet"
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n bookinfo apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql.yaml

  infomsg "Creating ratings-v2 app - this will use Mongo but will not be correctly configured yet"
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n bookinfo apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-ratings-v2.yaml
}

# minikube_install_skupper will create the Skupper pipe so Bookinfo access talk to the databases on the db cluster.
# This function should only be executed after the minikube_install_basic_demo function successfully completes.
minikube_install_skupper() {
  # create a link to Mongo
  infomsg "Creating the Skupper link so Bookinfo can access Mongo"
  rm -f "${SKUPPER_TOKEN_FILE_MONGO}"
  ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${MONGONS} init
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} get namespace ${MONGOSKUPPERNS} 2>/dev/null || ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} create namespace ${MONGOSKUPPERNS}
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} label namespace ${MONGOSKUPPERNS} istio-injection=enabled --overwrite
  ${SKUPPER_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} init --enable-console --enable-flow-collector
  ${SKUPPER_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} token create "${SKUPPER_TOKEN_FILE_MONGO}"
  # skupper link will connect both ends of the pipe (the skupper-routers on each end of the pipe will be "linked")
  ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${MONGONS} link create "${SKUPPER_TOKEN_FILE_MONGO}"
  # skupper expose sets up a service on the client side pipe to mimic the service-side service; you can expose multiple services per router
  ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${MONGONS} expose deployment/mongodb-v1 --port 27017
  infomsg "Wait for the mongodb-v1 service to be created by Skupper in the [${CLUSTER1_ISTIO}] cluster"
  while ! ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} get svc mongodb-v1 &> /dev/null ; do echo -n '.'; sleep 1; done; echo
  SKUPPER_MONGO_IP="$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} get svc mongodb-v1 -o jsonpath='{.spec.clusterIPs[0]}')"
  infomsg "Mongo IP over the Skupper link: ${SKUPPER_MONGO_IP}"
  infomsg "Configuring Bookinfo ratings-v2 to talk to Mongo over the Skupper link"
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n bookinfo set env deployment/ratings-v2 MONGO_DB_URL="mongodb://${SKUPPER_MONGO_IP}:27017/test"
  infomsg "Exposing Mongo Skupper Prometheus so its UI can be accessed"
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} patch svc skupper-prometheus --type=merge --patch '{"spec":{"type":"LoadBalancer"}}'

  # create a link to MySQL
  infomsg "Creating the Skupper link so Bookinfo can access MySQL"
  # we only have to init a second router if we were told not to have a single router
  if [ "${SINGLE_ROUTER}" != "true" ]; then
    rm -f "${SKUPPER_TOKEN_FILE_MYSQL}"
    ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${MYSQLNS} init
    ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} get namespace ${MYSQLSKUPPERNS} 2>/dev/null || ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} create namespace ${MYSQLSKUPPERNS}
    ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} label namespace ${MYSQLSKUPPERNS} istio-injection=enabled --overwrite
    ${SKUPPER_EXE} --context ${CLUSTER1_ISTIO} -n ${MYSQLSKUPPERNS} init --enable-console --enable-flow-collector
    ${SKUPPER_EXE} --context ${CLUSTER1_ISTIO} -n ${MYSQLSKUPPERNS} token create "${SKUPPER_TOKEN_FILE_MYSQL}"
    # skupper link will connect both ends of the pipe (the skupper-routers on each end of the pipe will be "linked")
    ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${MYSQLNS} link create "${SKUPPER_TOKEN_FILE_MYSQL}"
  fi
  # skupper expose sets up a service on the client side pipe to mimic the service-side service; you can expose multiple services per router
  ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${MYSQLNS} expose deployment/mysqldb-v1 --port 3306
  infomsg "Wait for the mysqldb-v1 service to be created by Skupper in the [${CLUSTER1_ISTIO}] cluster"
  while ! ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${MYSQLSKUPPERNS} get svc mysqldb-v1 &> /dev/null ; do echo -n '.'; sleep 1; done; echo
  SKUPPER_MYSQL_IP="$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${MYSQLSKUPPERNS} get svc mysqldb-v1 -o jsonpath='{.spec.clusterIPs[0]}')"
  infomsg "MySQL IP over the Skupper link: ${SKUPPER_MYSQL_IP}"
  infomsg "Configuring Bookinfo ratings-v2-mysql to talk to MySQL over the Skupper link"
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n bookinfo set env deployment/ratings-v2-mysql MYSQL_DB_HOST="${SKUPPER_MYSQL_IP}"
  infomsg "Exposing MySQL Skupper Prometheus so its UI can be accessed"
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${MYSQLSKUPPERNS} patch svc skupper-prometheus --type=merge --patch '{"spec":{"type":"LoadBalancer"}}'

  # Get all deployments with the specified label, and patch them with another app label
  local deployments=$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} get deployments -l "app.kubernetes.io/name=skupper-router" --all-namespaces -o jsonpath='{range .items[*]}{.metadata.namespace}:{.metadata.name}{"\n"}{end}')
  for d in $deployments; do
    local _ns="$(echo $d | cut -d: -f1)"
    local _n="$(echo $d | cut -d: -f2)"
    ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} patch deployment ${_n} -n ${_ns} -p '{"spec":{"template":{"metadata":{"labels":{"app": "skupper-router"}}}}}'
    infomsg "Label added to deployment: ${d}"
  done
}

# openshift_install_basic_demo will install the two databases, Istio, Kiali, and Bookinfo demo in the two existing OpenShift clusters.
# It will not install Skupper, so the ratings apps will not work after this function is run because it cannot access the databases.
# Execute the openshift_install_skupper function after this function finishes.
openshift_install_basic_demo() {

  download_istio

  # LOGIN TO CLUSTER 1
  openshift_login ${CLUSTER1_ISTIO}

  infomsg "Installing Istio ..."
  ${HACK_SCRIPTS_DIR}/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE} -s values.meshConfig.outboundTrafficPolicy.mode=REGISTRY_ONLY

  infomsg "Installing Bookinfo demo ..."
  ${HACK_SCRIPTS_DIR}/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE} --traffic-generator --wait-timeout 5m

  infomsg "Updating Bookinfo traffic-generator route ..."
  ${CLIENT_EXE} patch configmap traffic-generator-config -n bookinfo --type merge -p '{"data":{"route":"http://productpage:9080/productpage"}}'
  infomsg "Restarting Bookinfo traffic-generator pod ..."
  ${CLIENT_EXE} delete pod -n bookinfo -l app=kiali-traffic-generator

  infomsg "Logging into the image registry..."
  eval $(make --directory "${ROOT_DIR}" -e OC="$(which ${CLIENT_EXE})" CLUSTER_TYPE=openshift cluster-status | grep "Image Registry login:" | sed 's/Image Registry login: \(.*\)$/\1/')

  if [ "${KIALI_VERSION}" == "dev" ]; then
    infomsg "Installing Kiali ..."
    if [ "${KIALI_DEV_BUILD}" == "true" ]; then
      local make_build_targets="build build-ui"
    fi
    make --directory "${ROOT_DIR}" -e OC="$(which ${CLIENT_EXE})" CLUSTER_TYPE=openshift ${make_build_targets:-} cluster-push operator-create kiali-create
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
  ${CLIENT_EXE} get namespace ${MYSQLNS} 2>/dev/null || ${CLIENT_EXE} create namespace ${MYSQLNS}
  ${CLIENT_EXE} -n ${MYSQLNS} apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-mysql.yaml

  infomsg "Installing Mongo in [${CLUSTER2_DB}] cluster"
  ${CLIENT_EXE} get namespace ${MONGONS} 2>/dev/null || ${CLIENT_EXE} create namespace ${MONGONS}
  ${CLIENT_EXE} -n ${MONGONS} apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-db.yaml

  # LOGIN TO CLUSTER 1
  openshift_login ${CLUSTER1_ISTIO}

  infomsg "Creating ratings-v2-mysql app - this will use MySQL but will not be correctly configured yet"
  ${CLIENT_EXE} -n bookinfo apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-ratings-v2-mysql.yaml

  infomsg "Creating ratings-v2 app - this will use Mongo but will not be correctly configured yet"
  ${CLIENT_EXE} -n bookinfo apply -f ${OUTPUT_DIR}/istio-*/samples/bookinfo/platform/kube/bookinfo-ratings-v2.yaml
}

# openshift_install_skupper will create the Skupper pipe so Bookinfo access talk to the databases on the db cluster.
# This function should only be executed after the openshift_install_basic_demo function successfully completes.
openshift_install_skupper() {
  # create a link to Mongo
  infomsg "Creating the Skupper link so Bookinfo can access Mongo"
  rm -f "${SKUPPER_TOKEN_FILE_MONGO}"
  # LOGIN TO CLUSTER 2
  openshift_login ${CLUSTER2_DB}
  ${SKUPPER_EXE} -n ${MONGONS} init
  # LOGIN TO CLUSTER 1
  openshift_login ${CLUSTER1_ISTIO}
  ${CLIENT_EXE} get namespace ${MONGOSKUPPERNS} 2>/dev/null || ${CLIENT_EXE} create namespace ${MONGOSKUPPERNS}
  # TODO: RIGHT NOW SKUPPER DOES NOT WORK IN OPENSHIFT WHEN INSIDE THE MESH
  ${CLIENT_EXE} label namespace ${MONGOSKUPPERNS} istio-injection=disabled --overwrite
  ${SKUPPER_EXE} -n ${MONGOSKUPPERNS} init --enable-console --enable-flow-collector
  ${SKUPPER_EXE} -n ${MONGOSKUPPERNS} token create "${SKUPPER_TOKEN_FILE_MONGO}"
  # LOGIN TO CLUSTER 2
  openshift_login ${CLUSTER2_DB}
  # skupper link will connect both ends of the pipe (the skupper-routers on each end of the pipe will be "linked")
  ${SKUPPER_EXE} -n ${MONGONS} link create "${SKUPPER_TOKEN_FILE_MONGO}"
  # skupper expose sets up a service on the client side pipe to mimic the service-side service; you can expose multiple services per router
  ${SKUPPER_EXE} -n ${MONGONS} expose deployment/mongodb-v1 --port 27017
  # LOGIN TO CLUSTER 1
  openshift_login ${CLUSTER1_ISTIO}
  infomsg "Wait for the mongodb-v1 service to be created by Skupper in the [${CLUSTER1_ISTIO}] cluster"
  while ! ${CLIENT_EXE} -n ${MONGOSKUPPERNS} get svc mongodb-v1 &> /dev/null ; do echo -n '.'; sleep 1; done; echo
  SKUPPER_MONGO_IP="$(${CLIENT_EXE} -n ${MONGOSKUPPERNS} get svc mongodb-v1 -o jsonpath='{.spec.clusterIPs[0]}')"
  infomsg "Mongo IP over the Skupper link: ${SKUPPER_MONGO_IP}"
  infomsg "Configuring Bookinfo ratings-v2 to talk to Mongo over the Skupper link"
  ${CLIENT_EXE} -n bookinfo set env deployment/ratings-v2 MONGO_DB_URL="mongodb://${SKUPPER_MONGO_IP}:27017/test"
  infomsg "Exposing Mongo Skupper Prometheus so its UI can be accessed"
  ${CLIENT_EXE} -n ${MONGOSKUPPERNS} expose svc skupper-prometheus

  # create a link to MySQL
  infomsg "Creating the Skupper link so Bookinfo can access MySQL"
  # we only have to init a second router if we were told not to have a single router
  if [ "${SINGLE_ROUTER}" != "true" ]; then
    rm -f "${SKUPPER_TOKEN_FILE_MYSQL}"
    # LOGIN TO CLUSTER 2
    openshift_login ${CLUSTER2_DB}
    ${SKUPPER_EXE} -n ${MYSQLNS} init
    # LOGIN TO CLUSTER 1
    openshift_login ${CLUSTER1_ISTIO}
    ${CLIENT_EXE} get namespace ${MYSQLSKUPPERNS} 2>/dev/null || ${CLIENT_EXE} create namespace ${MYSQLSKUPPERNS}
    # TODO: RIGHT NOW SKUPPER DOES NOT WORK IN OPENSHIFT WHEN INSIDE THE MESH
    ${CLIENT_EXE} label namespace ${MYSQLSKUPPERNS} istio-injection=disabled --overwrite
    ${SKUPPER_EXE} -n ${MYSQLSKUPPERNS} init --enable-console --enable-flow-collector
    ${SKUPPER_EXE} -n ${MYSQLSKUPPERNS} token create "${SKUPPER_TOKEN_FILE_MYSQL}"
    # LOGIN TO CLUSTER 2
    openshift_login ${CLUSTER2_DB}
    # skupper link will connect both ends of the pipe (the skupper-routers on each end of the pipe will be "linked")
    ${SKUPPER_EXE} -n ${MYSQLNS} link create "${SKUPPER_TOKEN_FILE_MYSQL}"
  else
    # LOGIN TO CLUSTER 2
    openshift_login ${CLUSTER2_DB}
  fi
  # skupper expose sets up a service on the client side pipe to mimic the service-side service; you can expose multiple services per router
  ${SKUPPER_EXE} -n ${MYSQLNS} expose deployment/mysqldb-v1 --port 3306
  # LOGIN TO CLUSTER 1
  openshift_login ${CLUSTER1_ISTIO}
  infomsg "Wait for the mysqldb-v1 service to be created by Skupper in the [${CLUSTER1_ISTIO}] cluster"
  while ! ${CLIENT_EXE} -n ${MYSQLSKUPPERNS} get svc mysqldb-v1 &> /dev/null ; do echo -n '.'; sleep 1; done; echo
  SKUPPER_MYSQL_IP="$(${CLIENT_EXE} -n ${MYSQLSKUPPERNS} get svc mysqldb-v1 -o jsonpath='{.spec.clusterIPs[0]}')"
  infomsg "MySQL IP over the Skupper link: ${SKUPPER_MYSQL_IP}"
  infomsg "Configuring Bookinfo ratings-v2-mysql to talk to MySQL over the Skupper link"
  ${CLIENT_EXE} -n bookinfo set env deployment/ratings-v2-mysql MYSQL_DB_HOST="${SKUPPER_MYSQL_IP}"
  infomsg "Exposing MySQL Skupper Prometheus so its UI can be accessed"
  ${CLIENT_EXE} -n ${MYSQLSKUPPERNS} get route skupper-prometheus 2>/dev/null || ${CLIENT_EXE} -n ${MYSQLSKUPPERNS} expose svc skupper-prometheus

  # Get all deployments with the specified label, and patch them with another app label
  local deployments=$(${CLIENT_EXE} get deployments -l "app.kubernetes.io/name=skupper-router" --all-namespaces -o jsonpath='{range .items[*]}{.metadata.namespace}:{.metadata.name}{"\n"}{end}')
  for d in $deployments; do
    local _ns="$(echo $d | cut -d: -f1)"
    local _n="$(echo $d | cut -d: -f2)"
    ${CLIENT_EXE} patch deployment ${_n} -n ${_ns} -p '{"spec":{"template":{"metadata":{"labels":{"app": "skupper-router"}}}}}'
    infomsg "Label added to deployment: ${d}"
  done
}

minikube_install_east_west_demo() {
  infomsg "Installing East-West Demo..."

  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} create namespace ${NAMESPACE_WEST}
  ${CLIENT_EXE} --context ${CLUSTER2_DB} create namespace ${NAMESPACE_EAST}

  ${SKUPPER_EXE} --context ${CLUSTER1_ISTIO} -n ${NAMESPACE_WEST} init --enable-console --enable-flow-collector
  ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${NAMESPACE_EAST} init

  rm -r "${SKUPPER_TOKEN_FILE_EW}"
  ${SKUPPER_EXE} --context ${CLUSTER1_ISTIO} -n ${NAMESPACE_WEST} token create "${SKUPPER_TOKEN_FILE_EW}"
  ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${NAMESPACE_EAST} link create "${SKUPPER_TOKEN_FILE_EW}"

  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${NAMESPACE_WEST} create deployment frontend --image quay.io/skupper/hello-world-frontend
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${NAMESPACE_WEST} patch deployment frontend --type=json -p='[{"op": "add", "path": "/spec/template/metadata/labels/version", "value":"1"}]'
  ${CLIENT_EXE} --context ${CLUSTER2_DB} -n ${NAMESPACE_EAST} create deployment backend --image quay.io/skupper/hello-world-backend --replicas 3
  ${CLIENT_EXE} --context ${CLUSTER2_DB} -n ${NAMESPACE_EAST} patch deployment backend --type=json -p='[{"op": "add", "path": "/spec/template/metadata/labels/version", "value":"1"}]'

  # expose with http protocol
  ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${NAMESPACE_EAST} expose deployment/backend --port 8080 --protocol http
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${NAMESPACE_WEST} expose deployment frontend --port 8080 --type LoadBalancer

  case ${INSTALL_EAST_WEST_DEMO} in
    yes)
      infomsg "East-West Demo is fully deployed in the mesh"
      ;;
    partial)
      for d in skupper-prometheus skupper-router skupper-service-controller; do
        ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${NAMESPACE_WEST} patch deployment $d --type=json -p='[{"op": "add", "path": "/spec/template/metadata/labels/sidecar.istio.io~1inject", "value": "false"}]'
      done
      infomsg "East-West Demo is deployed with frontend app in the mesh, but Skupper components are not in the mesh"
      ;;
    *)
      errormsg "--east-west-demo option is not valid [${INSTALL_EAST_WEST_DEMO}]. Must be one of: yes, no, partial"
      exit 1
      ;;
  esac

  # start injecting sidecars
  infomsg "Adding injection flag to west namespace to add components to the mesh"
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} label namespace ${NAMESPACE_WEST} istio-injection=enabled
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} rollout restart deployment -n ${NAMESPACE_WEST}

  infomsg "Exposing Skupper Prometheus so its UI can be accessed"
  ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${NAMESPACE_WEST} patch svc skupper-prometheus --type=merge --patch '{"spec":{"type":"LoadBalancer"}}'

  infomsg "East-West Demo installed."
}

openshift_install_east_west_demo() {
  infomsg "Installing East-West Demo..."

  openshift_login ${CLUSTER1_ISTIO} && ${CLIENT_EXE} create namespace ${NAMESPACE_WEST}
  openshift_login ${CLUSTER2_DB} && ${CLIENT_EXE} create namespace ${NAMESPACE_EAST}

  openshift_login ${CLUSTER1_ISTIO} && ${SKUPPER_EXE} -n ${NAMESPACE_WEST} init --enable-console --enable-flow-collector
  openshift_login ${CLUSTER2_DB} && ${SKUPPER_EXE} -n ${NAMESPACE_EAST} init

  rm -r "${SKUPPER_TOKEN_FILE_EW}"
  openshift_login ${CLUSTER1_ISTIO} && ${SKUPPER_EXE} -n ${NAMESPACE_WEST} token create "${SKUPPER_TOKEN_FILE_EW}"
  openshift_login ${CLUSTER2_DB} && ${SKUPPER_EXE} -n ${NAMESPACE_EAST} link create "${SKUPPER_TOKEN_FILE_EW}"

  openshift_login ${CLUSTER1_ISTIO} && ${CLIENT_EXE} -n ${NAMESPACE_WEST} create deployment frontend --image quay.io/skupper/hello-world-frontend
  ${CLIENT_EXE} -n ${NAMESPACE_WEST} patch deployment frontend --type=json -p='[{"op": "add", "path": "/spec/template/metadata/labels/version", "value":"1"}]'
  openshift_login ${CLUSTER2_DB} && ${CLIENT_EXE} -n ${NAMESPACE_EAST} create deployment backend --image quay.io/skupper/hello-world-backend --replicas 3
  ${CLIENT_EXE} -n ${NAMESPACE_EAST} patch deployment backend --type=json -p='[{"op": "add", "path": "/spec/template/metadata/labels/version", "value":"1"}]'

  # expose with http protocol - still logged into cluster 2
  ${SKUPPER_EXE} -n ${NAMESPACE_EAST} expose deployment/backend --port 8080 --protocol http

  # switch back to cluster 1 and finish up

  openshift_login ${CLUSTER1_ISTIO}
  ${CLIENT_EXE} -n ${NAMESPACE_WEST} expose deployment frontend --port 8080
  ${CLIENT_EXE} -n ${NAMESPACE_WEST} expose svc frontend

  case ${INSTALL_EAST_WEST_DEMO} in
    yes)
      infomsg "East-West Demo is fully deployed in the mesh"
      ;;
    partial)
      for d in skupper-prometheus skupper-router skupper-service-controller; do
        ${CLIENT_EXE} -n ${NAMESPACE_WEST} patch deployment $d --type=json -p='[{"op": "add", "path": "/spec/template/metadata/labels/sidecar.istio.io~1inject", "value": "false"}]'
      done
      infomsg "East-West Demo is deployed with frontend app in the mesh, but Skupper components are not in the mesh"
      ;;
    *)
      errormsg "--east-west-demo option is not valid [${INSTALL_EAST_WEST_DEMO}]. Must be one of: yes, no, partial"
      exit 1
      ;;
  esac

  # start injecting sidecars
  infomsg "Adding injection flag to west namespace to add components to the mesh"
  ${CLIENT_EXE} label namespace ${NAMESPACE_WEST} istio-injection=enabled
  ${CLIENT_EXE} rollout restart deployment -n ${NAMESPACE_WEST}

  infomsg "Exposing Skupper Prometheus so its UI can be accessed"
  ${CLIENT_EXE} -n ${NAMESPACE_WEST} expose svc skupper-prometheus

  infomsg "East-West Demo installed."
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
      infomsg "Installing Istio/Kiali/Bookinfo demo on minikube"
      minikube_install_basic_demo
      minikube_install_skupper
      if [ "${INSTALL_EAST_WEST_DEMO}" != "no" ]; then
        minikube_install_east_west_demo
      fi
      ;;

    openshift)
      infomsg "Installing Istio/Kiali/Bookinfo demo on OpenShift"
      openshift_install_basic_demo
      openshift_install_skupper
      if [ "${INSTALL_EAST_WEST_DEMO}" != "no" ]; then
        openshift_install_east_west_demo
      fi
      ;;

    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

  infomsg "Installation complete"

elif [ "$_CMD" == "delete" ]; then

  case ${CLUSTER_TYPE} in
    minikube)
      if [ "${DELETE_MINIKUBE}" == "true" ]; then
        infomsg "Will delete both minikube clusters..."
        infomsg "Shutting down [${CLUSTER2_DB}] cluster..."
        ${HACK_SCRIPTS_DIR}/k8s-minikube.sh delete --minikube-profile ${CLUSTER2_DB}
        infomsg "Shutting down [${CLUSTER1_ISTIO}] cluster..."
        ${HACK_SCRIPTS_DIR}/k8s-minikube.sh delete --minikube-profile ${CLUSTER1_ISTIO}
      else
        infomsg "Was told not to delete minikube clusters; installed resources will be deleted but clusters will remain running."

        infomsg "Uninstalling Kiali ..."
        make --directory "${ROOT_DIR}" -e OC="$(which ${CLIENT_EXE})" CLUSTER_TYPE=minikube MINIKUBE_PROFILE=${CLUSTER1_ISTIO} operator-delete

        # ignore any errors while deleting, just try to delete everything
        set +e
        infomsg "Uninstalling Bookinfo demo ..."
        ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} get namespace bookinfo 2>/dev/null && ${HACK_SCRIPTS_DIR}/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE} -mp ${CLUSTER1_ISTIO} --delete-bookinfo true
        infomsg "Uninstalling Istio ..."
        # hack script used to install istio doesn't support telling it which minikube profile to use so just switch context to ensure we talk to the right one
        ${CLIENT_EXE} config use-context ${CLUSTER1_ISTIO}
        ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} get namespace istio-system 2>/dev/null && ${HACK_SCRIPTS_DIR}/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE} --delete-istio true
        infomsg "Uninstalling Mongo Skupper pipe ..."
        ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} get namespace ${MONGOSKUPPERNS} 2>/dev/null && ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} delete namespace ${MONGOSKUPPERNS}
        infomsg "Uninstalling MySQL Skupper pipe ..."
        ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} get namespace ${MYSQLSKUPPERNS} 2>/dev/null && ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} delete namespace ${MYSQLSKUPPERNS}

        infomsg "Uninstalling ${NAMESPACE_WEST} namespace ..."
        ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} get namespace ${NAMESPACE_WEST} 2>/dev/null && ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} delete namespace ${NAMESPACE_WEST}

        infomsg "Uninstalling the databases ..."
        ${CLIENT_EXE} --context ${CLUSTER2_DB} get namespace ${MYSQLNS} 2>/dev/null && ${CLIENT_EXE} --context ${CLUSTER2_DB} delete namespace ${MYSQLNS}
        ${CLIENT_EXE} --context ${CLUSTER2_DB} get namespace ${MONGONS} 2>/dev/null && ${CLIENT_EXE} --context ${CLUSTER2_DB} delete namespace ${MONGONS}

        infomsg "Uninstalling ${NAMESPACE_EAST} namespace ..."
        ${CLIENT_EXE} --context ${CLUSTER2_DB} get namespace ${NAMESPACE_EAST} 2>/dev/null && ${CLIENT_EXE} --context ${CLUSTER2_DB} delete namespace ${NAMESPACE_EAST}
        set -e
      fi
      ;;

    openshift)
      # LOGIN TO CLUSTER 1
      openshift_login ${CLUSTER1_ISTIO}

      infomsg "Uninstalling Kiali ..."
      make --directory "${ROOT_DIR}" -e OC="$(which ${CLIENT_EXE})" CLUSTER_TYPE=openshift operator-delete

      # ignore any errors while deleting, just try to delete everything
      set +e
      infomsg "Uninstalling Bookinfo demo ..."
      ${CLIENT_EXE} get namespace bookinfo 2>/dev/null && ${HACK_SCRIPTS_DIR}/istio/install-bookinfo-demo.sh -c ${CLIENT_EXE} --delete-bookinfo true
      infomsg "Uninstalling Istio ..."
      ${CLIENT_EXE} get namespace istio-system 2>/dev/null && ${HACK_SCRIPTS_DIR}/istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE} --delete-istio true
      infomsg "Uninstalling Mongo Skupper pipe ..."
      ${CLIENT_EXE} get namespace ${MONGOSKUPPERNS} 2>/dev/null && ${CLIENT_EXE} delete namespace ${MONGOSKUPPERNS}
      infomsg "Uninstalling MySQL Skupper pipe ..."
      ${CLIENT_EXE} get namespace ${MYSQLSKUPPERNS} 2>/dev/null && ${CLIENT_EXE} delete namespace ${MYSQLSKUPPERNS}

      infomsg "Uninstalling ${NAMESPACE_WEST} namespace ..."
      ${CLIENT_EXE} get namespace ${NAMESPACE_WEST} 2>/dev/null && ${CLIENT_EXE} delete namespace ${NAMESPACE_WEST}

      # LOGIN TO CLUSTER 2
      openshift_login ${CLUSTER2_DB}

      infomsg "Uninstalling the databases ..."
      ${CLIENT_EXE} get namespace ${MYSQLNS} 2>/dev/null && ${CLIENT_EXE} delete namespace ${MYSQLNS}
      ${CLIENT_EXE} get namespace ${MONGONS} 2>/dev/null && ${CLIENT_EXE} delete namespace ${MONGONS}

      infomsg "Uninstalling ${NAMESPACE_EAST} namespace ..."
      ${CLIENT_EXE} get namespace ${NAMESPACE_EAST} 2>/dev/null && ${CLIENT_EXE} delete namespace ${NAMESPACE_EAST}
      set -e
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

elif [ "$_CMD" == "bui" ]; then

  confirm_cluster_is_up "${CLUSTER1_ISTIO}"
  infomsg "Opening browser tab to the Bookinfo UI"

  case ${CLUSTER_TYPE} in
    minikube) open_browser http://$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n bookinfo get svc productpage -ojsonpath='{.status.loadBalancer.ingress[0].ip}'):9080 ;;
    openshift) open_browser http://$(${CLIENT_EXE} -n bookinfo get route productpage -ojsonpath='{.spec.host}') ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

elif [ "$_CMD" == "smetricsmongo" -o "$_CMD" == "smetricsmysql" ]; then

  case "${_CMD}" in
    smetricsmongo) _skupper_ns="${MONGOSKUPPERNS}" ;;
    smetricsmysql) _skupper_ns="${MYSQLSKUPPERNS}" ;;
  esac

  confirm_cluster_is_up "${CLUSTER1_ISTIO}"
  infomsg "Dumping live metrics from the Skupper service controller"

  case ${CLUSTER_TYPE} in
    minikube) ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} exec -it -n ${_skupper_ns} -c service-controller deploy/skupper-service-controller -- curl -k https://localhost:8010/api/v1alpha1/metrics/ ;;
    openshift) ${CLIENT_EXE} exec -it -n ${_skupper_ns} -c service-controller deploy/skupper-service-controller -- curl -k https://localhost:8010/api/v1alpha1/metrics/ ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

elif [ "$_CMD" == "sprommongo" -o "$_CMD" == "sprommysql" ]; then

  case "${_CMD}" in
    sprommongo) _skupper_ns="${MONGOSKUPPERNS}" ;;
    sprommysql) _skupper_ns="${MYSQLSKUPPERNS}" ;;
  esac

  confirm_cluster_is_up "${CLUSTER1_ISTIO}"
  infomsg "Opening browser tab to the Skupper Prometheus UI found in namespace [${_skupper_ns}]"

  case ${CLUSTER_TYPE} in
    minikube) open_browser http://$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${_skupper_ns} get svc skupper-prometheus -ojsonpath='{.status.loadBalancer.ingress[0].ip}'):9090 ;;
    openshift) open_browser http://$(${CLIENT_EXE} -n ${_skupper_ns} get route skupper-prometheus -ojsonpath='{.spec.host}') ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

elif [ "$_CMD" == "sstatus" ]; then

  skupper_ui_username="admin"

  confirm_cluster_is_up "${CLUSTER2_DB}"
  infomsg "Status of Mongo Skupper link on [${CLUSTER2_DB}] cluster:"

  case ${CLUSTER_TYPE} in
    minikube) ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${MONGONS} link status ;;
    openshift) ${SKUPPER_EXE} -n ${MONGONS} link status ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

  infomsg "Status of MySQL Skupper link on [${CLUSTER2_DB}] cluster:"

  case ${CLUSTER_TYPE} in
    minikube) ${SKUPPER_EXE} --context ${CLUSTER2_DB} -n ${MYSQLNS} link status ;;
    openshift) ${SKUPPER_EXE} -n ${MYSQLNS} link status ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

  confirm_cluster_is_up "${CLUSTER1_ISTIO}"
  infomsg "Status of Mongo Skupper link on [${CLUSTER1_ISTIO}] cluster:"

  case ${CLUSTER_TYPE} in
    minikube) ${SKUPPER_EXE} --context ${CLUSTER1_ISTIO} -n ${MONGOSKUPPERNS} link status ;;
    openshift) ${SKUPPER_EXE} -n ${MONGOSKUPPERNS} link status ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

  infomsg "Status of MySQL Skupper link on [${CLUSTER1_ISTIO}] cluster:"

  case ${CLUSTER_TYPE} in
    minikube) ${SKUPPER_EXE} --context ${CLUSTER1_ISTIO} -n ${MYSQLSKUPPERNS} link status ;;
    openshift) ${SKUPPER_EXE} -n ${MYSQLSKUPPERNS} link status ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

  case ${CLUSTER_TYPE} in
    minikube)
      if ${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${NAMESPACE_WEST} get service/frontend &>/dev/null; then
        east_west_demo_app_ip="$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${NAMESPACE_WEST} get service/frontend -o jsonpath={.status.loadBalancer.ingress[0].ip} 2>/dev/null)"
        east_west_demo_pui="http://$(${CLIENT_EXE} -n ${NAMESPACE_WEST} get svc skupper-prometheus -ojsonpath='{.status.loadBalancer.ingress[0].ip}'):9090"
        east_west_demo_spass="$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} get secret -n ${NAMESPACE_WEST} skupper-console-users -ojsonpath={.data.${skupper_ui_username}} | base64 -d)"
        east_west_demo_sui="https://$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${NAMESPACE_WEST} get svc skupper -ojsonpath='{.status.loadBalancer.ingress[0].ip}'):8010"
      fi
    ;;
    openshift)
      if ${CLIENT_EXE} -n ${NAMESPACE_WEST} get service/frontend &>/dev/null; then
        east_west_demo_app_ip="$(${CLIENT_EXE} -n ${NAMESPACE_WEST} get route frontend -o jsonpath={.spec.host} 2>/dev/null)"
        east_west_demo_pui="http://$(${CLIENT_EXE} -n ${NAMESPACE_WEST} get route skupper-prometheus -ojsonpath='{.spec.host}')"
        east_west_demo_spass="$(${CLIENT_EXE} get secret -n ${NAMESPACE_WEST} skupper-console-users -ojsonpath={.data.${skupper_ui_username}} | base64 -d)"
        east_west_demo_sui="https://$(${CLIENT_EXE} -n ${NAMESPACE_WEST} get route skupper -ojsonpath='{.spec.host}')"
      fi
    ;;
    *) errormsg "Invalid cluster type" && exit 1
    ;;
  esac
  if [ -n "${east_west_demo_app_ip:-}" ]; then
    echo
    [ "${CLUSTER_TYPE}" == "minikube" ] && infomsg "East-West Demo Frontend App: http://${east_west_demo_app_ip}:8080"
    [ "${CLUSTER_TYPE}" == "openshift" ] && infomsg "East-West Demo Frontend App: http://${east_west_demo_app_ip}"
    infomsg "East-West Demo Prometheus UI URL: ${east_west_demo_pui}"
    infomsg "East-West Demo Skupper UI URL (USERNAME=[${skupper_ui_username}], PASSWORD=[${east_west_demo_spass}]): ${east_west_demo_sui}"
  fi

elif [ "$_CMD" == "suimongo" -o "$_CMD" == "suimysql" ]; then

  case "${_CMD}" in
    suimongo) _skupper_ns="${MONGOSKUPPERNS}" ;;
    suimysql) _skupper_ns="${MYSQLSKUPPERNS}" ;;
  esac

  confirm_cluster_is_up "${CLUSTER1_ISTIO}"
  skupper_ui_username="admin"

  case ${CLUSTER_TYPE} in
    minikube)
      PASSWORD="$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} get secret -n ${_skupper_ns} skupper-console-users -ojsonpath={.data.${skupper_ui_username}} | base64 -d)"
      open_browser https://$(${CLIENT_EXE} --context ${CLUSTER1_ISTIO} -n ${_skupper_ns} get svc skupper -ojsonpath='{.status.loadBalancer.ingress[0].ip}'):8010 ;;
    openshift)
      PASSWORD="$(${CLIENT_EXE} get secret -n ${_skupper_ns} skupper-console-users -ojsonpath={.data.${skupper_ui_username}} | base64 -d)"
      open_browser https://$(${CLIENT_EXE} -n ${_skupper_ns} get route skupper -ojsonpath='{.spec.host}') ;;
    *) errormsg "Invalid cluster type" && exit 1 ;;
  esac

  infomsg "Log into the Skupper UI with these credentials: USERNAME=[${skupper_ui_username}], PASSWORD=[${PASSWORD}]"

elif [ "$_CMD" == "" ]; then
  errormsg "You must specify the command to execute. See --help for more details."
else
  errormsg "Invalid command: $_CMD"
fi
