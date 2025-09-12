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
# In order to use this, you usually install Kiali the "normal" way
# (i.e. either via the operator or helm). Once installed, the Kiali
# service account and roles will be created; this script will use that
# service account to access the cluster, thus giving it the same
# permissions that Kiali is normally granted. If you do not want to install
# Kiali first, then you must use the "--kube-context current" option.
#
# When running, you can reboot the Kiali server in one of two ways:
#
#   1. Control-C - you will be prompted to reboot the Kiali server or exit
#   2. kill - Kill the server PID which will automatically reboot the Kiali server.
#             To know what PID to kill, you can look for the log message that says:
#             "The server is rebootable. You can reboot the server via [kill ##]."
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

# Some defaults

DEFAULT_API_PROXY_HOST="127.0.0.1"
DEFAULT_API_PROXY_PORT="8001"
DEFAULT_CLIENT_EXE="kubectl"
DEFAULT_COPY_CLUSTER_SECRETS="true"
DEFAULT_ENABLE_SERVER="true"
DEFAULT_ENABLE_GRAFANA="true"
DEFAULT_ENABLE_TRACING="true"
DEFAULT_IGNORE_HOME_CLUSTER="false"
DEFAULT_ISTIO_NAMESPACE="istio-system"
DEFAULT_ISTIOD_URL="http://127.0.0.1:15014/version"
DEFAULT_ISTIOD_SERVICE_NAME="istiod"
DEFAULT_KIALI_CONFIG_TEMPLATE_FILE="${SCRIPT_DIR}/run-kiali-config-template.yaml"
DEFAULT_KIALI_EXE="${GOPATH:-.}/bin/kiali"
DEFAULT_KUBE_CONTEXT="kiali-developer"
DEFAULT_LOCAL_REMOTE_PORTS_GRAFANA="3000:3000"
DEFAULT_LOCAL_REMOTE_PORTS_PROMETHEUS="9091:9090"
DEFAULT_LOCAL_REMOTE_PORTS_TRACING="16686:16686"
DEFAULT_LOCAL_REMOTE_PORTS_PERSES="4000:4000"
DEFAULT_LOG_LEVEL="info"
DEFAULT_REBOOTABLE="true"
DEFAULT_TMP_ROOT_DIR="${HOME}/tmp"
DEFAULT_TRACING_APP="jaeger"
DEFAULT_TRACING_SERVICE="tracing"

# Process command line options

