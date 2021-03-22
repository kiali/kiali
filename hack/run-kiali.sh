#!/bin/bash

##############################################################################
# run-kiali.sh
#
# This script allows you to run Kiali on the local machine
# while it is connected to a remote k8s cluster.
#
# This is useful for Kiali developers who want to do quick code/build/test
# cycles without deploying Kiali directly in the cluster each time
# via the operator or helm charts.
#
# This is not to be used in production environments and is not supported.
#
# In order to use this, you first must install Kiali the "normal" way
# (i.e. either via the operator or helm). Once installed, the Kiali
# service account and roles will be created; this script will use that
# service account to access the cluster, thus giving it the same
# permissions that Kiali is normally granted.
#
# When running, you can reboot the Kiali server in one of two ways:
#
#   1. Control-C - you will be prompted to reboot the Kiali server or exit
#   2. pkill run-kiali.sh - this will automatically reboot the Kiali server
#
# This is useful when you rebuild the Kiali binary executable - to pick up
# the change, just reboot the Kiali Server using one of those two mechanisms.
# You can turn off that feature (i.e. you want the Kiali Server itself
# to be run in the foreground and Control-C immediately kills it) by
# passing in "--rebootable false".
##############################################################################

set -u

errormsg() {
  echo -e "\U0001F6A8 ERROR: ${1}"
}

warnmsg() {
  echo -e "\U0001F6A7 WARNING: ${1}"
}

infomsg() {
  echo -e "\U0001F4C4 ${1}"
}

startmsg() {
  echo -e "\U000026A1 ${1}"
}

killmsg() {
  echo -e "\U001F480 ${1}"
}

exitmsg() {
  echo -e "\U0001F6D1 ${1}"
}

questionchar() {
  echo -en '\U00002753'
}

# Determine where this script is and make it the cwd

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
cd ${SCRIPT_DIR}

# This is a directory where we write temp files needed to run Kiali locally

TMP_DIR="/tmp/run-kiali"
rm -rf /tmp/run-kiali
mkdir -p ${TMP_DIR}

# Some defaults

DEFAULT_API_PROXY_HOST="127.0.0.1"
DEFAULT_API_PROXY_PORT="8001"
DEFAULT_CLIENT_EXE="kubectl"
DEFAULT_ENABLE_SERVER="true"
DEFAULT_ISTIO_NAMESPACE="istio-system"
DEFAULT_KIALI_CONFIG_TEMPLATE_FILE="${SCRIPT_DIR}/run-kiali-config-template.yaml"
DEFAULT_KIALI_EXE="${GOPATH:-.}/bin/kiali"
DEFAULT_KUBE_CONTEXT="kiali-developer"
DEFAULT_LOCAL_REMOTE_PORTS_GRAFANA="3000:3000"
DEFAULT_LOCAL_REMOTE_PORTS_PROMETHEUS="9091:9090"
DEFAULT_LOCAL_REMOTE_PORTS_TRACING="16686:16686"
DEFAULT_LOG_LEVEL="info"
DEFAULT_REBOOTABLE="true"
DEFAULT_UI_CONSOLE_DOWNLOAD_VERSION="latest"

# Process command line options

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -aph|--api-proxy-host)       API_PROXY_HOST="$2";                shift;shift ;;
    -app|--api-proxy-port)       API_PROXY_PORT="$2";                shift;shift ;;
    -c|--config)                 KIALI_CONFIG_TEMPLATE_FILE="$2";    shift;shift ;;
    -ce|--client-exe)            CLIENT_EXE="$2";                    shift;shift ;;
    -es|--enable-server)         ENABLE_SERVER="$2";                 shift;shift ;;
    -gu|--grafana-url)           GRAFANA_URL="$2";                   shift;shift ;;
    -in|--istio-namespace)       ISTIO_NAMESPACE="$2";               shift;shift ;;
    -kah|--kubernetes-api-host)  KUBERNETES_API_HOST="$2";           shift;shift ;;
    -kap|--kubernetes-api-port)  KUBERNETES_API_PORT="$2";           shift;shift ;;
    -kc|--kube-context)          KUBE_CONTEXT="$2";                  shift;shift ;;
    -ke|--kiali-exe)             KIALI_EXE="$2";                     shift;shift ;;
    -ll|--log-level)             LOG_LEVEL="$2";                     shift;shift ;;
    -pg|--ports-grafana)         LOCAL_REMOTE_PORTS_GRAFANA="$2";    shift;shift ;;
    -pp|--ports-prometheus)      LOCAL_REMOTE_PORTS_PROMETHEUS="$2"; shift;shift ;;
    -pt|--ports-tracing)         LOCAL_REMOTE_PORTS_TRACING="$2";    shift;shift ;;
    -pu|--prometheus-url)        PROMETHEUS_URL="$2";                shift;shift ;;
    -r|--rebootable)             REBOOTABLE="$2";                    shift;shift ;;
    -tu|--tracing-url)           TRACING_URL="$2";                   shift;shift ;;
    -ucd|--ui-console-dir)       UI_CONSOLE_DIR="$2";                shift;shift ;;
    -ucv|--ui-console-version)   UI_CONSOLE_DOWNLOAD_VERSION="$2";   shift;shift ;;
    -h|--help )
      cat <<HELPMSG
