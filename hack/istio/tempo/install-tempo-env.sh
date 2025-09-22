#!/bin/bash

##############################################################################
# install-tempo-env
#
# Installs the Tempo environment using the Tempo operator.
#
# See --help for more details on options to this script.
#
##############################################################################

AMBIENT="false"
CLIENT_EXE_NAME="oc"
DELETE_ALL="false"
DELETE_TEMPO="false"
INSTALL_BOOKINFO="true"
INSTALL_ISTIO="true"
INSTALL_KIALI="false"
METHOD="operator"
ONLY_TEMPO="false"
SECURE_DISTRIBUTOR="false"
TEMPO_NS="tempo"
TEMPO_PORT="3200"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -a|--ambient)
      AMBIENT="$2"
      shift;shift
      ;;
    -c|--client)
      CLIENT_EXE_NAME="$2"
      shift;shift
      ;;
    -da|--delete-all)
      DELETE_ALL="$2"
      shift;shift
      ;;
    -dt|--delete-tempo)
      DELETE_TEMPO="$2"
      shift;shift
      ;;
    -ib|--install-bookinfo)
      INSTALL_BOOKINFO="$2"
      shift;shift
      ;;
    -ii|--install-istio)
      INSTALL_ISTIO="$2"
      shift;shift
      ;;
    -ik|--install-kiali)
      INSTALL_KIALI="$2"
      shift;shift
      ;;
    -im|--install-method)
      METHOD="$2"
      shift;shift
      ;;
    -ot|--only-tempo)
      ONLY_TEMPO="$2"
      shift;shift
      ;;
    -sd|--secure-distributor)
      SECURE_DISTRIBUTOR="$2"
      shift;shift
      ;;
    -t|--tempo-ns)
      TEMPO_NS="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -a|--ambient:
       Install Ambient mesh. false by default.
  -c|--client:
       client exe. kubectl and oc are supported. oc by default.
  -da|--delete-all:
       Delete tempo and all the components installed (Including Istio, Kiali & bookinfo).
  -dt|--delete-tempo:
       Delete tempo, tempo operator and cert manager.
  -ib|--install-bookinfo:
       If bookinfo should be installed. true by default.
  -ii|--install-istio:
       If istio should be installed. true by default.
  -ik|--install-kiali:
       If Kiali should be installed. false by default.
  -im|--install-method:
       If using "operator" or "helm". "operator" by default. Helm installation has other properties and uses a more updated version of Tempo.
       The recommendation resources for using helm in minikube:
  -ot|--only-tempo:
       Install only tempo. false by default.
  -sd|--secure-distributor:
       If the tempo distributor will use tls (Using a self signed certificate). false by default.
  -t|--tempo-ns:
       Tempo namespace. Tempo by default.
  -h|--help:
       this message
HELPMSG
      exit 1
      ;;
    *)
      echo "ERROR: Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
MINIO_FILE="${SCRIPT_DIR}/minio.yaml"