while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -aph|--api-proxy-host)       API_PROXY_HOST="$2";                shift;shift ;;
    -app|--api-proxy-port)       API_PROXY_PORT="$2";                shift;shift ;;
    -c|--config)                 KIALI_CONFIG_TEMPLATE_FILE="$2";    shift;shift ;;
    -ccs|--copy-cluster-secrets) COPY_CLUSTER_SECRETS="$2";          shift;shift ;;
    -ce|--client-exe)            CLIENT_EXE="$2";                    shift;shift ;;
    -cn|--cluster-name)          CLUSTER_NAME="$2";                  shift;shift ;;
    -es|--enable-server)         ENABLE_SERVER="$2";                 shift;shift ;;
    -eg|--enable-grafana)        ENABLE_GRAFANA="$2";                shift;shift ;;
    -et|--enable-tracing)        ENABLE_TRACING="$2";                shift;shift ;;
    -gu|--grafana-url)           GRAFANA_URL="$2";                   shift;shift ;;
    -hkc|--home-kube-context)    HOME_KUBE_CONTEXT="$2";             shift;shift ;;
    -ihc|--ignore-home-cluster)  IGNORE_HOME_CLUSTER="$2";          shift;shift ;;
    -in|--istio-namespace)       ISTIO_NAMESPACE="$2";               shift;shift ;;
    -isn|--istiod-service-name)  ISTIOD_SERVICE_NAME="$2";           shift;shift ;;
    -iu|--istiod-url)            ISTIOD_URL="$2";                    shift;shift ;;
    -kah|--kubernetes-api-host)  KUBERNETES_API_HOST="$2";           shift;shift ;;
    -kap|--kubernetes-api-port)  KUBERNETES_API_PORT="$2";           shift;shift ;;
    -kc|--kube-context)          KUBE_CONTEXT="$2";                  shift;shift ;;
    -ke|--kiali-exe)             KIALI_EXE="$2";                     shift;shift ;;
    -ll|--log-level)             LOG_LEVEL="$2";                     shift;shift ;;
    -peu|--perses-url)           PERSES_URL="$2";                    shift;shift ;;
    -pg|--ports-grafana)         LOCAL_REMOTE_PORTS_GRAFANA="$2";    shift;shift ;;
    -ppe|--ports-perses)         LOCAL_REMOTE_PORTS_PERSES="$2";     shift;shift ;;
    -pp|--ports-prometheus)      LOCAL_REMOTE_PORTS_PROMETHEUS="$2"; shift;shift ;;
    -pt|--ports-tracing)         LOCAL_REMOTE_PORTS_TRACING="$2";    shift;shift ;;
    -pu|--prometheus-url)        PROMETHEUS_URL="$2";                shift;shift ;;
    -r|--rebootable)             REBOOTABLE="$2";                    shift;shift ;;
    -trd|--tmp-root-dir)         TMP_ROOT_DIR="$2";                  shift;shift ;;
    -tr|--tracing-app)           TRACING_APP="$2";                   shift;shift ;;
    -ts|--tracing-service)       TRACING_SERVICE="$2";               shift;shift ;;
    -tn|--tracing-namespace)     TRACING_NAMESPACE="$2";             shift;shift ;;
    -tu|--tracing-url)           TRACING_URL="$2";                   shift;shift ;;
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
  -ccs|--copy-cluster-secrets
      When true, the remote cluster secrets mounted to the Kiali pod will be copied to your
      local file system at /kiali-remote-cluster-secrets. Obviously, Kiali must be deployed
      in the cluster for this option to work.
      Default: ${DEFAULT_COPY_CLUSTER_SECRETS}
  -ce|--client-exe
      Cluster client executable - must refer to 'oc' or 'kubectl'.
      Default: ${DEFAULT_CLIENT_EXE}
  -cn|--cluster-name)
      The name of the Kiali home cluster. This option must be specified if the home cluster name is
      not the same as the active home context.
      Default: <not defined>
  -es|--enable-server
      When 'true', this script will start the server and manage its lifecycle.
      When 'false' this script will do nothing to start or stop the server.
      The purpose of this setting is to allow for this script to work while debugging the server in
      a debugging IDE. When 'false', this script will do everything else except start the server, which
      will be the job of an external tool such as an IDE. When 'false' this script will print out a command
      so you can know what that external tool should execute to start a properly configured server.
      Default: ${DEFAULT_ENABLE_SERVER}
  -eg|--enable-grafana
      When true, Grafana integration will be enabled and Grafana URL will be auto-discovered or
      used from --grafana-url. When false, Grafana integration will be completely disabled.
      Default: ${DEFAULT_ENABLE_GRAFANA}
  -et|--enable-tracing
      When true, tracing integration will be enabled and tracing URL will be auto-discovered or
      used from --tracing-url. When false, tracing integration will be completely disabled.
      Default: ${DEFAULT_ENABLE_TRACING}
  -gu|--grafana-url
      The URL that can be used to query the exposed Grafana service. You must have exposed Grafana
      to external clients outside of the cluster - that external URL is what this value should be.
      For example, for OpenShift clusters, this should be the Grafana Route URL.
      Default: <will be auto-discovered>
  -hkc|--home-kube-context
      The kubernetes context to use specifically when talking to the Kiali pod to download secrets.
      For all other operations, the --kube-context value will be used.
      If not specified, the --kube-context value will be used as the default.
      Default: <same as --kube-context>
  -ihc|--ignore-home-cluster
      When true, Kiali won't consider the home cluster as part of the mesh.
      Set this when testing the external deployment mode.
      Default: ${DEFAULT_IGNORE_HOME_CLUSTER}
  -in|--istio-namespace
      The name of the control plane namespace - this is where Istio components are installed.
      Default: ${DEFAULT_ISTIO_NAMESPACE}
  -isn|--istiod-service-name
      The name of the istiod service.
      This is used in conjunction with the istiod URL in order to port forward to istiod.
      Default: ${DEFAULT_ISTIOD_SERVICE_NAME}
  -iu|--istiod-url
      The URL of the istiod endpoint.
      Default: ${DEFAULT_ISTIOD_URL}
  -kah|--kubernetes-api-host
      The hostname of the Kubernetes API Endpoint.
      Default: <will be auto-discovered>
  -kap|--kubernetes-api-port
      The port that the Kubernetes API Endpoint is listening to.
      Default: <will be auto-discovered>
  -kc|--kube-context
      The context used to connect to the cluster. This is a context that will be
      created/modified in order to proxy the requests to the API server.
      This context will be associated with the Kiali service account.
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
  -peu|--perses-url
        The URL that can be used to query the exposed Perses service. You must have exposed Perses
        to external clients outside of the cluster - that external URL is what this value should be.
        For example, for OpenShift clusters, this should be the Perses Route URL.
        Default: <will be auto-discovered>
  -pg|--ports-grafana
      If a port-forward is created for the Grafana component, this specifies the
      local and remote ports separated with a colon.
      Default: ${DEFAULT_LOCAL_REMOTE_PORTS_GRAFANA}
  -pp|--ports-prometheus
      If a port-forward is created for the Prometheus component, this specifies the
      local and remote ports separated with a colon.
      Default: ${DEFAULT_LOCAL_REMOTE_PORTS_PROMETHEUS}
  -ppe|--ports-perses
      If a port-forward is created for the perses component, this specifies the
      local and remote ports separated with a colon.
      Default: ${DEFAULT_LOCAL_REMOTE_PORTS_PERSES}
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
  -trd|--tmp-root-dir)
      Where temporary files and directories will be created.
      Default: ${DEFAULT_TMP_ROOT_DIR}
  -tr|--tracing-app)
      Tracing backend. Jaeger, tempo-query-frontend
      Default: ${DEFAULT_TRACING_APP}
  -ts|--tracing-service)
      Tracing service. tracing, tempo-query-frontend, ...
      Default: ${DEFAULT_TRACING_SERVICE}
  -tn|--tracing-namespace)
      Tracing backend namespace
      Default: ${DEFAULT_ISTIO_NAMESPACE}
  -tu|--tracing-url
      The URL that can be used to query the exposed Tracing service. You must have exposed Tracing
      to external clients outside of the cluster - that external URL is what this value should be.
      For example, for OpenShift clusters, this should be the Tracing (e.g. Jaeger) Route URL.
      Default: <will be auto-discovered>
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
CLUSTER_NAME="${CLUSTER_NAME:-}"
COPY_CLUSTER_SECRETS="${COPY_CLUSTER_SECRETS:-${DEFAULT_COPY_CLUSTER_SECRETS}}"
ENABLE_SERVER="${ENABLE_SERVER:-${DEFAULT_ENABLE_SERVER}}"
ENABLE_GRAFANA="${ENABLE_GRAFANA:-${DEFAULT_ENABLE_GRAFANA}}"
ENABLE_TRACING="${ENABLE_TRACING:-${DEFAULT_ENABLE_TRACING}}"
IGNORE_HOME_CLUSTER="${IGNORE_HOME_CLUSTER:-${DEFAULT_IGNORE_HOME_CLUSTER}}"
ISTIO_NAMESPACE="${ISTIO_NAMESPACE:-${DEFAULT_ISTIO_NAMESPACE}}"
KIALI_CONFIG_TEMPLATE_FILE="${KIALI_CONFIG_TEMPLATE_FILE:-${DEFAULT_KIALI_CONFIG_TEMPLATE_FILE}}"
KIALI_EXE="${KIALI_EXE:-${DEFAULT_KIALI_EXE}}"
KUBE_CONTEXT="${KUBE_CONTEXT:-${DEFAULT_KUBE_CONTEXT}}"
HOME_KUBE_CONTEXT="${HOME_KUBE_CONTEXT:-${KUBE_CONTEXT}}" # uses KUBE_CONTEXT as default, that's why it appears after KUBE_CONTEXT
LOCAL_REMOTE_PORTS_GRAFANA="${LOCAL_REMOTE_PORTS_GRAFANA:-${DEFAULT_LOCAL_REMOTE_PORTS_GRAFANA}}"
LOCAL_REMOTE_PORTS_PROMETHEUS="${LOCAL_REMOTE_PORTS_PROMETHEUS:-${DEFAULT_LOCAL_REMOTE_PORTS_PROMETHEUS}}"
LOCAL_REMOTE_PORTS_TRACING="${LOCAL_REMOTE_PORTS_TRACING:-${DEFAULT_LOCAL_REMOTE_PORTS_TRACING}}"
LOCAL_REMOTE_PORTS_PERSES="${LOCAL_REMOTE_PORTS_PERSES:-${DEFAULT_LOCAL_REMOTE_PORTS_PERSES}}"
LOG_LEVEL="${LOG_LEVEL:-${DEFAULT_LOG_LEVEL}}"
REBOOTABLE="${REBOOTABLE:-${DEFAULT_REBOOTABLE}}"
TMP_ROOT_DIR="${TMP_ROOT_DIR:-${DEFAULT_TMP_ROOT_DIR}}"
TRACING_APP="${TRACING_APP:-${DEFAULT_TRACING_APP}}"
TRACING_SERVICE="${TRACING_SERVICE:-${DEFAULT_TRACING_SERVICE}}"
TRACING_NAMESPACE="${TRACING_NAMESPACE:-${ISTIO_NAMESPACE}}"