$0 [option...]
Valid options:
  -aph|--api-proxy-host
      The hostname of the proxy that will forward API requests.
      If you already set up your own proxy, this must be the hostname where it is bound.
      If you want the script to set up the proxy for you, normally keep the default value.
      Default: ${DEFAULT_API_PROXY_HOST}
  -app|--api-proxy-port
      The port that the API request proxy is bound to.
      If you already set up your own proxy, this must be the port where it is bound.
      If you want the script to set up the proxy for you, set this to a free port on your machine.
      Default: ${DEFAULT_API_PROXY_PORT}
  -c|--config
      The full path to the Kiali configuration file.
      This is actually a template file that can have '\${X}' notation in it; those
      environment variables will be replaced by this script to build the true config file.
      This must be a YAML file and must mimic what the Kiali ConfigMap would look like.
      For details on what settings can go in this config file, see the "spec" field in the
      example Kiali CR here: https://github.com/kiali/kiali-operator/blob/master/deploy/kiali/kiali_cr.yaml
      Default: ${DEFAULT_KIALI_CONFIG_TEMPLATE_FILE}
  -ce|--client-exe
      Cluster client executable - must refer to 'oc' or 'kubectl'.
      Default: ${DEFAULT_CLIENT_EXE}
  -es|--enable-server
      When 'true', this script will start the server and manage its lifecycle.
      When 'false' this script will do nothing to start or stop the server.
      The purpose of this setting is to allow for this script to work while debugging the server in
      a debugging IDE. When 'false', this script will do everything else except start the server, which
      will be the job of an external tool such as an IDE. When 'false' this script will print out a command
      so you can know what that external tool should execute to start a properly configured server.
      Default: ${DEFAULT_ENABLE_SERVER}
  -gu|--grafana-url
      The URL that can be used to query the exposed Grafana service. You must have exposed Grafana
      to external clients outside of the cluster - that external URL is what this value should be.
      For example, for OpenShift clusters, this should be the Grafana Route URL.
      Default: <will be auto-discovered>
  -in|--istio-namespace
      The name of the control plane namespace - this is where Istio components are installed.
      Default: ${DEFAULT_ISTIO_NAMESPACE}
  -kah|--kubernetes-api-host
      The hostname of the Kubernetes API Endpoint.
      Default: <will be auto-discovered>
  -kap|--kubernetes-api-port
      The port that the Kubernetes API Endpoint is listening to.
      Default: <will be auto-discovered>
  -kc|--kube-context
      The context used to connect to the cluster. This is a context that will be
      created/modified in order to proxy the requests to the API server.
      This context will be associatd with the Kiali service account.
      After it is created, you will be able to inspect this context and its
      related information via "kubectl config" while the server is running,
      but it will be deleted when this script exits and you will return back to
      the original context that you started with.
      Note: setting this to "current" tells this script to not create or modify
      anything - instead it will rely on the current context to make requests, using
      the permissions granted to the current user (which may or may not be compatible
      with what the Kiali Server needs in order to operate properly).
      When using "current", the Kiali Server need not be deployed in the cluster, however
      it also means the Kiali Server will not run with a service account and you will
      see some errors in the server because of this.
      Default: ${DEFAULT_KUBE_CONTEXT}
  -ke|--kiali-exe
      Path to the Kiali executable.
      Default: ${DEFAULT_KIALI_EXE}
  -ll|--log-level
      The noisiness of the output logs.
      Log levels can be one of: trace, debug, info, warn, error, fatal
      Default: ${DEFAULT_LOG_LEVEL}
  -pg|--ports-grafana
      If a port-forward is created for the Grafana component, this specifies the
      local and remote ports separated with a colon.
      Default: ${DEFAULT_LOCAL_REMOTE_PORTS_GRAFANA}
  -pp|--ports-prometheus
      If a port-forward is created for the Prometheus component, this specifies the
      local and remote ports separated with a colon.
      Default: ${DEFAULT_LOCAL_REMOTE_PORTS_PROMETHEUS}
  -pt|--ports-tracing
      If a port-forward is created for the Tracing component, this specifies the
      local and remote ports separated with a colon.
      Default: ${DEFAULT_LOCAL_REMOTE_PORTS_TRACING}
  -pu|--prometheus-url
      The URL that can be used to query the exposed Prometheus service. You must have exposed Prometheus
      to external clients outside of the cluster - that external URL is what this value should be.
      For example, for OpenShift clusters, this should be the Prometheus Route URL.
      Default: <will be auto-discovered>
  -r|--rebootable
      If true, this script will reboot the Kiali Server when SIGTERM signal is sent to it and will
      prompt to reboot when Control-C is pressed. By setting this to 'false', the Kiali Server will
      be run in foreground and Control-C will kill it immediately without the ability to reboot it.
      If --enabled-server is 'false', this setting is ignored and assumed 'false'.
      Default: ${DEFAULT_REBOOTABLE}
  -tu|--tracing-url
      The URL that can be used to query the exposed Tracing service. You must have exposed Tracing
      to external clients outside of the cluster - that external URL is what this value should be.
      For example, for OpenShift clusters, this should be the Tracing (e.g. Jaeger) Route URL.
      Default: <will be auto-discovered>
  -ucd|--ui-console-dir
      A directory on the local machine containing the UI console code.
      If not specified, an attempt to find it on the local machine will be made. A search up the
      directory tree is made, looking for any directory called "kiali-ui" that has a "build" directory under it.
      If one is not found, you will be asked if you want to download a copy via npm to the ${TMP_DIR} directory.
      If you want to download it without being asked, set this value to "download".
      The version of the UI console that will be downloaded is specified via --ui-console-version.
      Note that in order to download the UI console, you must have "npm" in your PATH.
      In order to set this to something other than "download', you must first build the UI
      and set this option to the build directory. For details, see: https://github.com/kiali/kiali-ui
      Default: <either a local build that is auto-discovered or the latest UI that will be downloaded via npm>
  -ucv|--ui-console-version
      If you elect to download the UI Console from npm, this is the version it will download.
      Make sure this version is compatible with the server you are going to run.
      Note that this value is ignored if you do not elect to download the UI Console.
      Default: ${DEFAULT_UI_CONSOLE_DOWNLOAD_VERSION}
