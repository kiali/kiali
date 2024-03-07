#!/bin/bash

##########################################################
#
# This installs Istio and Kiali using the latest
# release of the Sail and Kiali operators.
#
##########################################################

set -u

# Change to the directory where this script is
SCRIPT_ROOT="$( cd "$(dirname "$0")" ; pwd -P )"
cd ${SCRIPT_ROOT}

# get function definitions
source ${SCRIPT_ROOT}/func-sm.sh
source ${SCRIPT_ROOT}/func-kiali.sh
source ${SCRIPT_ROOT}/func-tempo.sh
source ${SCRIPT_ROOT}/func-addons.sh
source ${SCRIPT_ROOT}/func-olm.sh
source ${SCRIPT_ROOT}/func-log.sh

DEFAULT_CONTROL_PLANE_NAMESPACE="istio-system"
DEFAULT_ENABLE_KIALI="true"
DEFAULT_ENABLE_OSSMCONSOLE="true"
DEFAULT_ADDONS="prometheus grafana"
DEFAULT_OC="oc"
DEFAULT_ISTIO_VERSION="latest"
DEFAULT_KIALI_VERSION="default"
DEFAULT_CATALOG_SOURCE="community"

_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in

    # COMMANDS

    install-operators) _CMD="install-operators" ; shift ;;
    install-istio)     _CMD="install-istio"     ; shift ;;
    delete-operators)  _CMD="delete-operators"  ; shift ;;
    delete-istio)      _CMD="delete-istio"      ; shift ;;
    status)            _CMD="status"            ; shift ;;
    kiali-ui)          _CMD="kiali-ui"          ; shift ;;

    # OPTIONS

    -a|--addons)                    ADDONS="${2}"                  ; shift;shift ;;
    -c|--client)                    OC="${2}"                      ; shift;shift ;;
    -cpn|--control-plane-namespace) CONTROL_PLANE_NAMESPACE="${2}" ; shift;shift ;;
    -cs|--catalog-source)           CATALOG_SOURCE="${2}"          ; shift;shift ;;
    -ek|--enable-kiali)             ENABLE_KIALI="${2}"            ; shift;shift ;;
    -eo|--enable-ossmconsole)       ENABLE_OSSMCONSOLE="${2}"      ; shift;shift ;;
    -iv|--istio-version)            ISTIO_VERSION="${2}"           ; shift;shift ;;
    -kv|--kiali-version)            KIALI_VERSION="${2}"           ; shift;shift ;;

    # HELP

    -h|--help)
      cat <<HELPMSG

$0 [option...] command

Installs Istio using the Sail and Kiali operators.

Valid options:

  -a|--addons <addon names>
      A space-separated list of addon names that will be installed in the control plane namespace.
      This is only used with the "install-istio" command.
      The list of supported addon names are: prometheus, jaeger, grafana, loki
      Default: ${DEFAULT_ADDONS}

  -c|--client <path to k8s client>
      A filename or path to the 'oc' or 'kubectl' client.
      If this is a path to 'oc' then it will be assumed OpenShift is being used.
      (NOTE: Installing in a non-OpenShift cluster is currently not supported.)
      Default: ${DEFAULT_OC}

  -cpn|--control-plane-namespace <name>
      The name of the control plane namespace if Istio is to be installed.
      This is only used with the "install-istio" command.
      Default: ${DEFAULT_CONTROL_PLANE_NAMESPACE}

  -cs|--catalog-source <redhat|community>
      The name of the OpenShift catalog source where the operators will come from. You can choose
      to install the operators from the RedHat product catalog or the Community catalog.
      Valid values are "redhat" and "community".
      This is only used with the "install-operators" command and when using an OpenShift cluster.
      Default: ${DEFAULT_CATALOG_SOURCE}

  -ek|--enable-kiali <true|false>
      If true, and you elect to install-operators, the Kiali operator is installed
      with the rest of the Service Mesh operators.
      If true, and you elect to install-istio, a Kiali CR and optionally an OSSMConsole CR
      will be created (see --enable-ossmconsole).
      This is ignored when deleting operators (i.e. regardless of this setting, all
      operators are deleted, Kiali operator included).
      This is ignored when deleting Istio (i.e. regardless of this setting, all
      Kiali CRs are deleted).
      Default: ${DEFAULT_ENABLE_KIALI}

  -eo|--enable-ossmconsole <true|false>
      If true, and you elect to enable Kiali (--enable-kiali) this will install OSSMC also.
      This is only used with the "install-istio" command.
      Default: ${DEFAULT_ENABLE_OSSMCONSOLE}

  -iv|--istio-version
      The version of Istio control plane that will be installed.
      This is only used with the "install-istio" command.
      Default: ${DEFAULT_ISTIO_VERSION}

  -kv|--kiali-version
      The version of the Kiali Server and OSSM Console plugin that will be installed.
      This is only used with "install-istio" command and only if Kiali is to be installed.
      Default: ${DEFAULT_KIALI_VERSION}

The command must be one of:

  * install-operators: Install the latest version of the Sail operator and (if --enable-kiali is "true") the Kiali operator.
  * install-istio: Install Istio control plane (you must first have installed the operators). Also installs the configured addons.
  * delete-operators: Delete the Sail and Kiali operators (you must first delete all Istio control planes and Kiali CRs manually).
  * delete-istio: Uninstalls Istio control plane, Kiali, as well as uninstalls any and all addons.
  * status: Provides details about resources that have been installed (not including the addons).
  * kiali-ui: Pops up a browser tab pointing to the Kiali UI.

HELPMSG
      exit 1
      ;;
    *)
      errormsg "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# Setup user-defined environment