# these are the env vars required by the Kiali server itself
KUBERNETES_SERVICE_HOST="${API_PROXY_HOST}"
KUBERNETES_SERVICE_PORT="${API_PROXY_PORT}"

# this is the secret we will manage if we need to set up our own context
SERVICE_ACCOUNT_SECRET_NAME="runkiali-secret"

# This is a directory where we write temp files needed to run Kiali locally

TMP_DIR="${TMP_ROOT_DIR}/run-kiali"
rm -rf ${TMP_ROOT_DIR}/run-kiali
mkdir -p ${TMP_DIR}

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

# Port forward data for Istiod, used for the Istiod URL
ISTIOD_SERVICE_NAME="${ISTIOD_SERVICE_NAME:-${DEFAULT_ISTIOD_SERVICE_NAME}}"
PORT_FORWARD_SERVICE_ISTIOD="service/${ISTIOD_SERVICE_NAME}"
LOCAL_REMOTE_PORTS_ISTIOD="15014:15014"
# Use default only if ISTIOD_URL is unset, not if it's explicitly set to empty
ISTIOD_URL="${ISTIOD_URL-${DEFAULT_ISTIOD_URL}}"


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
        prom_remote_port="$(${CLIENT_EXE} get service -n ${ISTIO_NAMESPACE} prometheus -o jsonpath='{.spec.ports[0].targetPort}')"
        if [ "$?" != "0" -o -z "${prom_remote_port}" ]; then
          warnmsg "Cannot auto-discover Prometheus port on OpenShift. If you exposed it, you can specify the Prometheus URL via --prometheus-url. For now, this session will attempt to port-forward to it."
        else
          prom_local_port="$(echo ${LOCAL_REMOTE_PORTS_PROMETHEUS} | cut -d ':' -f 1)"
          LOCAL_REMOTE_PORTS_PROMETHEUS="${prom_local_port}:${prom_remote_port}"
        fi
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
      prom_remote_port="$(${CLIENT_EXE} get service -n ${ISTIO_NAMESPACE} prometheus -o jsonpath='{.spec.ports[0].targetPort}')"
      if [ "$?" != "0" -o -z "${prom_remote_port}" ]; then
        warnmsg "Failed to port forward. Cannot auto-discover Prometheus port on Kubernetes. If you exposed it, you can specify the Prometheus URL via --prometheus-url. For now, this session will attempt to port-forward to it."
      else
        prom_local_port="$(echo ${LOCAL_REMOTE_PORTS_PROMETHEUS} | cut -d ':' -f 1)"
        LOCAL_REMOTE_PORTS_PROMETHEUS="${prom_local_port}:${prom_remote_port}"
      fi
      PROMETHEUS_URL="http://127.0.0.1:$(echo ${LOCAL_REMOTE_PORTS_PROMETHEUS} | cut -d ':' -f 1)"
    fi
  fi
fi

# If the user didn't tell us what the Grafana URL is, try to auto-discover it

PORT_FORWARD_DEPLOYMENT_GRAFANA=""
if [ "${ENABLE_GRAFANA}" == "false" ]; then
  infomsg "Grafana integration is disabled via --enable-grafana=false"
  GRAFANA_URL=""
  GRAFANA_ENABLED="false"