HELPMSG
      exit 1
      ;;
    *)
      errormsg "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# Set some runtime variables

API_PROXY_HOST="${API_PROXY_HOST:-${DEFAULT_API_PROXY_HOST}}"
API_PROXY_PORT="${API_PROXY_PORT:-${DEFAULT_API_PROXY_PORT}}"
ENABLE_SERVER="${ENABLE_SERVER:-${DEFAULT_ENABLE_SERVER}}"
ISTIO_NAMESPACE="${ISTIO_NAMESPACE:-${DEFAULT_ISTIO_NAMESPACE}}"
KIALI_CONFIG_TEMPLATE_FILE="${KIALI_CONFIG_TEMPLATE_FILE:-${DEFAULT_KIALI_CONFIG_TEMPLATE_FILE}}"
KIALI_EXE="${KIALI_EXE:-${DEFAULT_KIALI_EXE}}"
KUBE_CONTEXT="${KUBE_CONTEXT:-${DEFAULT_KUBE_CONTEXT}}"
LOCAL_REMOTE_PORTS_GRAFANA="${LOCAL_REMOTE_PORTS_GRAFANA:-${DEFAULT_LOCAL_REMOTE_PORTS_GRAFANA}}"
LOCAL_REMOTE_PORTS_PROMETHEUS="${LOCAL_REMOTE_PORTS_PROMETHEUS:-${DEFAULT_LOCAL_REMOTE_PORTS_PROMETHEUS}}"
LOCAL_REMOTE_PORTS_TRACING="${LOCAL_REMOTE_PORTS_TRACING:-${DEFAULT_LOCAL_REMOTE_PORTS_TRACING}}"
LOG_LEVEL="${LOG_LEVEL:-${DEFAULT_LOG_LEVEL}}"
REBOOTABLE="${REBOOTABLE:-${DEFAULT_REBOOTABLE}}"

# these are the env vars required by the Kiali server itself
KUBERNETES_SERVICE_HOST="${API_PROXY_HOST}"
KUBERNETES_SERVICE_PORT="${API_PROXY_PORT}"

# Get the client with which we can talk to the cluster

CLIENT_EXE="$(which "${CLIENT_EXE:-${DEFAULT_CLIENT_EXE}}")"
if [ "$?" != "0" ]; then
  errormsg "Cannot find the cluster client. Provide a path to 'kubectl' or 'oc' via --client-exe"
  exit 1
fi

# Make sure we are connected to a cluster that has the Istio namespace

if ! ${CLIENT_EXE} get namespace ${ISTIO_NAMESPACE} > /dev/null 2>&1; then
  errormsg "You are not connected to a cluster that has the Istio namespace [${ISTIO_NAMESPACE}]."
  exit 1
fi

# Determine if we are running with OpenShift or not

if ${CLIENT_EXE} api-versions | grep --quiet "route.openshift.io"; then
  IS_OPENSHIFT="true"
  infomsg "You are connecting to an OpenShift cluster"
else
  IS_OPENSHIFT="false"
  infomsg "You are connecting to a (non-OpenShift) Kubernetes cluster"
fi

# If the user didn't tell us what the Prometheus URL is, try to auto-discover it

PORT_FORWARD_DEPLOYMENT_PROMETHEUS=""
if [ -z "${PROMETHEUS_URL:-}" ]; then
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    prom_host="$(${CLIENT_EXE} get route -n ${ISTIO_NAMESPACE} prometheus -o jsonpath='{.spec.host}')"
    if [ "$?" != "0" -o -z "${prom_host}" ]; then
      PORT_FORWARD_DEPLOYMENT_PROMETHEUS="$(${CLIENT_EXE} get deployment -n ${ISTIO_NAMESPACE} prometheus -o name)"
      if [ "$?" != "0" -o -z "${PORT_FORWARD_DEPLOYMENT_PROMETHEUS}" ]; then
        errormsg "Cannot auto-discover Prometheus on OpenShift. You must specify the Prometheus URL via --prometheus-url"
        exit 1
      else
        warnmsg "Cannot auto-discover Prometheus on OpenShift. If you exposed it, you can specify the Prometheus URL via --prometheus-url. For now, this session will attempt to port-forward to it."
        PROMETHEUS_URL="http://127.0.0.1:$(echo ${LOCAL_REMOTE_PORTS_PROMETHEUS} | cut -d ':' -f 1)"
      fi
    else
      infomsg "Auto-discovered OpenShift route that exposes Prometheus"
      PROMETHEUS_URL="http://${prom_host}"
    fi
  else
    PORT_FORWARD_DEPLOYMENT_PROMETHEUS="$(${CLIENT_EXE} get deployment -n ${ISTIO_NAMESPACE} prometheus -o name)"
    if [ "$?" != "0" -o -z "${PORT_FORWARD_DEPLOYMENT_PROMETHEUS}" ]; then
      errormsg "Cannot auto-discover Prometheus on Kubernetes. You must specify the Prometheus URL via --prometheus-url"
      exit 1
    else
      warnmsg "Cannot auto-discover Prometheus on Kubernetes. If you exposed it, you can specify the Prometheus URL via --prometheus-url. For now, this session will attempt to port-forward to it."
      PROMETHEUS_URL="http://127.0.0.1:$(echo ${LOCAL_REMOTE_PORTS_PROMETHEUS} | cut -d ':' -f 1)"
    fi
  fi
