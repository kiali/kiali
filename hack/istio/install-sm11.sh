#!/bin/bash

##############################################################################
# install-sm11.sh
#
# Run this script to install Service Mesh 1.1.
#
# This script takes one command whose value is one of the following:
#   sm-install: installs service mesh into the cluster
# sm-uninstall: removes all service mesh components
#   bi-install: installs bookinfo demo into the cluster
#  k-uninstall: removes only kiali components
#
# This script accepts several options - see --help for details.
#
##############################################################################

########################################
# START FUNCTIONS

infomsg() {
  echo "HACK: $1"
}

warnmsg() {
  echo "HACK: $1" >&2
}

debug() {
  if [ "$_VERBOSE" == "true" ]; then
    infomsg "DEBUG: $1"
  fi
}

get_downloader() {
  if [ -z "$DOWNLOADER" ] ; then
    # Use wget command if available, otherwise try curl
    if which wget > /dev/null 2>&1 ; then
      DOWNLOADER="wget -O"
    else
      if which curl > /dev/null 2>&1 ; then
        DOWNLOADER="curl -L -o"
      fi
    fi

    if [ ! "$DOWNLOADER" ] ; then
      infomsg "ERROR: You must install either curl or wget to allow downloading."
      exit 1
    fi
  fi
  debug "Downloader command to be used: ${DOWNLOADER}"
}

check_istio_app() {
  local expected="$1"
  apps=$(${OC} get deployment.apps -n ${CONTROL_PLANE_NAMESPACE} -o jsonpath='{range .items[*]}{.metadata.name}{" "}{end}' 2> /dev/null)
  for app in ${apps[@]}
  do
    if [[ "$expected" == "$app" ]]; then
      return 0
    fi
  done
  return 1
}