elif [ -z "${GRAFANA_URL:-}" ]; then
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    graf_host="$(${CLIENT_EXE} get route -n ${ISTIO_NAMESPACE} grafana -o jsonpath='{.spec.host}')"
    if [ "$?" != "0" -o -z "${graf_host}" ]; then
      PORT_FORWARD_DEPLOYMENT_GRAFANA="$(${CLIENT_EXE} get deployment -n ${ISTIO_NAMESPACE} grafana -o name)"
      if [ "$?" != "0" -o -z "${PORT_FORWARD_DEPLOYMENT_GRAFANA}" ]; then
        errormsg "Cannot auto-discover Grafana on OpenShift. You must specify the Grafana URL via --grafana-url"
        exit 1
      else
        warnmsg "Cannot auto-discover Grafana on OpenShift. If you exposed it, you can specify the Grafana URL via --grafana-url. For now, this session will attempt to port-forward to it."
        graf_remote_port="$(${CLIENT_EXE} get service -n ${ISTIO_NAMESPACE} grafana -o jsonpath='{.spec.ports[0].targetPort}')"
        if [ "$?" != "0" -o -z "${graf_remote_port}" ]; then
          warnmsg "Cannot auto-discover Grafana port on OpenShift. If you exposed it, you can specify the Grafana URL via --grafana-url. For now, this session will attempt to port-forward to it."
        else
          graf_local_port="$(echo ${LOCAL_REMOTE_PORTS_GRAFANA} | cut -d ':' -f 1)"
          LOCAL_REMOTE_PORTS_GRAFANA="${graf_local_port}:${graf_remote_port}"
        fi
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
      graf_remote_port="$(${CLIENT_EXE} get service -n ${ISTIO_NAMESPACE} grafana -o jsonpath='{.spec.ports[0].targetPort}')"
      if [ "$?" != "0" -o -z "${graf_remote_port}" ]; then
        warnmsg "Cannot auto-discover Grafana port on Kubernetes. If you exposed it, you can specify the Grafana URL via --grafana-url. For now, this session will attempt to port-forward to it."
      else
        graf_local_port="$(echo ${LOCAL_REMOTE_PORTS_GRAFANA} | cut -d ':' -f 1)"
        LOCAL_REMOTE_PORTS_GRAFANA="${graf_local_port}:${graf_remote_port}"
      fi
      GRAFANA_URL="http://127.0.0.1:$(echo ${LOCAL_REMOTE_PORTS_GRAFANA} | cut -d ':' -f 1)"
    fi
  fi
  GRAFANA_ENABLED="true"
else
  GRAFANA_ENABLED="true"
fi

# If the user didn't tell us what the Perses URL is, try to auto-discover it

PORT_FORWARD_DEPLOYMENT_PERSES=""
if [ -z "${PERSES_URL:-}" ]; then
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    graf_host="$(${CLIENT_EXE} get route -n ${ISTIO_NAMESPACE} perses -o jsonpath='{.spec.host}')"
    if [ "$?" != "0" -o -z "${pers_host}" ]; then
      PORT_FORWARD_DEPLOYMENT_PERSES="$(${CLIENT_EXE} get deployment -n ${ISTIO_NAMESPACE} perses -o name)"
      if [ "$?" != "0" -o -z "${PORT_FORWARD_DEPLOYMENT_PERSES}" ]; then
        errormsg "Cannot auto-discover Perses on OpenShift. You must specify the Perses URL via --perses-url. Skipping"
      else
        warnmsg "Cannot auto-discover Perses on OpenShift. If you exposed it, you can specify the Perses URL via --perses-url. For now, this session will attempt to port-forward to it."
        graf_remote_port="$(${CLIENT_EXE} get service -n ${ISTIO_NAMESPACE} perses -o jsonpath='{.spec.ports[0].targetPort}')"
        if [ "$?" != "0" -o -z "${graf_remote_port}" ]; then
          warnmsg "Cannot auto-discover Perses port on OpenShift. If you exposed it, you can specify the Perses URL via --perses-url. For now, this session will attempt to port-forward to it."
        else
          graf_local_port="$(echo ${LOCAL_REMOTE_PORTS_PERSES} | cut -d ':' -f 1)"
          LOCAL_REMOTE_PORTS_PERSES="${pers_local_port}:${pers_remote_port}"
        fi
        PERSES_URL="http://127.0.0.1:$(echo ${LOCAL_REMOTE_PORTS_PERSES} | cut -d ':' -f 1)"
      fi
    else
      infomsg "Auto-discovered OpenShift route that exposes Perses"
      PERSES_URL="http://${pers_host}"
    fi
  else
    PORT_FORWARD_DEPLOYMENT_PERSES="$(${CLIENT_EXE} get deployment -n ${ISTIO_NAMESPACE} perses -o name)"
    if [ "$?" != "0" -o -z "${PORT_FORWARD_DEPLOYMENT_PERSES}" ]; then
      errormsg "Cannot auto-discover Perses on Kubernetes. You must specify the Perses URL via --perses-url. Skipping"
    else
      warnmsg "Cannot auto-discover Perses on Kubernetes. If you exposed it, you can specify the Perses URL via --perses-url. For now, this session will attempt to port-forward to it."
      graf_remote_port="$(${CLIENT_EXE} get service -n ${ISTIO_NAMESPACE} perses -o jsonpath='{.spec.ports[0].targetPort}')"
      if [ "$?" != "0" -o -z "${graf_remote_port}" ]; then
        warnmsg "Cannot auto-discover Perses port on Kubernetes. If you exposed it, you can specify the Perses URL via --perses-url. For now, this session will attempt to port-forward to it."
      else
        graf_local_port="$(echo ${LOCAL_REMOTE_PORTS_PERSES} | cut -d ':' -f 1)"
        LOCAL_REMOTE_PORTS_PERSES="${graf_local_port}:${graf_remote_port}"
      fi
      PERSES_URL="http://127.0.0.1:$(echo ${LOCAL_REMOTE_PORTS_PERSES} | cut -d ':' -f 1)"
    fi
  fi
fi

# If the user didn't tell us what the Tracing URL is, try to auto-discover it

PORT_FORWARD_DEPLOYMENT_TRACING=""
if [ "${ENABLE_TRACING}" == "false" ]; then
  infomsg "Tracing integration is disabled via --enable-tracing=false"
  TRACING_URL=""
  TRACING_ENABLED="false"