fi

# If the user didn't tell us what the Grafana URL is, try to auto-discover it

PORT_FORWARD_DEPLOYMENT_GRAFANA=""
if [ -z "${GRAFANA_URL:-}" ]; then
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    graf_host="$(${CLIENT_EXE} get route -n ${ISTIO_NAMESPACE} grafana -o jsonpath='{.spec.host}')"
    if [ "$?" != "0" -o -z "${graf_host}" ]; then
      PORT_FORWARD_DEPLOYMENT_GRAFANA="$(${CLIENT_EXE} get deployment -n ${ISTIO_NAMESPACE} grafana -o name)"
      if [ "$?" != "0" -o -z "${PORT_FORWARD_DEPLOYMENT_GRAFANA}" ]; then
        errormsg "Cannot auto-discover Grafana on OpenShift. You must specify the Grafana URL via --grafana-url"
        exit 1
      else
        warnmsg "Cannot auto-discover Grafana on OpenShift. If you exposed it, you can specify the Grafana URL via --grafana-url. For now, this session will attempt to port-forward to it."
        GRAFANA_URL="http://127.0.0.1:$(echo ${LOCAL_REMOTE_PORTS_GRAFANA} | cut -d ':' -f 1)"
      fi
    else
      infomsg "Auto-discovered OpenShift route that exposes Grafana"
      GRAFANA_URL="http://${graf_host}"
    fi
  else
    PORT_FORWARD_DEPLOYMENT_GRAFANA="$(${CLIENT_EXE} get deployment -n ${ISTIO_NAMESPACE} grafana -o name)"
    if [ "$?" != "0" -o -z "${PORT_FORWARD_DEPLOYMENT_GRAFANA}" ]; then
      errormsg "Cannot auto-discover Grafana on Kubernetes. You must specify the Grafana URL via --grafana-url"
      exit 1
    else
      warnmsg "Cannot auto-discover Grafana on Kubernetes. If you exposed it, you can specify the Grafana URL via --grafana-url. For now, this session will attempt to port-forward to it."
      GRAFANA_URL="http://127.0.0.1:$(echo ${LOCAL_REMOTE_PORTS_GRAFANA} | cut -d ':' -f 1)"
    fi
  fi
fi

# If the user didn't tell us what the Tracing URL is, try to auto-discover it

PORT_FORWARD_DEPLOYMENT_TRACING=""
if [ -z "${TRACING_URL:-}" ]; then
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    trac_host="$(${CLIENT_EXE} get route -n ${ISTIO_NAMESPACE} tracing -o jsonpath='{.spec.host}')"
    if [ "$?" != "0" -o -z "${trac_host}" ]; then
      PORT_FORWARD_DEPLOYMENT_TRACING="$(${CLIENT_EXE} get deployment -n ${ISTIO_NAMESPACE} jaeger -o name)"
      if [ "$?" != "0" -o -z "${PORT_FORWARD_DEPLOYMENT_TRACING}" ]; then
        errormsg "Cannot auto-discover Tracing on OpenShift. You must specify the Tracing URL via --tracing-url"
        exit 1
      else
        warnmsg "Cannot auto-discover Tracing on OpenShift. If you exposed it, you can specify the Tracing URL via --tracing-url. For now, this session will attempt to port-forward to it."
        TRACING_URL="http://127.0.0.1:$(echo ${LOCAL_REMOTE_PORTS_TRACING} | cut -d ':' -f 1)"
      fi
    else
      infomsg "Auto-discovered OpenShift route that exposes Tracing"
      TRACING_URL="http://${trac_host}"
    fi
  else
    PORT_FORWARD_DEPLOYMENT_TRACING="$(${CLIENT_EXE} get deployment -n ${ISTIO_NAMESPACE} jaeger -o name)"
    if [ "$?" != "0" -o -z "${PORT_FORWARD_DEPLOYMENT_TRACING}" ]; then
      errormsg "Cannot auto-discover Tracing on Kubernetes. You must specify the Tracing URL via --tracing-url"
      exit 1
    else
      warnmsg "Cannot auto-discover Tracing on Kubernetes. If you exposed it, you can specify the Tracing URL via --tracing-url. For now, this session will attempt to port-forward to it."
      TRACING_URL="http://127.0.0.1:$(echo ${LOCAL_REMOTE_PORTS_TRACING} | cut -d ':' -f 1)"
    fi
  fi
fi

# If the user didn't tell us what the k8s master api endpoint is, try to auto-discover it

if [ -z "${KUBERNETES_API_HOST:-}" -o -z "${KUBERNETES_API_PORT:-}" ]; then
  infomsg "Attempting to auto-discover the Kubernetes API Endpoint..."

  # Get the api server endpoint in the form "host:port" - assumes it is always https and always has a port
  API_SERVER_ENDPOINT_FULL="$(${CLIENT_EXE} cluster-info | head -n 1 | sed 's/.*https:\/\/\(.\+\):\([0-9]\+\).*/\1:\2/g')"
  if ! echo -n ${API_SERVER_ENDPOINT_FULL} | grep -E '.*:[0-9]+' > /dev/null; then
    errormsg "Failed to auto-discover the Kubernetes API Endpoint. Please specify it via --kubernetes-api-host and --kubernetes-api-port"
    exit 1
  fi

  if [ -z "${KUBERNETES_API_HOST:-}" ]; then
    KUBERNETES_API_HOST="$(echo -n ${API_SERVER_ENDPOINT_FULL} | cut -d ':' -f 1)"
  fi
  if [ -z "${KUBERNETES_API_PORT:-}" ]; then
    KUBERNETES_API_PORT="$(echo -n  ${API_SERVER_ENDPOINT_FULL} | cut -d ':' -f 2)"
  fi