install_service_mesh() {

  # START CODE THAT IS NECESSARY TO PULL CONTENT FROM PRIVATE MAISTRA QUAY REPO
  if [ "${USE_QUAY}" == "true" ]; then

    if ${OC} get namespace registry-puller; then
      echo "registry-puller seems to be installed. Good."
    else
      echo "It appears you do not have the registry-puller installed. That must be installed. Aborting."
      exit 1
    fi

    # Disable all other Operator Sources - we probably don't need to do this
    ${OC} patch operatorhub cluster -n openshift-marketplace -p '{"spec":{"disableAllDefaultSources": true}}' --type=merge

    if ${OC} get secret sm-pull-secret -n openshift-marketplace; then
      echo "Operator source secret already created"
    else
      # Get the quay token that has access to the private maistra quay.io repo
      echo -n 'Your quay.io username: ' && read QUAY_USERNAME && echo -n 'Your quay.io password: ' && export QUAY_TOKEN=$(curl --silent -H "Content-Type: application/json" -XPOST https://quay.io/cnr/api/v1/users/login -d '{"user":{"username":"'"${QUAY_USERNAME}"'","password":"'"$(read -s PW && echo -n $PW)"'"}}' | sed -E 's/.*\"(basic .*)\".*/\1/')

      # create operator source secret used to get content from private maistra quay repo
      cat <<EOM1 | ${OC} apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: sm-pull-secret
  namespace: openshift-marketplace
stringData:
  token: "$QUAY_TOKEN"
EOM1
    fi

    # create operator source to get private maistra content
    OPERATOR_SOURCE_NAME="maistra-redhat-operators"
    cat <<EOM2 | ${OC} apply -f -
apiVersion: operators.coreos.com/v1
kind: OperatorSource
metadata:
  name: $OPERATOR_SOURCE_NAME
  namespace: openshift-marketplace
spec:
  type: appregistry
  endpoint: https://quay.io/cnr
  registryNamespace: maistra
  displayName: "Maistra Operators"
  publisher: "Maistra Team"
  authorizationToken:
    secretName: sm-pull-secret
EOM2
  fi
  # END CODE THAT IS NECESSARY TO PULL CONTENT FROM PRIVATE MAISTRA QUAY REPO

  local create_smcp="$1"
  OPERATOR_SOURCE_NAME=${OPERATOR_SOURCE_NAME:-redhat-operators}
  infomsg "Installing the Service Mesh operators..."
  cat <<EOM | ${OC} apply -f -
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: elasticsearch-operator
  namespace: openshift-operators
spec:
  channel: "4.3"
  installPlanApproval: Automatic
  name: elasticsearch-operator
  source: $OPERATOR_SOURCE_NAME
  sourceNamespace: openshift-marketplace
---
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: jaeger-product
  namespace: openshift-operators
spec:
  channel: stable
  installPlanApproval: Automatic
  name: jaeger-product
  source: $OPERATOR_SOURCE_NAME
  sourceNamespace: openshift-marketplace
---
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: kiali-ossm
  namespace: openshift-operators
spec:
  channel: stable
  installPlanApproval: Automatic
  name: kiali-ossm
  source: $OPERATOR_SOURCE_NAME
  sourceNamespace: openshift-marketplace
---
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: servicemeshoperator
  namespace: openshift-operators
spec:
  channel: stable
  installPlanApproval: Automatic
  name: servicemeshoperator
  source: $OPERATOR_SOURCE_NAME
  sourceNamespace: openshift-marketplace
EOM

  if [ "${create_smcp}" == "true" ] ; then

    infomsg "Waiting for the operator CRDs to come online"
    # TODO: if OLM dependencies work, we might want to add elasticsearches.logging.openshift.io
    for crd in servicemeshcontrolplanes.maistra.io servicemeshmemberrolls.maistra.io kialis.kiali.io jaegers.jaegertracing.io
    do
      echo -n "Waiting for $crd ..."
      while ! ${OC} get crd $crd > /dev/null 2>&1
      do
        sleep 2
        echo -n '.'
      done
      echo "done."
    done

    infomsg "Waiting for operator Deployments to be created..."

    debug "Waiting for Service Mesh operator deployment to be created..."
    local servicemesh_deployment=$(${OC} get deployment -n openshift-operators -o name 2>/dev/null | grep istio)
    while [ "${servicemesh_deployment}" == "" ]
    do
      sleep 2
      servicemesh_deployment=$(${OC} get deployment -n openshift-operators -o name 2>/dev/null | grep istio)
    done

    debug "Waiting for Kiali operator deployment to be created..."
    local kiali_deployment=$(${OC} get deployment -n openshift-operators -o name 2>/dev/null | grep kiali)
    while [ "${kiali_deployment}" == "" ]
    do
      sleep 2
      kiali_deployment=$(${OC} get deployment -n openshift-operators -o name 2>/dev/null | grep kiali)
    done

    debug "Waiting for Jaeger operator deployment to be created..."
    local jaeger_deployment=$(${OC} get deployment -n openshift-operators -o name 2>/dev/null | grep jaeger)
    while [ "${jaeger_deployment}" == "" ]
    do
      sleep 2
      jaeger_deployment=$(${OC} get deployment -n openshift-operators -o name 2>/dev/null | grep jaeger)
    done

    infomsg "Waiting for operator deployments to start..."
    for op in ${servicemesh_deployment} ${kiali_deployment} ${jaeger_deployment}
    do
      echo -n "Waiting for ${op} to be ready..."
      readyReplicas="0"
      while [ "$?" != "0" -o "$readyReplicas" == "0" ]
      do
        sleep 1
        echo -n '.'
        readyReplicas="$(${OC} get ${op} -n openshift-operators -o jsonpath='{.status.readyReplicas}' 2> /dev/null)"
      done
      echo "done."
    done

    infomsg "Creating control plane namespace: ${CONTROL_PLANE_NAMESPACE}"
    ${OC} create namespace ${CONTROL_PLANE_NAMESPACE}

    infomsg "Wait for the webhook to be created."
    while [ "$(${OC} get validatingwebhookconfigurations -o name | grep servicemesh)" == "" ]
    do
      echo -n "."
      sleep 5
    done
    echo "done."

    infomsg "Installing Maistra via ServiceMeshControlPlane Custom Resource."
    if [ "${MAISTRA_SMCP_YAML}" != "" ]; then
      ${OC} create -n ${CONTROL_PLANE_NAMESPACE} -f ${MAISTRA_SMCP_YAML}
    else
      debug "Using example SMCP/SMMR"
      rm -f /tmp/maistra-smcp.yaml
      get_downloader
      eval ${DOWNLOADER} /tmp/maistra-smcp.yaml "https://raw.githubusercontent.com/Maistra/istio-operator/maistra-1.1/deploy/examples/maistra_v1_servicemeshcontrolplane_cr_full.yaml"

      # The example we just downloaded doesn't specify a version. We could set it explicitly to v1.1
      # but the webhook will set the value to v1.1 for us automagically.
      #sed -i 's/istio:/version: v1.1\n  istio:/' /tmp/maistra-smcp.yaml

      ${OC} create -n ${CONTROL_PLANE_NAMESPACE} -f /tmp/maistra-smcp.yaml

      # START CODE THAT IS NECESSARY TO PULL CONTENT FROM PRIVATE MAISTRA QUAY REPO
      if [ "${USE_QUAY}" == "true" ]; then
        ${OC} patch smcp full-install -n ${CONTROL_PLANE_NAMESPACE} -p '{"spec": {"istio": {"global": {"tag": "1.1.0", "hub":"quay.io/maistra"}}}}' --type=merge
      fi
      # END CODE THAT IS NECESSARY TO PULL CONTENT FROM PRIVATE MAISTRA QUAY REPO
    fi
  else
    infomsg "The operators should be available but the Maistra SMCP CR will not be created."
  fi
}

# END FUNCTIONS
########################################

# Change to the directory where this script is and set our environment
SCRIPT_ROOT="$( cd "$(dirname "$0")" ; pwd -P )"
cd ${SCRIPT_ROOT}

# Default control plane namespace - where the CRs and the Istio components are installed
DEFAULT_CONTROL_PLANE_NAMESPACE="istio-system"

# Default namespace where bookinfo is to be installed
DEFAULT_BOOKINFO_NAMESPACE="bookinfo"

# Default client to be used to communicate with the cluster (one of oc, kubectl)
OC=oc

# process command line args to override environment
_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in

    # COMMANDS

    sm-install)
      _CMD="sm-install"
      shift
      ;;
    sm-uninstall)
      _CMD="sm-uninstall"
      shift
      ;;
    bi-install)
      _CMD="bi-install"
      shift
      ;;
    k-uninstall)
      _CMD="k-uninstall"
      shift
      ;;

    # OPTIONS CONFIGURING THE HACK SCRIPT ITSELF

    -c|--client-exe)
      OC="$2"
      shift;shift
      ;;
    -v|--verbose)
      _VERBOSE=true
      shift
      ;;

    # OPTIONS CONFIGURING THE SERVICE MESH AND ITS COMPONENTS

    -bin|--bookinfo-namespace)
      BOOKINFO_NAMESPACE="$2"
      shift;shift
      ;;
    -cpn|--control-plane-namespace)
      CONTROL_PLANE_NAMESPACE="$2"
      shift;shift
      ;;
    -nw|--no-wait-for-istio)
      WAIT_FOR_ISTIO=false
      shift
      ;;
    -smcp|--maistra-smcp-yaml)
      MAISTRA_SMCP_YAML="$2"
      shift;shift
      ;;
    -uq|--use-quay)
      USE_QUAY="$2"
      shift;shift
      ;;
    # HELP

    -h|--help)
      cat <<HELPMSG