elif [ -z "${TRACING_URL:-}" ]; then
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    trac_host="$(${CLIENT_EXE} get route -n ${TRACING_NAMESPACE} ${TRACING_SERVICE} -o jsonpath='{.spec.host}')"
    if [ "$?" != "0" -o -z "${trac_host}" ]; then
      trac_host="$(${CLIENT_EXE} get route -n ${TRACING_NAMESPACE} ${TRACING_APP} -o jsonpath='{.spec.host}')"
    fi
    if [ "$?" != "0" -o -z "${trac_host}" ]; then
      PORT_FORWARD_DEPLOYMENT_TRACING="$(${CLIENT_EXE} get deployment -n ${TRACING_NAMESPACE} ${TRACING_APP} -o name)"
      if [ "$?" != "0" -o -z "${PORT_FORWARD_DEPLOYMENT_TRACING}" ]; then
        errormsg "Cannot auto-discover Tracing on OpenShift. You must specify the Tracing URL via --tracing-url"
        exit 1
      else
        warnmsg "Cannot auto-discover Tracing on OpenShift. If you exposed it, you can specify the Tracing URL via --tracing-url. For now, this session will attempt to port-forward to it."
        trac_remote_port="$(${CLIENT_EXE} get service -n ${TRACING_NAMESPACE} ${TRACING_SERVICE} -o jsonpath='{.spec.ports[0].targetPort}')"
        if [ "$?" != "0" -o -z "${trac_remote_port}" ]; then
          warnmsg "Cannot auto-discover Tracing port on OpenShift. If you exposed it, you can specify the Tracing URL via --tracing-url. For now, this session will attempt to port-forward to it."
        else
          trac_local_port="$(echo ${LOCAL_REMOTE_PORTS_TRACING} | cut -d ':' -f 1)"
          LOCAL_REMOTE_PORTS_TRACING="${trac_local_port}:${trac_remote_port}"
        fi
        [ ${TRACING_APP} == 'jaeger' ] && TRACING_PREFIX="/jaeger" || TRACING_PREFIX=""
        TRACING_URL="http://127.0.0.1:$(echo ${LOCAL_REMOTE_PORTS_TRACING} | cut -d ':' -f 1)${TRACING_PREFIX}"
      fi
    else
      infomsg "Auto-discovered OpenShift route that exposes Tracing"
      TRACING_URL="http://${trac_host}"
    fi
  else
    PORT_FORWARD_DEPLOYMENT_TRACING="$(${CLIENT_EXE} get deployment -n ${TRACING_NAMESPACE} ${TRACING_APP} -o name)"
    if [ "$?" != "0" -o -z "${PORT_FORWARD_DEPLOYMENT_TRACING}" ]; then
      errormsg "Cannot auto-discover Tracing on Kubernetes. You must specify the Tracing URL via --tracing-url"
      exit 1
    else
      warnmsg "Cannot auto-discover Tracing on Kubernetes. If you exposed it, you can specify the Tracing URL via --tracing-url. For now, this session will attempt to port-forward to it."
      if [[ "$TRACING_SERVICE" == *"tempo"* ]]; then
        trac_remote_port="$(${CLIENT_EXE} get service -n ${TRACING_NAMESPACE} ${TRACING_SERVICE} -o jsonpath='{.spec.ports[3].port}')"
      else
        trac_remote_port="$(${CLIENT_EXE} get service -n ${TRACING_NAMESPACE} ${TRACING_SERVICE} -o jsonpath='{.spec.ports[0].targetPort}')"
      fi
      if [ "$?" != "0" -o -z "${trac_remote_port}" ]; then
        warnmsg "Cannot auto-discover Tracing port on Kubernetes. If you exposed it, you can specify the Tracing URL via --tracing-url. For now, this session will attempt to port-forward to it."
      else
        trac_local_port="$(echo ${LOCAL_REMOTE_PORTS_TRACING} | cut -d ':' -f 1)"
        LOCAL_REMOTE_PORTS_TRACING="${trac_local_port}:${trac_remote_port}"
      fi
      [ ${TRACING_APP} == 'jaeger' ] && TRACING_PREFIX="/jaeger" || TRACING_PREFIX=""
      TRACING_URL="http://127.0.0.1:$(echo ${LOCAL_REMOTE_PORTS_TRACING} | cut -d ':' -f 1)${TRACING_PREFIX}"
    fi
  fi
  TRACING_ENABLED="true"
else
  TRACING_ENABLED="true"
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

infomsg "===== SETTINGS ====="
echo "API_PROXY_HOST=$API_PROXY_HOST"
echo "API_PROXY_PORT=$API_PROXY_PORT"
echo "CLIENT_EXE=$CLIENT_EXE"
echo "CLUSTER_NAME=$CLUSTER_NAME"
echo "COPY_CLUSTER_SECRETS=$COPY_CLUSTER_SECRETS"
echo "ENABLE_SERVER=$ENABLE_SERVER"
echo "ENABLE_GRAFANA=$ENABLE_GRAFANA"
echo "ENABLE_TRACING=$ENABLE_TRACING"
echo "GRAFANA_URL=$GRAFANA_URL"
echo "GRAFANA_ENABLED=$GRAFANA_ENABLED"
echo "HOME_KUBE_CONTEXT=$HOME_KUBE_CONTEXT"
echo "IGNORE_HOME_CLUSTER=$IGNORE_HOME_CLUSTER"
echo "ISTIO_NAMESPACE=$ISTIO_NAMESPACE"
echo "ISTIOD_URL=$ISTIOD_URL"
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
echo "LOCAL_REMOTE_PORTS_PERSES=$LOCAL_REMOTE_PORTS_PERSES"
echo "LOG_LEVEL=$LOG_LEVEL"
if [[ -v PERSES_URL && -n "${PERSES_URL}" ]]; then
  echo "PERSES_URL=$PERSES_URL"
fi
echo "PROMETHEUS_URL=$PROMETHEUS_URL"
echo "REBOOTABLE=$REBOOTABLE"
echo "TMP_ROOT_DIR=$TMP_ROOT_DIR"
echo "TRACING_APP=$TRACING_APP"
echo "TRACING_SERVICE=$TRACING_SERVICE"
echo "TRACING_NAMESPACE=$TRACING_NAMESPACE"
echo "TRACING_URL=$TRACING_URL"
echo "TRACING_ENABLED=$TRACING_ENABLED"

# Validate the settings