fi

# If the user didn't tell us what ui console directory to use, try to determine it or download it

if [ -z "${UI_CONSOLE_DIR:-}" ]; then
  infomsg "Attempting to find the UI Console directory..."

  # See if the user has the typical dev environment. Go up the dir tree to find a 'kiali-ui' directory with a 'build' directory under it.
  cur_path="${SCRIPT_DIR}"
  while [[ ${cur_path} != / ]];
  do
    find_results="$(find "${cur_path}" -maxdepth 1 -mindepth 1 -name "kiali-ui" | head -n 1)"
    if [ ! -z "${find_results}" ]; then
      if [ -d "${find_results}/build" ]; then
        UI_CONSOLE_DIR="${find_results}/build"
        break;
      else
        warnmsg "Directory 'kiali-ui' was found without a 'build' directory - did you forget to build the UI?: ${find_results}"
      fi
    fi
    cur_path="$(readlink -f "${cur_path}"/..)"
  done
  if [ -z "${UI_CONSOLE_DIR:-}" ]; then
    warnmsg "Could not find a local directory containing the UI Console. You can either specify it via --ui-console-dir or download a copy."
    questionchar; read -p "Do you want to download a copy now from npm into the ${TMP_DIR} directory? ('y' or 'n'): " yn
    case $yn in
      [Yy]*) infomsg "OK, attempting to download it..."; UI_CONSOLE_DIR="download";;
      *) errormsg "Aborting. You need to specify the UI Console directory via --ui-console-dir"; exit 1;;
    esac
  fi
fi

if [ "${UI_CONSOLE_DIR}" == "download" ]; then
  UI_CONSOLE_DIR="${TMP_DIR}/console"
  UI_CONSOLE_DOWNLOAD_VERSION="${UI_CONSOLE_DOWNLOAD_VERSION:-${DEFAULT_UI_CONSOLE_DOWNLOAD_VERSION}}"
  infomsg "Attempting to download UI Console version [${UI_CONSOLE_DOWNLOAD_VERSION}] to: ${UI_CONSOLE_DIR}";
  rm -rf ${TMP_DIR}/console
  mkdir -p "${UI_CONSOLE_DIR}"
  curl -s $(npm view @kiali/kiali-ui@${UI_CONSOLE_DOWNLOAD_VERSION} dist.tarball) \
    | tar zxf - --strip-components=2 --directory ${UI_CONSOLE_DIR} package/build || warnmsg "Failed to download UI Console"
fi

# Kiali will log the version of the UI based on version.txt - create a dummy one to avoid a warning message at startup
if [ ! -f "${UI_CONSOLE_DIR}/version.txt" ]; then
  echo "Local-Build" > "${UI_CONSOLE_DIR}/version.txt"
fi

infomsg "===== SETTINGS ====="
echo "API_PROXY_HOST=$API_PROXY_HOST"
echo "API_PROXY_PORT=$API_PROXY_PORT"
echo "CLIENT_EXE=$CLIENT_EXE"
echo "ENABLE_SERVER=$ENABLE_SERVER"
echo "GRAFANA_URL=$GRAFANA_URL"
echo "ISTIO_NAMESPACE=$ISTIO_NAMESPACE"
echo "KIALI_CONFIG_TEMPLATE_FILE=$KIALI_CONFIG_TEMPLATE_FILE"
echo "KIALI_EXE=$KIALI_EXE"
echo "KUBE_CONTEXT=$KUBE_CONTEXT"
echo "KUBERNETES_API_HOST=$KUBERNETES_API_HOST"
echo "KUBERNETES_API_PORT=$KUBERNETES_API_PORT"
echo "KUBERNETES_SERVICE_HOST=$KUBERNETES_SERVICE_HOST"
echo "KUBERNETES_SERVICE_PORT=$KUBERNETES_SERVICE_PORT"
echo "LOCAL_REMOTE_PORTS_GRAFANA=$LOCAL_REMOTE_PORTS_GRAFANA"
echo "LOCAL_REMOTE_PORTS_PROMETHEUS=$LOCAL_REMOTE_PORTS_PROMETHEUS"
echo "LOCAL_REMOTE_PORTS_TRACING=$LOCAL_REMOTE_PORTS_TRACING"
echo "LOG_LEVEL=$LOG_LEVEL"
echo "PROMETHEUS_URL=$PROMETHEUS_URL"
echo "REBOOTABLE=$REBOOTABLE"
echo "TRACING_URL=$TRACING_URL"
echo "UI_CONSOLE_DIR=$UI_CONSOLE_DIR"
echo "UI_CONSOLE_DOWNLOAD_VERSION=${UI_CONSOLE_DOWNLOAD_VERSION:-<unused>}"

# Validate the settings

