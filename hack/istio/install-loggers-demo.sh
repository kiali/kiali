#!/bin/bash
##############################################################################
# install-logger-demo.sh
#
# Installs the Logger Demo Application into your cluster
# (either Kubernetes or OpenShift).
#
# See --help for more details on options to this script.
#
##############################################################################

CLIENT_EXE_NAME="oc"
NAMESPACE="loggers"
AMBIENT_ENABLED="false"
DELETE_DEMO="false"
ARCH="amd64"
AUTO_INJECTION="true"
AUTO_INJECTION_LABEL="istio-injection=enabled"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -a|--arch)
      ARCH="$2"
      shift;shift
      ;;
    -ai|--auto-injection)
      AUTO_INJECTION="$2"
      shift;shift
      ;;
    -ail|--auto-injection-label)
      AUTO_INJECTION_LABEL="$2"
      shift;shift
      ;;
    -c|--client-exe)
      CLIENT_EXE_NAME="$2"
      shift;shift
      ;;
    -ab|--ambient)
      AMBIENT_ENABLED="$2"
      shift;shift
      ;;
    -d|--delete)
      DELETE_DEMO="$2"
      shift;shift
      ;;
    -n|--namespace)
      NAMESPACE="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -a|--arch <amd64|ppc64le|s390x>: Images for given arch will be used (default: amd64).
  -ai|--auto-injection <true|false>: If true, auto-inject sidecars (default: true).
  -ail|--auto-injection-label <label>: Label to use for auto-injection (default: istio-injection=enabled).
  -ab|--ambient: Istio Ambient enabled
  -c|--client-exe <name>: Cluster client executable name - valid values are "kubectl" or "oc"  
  -d|--delete <true|false>: If true, uninstall logger demo. If false, install logger demo. (default: false).
  -n|--namespace <name>: Install the demo in this namespace (default: logger)
  -h|--help : this message
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
if [ "${ARCH}" != "ppc64le" ] && [ "${ARCH}" != "s390x" ] && [ "${ARCH}" != "amd64" ] && [ "${ARCH}" != "arm64" ]; then
  echo "${ARCH} is not supported. Exiting."
  exit 1
fi

CLIENT_EXE=`which ${CLIENT_EXE_NAME}`
if [ "$?" = "0" ]; then
  echo "The cluster client executable is found here: ${CLIENT_EXE}"
else
  echo "You must install the cluster client ${CLIENT_EXE_NAME} in your PATH before you can continue"
  exit 1
fi

IS_OPENSHIFT="false"
if [[ "${CLIENT_EXE}" = *"oc" ]]; then
  IS_OPENSHIFT="true"
fi

if [ "${DELETE_DEMO}" == "false" ]; then
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE new-project ${NAMESPACE}
  else
    echo "Creating loggers namespace"
    $CLIENT_EXE create namespace ${NAMESPACE}
  fi

  if [ "$AMBIENT_ENABLED" = "true" ]; then
    echo "Labeling namespace for Ambient"
    $CLIENT_EXE label namespace ${NAMESPACE} istio.io/dataplane-mode=ambient --overwrite
  elif [ "${AUTO_INJECTION}" == "true" ]; then
    echo "Labeling namespace for auto-injection"
    $CLIENT_EXE label namespace ${NAMESPACE} "${AUTO_INJECTION_LABEL}"
  fi

  echo "Deploying custom logger"
  cat <<EOF | $CLIENT_EXE apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: custom-logger
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: custom-logger
  template:
    metadata:
      labels:
        app: custom-logger
    spec:
      containers:
      - name: logger
        image: busybox
        command: ["/bin/sh", "-c"]
        args:
          - while true; do echo 'GET'; echo 'DEBUG'; sleep 1; done
EOF

  echo "Deploying json logger demo"
  cat <<EOF | $CLIENT_EXE apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: json-logger
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: json-logger
  template:
    metadata:
      labels:
        app: json-logger
    spec:
      containers:
      - name: logger
        image: busybox
        command: ["/bin/sh", "-c"]
        args:
          - while true; do echo "{\"a\":\"b\", \"c\":{\"d\":\"e\"}}"; sleep 1; echo "text format log"; done
EOF
  
  sleep 5
else
  $CLIENT_EXE delete ns $NAMESPACE --ignore-not-found
fi