[ ! -f "${KIALI_CONFIG_TEMPLATE_FILE}" ] && errormsg "Missing the Kiali config file. Make sure --config is correctly specified" && exit 1
[ ! -x "${KIALI_EXE}" ] && errormsg "Missing the Kiali executable. You must build it and make sure --kiali-exe is correctly specified" && exit 1
if ! echo "${LOCAL_REMOTE_PORTS_GRAFANA}" | grep -qiE "^[0-9]+:[0-9]+$"; then errormsg "Invalid Grafana local-remote ports specifer: ${LOCAL_REMOTE_PORTS_GRAFANA}"; exit 1; fi
if ! echo "${LOCAL_REMOTE_PORTS_PERSES}" | grep -qiE "^[0-9]+:[0-9]+$"; then errormsg "Invalid Perses local-remote ports specifer: ${LOCAL_REMOTE_PORTS_PERSES}"; exit 1; fi
if ! echo "${LOCAL_REMOTE_PORTS_PROMETHEUS}" | grep -qiE "^[0-9]+:[0-9]+$"; then errormsg "Invalid Prometheus local-remote ports specifer: ${LOCAL_REMOTE_PORTS_PROMETHEUS}"; exit 1; fi
if ! echo "${LOCAL_REMOTE_PORTS_TRACING}" | grep -qiE "^[0-9]+:[0-9]+$"; then errormsg "Invalid Tracing local-remote ports specifer: ${LOCAL_REMOTE_PORTS_TRACING}"; exit 1; fi
if ! echo "${LOG_LEVEL}" | grep -qiE "^(trace|debug|info|warn|error|fatal)$"; then errormsg "Invalid log level: ${LOG_LEVEL}"; exit 1; fi
[ "${REBOOTABLE}" != "true" -a "${REBOOTABLE}" != "false" ] && errormsg "--rebootable must be 'true' or 'false'" && exit 1
[ "${ENABLE_SERVER}" != "true" -a "${ENABLE_SERVER}" != "false" ] && errormsg "--enable-server must be 'true' or 'false'" && exit 1
[ "${ENABLE_SERVER}" == "false" -a "${REBOOTABLE}" == "true" ] && infomsg "--enable-server was set to false - turning off rebootable flag for you" && REBOOTABLE="false"
[ "${ENABLE_GRAFANA}" != "true" -a "${ENABLE_GRAFANA}" != "false" ] && errormsg "--enable-grafana must be 'true' or 'false'" && exit 1
[ "${ENABLE_TRACING}" != "true" -a "${ENABLE_TRACING}" != "false" ] && errormsg "--enable-tracing must be 'true' or 'false'" && exit 1
[ "${IGNORE_HOME_CLUSTER}" != "true" -a "${IGNORE_HOME_CLUSTER}" != "false" ] && errormsg "--ignore-home-cluster must be 'true' or 'false'" && exit 1
[ "${COPY_CLUSTER_SECRETS}" != "true" -a "${COPY_CLUSTER_SECRETS}" != "false" ] && errormsg "--copy-cluster-secrets must be 'true' or 'false'" && exit 1

# Build the config file from the template

KIALI_CONFIG_FILE="${TMP_DIR}/run-kiali-config.yaml"
cat ${KIALI_CONFIG_TEMPLATE_FILE} | \
  ISTIO_NAMESPACE=${ISTIO_NAMESPACE} \
  CLUSTER_NAME=${CLUSTER_NAME} \
  ISTIOD_URL=${ISTIOD_URL} \
  PROMETHEUS_URL=${PROMETHEUS_URL} \
  GRAFANA_URL=${GRAFANA_URL} \
  GRAFANA_ENABLED=${GRAFANA_ENABLED} \
  TRACING_APP=${TRACING_APP} \
  TRACING_URL=${TRACING_URL} \
  TRACING_ENABLED=${TRACING_ENABLED} \
  IGNORE_HOME_CLUSTER=${IGNORE_HOME_CLUSTER} \
  envsubst > ${KIALI_CONFIG_FILE}

# Set kubernetes_config.cluster_name only if the user told us to configure a specific cluster name
if [ -n "${CLUSTER_NAME}" ]; then
  cat << EOM >> ${KIALI_CONFIG_FILE}

kubernetes_config:
  cluster_name: "${CLUSTER_NAME}"
EOM
fi

# Kiali wants the UI Console in a directory called "console" under its cwd

cd ${TMP_DIR}

# If we are told to copy the remote cluster secrets, prepare the local directory
# and pull the files down from the Kiali pod. If there is no Kiali pod deployed,
# then spit out a warning but keep going.
# We always prepare the kiali-remote-cluster-secrets location because we will
# at minimum put our local cluster kubeconfig there (we do that later in the script).

# Unless this dir already exists, it will most likely fail to be created because
# creating a directory under the root directory usually requires sudo access.
REMOTE_CLUSTER_SECRETS_DIR="/kiali-remote-cluster-secrets"
mkdir -p ${REMOTE_CLUSTER_SECRETS_DIR}
if [ ! -d ${REMOTE_CLUSTER_SECRETS_DIR} ]; then
  errormsg "You first must prepare the remote cluster secrets directory: sudo mkdir -p ${REMOTE_CLUSTER_SECRETS_DIR}; sudo chmod ugo+w ${REMOTE_CLUSTER_SECRETS_DIR}"
  exit 1