[ ! -f "${KIALI_CONFIG_TEMPLATE_FILE}" ] && errormsg "Missing the Kiali config file. Make sure --config is correctly specified" && exit 1
[ ! -x "${KIALI_EXE}" ] && errormsg "Missing the Kiali executable. You must build it and make sure --kiali-exe is correctly specified" && exit 1
[ ! -d "${UI_CONSOLE_DIR}" ] && errormsg "Missing the UI Console directory. Make sure --ui-console-dir is correctly specified" && exit 1
if ! echo "${LOCAL_REMOTE_PORTS_GRAFANA}" | grep -qiE "^[0-9]+:[0-9]+$"; then errormsg "Invalid Grafana local-remote ports specifer: ${LOCAL_REMOTE_PORTS_GRAFANA}"; exit 1; fi
if ! echo "${LOCAL_REMOTE_PORTS_PROMETHEUS}" | grep -qiE "^[0-9]+:[0-9]+$"; then errormsg "Invalid Prometheus local-remote ports specifer: ${LOCAL_REMOTE_PORTS_PROMETHEUS}"; exit 1; fi
if ! echo "${LOCAL_REMOTE_PORTS_TRACING}" | grep -qiE "^[0-9]+:[0-9]+$"; then errormsg "Invalid Tracing local-remote ports specifer: ${LOCAL_REMOTE_PORTS_TRACING}"; exit 1; fi
if ! echo "${LOG_LEVEL}" | grep -qiE "^(trace|debug|info|warn|error|fatal)$"; then errormsg "Invalid log level: ${LOG_LEVEL}"; exit 1; fi
[ "${REBOOTABLE}" != "true" -a "${REBOOTABLE}" != "false" ] && errormsg "--rebootable must be 'true' or 'false'" && exit 1
[ "${ENABLE_SERVER}" != "true" -a "${ENABLE_SERVER}" != "false" ] && errormsg "--enable-server must be 'true' or 'false'" && exit 1
[ "${ENABLE_SERVER}" == "false" -a "${REBOOTABLE}" == "true" ] && infomsg "--enable-server was set to false - turning off rebootable flag for you" && REBOOTABLE="false"

# Build the config file from the template

KIALI_CONFIG_FILE="${TMP_DIR}/run-kiali-config.yaml"
cat ${KIALI_CONFIG_TEMPLATE_FILE} | \
  ISTIO_NAMESPACE=${ISTIO_NAMESPACE} \
  PROMETHEUS_URL=${PROMETHEUS_URL} \
  GRAFANA_URL=${GRAFANA_URL} \
  TRACING_URL=${TRACING_URL} \
  UI_CONSOLE_DIR=${UI_CONSOLE_DIR}   \
  envsubst > ${KIALI_CONFIG_FILE}

# Kiali wants the UI Console in a directory called "console" under its cwd

if [ ! -d "${TMP_DIR}/console" ]; then
  ln -s ${UI_CONSOLE_DIR} ${TMP_DIR}/console
fi
cd ${TMP_DIR}

# Obtain the service account token and certificates so we can authenticate with the server
# And then create the dev context that will be used to connect to the cluster.
# Note that if the user elected to use the "current" kube context, we do none of this.
# That means Kiali will connect as the current user with the current context for everything.
# Kiali will report errors in this case because it will be missing the service account, and
# the current user may have permissions that are different than the Kiali service account.
# But the benefit of this is that you do not need to have a Kiali deployment in the cluster.

if [ "${KUBE_CONTEXT}" == "current" ]; then
  KUBE_ORIGINAL_CONTEXT="$(${CLIENT_EXE} config current-context)"
  infomsg "Will use the current context as-is: ${KUBE_ORIGINAL_CONTEXT}"
  warnmsg "Since you will use your own context, expect some errors to occur in the Kiali Server due to missing service account credentials."
else
  TMP_SECRETS_DIR="${TMP_DIR}/secrets"
  mkdir -p "${TMP_SECRETS_DIR}"

  TOKEN_FILE="${TMP_SECRETS_DIR}/token"
  CA_FILE="${TMP_SECRETS_DIR}/ca.crt"

  infomsg "Attempting to obtain the service account token and certificates..."
  SERVICE_ACCOUNT_NAME="$(${CLIENT_EXE} -n ${ISTIO_NAMESPACE} get sa -l app=kiali -o name)"
  if [ -z "${SERVICE_ACCOUNT_NAME}" ]; then
    errormsg "Cannot get the service account name. Kiali must be deployed in [${ISTIO_NAMESPACE}]. If you do not want to deploy Kiali in the cluster, use '--kube-context current'"
    exit 1
  fi
  SERVICE_ACCOUNT_SECRET_NAME="$(${CLIENT_EXE} -n ${ISTIO_NAMESPACE} get ${SERVICE_ACCOUNT_NAME} -o jsonpath='{.secrets[0].name}')"
  ${CLIENT_EXE} -n ${ISTIO_NAMESPACE} get secret ${SERVICE_ACCOUNT_SECRET_NAME} -o jsonpath="{.data.token}" | base64 --decode > "${TOKEN_FILE}"
  ${CLIENT_EXE} -n ${ISTIO_NAMESPACE} get secret ${SERVICE_ACCOUNT_SECRET_NAME} -o jsonpath="{.data['ca\.crt']}" | base64 --decode > "${CA_FILE}"
  if [ ! -s "${TOKEN_FILE}"  ]; then errormsg "Cannot obtain the Kiali service account token"; exit 1; fi
  if [ ! -s "${CA_FILE}"  ]; then errormsg "Cannot obtain the Kiali service account ca.crt"; exit 1; fi
  chmod 'u=r,go=' "${TOKEN_FILE}" "${CA_FILE}"

  # This is a directory hardcoded into the Kial server - there is no way to configure it to be anything else.
  # We must link our token and crt files to that hardcoded path the Kiali server will look for.
  ROOT_SECRETS_DIR="/var/run/secrets/kubernetes.io/serviceaccount"
  if [ ! -d $(dirname ${ROOT_SECRETS_DIR}) ]; then
    errormsg "You first must prepare the secrets directory: sudo mkdir -p $(dirname ${ROOT_SECRETS_DIR}); sudo chmod ugo+w $(dirname ${ROOT_SECRETS_DIR})"
    exit 1
  fi
  rm -f ${ROOT_SECRETS_DIR}
  ln -s "${TMP_SECRETS_DIR}" ${ROOT_SECRETS_DIR}

  # Set up the dev context that we will use to connect to the cluster
  KUBE_ORIGINAL_CONTEXT="$(${CLIENT_EXE} config current-context)"
  if [ "${KUBE_ORIGINAL_CONTEXT}" == "${KUBE_CONTEXT}" ]; then
    errormsg "The current context name is the same as the context to be created [${KUBE_CONTEXT}]. If you want to use the current context, set '--kube-context current'"
    exit 1
  fi
  infomsg "Setting up context [${KUBE_CONTEXT}]"
  ${CLIENT_EXE} config set-cluster ${KUBE_CONTEXT} "--server=https://${KUBERNETES_API_HOST}:${KUBERNETES_API_PORT}" "--certificate-authority=${CA_FILE}"
  ${CLIENT_EXE} config set-credentials ${KUBE_CONTEXT} "--token=$(cat ${TOKEN_FILE})"
  ${CLIENT_EXE} config set-context ${KUBE_CONTEXT} --user=${KUBE_CONTEXT} --cluster=${KUBE_CONTEXT} --namespace=${ISTIO_NAMESPACE}
  ${CLIENT_EXE} config use-context ${KUBE_CONTEXT}