$0 [option...] command

Valid options that configure the hack script itself:

  -c|--client-exe
      Which cluster client to use. One of: oc, kubectl
      Default: oc
  -v|--verbose
      Enable logging of debug messages from this script.

Valid options that configure the service mesh components:

  -bin|--bookinfo-namespace
      The namespace where the bookinfo demo will be installed.
      Default: ${DEFAULT_BOOKINFO_NAMESPACE}
      Used only for the 'bi-install' command.
  -cpn|--control-plane-namespace
      The namespace where the service mesh components are or will be installed. The operator CRs are installed here also.
      Default: ${DEFAULT_CONTROL_PLANE_NAMESPACE}
  -nw|--no-wait-for-istio
      When specified, this script will not wait for Maistra to be up and running before exiting.
  -smcp|--maistra-smcp-yaml <file or url>
      Points to the YAML file that defines the ServiceMeshControlPlane custom resource which declares what to install.
      If not defined, a basic one will be used.
  -uq|--use-quay <true|false>
      If true, perform additional things so the images are pulled from quay.io rather than registry.redhat.io.
      You can only use this if you have been granted access to the pre-release quay.io repository for Maistra images.
      Default: false

The command must be one of:

  * sm-install: Installs Service Mesh into the cluster.
  * sm-uninstall: Removes Service Mesh from the cluster.
  * bi-install: Installs Bookinfo demo into the cluster.
  * k-uninstall: Removes Kiali from the cluster.