fi
rm -rf ${REMOTE_CLUSTER_SECRETS_DIR}/*

# remote clusters
if [ "${COPY_CLUSTER_SECRETS}" == "true" ]; then
  infomsg "Attempting to copy the remote cluster secrets from a Kiali pod deployed in the cluster..."
  # Determine the context option for secret operations
  if [ "${HOME_KUBE_CONTEXT}" != "current" ]; then
    HOME_CONTEXT_OPT="--context=${HOME_KUBE_CONTEXT}"
  else
    HOME_CONTEXT_OPT=""
  fi
  POD_NAME="$(${CLIENT_EXE} ${HOME_CONTEXT_OPT} -n ${ISTIO_NAMESPACE} get pod -l app.kubernetes.io/name=kiali -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)"
  if [ -z "${POD_NAME}" ]; then
    warnmsg "Cannot get the Kiali pod name. Kiali must be deployed in [${ISTIO_NAMESPACE}]. If you do not want to deploy Kiali in the cluster, set '--copy-cluster-secrets' to 'false'."
  else
    infomsg "Will copy remote cluster secrets from the Kiali pod [${HOME_KUBE_CONTEXT}/${ISTIO_NAMESPACE}/${POD_NAME}]"

    # if the directory doesn't exist, then no remote secrets are available, so skip everything else
    ${CLIENT_EXE} ${HOME_CONTEXT_OPT} exec -n ${ISTIO_NAMESPACE} --stdin --tty pod/${POD_NAME} -- ls -d ${REMOTE_CLUSTER_SECRETS_DIR} >&/dev/null
    if [ "$?" == "0" ]; then
      pod_remote_secrets_dirs=$(${CLIENT_EXE} ${HOME_CONTEXT_OPT} exec -n ${ISTIO_NAMESPACE} --stdin --tty pod/${POD_NAME} -- ls -1 ${REMOTE_CLUSTER_SECRETS_DIR} | tr -d '\r')
      for d in $pod_remote_secrets_dirs; do
        mkdir -p "${REMOTE_CLUSTER_SECRETS_DIR}/$d"
        pod_remote_secrets_files=$(${CLIENT_EXE} ${HOME_CONTEXT_OPT} exec -n ${ISTIO_NAMESPACE} --stdin --tty pod/${POD_NAME} -- ls -1 ${REMOTE_CLUSTER_SECRETS_DIR}/${d} | tr -d '\r')
        for f in $pod_remote_secrets_files; do
          infomsg "Copying remote cluster secret file: ${REMOTE_CLUSTER_SECRETS_DIR}/${d}/${f}"
          secret_file_content=$(${CLIENT_EXE} ${HOME_CONTEXT_OPT} exec -n ${ISTIO_NAMESPACE} --stdin --tty pod/${POD_NAME} -- cat ${REMOTE_CLUSTER_SECRETS_DIR}/${d}/${f})
          echo "${secret_file_content}" > ${REMOTE_CLUSTER_SECRETS_DIR}/${d}/${f}
        done
      done
    else
      infomsg "There are no remote cluster secrets mounted on the Kiali pod."
    fi
  fi
fi

# Obtain the service account token and certificates so we can authenticate with the server
# And then create the dev context that will be used to connect to the cluster.
# Note that if the user elected to use the "current" kube context, we do none of this.
# That means Kiali will connect as the current user with the current context for everything.
# Kiali will report errors in this case because it will be missing the service account, and
# the current user may have permissions that are different than the Kiali service account.
# But the benefit of this is that you do not need to have a Kiali deployment in the cluster.
REMOTE_SECRET_PATH="${TMP_DIR}/kubeconfig"
if [ "${HOME_KUBE_CONTEXT}" != "current" ] && ! ${CLIENT_EXE} config get-contexts "${HOME_KUBE_CONTEXT}" >/dev/null 2>&1; then
  TOKEN_FILE="${TMP_DIR}/token"
  CA_FILE="${TMP_DIR}/ca.crt"

  infomsg "Attempting to obtain the service account token and certificates..."
  SERVICE_ACCOUNT_NAME="$(${CLIENT_EXE} -n ${ISTIO_NAMESPACE} get sa -l app.kubernetes.io/name=kiali -o jsonpath={.items[0].metadata.name})"
  if [ -z "${SERVICE_ACCOUNT_NAME}" ]; then
    errormsg "Cannot get the service account name. Kiali must be deployed in [${ISTIO_NAMESPACE}]. If you do not want to deploy Kiali in the cluster, use '--kube-context current'"
    exit 1
  fi

  # Newer k8s/OpenShift clusters no longer provide secrets for SAs - so manually create a secret that will contain the certs/token
  cat <<EOM | ${CLIENT_EXE} apply -f -
apiVersion: v1
kind: Secret
metadata:
  name: ${SERVICE_ACCOUNT_SECRET_NAME}
  namespace: ${ISTIO_NAMESPACE}
  annotations:
    kubernetes.io/service-account.name: ${SERVICE_ACCOUNT_NAME}
type: kubernetes.io/service-account-token
EOM

  wait_for_secret=1
  until [ $wait_for_secret -eq 5 ] || [ "$(${CLIENT_EXE} -n ${ISTIO_NAMESPACE} get secret ${SERVICE_ACCOUNT_SECRET_NAME} -o jsonpath="{.data.token}" 2> /dev/null)" != "" ] ; do
    sleep $(( wait_for_secret++ ))
  done

  ${CLIENT_EXE} -n ${ISTIO_NAMESPACE} get secret ${SERVICE_ACCOUNT_SECRET_NAME} -o jsonpath="{.data.token}" | base64 --decode > "${TOKEN_FILE}"
  ${CLIENT_EXE} -n ${ISTIO_NAMESPACE} get secret ${SERVICE_ACCOUNT_SECRET_NAME} -o jsonpath="{.data['ca\.crt']}" | base64 --decode > "${CA_FILE}"
  if [ ! -s "${TOKEN_FILE}"  ]; then errormsg "Cannot obtain the Kiali service account token"; exit 1; fi
  if [ ! -s "${CA_FILE}"  ]; then errormsg "Cannot obtain the Kiali service account ca.crt"; exit 1; fi
  chmod 'u=r,go=' "${TOKEN_FILE}" "${CA_FILE}"

  infomsg "Setting up kubeconfig at [${REMOTE_SECRET_PATH}]"
  # Embedding the ca cert so we don't have pathing issues.
  ${CLIENT_EXE} config set-cluster ${KUBE_CONTEXT} --kubeconfig="${REMOTE_SECRET_PATH}" "--server=https://${KUBERNETES_API_HOST}:${KUBERNETES_API_PORT}" --certificate-authority="${CA_FILE}" --embed-certs
  ${CLIENT_EXE} config set-credentials ${KUBE_CONTEXT} --kubeconfig="${REMOTE_SECRET_PATH}" --token="$(cat ${TOKEN_FILE})"
  ${CLIENT_EXE} config set-context ${KUBE_CONTEXT} --kubeconfig="${REMOTE_SECRET_PATH}" --user=${KUBE_CONTEXT} --cluster=${KUBE_CONTEXT} --namespace=${ISTIO_NAMESPACE}
  ${CLIENT_EXE} config use-context --kubeconfig="${REMOTE_SECRET_PATH}" ${KUBE_CONTEXT}

  # Set the cluster name for the secret when not specifying -kc current
  if [ -z "${CLUSTER_NAME}" ]; then
    CLUSTER_NAME_FOR_SECRET=$KUBE_CONTEXT
  else
    CLUSTER_NAME_FOR_SECRET="${CLUSTER_NAME}"
  fi
else
  # we are using an existing context - extract the specified context info and create a new kubeconfig
  if [ "${HOME_KUBE_CONTEXT}" == "current" ]; then
    infomsg "Extracting current cluster information from user's kubeconfig: $(${CLIENT_EXE} config current-context)"
    ${CLIENT_EXE} config view --minify --flatten > "${REMOTE_SECRET_PATH}"
  else
    infomsg "Extracting context [${HOME_KUBE_CONTEXT}] information from user's kubeconfig"
    ${CLIENT_EXE} config view --minify --flatten --context="${HOME_KUBE_CONTEXT}" > "${REMOTE_SECRET_PATH}"
  fi

  # Set the cluster name for the secret
  if [ -z "${CLUSTER_NAME}" ]; then
    CLUSTER_NAME_FOR_SECRET=$(${CLIENT_EXE} config view --kubeconfig="${REMOTE_SECRET_PATH}" -o jsonpath='{.contexts[0].context.cluster}')
  else
    CLUSTER_NAME_FOR_SECRET="${CLUSTER_NAME}"
  fi
fi

# Set up the local cluster with the local kubeconfig
CLUSTER_NAME_FOR_SECRET="${CLUSTER_NAME_FOR_SECRET:-run-kiali-cluster}"
mkdir ${REMOTE_CLUSTER_SECRETS_DIR}/${CLUSTER_NAME_FOR_SECRET}
cp ${REMOTE_SECRET_PATH} ${REMOTE_CLUSTER_SECRETS_DIR}/${CLUSTER_NAME_FOR_SECRET}/${CLUSTER_NAME_FOR_SECRET}

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
      if [ "${COMPONENT_NAME}" == "Tracing" ]; then
        NS=${TRACING_NAMESPACE}
      else
        NS=${ISTIO_NAMESPACE}
      fi
      (while true; do ${CLIENT_EXE} port-forward -n ${NS} ${PORT_FORWARD_DEPLOYMENT} --address=127.0.0.1 ${LOCAL_REMOTE_PORTS} > /dev/null; warnmsg "${COMPONENT_NAME} port-forward died - restarting on [${EXPECTED_URL}]"; sleep 1; done) &
      set +m
      local childpid="$!"
      printf -v "${PORT_FORWARD_JOB_VARNAME}" "$(jobs -lr | grep "${childpid}" | sed 's/.*\[\([0-9]\+\)\].*/\1/')"
      sleep 2 # wait for port-forward to start
      infomsg "${COMPONENT_NAME} port-forward started (pid=${childpid}, job=${!PORT_FORWARD_JOB_VARNAME})"
      if ! curl ${EXPECTED_URL} > /dev/null 2>&1; then
        errormsg "Cannot port-forward to the ${COMPONENT_NAME} component. You must expose it and specify its URL via ${CMDLINE_OPT}"
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