fi

# Functions that port-forward to components we need

start_port_forward_component() {
  local COMPONENT_NAME="${1}"            # e.g. "Prometheus"
  local PORT_FORWARD_JOB_VARNAME="${2}"  # e.g. "PORT_FORWARD_JOB_PROMETHEUS"
  local PORT_FORWARD_DEPLOYMENT="${3}"   # e.g. ${PORT_FORWARD_DEPLOYMENT_PROMETHEUS}
  local LOCAL_REMOTE_PORTS="${4}"        # e.g. "9091:9090"
  local EXPECTED_URL="${5}"              # e.g. ${PROMETHEUS_URL}
  local CMDLINE_OPT="${6}"               # e.g. "--prometheus-url"

  if [ ! -z "${PORT_FORWARD_DEPLOYMENT}" ]; then
    local localport="$(echo ${LOCAL_REMOTE_PORTS} | cut -d ':' -f 1)"
    if lsof -Pi :${localport} -sTCP:LISTEN -t > /dev/null 2>&1; then
      warnmsg "There is something listening on port [${localport}] - will assume it is a port-forward already set up, so no port-forward will be started"
      printf -v "${PORT_FORWARD_JOB_VARNAME}" ""
      if ! curl ${EXPECTED_URL} > /dev/null 2>&1; then
        errormsg "Cannot access the ${COMPONENT_NAME} URL. Make sure this is accessible: ${EXPECTED_URL}"
        cleanup_and_exit 1
      fi
    else
      startmsg "The port-forward to ${COMPONENT_NAME} is being started on [${EXPECTED_URL}]"
      set -m
      (while true; do ${CLIENT_EXE} port-forward -n ${ISTIO_NAMESPACE} ${PORT_FORWARD_DEPLOYMENT} --address=127.0.0.1 ${LOCAL_REMOTE_PORTS} > /dev/null; warnmsg "${COMPONENT_NAME} port-forward died - restarting on [${EXPECTED_URL}]"; sleep 1; done) &
      set +m
      local childpid="$!"
      printf -v "${PORT_FORWARD_JOB_VARNAME}" "$(jobs -lr | grep "${childpid}" | sed 's/.*\[\([0-9]\+\)\].*/\1/')"
      sleep 2 # wait for port-forward to start
      infomsg "${COMPONENT_NAME} port-forward started (pid=${childpid}, job=${!PORT_FORWARD_JOB_VARNAME})"
      if ! curl ${EXPECTED_URL} > /dev/null 2>&1; then
        errormsg "Cannot port-forward to the ${COMPONENT_NAME} component. You must expose it and specify its URL via ${CMDLINE_OPT}"
        cleanup_and_exit 1
      fi
    fi
  else
    printf -v "${PORT_FORWARD_JOB_VARNAME}" ""
    if ! curl ${EXPECTED_URL} > /dev/null 2>&1; then
      errormsg "Cannot access the ${COMPONENT_NAME} URL. Make sure this is accessible: ${EXPECTED_URL}"
      cleanup_and_exit 1
    fi
  fi
}

kill_port_forward_component() {
  local COMPONENT_NAME="${1}"            # e.g. "Prometheus"
  local PORT_FORWARD_JOB_VARNAME="${2}"  # e.g. "PORT_FORWARD_JOB_PROMETHEUS"

  if [ ! -z "${!PORT_FORWARD_JOB_VARNAME:-}" ]; then
    kill %${!PORT_FORWARD_JOB_VARNAME}
    wait %${!PORT_FORWARD_JOB_VARNAME}
    killmsg "The port-forward to ${COMPONENT_NAME} has been killed"
    printf -v "${PORT_FORWARD_JOB_VARNAME}" ""
  fi
}

start_port_forward_prometheus() {
  start_port_forward_component 'Prometheus' 'PORT_FORWARD_JOB_PROMETHEUS' "${PORT_FORWARD_DEPLOYMENT_PROMETHEUS}" "${LOCAL_REMOTE_PORTS_PROMETHEUS}"  "${PROMETHEUS_URL}" '--prometheus-url'
}

kill_port_forward_prometheus() {
  kill_port_forward_component 'Prometheus' 'PORT_FORWARD_JOB_PROMETHEUS'
}

start_port_forward_grafana() {
  start_port_forward_component 'Grafana' 'PORT_FORWARD_JOB_GRAFANA' "${PORT_FORWARD_DEPLOYMENT_GRAFANA}" "${LOCAL_REMOTE_PORTS_GRAFANA}" "${GRAFANA_URL}" '--grafana-url'
}