HELPMSG
      exit 1
      ;;
    *)
      infomsg "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

########################################
# Environment setup section starts here.

#--------------------------------------------------------------
# Variables below have values that can be overridden by
# command line options (see above) or by environment variables.
#--------------------------------------------------------------

# if sed is gnu-sed then set option to work in posix mode to be compatible with non-gnu-sed versions
if sed --posix 's/ / /' < /dev/null > /dev/null 2>&1 ; then
  SEDOPTIONS="--posix"
fi

# By default, wait for Maistra to be up and running before the script ends.
WAIT_FOR_ISTIO="${WAIT_FOR_ISTIO:-true}"

# Namespaces for the components
CONTROL_PLANE_NAMESPACE="${CONTROL_PLANE_NAMESPACE:-${DEFAULT_CONTROL_PLANE_NAMESPACE}}"
BOOKINFO_NAMESPACE="${BOOKINFO_NAMESPACE:-${DEFAULT_BOOKINFO_NAMESPACE}}"

#--------------------------------------------------------------
# Variables below have values derived from the variables above.
# These variables below are not meant for users to change.
#--------------------------------------------------------------

# Environment setup section stops here.
########################################

debug "ENVIRONMENT:
  command=$_CMD
  BOOKINFO_NAMESPACE=$BOOKINFO_NAMESPACE
  CONTROL_PLANE_NAMESPACE=$CONTROL_PLANE_NAMESPACE
  MAISTRA_SMCP_YAML=$MAISTRA_SMCP_YAML
  OC=$OC
  SEDOPTIONS=$SEDOPTIONS
  "

debug "Client that will be used: ${OC}"
debug "$(${OC} version --client)"

if [ "$_CMD" = "sm-install" ]; then

  install_service_mesh "true"

  # It should be installing now - if we need to, wait for it to finish
  if [ "${WAIT_FOR_ISTIO}" == "true" ]; then
    infomsg "Wait for Maistra to fully start (this is going to take a while)..."

    infomsg "Waiting for Maistra Deployments to be created."
    _EXPECTED_APPS=(istio-citadel prometheus istio-galley istio-policy istio-telemetry istio-pilot istio-egressgateway istio-ingressgateway istio-sidecar-injector)
    for expected in ${_EXPECTED_APPS[@]}
    do
      echo -n "Waiting for $expected ..."
      while ! check_istio_app $expected
      do
        sleep 5
        echo -n '.'
      done
      echo "done."
    done

    infomsg "Waiting for Maistra Deployments to start..."
    for app in $(${OC} get deployment.apps -n ${CONTROL_PLANE_NAMESPACE} -o jsonpath='{range .items[*]}{.metadata.name}{" "}{end}' 2> /dev/null)
    do
      echo -n "Waiting for ${app} to be ready..."
      readyReplicas="0"
      while [ "$?" != "0" -o "$readyReplicas" == "0" ]
      do
        sleep 1
        echo -n '.'
        readyReplicas="$(${OC} get deployment.app/${app} -n ${CONTROL_PLANE_NAMESPACE} -o jsonpath='{.status.readyReplicas}' 2> /dev/null)"
      done
      echo "done."
    done
  fi