start_port_forward_istiod() {
  start_port_forward_component 'Istiod' 'PORT_FORWARD_JOB_ISTIOD' "${PORT_FORWARD_SERVICE_ISTIOD}" "${LOCAL_REMOTE_PORTS_ISTIOD}" "${ISTIOD_URL}" '--istiod-url'
}

kill_port_forward_istiod() {
  kill_port_forward_component 'Istiod' 'PORT_FORWARD_JOB_ISTIOD'
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

start_port_forward_perses() {
  start_port_forward_component 'Perses' 'PORT_FORWARD_JOB_PERSES' "${PORT_FORWARD_DEPLOYMENT_PERSES}" "${LOCAL_REMOTE_PORTS_PERSES}" "${PERSES_URL}" '--perses-url'
}

kill_port_forward_perses() {
  kill_port_forward_component 'Perses' 'PORT_FORWARD_JOB_PERSES'
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
    # Setting this env variable will tell Kiali to use the local kubeconfig
    # found at the env var instead of assuming it's an in cluster kubeconfig.
    export KUBECONFIG="${HOME}/.kube/config"
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
  kill_port_forward_istiod
  kill_port_forward_prometheus
  if [ "${ENABLE_GRAFANA}" == "true" ]; then
    kill_port_forward_grafana
  fi
  if [[ -v PERSES_URL && -n "${PERSES_URL}" ]]; then
    kill_port_forward_perses
  fi
  if [ "${ENABLE_TRACING}" == "true" ]; then
    kill_port_forward_tracing
  fi

  exitmsg "Exiting"
  exit ${1:-0}
}

# Main - start the server (and optionally the proxy) and wait for user input to tell us what to do next
if [ "${REBOOTABLE}" == "true" ]; then
  infomsg "The server is rebootable. You can reboot the server via [kill $$]. You can kill this script via [kill -USR1 $$]"
else
  infomsg "The server is not rebootable. You can kill this script via either [kill $$] or [kill -USR1 $$]"
fi

if [ "${ISTIOD_URL}" != "" ]; then
  start_port_forward_istiod
fi
start_port_forward_prometheus
if [ "${ENABLE_GRAFANA}" == "true" ]; then
  start_port_forward_grafana
fi
if [[ -v PERSES_URL && -n "${PERSES_URL}" ]]; then
  start_port_forward_perses
fi
if [ "${ENABLE_TRACING}" == "true" ]; then
  start_port_forward_tracing
fi
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