CONTROL_PLANE_NAMESPACE="${CONTROL_PLANE_NAMESPACE:-${DEFAULT_CONTROL_PLANE_NAMESPACE}}"
ENABLE_KIALI="${ENABLE_KIALI:-${DEFAULT_ENABLE_KIALI}}"
ENABLE_OSSMCONSOLE="${ENABLE_OSSMCONSOLE:-${DEFAULT_ENABLE_OSSMCONSOLE}}"
ADDONS="${ADDONS-${DEFAULT_ADDONS}}"
OC="${OC:-${DEFAULT_OC}}"
ISTIO_VERSION="${ISTIO_VERSION:-${DEFAULT_ISTIO_VERSION}}"
KIALI_VERSION="${KIALI_VERSION:-${DEFAULT_KIALI_VERSION}}"
CATALOG_SOURCE="${CATALOG_SOURCE:-${DEFAULT_CATALOG_SOURCE}}"

infomsg "CONTROL_PLANE_NAMESPACE=$CONTROL_PLANE_NAMESPACE"
infomsg "ENABLE_KIALI=$ENABLE_KIALI"
infomsg "ENABLE_OSSMCONSOLE=$ENABLE_OSSMCONSOLE"
infomsg "ADDONS=$ADDONS"
infomsg "OC=$OC"
infomsg "ISTIO_VERSION=$ISTIO_VERSION"
infomsg "KIALI_VERSION=$KIALI_VERSION"
infomsg "CATALOG_SOURCE=$CATALOG_SOURCE"

# Check the type of cluster we are talking to.
# * If OpenShift, make sure we are logged in.
# * Define the namespace where the operators are expected to run based on cluster type.

if ! which ${OC} >& /dev/null; then
  errormsg "The client is not valid [${OC}]. Use --client to specify a valid path to 'oc' or 'kubectl'."
  exit 1
fi
if [[ "${OC}" = *"oc" ]]; then
  # if we are using 'oc' (as opposed to 'kubectl') we therefore assume we are installing in an OpenShift cluster
  IS_OPENSHIFT="true"
  OLM_OPERATORS_NAMESPACE="openshift-operators"
  if ! ${OC} whoami >& /dev/null; then
    errormsg "You are not logged into the OpenShift cluster. Use '${OC} login' to log into a cluster and then retry."
    exit 1
  fi
else
  IS_OPENSHIFT="false"
  OLM_OPERATORS_NAMESPACE="operators"
fi

if [ "${IS_OPENSHIFT}" == "true" -a "${CATALOG_SOURCE}" != "redhat" -a "${CATALOG_SOURCE}" != "community" ]; then
  errormsg "The OpenShift catalog source must be one of 'redhat' or 'community' but was [${CATALOG_SOURCE}]"
  exit 1
fi

# Process the command
if [ "${_CMD}" == "install-operators" ]; then

  # if not on OpenShift make sure OLM is available
  if [ "${IS_OPENSHIFT}" == "false" ]; then
    install_olm
  fi

  if [ "${ENABLE_KIALI}" == "true" ]; then
    install_kiali_operator "${CATALOG_SOURCE}"
  fi
  install_tempo_operator "${CATALOG_SOURCE}"
  install_servicemesh_operators "${CATALOG_SOURCE}"

elif [ "${_CMD}" == "install-istio" ]; then

  if [ "${ENABLE_KIALI}" == "true" ] && ! ${OC} get crd kialis.kiali.io >& /dev/null; then
    errormsg "Cannot install Istio with Kiali enabled because Kiali Operator is either not installed or installation is in progress."
    exit 1
  fi

  if ! ${OC} get crd istios.operator.istio.io >& /dev/null; then
    errormsg "Cannot install Istio because the Sail Operator is either not installed or installation is in progress."
    exit 1
  fi

  if ! ${OC} get crd tempostacks.tempo.grafana.com >& /dev/null; then
    errormsg "Cannot install Istio because the Tempo Operator is either not installed or installation is in progress."
    exit 1
  fi

  install_tempo
  install_istio "${CONTROL_PLANE_NAMESPACE}" "${ISTIO_VERSION}"

  if [ -n "${ADDONS}" ]; then
    infomsg "Installing addons: ${ADDONS}"
    for addon in ${ADDONS}; do
      install_addon ${addon}
    done
  else
    infomsg "No addons will be installed"
  fi

  if [ "${ENABLE_KIALI}" == "true" ]; then
    install_kiali_cr "${CONTROL_PLANE_NAMESPACE}"
    if [ "${ENABLE_OSSMCONSOLE}" == "true" ]; then
      install_ossmconsole_cr "ossmconsole"
    fi
  fi

elif [ "${_CMD}" == "delete-operators" ]; then

  delete_servicemesh_operators
  delete_tempo_operator
  delete_kiali_operator

elif [ "${_CMD}" == "delete-istio" ]; then

  delete_ossmconsole_cr
  delete_kiali_cr
  delete_istio
  delete_tempo
  delete_all_addons

elif [ "${_CMD}" == "status" ]; then

  status_servicemesh_operators
  status_kiali_operator
  status_tempo_operator
  status_istio
  status_kiali_cr
  status_ossmconsole_cr
  status_tempo

elif [ "${_CMD}" == "kiali-ui" ]; then

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    kiali_url="http://$(${OC} -n ${CONTROL_PLANE_NAMESPACE} get route kiali -o jsonpath='{.spec.host}' 2> /dev/null)"
  else
    kiali_url="http://$(${OC} -n ${CONTROL_PLANE_NAMESPACE} get svc kiali -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2> /dev/null):20001"
  fi

  infomsg "Attempting to open browser to Kiali UI at URL [${kiali_url}]"
  xdg-open ${kiali_url}

else
  errormsg "Missing or unknown command. See --help for usage."
  exit 1
fi