elif [ "$_CMD" = "sm-uninstall" ]; then

  # remove the SMCP and SMMR CRs which uninstalls all the Service Mesh components
  debug "Deleting the ServiceMesh SMCP and SMMR CRs"
  ${OC} delete -n ${CONTROL_PLANE_NAMESPACE} $(${OC} get smcp -n ${CONTROL_PLANE_NAMESPACE} -o name)
  ${OC} delete -n ${CONTROL_PLANE_NAMESPACE} $(${OC} get smmr -n ${CONTROL_PLANE_NAMESPACE} -o name)

  # Make sure the Kiail CR is deleted (probably not needed, ServiceMesh should be doing this)
  _kialicr=$(${OC} get kiali -n ${CONTROL_PLANE_NAMESPACE} -o name 2>/dev/null)
  if [ "${_kialicr}" != "" ]; then
    debug "Deleting the Kiali CR"
    ${OC} patch ${_kialicr} -n ${CONTROL_PLANE_NAMESPACE} -p '{"metadata":{"finalizers": []}}' --type=merge
    ${OC} delete ${_kialicr} -n ${CONTROL_PLANE_NAMESPACE}
  fi

  debug "Cleaning up the rest of ServiceMesh"

  # clean up the control plane namespace
  ${OC} delete namespace ${CONTROL_PLANE_NAMESPACE}

  # clean up OLM Subscriptions
  for sub in $(${OC} get subscriptions -n openshift-operators -o name | grep -E 'servicemesh|kiali|jaeger|elasticsearch')
  do
    ${OC} delete -n openshift-operators ${sub}
  done

  # clean up OLM CSVs for all the different operators which deletes the operators and their related resources
  for csv in $(${OC} get csv --all-namespaces --no-headers -o custom-columns=NS:.metadata.namespace,N:.metadata.name | sed ${SEDOPTIONS} 's/  */:/g' | grep -E 'servicemesh|kiali|jaeger|elasticsearch')
  do
    ${OC} delete csv -n $(echo -n $csv | cut -d: -f1) $(echo -n $csv | cut -d: -f2)
  done

  # Delete Istio resources that are getting left behind for some reason
  for r in \
    $(${OC} get clusterrolebindings -o name | grep -E 'istio') \
    $(${OC} get clusterroles -o name | grep -E 'istio')
  do
    ${OC} delete ${r}
  done
  for r in \
    $(${OC} get sa -n openshift-operators -o name | grep -E 'istio') \
    $(${OC} get configmaps -n openshift-operators -o name | grep -E 'istio') \
    $(${OC} get secrets -n openshift-operators -o name | grep -E 'istio')
  do
    ${OC} delete -n openshift-operators ${r}
  done

  # clean up additional leftover items (TODO: is this still needed for SM 1.1?)
  # see: https://docs.openshift.com/container-platform/4.1/service_mesh/service_mesh_install/removing-ossm.html#ossm-remove-cleanup_removing-ossm
  ${OC} delete validatingwebhookconfiguration/openshift-operators.servicemesh-resources.maistra.io
  ${OC} delete -n openshift-operators daemonset/istio-node
  ${OC} delete clusterrole/istio-admin
  ${OC} get crds -o name | grep '.*\.istio\.io' | xargs -r -n 1 ${OC} delete
  ${OC} get crds -o name | grep '.*\.maistra\.io' | xargs -r -n 1 ${OC} delete
  ${OC} get crds -o name | grep '.*\.kiali\.io' | xargs -r -n 1 ${OC} delete
  ${OC} get crds -o name | grep '.*\.jaegertracing\.io' | xargs -r -n 1 ${OC} delete
  ${OC} get crds -o name | grep '.*\.logging\.openshift\.io' | xargs -r -n 1 ${OC} delete