kill_port_forward_grafana() {
  kill_port_forward_component 'Grafana' 'PORT_FORWARD_JOB_GRAFANA'
}

start_port_forward_tracing() {
  start_port_forward_component 'Tracing' 'PORT_FORWARD_JOB_TRACING' "${PORT_FORWARD_DEPLOYMENT_TRACING}" "${LOCAL_REMOTE_PORTS_TRACING}" "${TRACING_URL}" '--tracing-url'
}

kill_port_forward_tracing() {
  kill_port_forward_component 'Tracing' 'PORT_FORWARD_JOB_TRACING'
}

# Functions that start and stop the proxy

start_proxy() {
  if lsof -Pi @${API_PROXY_HOST}:${API_PROXY_PORT} -sTCP:LISTEN -t > /dev/null 2>&1; then
    warnmsg "There is something listening on port [${API_PROXY_HOST}:${API_PROXY_PORT}] - will assume it is a proxy, so no proxy will be started"
    PROXY_PID=""
  else
    startmsg "The proxy is being started on [${API_PROXY_HOST}:${API_PROXY_PORT}]"
    ${CLIENT_EXE} proxy --address=${API_PROXY_HOST} --port=${API_PROXY_PORT} &
    PROXY_PID="$!"
    while ! lsof -Pi @${API_PROXY_HOST}:${API_PROXY_PORT} -sTCP:LISTEN -t > /dev/null 2>&1; do sleep 1; done # wait for proxy to start
  fi
}

kill_proxy() {
  if [ ! -z "${PROXY_PID:-}" ]; then
    kill ${PROXY_PID}
    wait ${PROXY_PID}
    killmsg "The proxy has been killed"
    PROXY_PID=""
  fi
}

# Functions that start and stop the Kiali server

start_server() {
  if [ "${ENABLE_SERVER}" == "true" ]; then
    startmsg "The Kiali server is being started with config: ${KIALI_CONFIG_FILE}"
    "${KIALI_EXE}" -config "${KIALI_CONFIG_FILE}" &
    SERVER_PID="$!"
  else
    warnmsg "Server has not been enabled; it will not be started."
    SERVER_PID=""
  fi
}

kill_server() {
  if [ ! -z "${SERVER_PID:-}" ]; then
    kill ${SERVER_PID}
    wait ${SERVER_PID}
    killmsg "The Kiali server has been killed"
    SERVER_PID=""
  fi
}

# Signal handler for Control-C reboot

ask_to_restart_or_exit() {
  kill_server
  while true; do
    questionchar; read -p " Do you want to restart Kiali? ('y' or 'n'): " yn
    case $yn in
      [Yy]*) start_server; break;;
      [Nn]*) cleanup_and_exit;;
      *) ;;
    esac
  done
}

# While we have background jobs running, this must be called on exit to clean up things

cleanup_and_exit() {
  kill_server
  kill_proxy
  kill_port_forward_prometheus
  kill_port_forward_grafana
  kill_port_forward_tracing
  restore_original_context

  exitmsg "Exiting"
  exit ${1:-0}
}

restore_original_context() {
  if [ "${KUBE_CONTEXT}" != "current" ]; then
    infomsg "Restoring current context to the original context: ${KUBE_ORIGINAL_CONTEXT}"
    ${CLIENT_EXE} config use-context ${KUBE_ORIGINAL_CONTEXT}
    infomsg "Removing the dev context [${KUBE_CONTEXT}]"
    ${CLIENT_EXE} config delete-cluster ${KUBE_CONTEXT}
    ${CLIENT_EXE} config delete-user ${KUBE_CONTEXT}
    ${CLIENT_EXE} config delete-context ${KUBE_CONTEXT}
  fi
}

# Main - start the server (and optionally the proxy) and wait for user input to tell us what to do next
if [ "${REBOOTABLE}" == "true" ]; then
  infomsg "The server is rebootable. You can reboot the server via [kill $$]. You can kill this script via [kill -USR1 $$]"
else
  infomsg "The server is not rebootable. You can kill this script via either [kill $$] or [kill -USR1 $$]"
fi

start_port_forward_prometheus
start_port_forward_grafana
start_port_forward_tracing
start_proxy

if [ "${ENABLE_SERVER}" == "true" ]; then
  export KUBERNETES_SERVICE_HOST KUBERNETES_SERVICE_PORT LOG_LEVEL
  start_server
else
  infomsg "The server has not been enabled - you must start it manually with the following environment variables and command:"
  cat << STARTCMD
export KUBERNETES_SERVICE_HOST="${KUBERNETES_SERVICE_HOST}"
export KUBERNETES_SERVICE_PORT="${KUBERNETES_SERVICE_PORT}"
export LOG_LEVEL="${LOG_LEVEL}"
"${KIALI_EXE}" -config "${KIALI_CONFIG_FILE}"
STARTCMD
fi

if [ "${REBOOTABLE}" == "true" ]; then
  trap "ask_to_restart_or_exit"    SIGINT  # control-c will prompt to restart the server
  trap "kill_server; start_server" SIGTERM # someone did a manual "kill" - always restart
else
  trap "cleanup_and_exit" SIGINT SIGTERM # always kill everything immediately
fi

trap "warnmsg 'SIGUSR1 received - exiting immediately'; cleanup_and_exit" SIGUSR1 # backdoor kill - always kill everything immediately on SIGUSR1

# Wait forever, waking up periodically to allow for the signal handlers to execute
while true; do sleep 1; done
