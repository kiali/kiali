#/bin/bash

# This deploys the travel agency demo

: ${CLIENT_EXE:=oc}
: ${NAMESPACE_ALPHA:=alpha}
: ${NAMESPACE_BETA:=beta}
: ${ENABLE_INJECTION:=true}
: ${DELETE_DEMO:=false}

while [ $# -gt 0 ]; do
  key="$1"
  case $key in
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -d|--delete)
      DELETE_DEMO="$2"
      shift;shift
      ;;
    -ei|--enable-injection)
      ENABLE_INJECTION="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client: either 'oc' or 'kubectl'
  -d|--delete: either 'true' or 'false'. If 'true' the travel agency demo will be deleted, not installed.
  -ei|--enable-injection: either 'true' or 'false' (default is true). If 'true' auto-inject proxies for the workloads.
  -h|--help: this text
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

echo Will deploy Error Rates Demo using these settings:
echo CLIENT_EXE=${CLIENT_EXE}
echo NAMESPACE_ALPHA=${NAMESPACE_ALPHA}
echo NAMESPACE_BETA=${NAMESPACE_BETA}
echo ENABLE_INJECTION=${ENABLE_INJECTION}

# If we are to delete, remove everything and exit immediately after
if [ "${DELETE_DEMO}" == "true" ]; then
  echo "Deleting Error Rates Demo (the envoy filters, if previously created, will remain)"
  if [ "${CLIENT_EXE}" == "oc" ]; then
    ${CLIENT_EXE} adm policy remove-scc-from-group privileged system:serviceaccounts:${NAMESPACE_ALPHA}
    ${CLIENT_EXE} adm policy remove-scc-from-group anyuid system:serviceaccounts:${NAMESPACE_ALPHA}
    ${CLIENT_EXE} delete network-attachment-definition istio-cni -n ${NAMESPACE_ALPHA}

    ${CLIENT_EXE} adm policy remove-scc-from-group privileged system:serviceaccounts:${NAMESPACE_BETA}
    ${CLIENT_EXE} adm policy remove-scc-from-group anyuid system:serviceaccounts:${NAMESPACE_BETA}
    ${CLIENT_EXE} delete network-attachment-definition istio-cni -n ${NAMESPACE_BETA}
  fi
  ${CLIENT_EXE} delete namespace ${NAMESPACE_ALPHA}
  ${CLIENT_EXE} delete namespace ${NAMESPACE_BETA}
  exit 0
fi

# Create and prepare the demo namespaces

if ! ${CLIENT_EXE} get namespace ${NAMESPACE_ALPHA} 2>/dev/null; then
  ${CLIENT_EXE} create namespace ${NAMESPACE_ALPHA}
  if [ "${ENABLE_INJECTION}" == "true" ]; then
    ${CLIENT_EXE} label namespace ${NAMESPACE_ALPHA} istio-injection=enabled
  fi
  if [ "${CLIENT_EXE}" == "oc" ]; then
    ${CLIENT_EXE} adm policy add-scc-to-group privileged system:serviceaccounts:${NAMESPACE_ALPHA}
    ${CLIENT_EXE} adm policy add-scc-to-group anyuid system:serviceaccounts:${NAMESPACE_ALPHA}
    cat <<EOF | ${CLIENT_EXE} -n ${NAMESPACE_ALPHA} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
EOF
  fi
fi

if ! ${CLIENT_EXE} get namespace ${NAMESPACE_BETA} 2>/dev/null; then
  ${CLIENT_EXE} create namespace ${NAMESPACE_BETA}
  if [ "${ENABLE_INJECTION}" == "true" ]; then
    ${CLIENT_EXE} label namespace ${NAMESPACE_BETA} istio-injection=enabled
  fi
  if [ "${CLIENT_EXE}" == "oc" ]; then
    ${CLIENT_EXE} adm policy add-scc-to-group privileged system:serviceaccounts:${NAMESPACE_BETA}
    ${CLIENT_EXE} adm policy add-scc-to-group anyuid system:serviceaccounts:${NAMESPACE_BETA}
    cat <<EOF | ${CLIENT_EXE} -n ${NAMESPACE_BETA} create -f -
apiVersion: "k8s.cni.cncf.io/v1"
kind: NetworkAttachmentDefinition
metadata:
  name: istio-cni
EOF
  fi
fi

# Deploy the demo

${CLIENT_EXE} apply -f <(curl -L https://raw.githubusercontent.com/kiali/demos/master/error-rates/alpha.yaml) -n ${NAMESPACE_ALPHA}
${CLIENT_EXE} apply -f <(curl -L https://raw.githubusercontent.com/kiali/demos/master/error-rates/beta.yaml) -n ${NAMESPACE_BETA}