elif [ "$_CMD" = "bi-install" ]; then

  infomsg "Installing Bookinfo into namespace [${BOOKINFO_NAMESPACE}]"

  # see: https://maistra.io/docs/examples/bookinfo/
  ${OC} new-project ${BOOKINFO_NAMESPACE}
  ${OC} patch -n ${CONTROL_PLANE_NAMESPACE} --type='json' smmr default -p '[{"op": "add", "path": "/spec/members", "value":["'"${BOOKINFO_NAMESPACE}"'"]}]'
  ${OC} apply -n ${BOOKINFO_NAMESPACE} -f https://raw.githubusercontent.com/Maistra/bookinfo/maistra-1.1/bookinfo.yaml
  ${OC} apply -n ${BOOKINFO_NAMESPACE} -f https://raw.githubusercontent.com/Maistra/bookinfo/maistra-1.1/bookinfo-gateway.yaml

  BOOKINFO_PRODUCTPAGE_URL="http://$(${OC} get route istio-ingressgateway -n ${CONTROL_PLANE_NAMESPACE} -o jsonpath='{.spec.host}')/productpage"
  infomsg "Bookinfo URL: ${BOOKINFO_PRODUCTPAGE_URL}"

  infomsg "Installing Bookinfo Traffic Generator..."
  curl https://raw.githubusercontent.com/kiali/kiali-test-mesh/master/traffic-generator/openshift/traffic-generator-configmap.yaml | DURATION="0s" RATE="1" ROUTE="${BOOKINFO_PRODUCTPAGE_URL}" envsubst | ${OC} apply -n ${BOOKINFO_NAMESPACE} -f -
  curl https://raw.githubusercontent.com/kiali/kiali-test-mesh/master/traffic-generator/openshift/traffic-generator.yaml | ${OC} apply -n ${BOOKINFO_NAMESPACE} -f -

elif [ "$_CMD" = "k-uninstall" ]; then

  # Tell ServiceMesh to disable Kiali so it doesn't try to manage it
  _smcp=$(${OC} get smcp -n ${CONTROL_PLANE_NAMESPACE} -o name 2>/dev/null)
  if [ "${_smcp}" != "" ]; then
    debug "Telling ServiceMesh to disable Kiali"
    ${OC} patch ${_smcp} -n ${CONTROL_PLANE_NAMESPACE} -p '{"spec":{"istio":{"kiali":{"enabled": "false"}}}}' --type=merge
  fi

  # Make sure the Kiail CR is deleted (probably not needed, ServiceMesh should be doing this)
  _kialicr=$(${OC} get kiali -n ${CONTROL_PLANE_NAMESPACE} -o name 2>/dev/null)
  if [ "${_kialicr}" != "" ]; then
    debug "Deleting the Kiali CR"
    ${OC} patch ${_kialicr} -n ${CONTROL_PLANE_NAMESPACE} -p '{"metadata":{"finalizers": []}}' --type=merge
    ${OC} delete ${_kialicr} -n ${CONTROL_PLANE_NAMESPACE}
  fi

  debug "Waiting for Kiali CR to disappear..."
  _kialicr=$(${OC} get kiali -n ${CONTROL_PLANE_NAMESPACE} -o name 2>/dev/null)
  while [ "${kiali_deployment}" != "" ]
  do
    sleep 2
    _kialicr=$(${OC} get kiali -n ${CONTROL_PLANE_NAMESPACE} -o name 2>/dev/null)
  done

  # clean up OLM subscriptions
  for sub in $(${OC} get subscriptions -n openshift-operators -o name | grep kiali)
  do
    ${OC} delete -n openshift-operators ${sub}
  done

  # clean up OLM CSVs which deletes the operator and its related resources
  for csv in $(${OC} get csv --all-namespaces --no-headers -o custom-columns=NS:.metadata.namespace,N:.metadata.name | sed ${SEDOPTIONS} 's/  */:/g' | grep kiali-operator)
  do
    ${OC} delete csv -n $(echo -n $csv | cut -d: -f1) $(echo -n $csv | cut -d: -f2)
  done

  # clean up additional leftover items
  ${OC} get crds -o name | grep '.*\.kiali\.io' | xargs -r -n 1 ${OC} delete

else
  infomsg "ERROR: Missing command. See --help for usage."
  exit 1
fi