# Function to wait for webhook readiness with retries
wait_for_webhook_readiness() {
  local webhook_name="$1"
  local namespace="$2"
  local max_retries="${3:-10}"
  local retry_interval="${4:-10}"
  
  echo "Waiting for webhook '${webhook_name}' to be ready..."
  
  for ((i=1; i<=max_retries; i++)); do
    echo "Attempt ${i}/${max_retries}: Checking webhook readiness..."
    
    # Check if the webhook service exists and has endpoints
    if ${CLIENT_EXE} get service "${webhook_name}" -n "${namespace}" >/dev/null 2>&1; then
      # Check if the service has endpoints (pods backing the service)
      local endpoints=$(${CLIENT_EXE} get endpoints "${webhook_name}" -n "${namespace}" -o jsonpath='{.subsets[0].addresses[*].ip}' 2>/dev/null)
      
      if [ -n "${endpoints}" ] && [ "${endpoints}" != "null" ]; then
        # Check if the webhook pods are ready
        local ready_pods=$(${CLIENT_EXE} get pods -n "${namespace}" -l app.kubernetes.io/name=tempo-operator -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' 2>/dev/null)
        
        if [ -n "${ready_pods}" ]; then
          # Additional check: try to create a test resource to verify webhook is working
          echo "Testing webhook functionality by creating a test TempoStack..."
          if ${CLIENT_EXE} apply -n "${namespace}" -f - <<EOF >/dev/null 2>&1; then
apiVersion: tempo.grafana.com/v1alpha1
kind: TempoStack
metadata:
  name: webhook-test
  namespace: ${namespace}
spec:
  storageSize: 1Gi
  storage:
    secret:
      type: s3
      name: test-secret
EOF
            # Clean up the test resource
            ${CLIENT_EXE} delete TempoStack webhook-test -n "${namespace}" --ignore-not-found=true >/dev/null 2>&1
            echo "Webhook '${webhook_name}' is ready and functional!"
            return 0
          else
            echo "Webhook service exists but is not yet functional"
          fi
        else
          echo "Webhook service exists but pods are not ready yet"
        fi
      else
        echo "Webhook service exists but has no endpoints yet"
      fi
    else
      echo "Webhook service '${webhook_name}' does not exist yet"
    fi
    
    if [ ${i} -lt ${max_retries} ]; then
      echo "Webhook not ready yet, waiting ${retry_interval} seconds before retry..."
      sleep ${retry_interval}
    fi
  done
  
  echo "ERROR: Webhook '${webhook_name}' failed to become ready after ${max_retries} attempts"
  return 1
}

# Function to clean up failed Tempo installation
cleanup_failed_tempo_installation() {
  echo "Cleaning up failed Tempo installation..."
  
  # Delete TempoStack resources first
  ${CLIENT_EXE} delete TempoStack --all --all-namespaces --ignore-not-found=true
  
  # Delete the operators
  ${CLIENT_EXE} delete -f https://github.com/grafana/tempo-operator/releases/latest/download/tempo-operator.yaml --ignore-not-found=true
  ${CLIENT_EXE} delete -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml --ignore-not-found=true
  
  # Wait for resources to be deleted
  ${CLIENT_EXE} wait --for=delete namespace/${TEMPO_NS} --timeout=60s --ignore-not-found=true
  ${CLIENT_EXE} wait --for=delete namespace/tempo-operator-system --timeout=60s --ignore-not-found=true
  ${CLIENT_EXE} wait --for=delete namespace/cert-manager --timeout=60s --ignore-not-found=true
  
  # Force delete namespaces if they still exist
  ${CLIENT_EXE} delete namespace ${TEMPO_NS} tempo-operator-system cert-manager --ignore-not-found=true --force --grace-period=0
  
  # Clean up any remaining webhook configurations
  ${CLIENT_EXE} delete validatingwebhookconfigurations -l app.kubernetes.io/name=tempo-operator --ignore-not-found=true
  ${CLIENT_EXE} delete mutatingwebhookconfigurations -l app.kubernetes.io/name=tempo-operator --ignore-not-found=true
  
  echo "Cleanup completed, waiting 15 seconds before retry..."
  sleep 15
}

CLIENT_EXE=`which ${CLIENT_EXE_NAME}`
if [ "$?" = "0" ]; then
  echo "The cluster client executable is found here: ${CLIENT_EXE}"
else
  echo "You must install the cluster client ${CLIENT_EXE_NAME} in your PATH before you can continue"
  exit 1
fi

if [ "${METHOD}" != "operator" ] && [ "${METHOD}" != "helm" ]; then
  echo "method should be 'operator' or 'helm'"
  exit 1
fi

if ${CLIENT_EXE} api-versions | grep --quiet "route.openshift.io"; then
  IS_OPENSHIFT="true"
  echo "You are connecting to an OpenShift cluster"
else
  IS_OPENSHIFT="false"
  echo "You are connecting to a (non-OpenShift) Kubernetes cluster"
fi

echo "IS_OPENSHIFT=${IS_OPENSHIFT}"

install_tempo() {
  local max_retries="${1:-3}"
  local retry_interval="${2:-30}"
  
  for ((attempt=1; attempt<=max_retries; attempt++)); do
    echo "Tempo installation attempt ${attempt}/${max_retries}"
    
    if install_tempo_single_attempt; then
      echo "Tempo installation completed successfully"
      
      # Wait for webhook readiness
      if wait_for_webhook_readiness "tempo-operator-webhook-service" "tempo-operator-system" 30 10; then
        echo "Tempo webhook is ready and functional!"
        return 0
      else
        echo "Tempo webhook failed to become ready, will retry installation"
        cleanup_failed_tempo_installation
      fi
    else
      echo "Tempo installation failed on attempt ${attempt}"
      cleanup_failed_tempo_installation
    fi
    
    if [ ${attempt} -lt ${max_retries} ]; then
      echo "Waiting ${retry_interval} seconds before retry..."
      sleep ${retry_interval}
    fi
  done
  
  echo "ERROR: Tempo installation failed after ${max_retries} attempts. Aborting."
  exit 1
}

install_tempo_single_attempt() {
  echo -e "Installing cert manager...\n"
  ${CLIENT_EXE} apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
  echo -e "Waiting for cert-manager pods to be ready... \n"
  $CLIENT_EXE wait pods --all -n cert-manager --for=condition=Ready --timeout=5m

  # There's some issue with the cert-manager webhook where it fails to add the https cert to the webhook
  # before it is marked as ready. So we need to wait for a small period of time before installing the Tempo operator
  # because the tempo manifests rely on the cert-manager webhook to be ready.
  echo -e "Waiting for cert-manager webhook to be ready... \n"
  sleep 10

  echo -e "Installing latest Tempo operator \n"
  
  # Download the tempo operator YAML to modify it locally
  TEMPO_OPERATOR_YAML="/tmp/tempo-operator.yaml"
  echo "Downloading tempo-operator.yaml from GitHub..."
  curl -L -o "${TEMPO_OPERATOR_YAML}" https://github.com/grafana/tempo-operator/releases/latest/download/tempo-operator.yaml
  
  # Add ENABLE_WEBHOOKS=true environment variable to the tempo-operator deployment
  echo "Adding ENABLE_WEBHOOKS=true environment variable to tempo-operator..."
  
  # Create a temporary file for the modified YAML
  MODIFIED_TEMPO_YAML="/tmp/tempo-operator-modified.yaml"
  
  # Use awk to find the tempo-operator container and add the environment variable
  awk '
  BEGIN { in_tempo_operator = 0; in_container = 0; env_added = 0 }
  
  # Look for tempo-operator deployment
  /kind: Deployment/ { in_tempo_operator = 1 }
  /name: tempo-operator/ && in_tempo_operator { in_tempo_operator = 2 }
  
  # Look for the container spec within tempo-operator deployment
  /- name: manager/ && in_tempo_operator == 2 { in_container = 1 }
  
  # Add env section if we find the image line in the manager container
  /image:/ && in_container && !env_added {
    print $0
    print "        env:"
    print "        - name: ENABLE_WEBHOOKS"
    print "          value: \"true\""
    env_added = 1
    next
  }
  
  # Reset flags when we exit the deployment
  /^---/ { in_tempo_operator = 0; in_container = 0; env_added = 0 }
  
  # Print all other lines as-is
  { print }
  ' "${TEMPO_OPERATOR_YAML}" > "${MODIFIED_TEMPO_YAML}"
  
  # Apply the modified YAML
  ${CLIENT_EXE} apply -f "${MODIFIED_TEMPO_YAML}"
  
  # Clean up temporary files
  rm -f "${TEMPO_OPERATOR_YAML}" "${MODIFIED_TEMPO_YAML}"
  echo -e "Waiting for Tempo operator to be ready... \n"
  $CLIENT_EXE wait pods --all -n tempo-operator-system --for=condition=Ready --timeout=5m

  # If OpenShift, we need to do some additional things
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE new-project ${TEMPO_NS}
  else
    $CLIENT_EXE create namespace ${TEMPO_NS}
  fi

  echo -e "Installing minio and create secret \n"
  ${CLIENT_EXE} apply --namespace ${TEMPO_NS} -f ${MINIO_FILE}

  # Create secret for minio
  ${CLIENT_EXE} create secret generic -n ${TEMPO_NS} tempostack-dev-minio \
    --from-literal=bucket="tempo-data" \
    --from-literal=endpoint="http://minio:9000" \
    --from-literal=access_key_id="minio" \
    --from-literal=access_key_secret="minio123"

  if [ "${METHOD}" == "operator" ]; then

    echo -e "Installing Tempo with the operator \n"

    if [ "${SECURE_DISTRIBUTOR}" == "true" ]; then
      # Create ca and cert for tls for the distributor
      echo -e "Creating ca and cert for tls for the distributor \n"
      subj="
C=ES
ST=ST
O=AR
localityName=Ar
commonName=Ct
organizationalUnitName=rh
emailAddress=not@mail
"
    openssl req -x509 -sha256 -nodes -newkey rsa:2048 -subj "$(echo -n "$subj" | tr "\n" "/")" -keyout /tmp/tls.key -out /tmp/service-ca.crt
    ${CLIENT_EXE} -n ${TEMPO_NS} create configmap tempo-ca --from-file=/tmp/service-ca.crt
    ${CLIENT_EXE} create secret tls tempo-cert -n ${TEMPO_NS} --key="/tmp/tls.key" --cert="/tmp/service-ca.crt"
    # Install TempoStack CR
    echo -e "Installing tempo with tls enabled \n"
    ${CLIENT_EXE} apply -n ${TEMPO_NS} -f - <<EOF
apiVersion: tempo.grafana.com/v1alpha1
kind: TempoStack
metadata:
  name: cr
spec:
  storageSize: 1Gi
  storage:
    secret:
      type: s3
      name: tempostack-dev-minio
  template:
    distributor:
      tls:
        enabled: true
        certName: tempo-cert
    queryFrontend:
      component:
        resources:
          limits:
            cpu: "2"
            memory: 2Gi
      jaegerQuery:
        enabled: false
EOF
    else
      # Install TempoStack CR
      echo -e "Installing tempo \n"
      ${CLIENT_EXE} apply -n ${TEMPO_NS} -f - <<EOF
apiVersion: tempo.grafana.com/v1alpha1
kind: TempoStack
metadata:
  name: cr
spec:
  storageSize: 1Gi
  storage:
    secret:
      type: s3
      name: tempostack-dev-minio
  template:
    queryFrontend:
      component:
        resources:
          limits:
            cpu: "2"
            memory: 2Gi
      jaegerQuery:
        enabled: false
EOF
    fi

  else
    echo -e "Installing Tempo with Helm Charts \n"
    TEMPO_PORT="3100"
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    helm install tempo-cr grafana/tempo-distributed -n tempo -f ${SCRIPT_DIR}/helm.yaml

  fi
}

if [ "${DELETE_ALL}" == "true" ]; then
  DELETE_TEMPO="true"
fi

if [ "${DELETE_TEMPO}" == "true" ]; then
  echo -e "Deleting tempo \n"
  ${CLIENT_EXE} delete -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
  ${CLIENT_EXE} delete -f https://github.com/grafana/tempo-operator/releases/latest/download/tempo-operator.yaml
  ${CLIENT_EXE} delete secret -n ${TEMPO_NS} tempostack-dev-minio
  ${CLIENT_EXE} delete TempoStack cr -n ${TEMPO_NS}
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE delete project ${TEMPO_NS}
    $CLIENT_EXE delete ns ${TEMPO_NS}
  else
    ${CLIENT_EXE} delete ns ${TEMPO_NS}
  fi

  if [ "${DELETE_ALL}" == "true" ]; then
    ${SCRIPT_DIR}/../install-istio-via-istioctl.sh -c ${CLIENT_EXE} -di true
    ${SCRIPT_DIR}/../install-bookinfo-demo.sh -c ${CLIENT_EXE} -db true
  fi
else
  install_tempo 3 30

  if [ "${ONLY_TEMPO}" != "true" ]; then
    echo "Script Directory: ${SCRIPT_DIR}"

    if [ "${INSTALL_ISTIO}" == "true" ]; then
      if [ "${AMBIENT}" == "true" ]; then
        echo -e "Installing istio Ambient \n"
        ${SCRIPT_DIR}/../install-istio-via-istioctl.sh -c ${CLIENT_EXE} -a "prometheus grafana" -cp ambient -s values.meshConfig.defaultConfig.tracing.zipkin.address="tempo-cr-distributor.tempo:9411"
      else
        echo -e "Installing istio \n"
        ${SCRIPT_DIR}/../install-istio-via-istioctl.sh -c ${CLIENT_EXE} -a "prometheus grafana" -s values.meshConfig.defaultConfig.tracing.zipkin.address="tempo-cr-distributor.tempo:9411"
      fi
    fi

    if [ "${INSTALL_KIALI}" == "true" ]; then
      OUTPUT_DIR="${OUTPUT_DIR:-${SCRIPT_DIR}/../../../_output}"
      ISTIO_DIR=$(ls -dt1 ${OUTPUT_DIR}/istio-* | head -n1)
      echo "Istio directory where the Kiali addon yaml should be found: ${ISTIO_DIR}"
      ${CLIENT_EXE} apply -f ${ISTIO_DIR}/samples/addons/kiali.yaml
    fi

    if [ "${INSTALL_BOOKINFO}" == "true" ]; then
      echo -e "Installing bookinfo \n"
      if [ "${AMBIENT}" == "true" ]; then
         echo -e "Adding bookinfo in Ambient Mesh with a Waypoint proxy \n"
        ${SCRIPT_DIR}/../install-bookinfo-demo.sh -c ${CLIENT_EXE} -ai false -tg -w true
      else
        ${SCRIPT_DIR}/../install-bookinfo-demo.sh -c ${CLIENT_EXE} -tg
      fi
    fi

    # If OpenShift, we need to do some additional things
    if [ "${IS_OPENSHIFT}" == "true" ]; then
      $CLIENT_EXE expose svc/tempo-cr-query-frontend -n ${TEMPO_NS}
      $CLIENT_EXE expose svc/grafana -n istio-system
    fi

    echo -e "Installation finished. \n"
    if [ "${IS_OPENSHIFT}" != "true" ]; then
      echo "If you want to access Tempo from outside the cluster on your local machine, You can port forward the services with:
  ./run-kiali.sh -pg 13000:3000 -pp 19090:9090 -pt 3200:${TEMPO_PORT} -app 8080 -es false -iu http://127.0.0.1:15014 -tr tempo-cr-query-frontend -ts tempo-cr-query-frontend -tn tempo

  To configure Kiali to use this, set the external_services.tracing section with the following settings:
  tracing:
    enabled: true
    provider: \"tempo\"
    internal_url: http://localhost:3200
    external_url: http://localhost:3200
    use_grpc: false"
    fi
  fi

fi
