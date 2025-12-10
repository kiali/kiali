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
MULTI_TENANT="false"
INSTALL_COO_PLUGIN="false"
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
    -mt|--multi-tenant)
      MULTI_TENANT="$2"
      shift;shift
      ;;
    -coo|--install-coo-plugin)
      INSTALL_COO_PLUGIN="$2"
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
  -mt|--multi-tenant:
       Enable multi-tenant mode for OpenShift. Requires OpenShift cluster. false by default.
  -coo|--install-coo-plugin:
       Install Cluster Observability UI Plugin for distributed tracing. Requires multi-tenant mode. false by default.
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
MINIO_FILE="${SCRIPT_DIR}/resources/minio.yaml"

set -e

# Function to replace variables in YAML files
replace_yaml_vars() {
  local file="$1"
  shift
  local content=$(cat "$file")
  while [ $# -gt 0 ]; do
    local var_name="$1"
    shift
    local var_value="$1"
    shift
    content=$(echo "$content" | sed "s|\${${var_name}}|${var_value}|g")
  done
  echo "$content"
}

# Function to clean up failed Tempo installation
cleanup_failed_tempo_installation() {
  echo "Cleaning up failed Tempo installation..."
  
  # Delete TempoStack resources first (only if CRD exists)
  if ${CLIENT_EXE} get crd tempostacks.tempo.grafana.com >/dev/null 2>&1; then
    ${CLIENT_EXE} delete TempoStack --all --all-namespaces --ignore-not-found=true 2>/dev/null || true
  fi
  
  # Determine operator namespace based on installation method
  if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
    TEMPO_OPERATOR_NS="openshift-tempo-operator"
    # Delete UI Plugin first if it was installed
    if [ "${INSTALL_COO_PLUGIN}" == "true" ]; then
      ${CLIENT_EXE} delete UIPlugin distributed-tracing -n ${TEMPO_OPERATOR_NS} --ignore-not-found=true
    fi
    
    # Delete OLM subscriptions
    SUBSCRIPTIONS="my-tempo-operator my-opentelemetry-operator"
    if [ "${INSTALL_COO_PLUGIN}" == "true" ]; then
      SUBSCRIPTIONS="${SUBSCRIPTIONS} my-cluster-observability-operator"
    fi
    for sub in ${SUBSCRIPTIONS}; do
      ${CLIENT_EXE} delete subscription --ignore-not-found=true --namespace ${TEMPO_OPERATOR_NS} ${sub}
    done
    
    # Delete all CSVs related to tempo, opentelemetry, and optionally cluster-observability
    CSV_PATTERN="tempo|opentelemetry"
    if [ "${INSTALL_COO_PLUGIN}" == "true" ]; then
      CSV_PATTERN="${CSV_PATTERN}|cluster-observability"
    fi
    for csv in $(${CLIENT_EXE} get csv --namespace ${TEMPO_OPERATOR_NS} --no-headers -o custom-columns=N:.metadata.name 2>/dev/null | grep -E "${CSV_PATTERN}"); do
      ${CLIENT_EXE} delete --ignore-not-found=true csv --namespace ${TEMPO_OPERATOR_NS} ${csv}
    done
    ${CLIENT_EXE} delete OperatorGroup --ignore-not-found=true --namespace ${TEMPO_OPERATOR_NS} ${TEMPO_OPERATOR_NS}
  else
    TEMPO_OPERATOR_NS="tempo-operator-system"
    # Delete community operator from GitHub
    ${CLIENT_EXE} delete -f https://github.com/grafana/tempo-operator/releases/latest/download/tempo-operator.yaml --ignore-not-found=true
  fi
  
  ${CLIENT_EXE} delete -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml --ignore-not-found=true
  
  # Wait for resources to be deleted (only if they exist)
  if ${CLIENT_EXE} get namespace ${TEMPO_NS} >/dev/null 2>&1; then
    ${CLIENT_EXE} wait --for=delete namespace/${TEMPO_NS} --timeout=60s 2>/dev/null || true
  fi
  if ${CLIENT_EXE} get namespace ${TEMPO_OPERATOR_NS} >/dev/null 2>&1; then
    ${CLIENT_EXE} wait --for=delete namespace/${TEMPO_OPERATOR_NS} --timeout=60s 2>/dev/null || true
  fi
  if ${CLIENT_EXE} get namespace cert-manager >/dev/null 2>&1; then
    ${CLIENT_EXE} wait --for=delete namespace/cert-manager --timeout=60s 2>/dev/null || true
  fi
  
  # Force delete namespaces if they still exist
  ${CLIENT_EXE} delete namespace ${TEMPO_NS} ${TEMPO_OPERATOR_NS} cert-manager --ignore-not-found=true --force --grace-period=0
  
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

# Validate multi-tenant mode requirements
if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" != "true" ]; then
  echo "ERROR: Multi-tenant mode (-mt|--multi-tenant) requires an OpenShift cluster."
  echo "Current cluster is not OpenShift. Please disable multi-tenant mode or use an OpenShift cluster."
  exit 1
fi

# Validate COO plugin requirements
if [ "${INSTALL_COO_PLUGIN}" == "true" ] && [ "${MULTI_TENANT}" != "true" ]; then
  echo "ERROR: COO UI Plugin (-coo|--install-coo-plugin) requires multi-tenant mode to be enabled."
  echo "Please enable multi-tenant mode (-mt true) or disable COO plugin installation."
  exit 1
fi

if [ "${INSTALL_COO_PLUGIN}" == "true" ] && [ "${IS_OPENSHIFT}" != "true" ]; then
  echo "ERROR: COO UI Plugin (-coo|--install-coo-plugin) requires an OpenShift cluster."
  echo "Current cluster is not OpenShift. Please disable COO plugin or use an OpenShift cluster."
  exit 1
fi

# Function to create ClusterRole and ClusterRoleBinding for multi-tenant trace readers
create_multi_tenant_rbac() {
  local tenant_name="$1"
  
  echo -e "Creating ClusterRole and ClusterRoleBinding for tenant '${tenant_name}' trace readers...\n"
  
  local yaml_file="${SCRIPT_DIR}/resources/multi-tenant-rbac.yaml"
  replace_yaml_vars "$yaml_file" "TENANT_NAME" "$tenant_name" | ${CLIENT_EXE} apply -f -
}

# Function to install COO UI Plugin for distributed tracing
install_coo_ui_plugin() {
  local operator_namespace="${TEMPO_OPERATOR_NS:-openshift-tempo-operator}"
  
  echo -e "Creating COO UI Plugin for distributed tracing...\n"
  
  local yaml_file="${SCRIPT_DIR}/resources/ui-plugin.yaml"
  replace_yaml_vars "$yaml_file" "OPERATOR_NAMESPACE" "$operator_namespace" "TEMPO_NS" "$TEMPO_NS" | ${CLIENT_EXE} apply -f -
  
  echo -e "Waiting for UI Plugin to be ready...\n"
  ${CLIENT_EXE} wait --for=condition=Ready UIPlugin/distributed-tracing -n ${operator_namespace} --timeout=5m 2>/dev/null || echo "UI Plugin may take longer to become ready"
}

# Function to install OpenTelemetryCollector CR for multi-tenant Tempo
install_opentelemetry_collector() {
  local istio_namespace="${1:-istio-system}"
  local tempo_gateway_service="${2:-tempo-cr-gateway}"
  local tempo_namespace="${3:-tempo}"
  local tenant_name="${4:-north}"
  
  echo -e "Installing OpenTelemetryCollector CR in ${istio_namespace} namespace...\n"
  
  # Ensure istio-system namespace exists
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} get project ${istio_namespace} >/dev/null 2>&1 || ${CLIENT_EXE} new-project ${istio_namespace}
  else
    ${CLIENT_EXE} get namespace ${istio_namespace} >/dev/null 2>&1 || ${CLIENT_EXE} create namespace ${istio_namespace}
  fi
  
  # Create OpenTelemetryCollector CR
  local yaml_file="${SCRIPT_DIR}/resources/opentelemetry-collector-multi-tenant.yaml"
  replace_yaml_vars "$yaml_file" \
    "ISTIO_NAMESPACE" "$istio_namespace" \
    "TEMPO_GATEWAY_SERVICE" "$tempo_gateway_service" \
    "TEMPO_NAMESPACE" "$tempo_namespace" \
    "TENANT_NAME" "$tenant_name" | ${CLIENT_EXE} apply -f -
  
  echo -e "Waiting for OpenTelemetryCollector to be ready...\n"
  ${CLIENT_EXE} wait --for=condition=available deployment/otel-collector -n ${istio_namespace} --timeout=5m 2>/dev/null || {
    echo "WARNING: OpenTelemetryCollector may still be initializing"
    ${CLIENT_EXE} get opentelemetrycollector otel -n ${istio_namespace} 2>/dev/null || echo "OpenTelemetryCollector CR not found"
  }
  
  # Create ClusterRole and ClusterRoleBinding for OpenTelemetry collector to write traces
  echo -e "Creating RBAC for OpenTelemetry collector to write traces...\n"
  local rbac_file="${SCRIPT_DIR}/resources/opentelemetry-collector-rbac.yaml"
  replace_yaml_vars "$rbac_file" \
    "TENANT_NAME" "$tenant_name" \
    "ISTIO_NAMESPACE" "$istio_namespace" | ${CLIENT_EXE} apply -f -
  
  echo -e "OpenTelemetryCollector installed successfully.\n"
}

# Function to create Telemetry resource for Istio tracing
create_telemetry_resource() {
  local istio_namespace="${1:-istio-system}"
  
  echo -e "Creating Telemetry resource to enable tracing...\n"
  local telemetry_file="${SCRIPT_DIR}/resources/telemetry-resource.yaml"
  replace_yaml_vars "$telemetry_file" "ISTIO_NAMESPACE" "$istio_namespace" | ${CLIENT_EXE} apply -f -
}

install_tempo() {
  local max_retries="${1:-3}"
  local retry_interval="${2:-30}"
  
  for ((attempt=1; attempt<=max_retries; attempt++)); do
    echo "Tempo installation attempt ${attempt}/${max_retries}"
    
    if install_tempo_single_attempt; then
      echo "Tempo installation completed successfully"

      if [ "${MULTI_TENANT}" != "true" ] && [ "${IS_OPENSHIFT}" != "true" ]; then
        # Wait for webhook readiness
        if wait_for_webhook_readiness "tempo-operator-webhook-service" "tempo-operator-system" 30 10; then
          echo "Tempo webhook is ready and functional!"
          return 0
        else
          echo "Tempo webhook failed to become ready, will retry installation"
          cleanup_failed_tempo_installation
        fi
      else
        return 0
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

install_tempo_single_attempt() {

  local kiali_namespace="${1:-istio-system}"

  # Install Tempo operator based on cluster type and multi-tenant mode
  if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
    # For multi-tenant mode in OpenShift, use Red Hat operator from OLM
    # Note: Tempo operator doesn't need cert-manager, but OpenTelemetry operator does
    export TEMPO_OPERATOR_NS="openshift-tempo-operator"
    
    # Check if Tempo operator is already installed
    if ${CLIENT_EXE} get crd tempostacks.tempo.grafana.com >/dev/null 2>&1; then
      echo -e "Tempo operator CRD already exists. Checking if operator is ready...\n"
      # Check if operator deployment exists and is ready
      if ${CLIENT_EXE} get deployment --namespace ${TEMPO_OPERATOR_NS} -o name 2>/dev/null | grep -q tempo; then
        echo -e "Tempo operator is already installed. Skipping operator installation.\n"
        # Just verify pods are ready
        ${CLIENT_EXE} wait pods --all -n ${TEMPO_OPERATOR_NS} --for=condition=Ready --timeout=2m 2>/dev/null || echo "Tempo operator pods may still be initializing"
        # Continue to TempoStack installation - skip the rest of operator installation
      else
        echo -e "Tempo operator CRD exists but deployment not found. Will install operator.\n"
        # Continue with installation below
      fi
    else
      echo -e "Installing Red Hat Tempo operator from OLM (required for multi-tenant mode)...\n"
    fi
    
    # Only proceed with operator installation if CRD doesn't exist or deployment doesn't exist
    if ! ${CLIENT_EXE} get crd tempostacks.tempo.grafana.com >/dev/null 2>&1 || \
       ! ${CLIENT_EXE} get deployment --namespace ${TEMPO_OPERATOR_NS} -o name 2>/dev/null | grep -q tempo; then
      # Create namespace/project for operator FIRST, before creating any resources
    if [ "${IS_OPENSHIFT}" == "true" ]; then
      echo -e "Checking/creating project ${TEMPO_OPERATOR_NS}...\n"
      # Check if project already exists first
      if ${CLIENT_EXE} get project ${TEMPO_OPERATOR_NS} >/dev/null 2>&1; then
        echo "Project ${TEMPO_OPERATOR_NS} already exists, using existing project"
      else
        # Try to create the project
        echo "Creating new project ${TEMPO_OPERATOR_NS}..."
        if ${CLIENT_EXE} create ns ${TEMPO_OPERATOR_NS} 2>&1; then
          echo "Project ${TEMPO_OPERATOR_NS} created successfully"
        else
          # Creation failed, check if it was created by another process or if there's a permission issue
          sleep 1
          if ${CLIENT_EXE} get project ${TEMPO_OPERATOR_NS} >/dev/null 2>&1; then
            echo "Project ${TEMPO_OPERATOR_NS} exists now (may have been created by another process)"
          else
            echo "ERROR: Failed to create project ${TEMPO_OPERATOR_NS}"
            echo "Please check:"
            echo "  1. You have permissions to create projects: oc auth can-i create projects"
            echo "  2. The project doesn't exist in a different state: oc get project ${TEMPO_OPERATOR_NS}"
            echo "  3. Try deleting it first if it exists: oc delete project ${TEMPO_OPERATOR_NS}"
            return 1
          fi
        fi
      fi
    else
      echo -e "Creating namespace ${TEMPO_OPERATOR_NS}...\n"
      # Check if namespace already exists
      if ${CLIENT_EXE} get namespace ${TEMPO_OPERATOR_NS} >/dev/null 2>&1; then
        echo "Namespace ${TEMPO_OPERATOR_NS} already exists, using existing namespace"
      else
        # Try to create the namespace
        if ${CLIENT_EXE} create namespace ${TEMPO_OPERATOR_NS} >/dev/null 2>&1; then
          echo "Namespace ${TEMPO_OPERATOR_NS} created successfully"
        else
          echo "WARNING: Failed to create namespace ${TEMPO_OPERATOR_NS}, it may already exist"
          # Try one more time to verify it exists
          if ! ${CLIENT_EXE} get namespace ${TEMPO_OPERATOR_NS} >/dev/null 2>&1; then
            echo "ERROR: Cannot create or access namespace ${TEMPO_OPERATOR_NS}"
            return 1
          fi
        fi
      fi
    fi  # End of namespace creation if
    
      # Wait a moment for namespace to be fully ready
      sleep 2
      
      # Create OperatorGroup
      local og_file="${SCRIPT_DIR}/resources/operator-group.yaml"
      replace_yaml_vars "$og_file" \
        "OPERATOR_GROUP_NAME" "$TEMPO_OPERATOR_NS" \
        "OPERATOR_NAMESPACE" "$TEMPO_OPERATOR_NS" | ${CLIENT_EXE} apply -f -
    
    # Create Subscription for Red Hat Tempo operator
    local tempo_sub_file="${SCRIPT_DIR}/resources/tempo-operator-subscription.yaml"
    replace_yaml_vars "$tempo_sub_file" "OPERATOR_NAMESPACE" "$TEMPO_OPERATOR_NS" | ${CLIENT_EXE} apply -f -
    
    echo -e "Waiting for Tempo operator CRDs to be established...\n"
    # Wait for CRDs to be established
    while ! ${CLIENT_EXE} get crd tempostacks.tempo.grafana.com >/dev/null 2>&1; do
      echo -n "."
      sleep 2
    done
    echo "done."
    ${CLIENT_EXE} wait --for condition=established crd/tempostacks.tempo.grafana.com --timeout=5m
    
    echo -e "Waiting for Tempo operator deployment to be created...\n"
    # Wait for operator deployment
    while ! ${CLIENT_EXE} get deployment --namespace ${TEMPO_OPERATOR_NS} -o name 2>/dev/null | grep -q tempo; do
      echo -n "."
      sleep 2
    done
    echo "done."
    
    echo -e "Waiting for Tempo operator pods to be ready...\n"
    ${CLIENT_EXE} wait pods --all -n ${TEMPO_OPERATOR_NS} --for=condition=Ready --timeout=10m
    
    # Wait for webhooks to be ready
    echo -e "Waiting for Tempo operator webhooks to be ready...\n"
    while [ "$(${CLIENT_EXE} get validatingwebhookconfigurations -o name 2>/dev/null | grep tempo)" == "" ]; do
      echo -n "."
      sleep 2
    done
    echo "done."
    while [ "$(${CLIENT_EXE} get mutatingwebhookconfigurations -o name 2>/dev/null | grep tempo)" == "" ]; do
      echo -n "."
      sleep 2
    done
    echo "done."
    
    # Install OpenTelemetry Operator (required for multi-tenant with COO)
    # Note: OpenTelemetry operator requires cert-manager for webhook certificates
    echo -e "Installing cert-manager (required for OpenTelemetry operator webhooks)...\n"
    # Check if cert-manager is already installed
    if ${CLIENT_EXE} get crd certificates.cert-manager.io >/dev/null 2>&1; then
      echo -e "Cert-manager is already installed. Skipping cert-manager installation.\n"
    else
      ${CLIENT_EXE} apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
      echo -e "Waiting for cert-manager pods to be ready... \n"
      ${CLIENT_EXE} wait pods --all -n cert-manager --for=condition=Ready --timeout=5m 2>/dev/null || echo "Cert-manager pods may still be initializing"
      
      # Wait for cert-manager webhook to be ready
      echo -e "Waiting for cert-manager webhook to be ready... \n"
      sleep 10
    fi
    
    echo -e "Installing OpenTelemetry Operator from OLM...\n"
    local otel_sub_file="${SCRIPT_DIR}/resources/opentelemetry-operator-subscription.yaml"
    replace_yaml_vars "$otel_sub_file" "OPERATOR_NAMESPACE" "$TEMPO_OPERATOR_NS" | ${CLIENT_EXE} apply -f -
    
    echo -e "Waiting for OpenTelemetry operator CRDs to be established...\n"
    while ! ${CLIENT_EXE} get crd opentelemetrycollectors.opentelemetry.io >/dev/null 2>&1; do
      echo -n "."
      sleep 2
    done
    echo "done."
    ${CLIENT_EXE} wait --for condition=established crd/opentelemetrycollectors.opentelemetry.io --timeout=5m
    
    echo -e "Waiting for OpenTelemetry operator deployment to be ready...\n"
    while ! ${CLIENT_EXE} get deployment --namespace ${TEMPO_OPERATOR_NS} -o name 2>/dev/null | grep -q opentelemetry; do
      echo -n "."
      sleep 2
    done
    echo "done."
    ${CLIENT_EXE} wait pods --all -n ${TEMPO_OPERATOR_NS} -l app.kubernetes.io/name=opentelemetry-operator --for=condition=Ready --timeout=10m
    
    # Install Cluster Observability Operator (COO) only if COO plugin is requested
    if [ "${INSTALL_COO_PLUGIN}" == "true" ]; then
      echo -e "Installing Cluster Observability Operator from OLM...\n"
      local coo_sub_file="${SCRIPT_DIR}/resources/cluster-observability-operator-subscription.yaml"
      replace_yaml_vars "$coo_sub_file" "OPERATOR_NAMESPACE" "$TEMPO_OPERATOR_NS" | ${CLIENT_EXE} apply -f -
      
      echo -e "Waiting for Cluster Observability operator CRDs to be established...\n"
      while ! ${CLIENT_EXE} get crd uiplugins.observability.redhat.com >/dev/null 2>&1; do
        echo -n "."
        sleep 2
      done
      echo "done."
      ${CLIENT_EXE} wait --for condition=established crd/uiplugins.observability.redhat.com --timeout=5m
      
      echo -e "Waiting for Cluster Observability operator deployment to be ready...\n"
      while ! ${CLIENT_EXE} get deployment --namespace ${TEMPO_OPERATOR_NS} -o name 2>/dev/null | grep -q cluster-observability; do
        echo -n "."
        sleep 2
      done
    echo "done."
    ${CLIENT_EXE} wait pods --all -n ${TEMPO_OPERATOR_NS} -l app.kubernetes.io/name=cluster-observability-operator --for=condition=Ready --timeout=10m
    else
      echo -e "Skipping Cluster Observability Operator installation (COO plugin not requested)...\n"
    fi
    fi  # End of operator installation check (closes the if from line 714)
    
  else
    # For single-tenant or non-OpenShift, use community operator from GitHub
    export TEMPO_OPERATOR_NS="tempo-operator-system"
    
    # Check if Tempo operator is already installed
    if ${CLIENT_EXE} get crd tempostacks.tempo.grafana.com >/dev/null 2>&1; then
      echo -e "Tempo operator CRD already exists. Checking if operator is ready...\n"
      # Check if operator deployment exists and is ready
      if ${CLIENT_EXE} get deployment --namespace ${TEMPO_OPERATOR_NS} -o name 2>/dev/null | grep -q tempo; then
        echo -e "Tempo operator is already installed. Skipping operator installation.\n"
        # Just verify pods are ready
        ${CLIENT_EXE} wait pods --all -n ${TEMPO_OPERATOR_NS} --for=condition=Ready --timeout=2m 2>/dev/null || echo "Tempo operator pods may still be initializing"
        # Continue to TempoStack installation
      else
        echo -e "Tempo operator CRD exists but deployment not found. Will install operator.\n"
      fi
    else
      # cert-manager IS needed for community operator from GitHub
      echo -e "Installing cert manager (required for community Tempo operator)...\n"
      # Check if cert-manager is already installed
      if ${CLIENT_EXE} get crd certificates.cert-manager.io >/dev/null 2>&1; then
        echo -e "Cert-manager is already installed. Skipping cert-manager installation.\n"
      else
        ${CLIENT_EXE} apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
        echo -e "Waiting for cert-manager pods to be ready... \n"
        $CLIENT_EXE wait pods --all -n cert-manager --for=condition=Ready --timeout=5m

        # There's some issue with the cert-manager webhook where it fails to add the https cert to the webhook
        # before it is marked as ready. So we need to wait for a small period of time before installing the Tempo operator
        # because the tempo manifests rely on the cert-manager webhook to be ready.
        echo -e "Waiting for cert-manager webhook to be ready... \n"
        sleep 10
      fi
      
      echo -e "Installing latest Tempo operator from GitHub...\n"
      ${CLIENT_EXE} apply -f https://github.com/grafana/tempo-operator/releases/latest/download/tempo-operator.yaml
      echo -e "Waiting for Tempo operator to be ready... \n"
      $CLIENT_EXE wait pods --all -n ${TEMPO_OPERATOR_NS} --for=condition=Ready --timeout=5m
    fi
  fi

  # If OpenShift, we need to do some additional things
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE new-project ${TEMPO_NS}
  else
    $CLIENT_EXE create namespace ${TEMPO_NS}
  fi

  echo -e "Installing minio and create secret \n"
  ${CLIENT_EXE} apply --namespace ${TEMPO_NS} -f ${MINIO_FILE}

  # Create secret for minio
  # Use full service name for multi-tenant mode in OpenShift
  if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
    MINIO_ENDPOINT="http://minio.${TEMPO_NS}.svc.cluster.local:9000"
  else
    MINIO_ENDPOINT="http://minio:9000"
  fi

  ${CLIENT_EXE} create secret generic -n ${TEMPO_NS} tempostack-dev-minio \
    --from-literal=bucket="tempo-data" \
    --from-literal=endpoint="${MINIO_ENDPOINT}" \
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
    if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
      echo -e "Installing tempo with tls enabled and multi-tenant mode \n"
    else
      echo -e "Installing tempo with tls enabled \n"
    fi
    
    # Retry logic for TempoStack installation as it sometimes fails because the webhook isn't ready.
    local max_retries=3
    local retry_count=0
    local success=false
    
    while [ $retry_count -lt $max_retries ] && [ "$success" = false ]; do
      retry_count=$((retry_count + 1))
      if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
        echo "Attempt ${retry_count}/${max_retries}: Installing TempoStack with TLS and multi-tenant mode..."
      else
        echo "Attempt ${retry_count}/${max_retries}: Installing TempoStack with TLS..."
      fi
      
      # Build and apply TempoStack spec based on multi-tenant mode
      if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
        # Multi-tenant TempoStack configuration
        local tempostack_file="${SCRIPT_DIR}/resources/tempostack-multi-tenant-tls.yaml"
        if replace_yaml_vars "$tempostack_file" "TEMPO_NS" "$TEMPO_NS" | ${CLIENT_EXE} apply -n ${TEMPO_NS} -f -; then
          echo "TempoStack with TLS and multi-tenant installation successful"
          success=true
        else
          echo "TempoStack with TLS and multi-tenant installation failed on attempt ${retry_count}"
          if [ $retry_count -lt $max_retries ]; then
            echo "Waiting 10 seconds before retry..."
            sleep 10
          fi
        fi
      else
        # Single-tenant TempoStack configuration with TLS
        local tempostack_file="${SCRIPT_DIR}/resources/tempostack-single-tenant-tls.yaml"
        if replace_yaml_vars "$tempostack_file" "TEMPO_NS" "$TEMPO_NS" | ${CLIENT_EXE} apply -n ${TEMPO_NS} -f -; then
          echo "TempoStack with TLS installation successful"
          success=true
        else
          echo "TempoStack with TLS installation failed on attempt ${retry_count}"
          if [ $retry_count -lt $max_retries ]; then
            echo "Waiting 10 seconds before retry..."
            sleep 10
          fi
        fi
      fi
    done
    
    if [ "$success" = false ]; then
      if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
        echo "ERROR: Failed to install TempoStack with TLS and multi-tenant after ${max_retries} attempts"
      else
        echo "ERROR: Failed to install TempoStack with TLS after ${max_retries} attempts"
      fi
      exit 1
    fi
    
    else
      # Install TempoStack CR
      if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
        echo -e "Installing tempo with multi-tenant mode \n"
      else
        echo -e "Installing tempo \n"
      fi
      
      # Retry logic for TempoStack installation as it sometimes fails because the webhook isn't ready.
      local max_retries=3
      local retry_count=0
      local success=false
      
      while [ $retry_count -lt $max_retries ] && [ "$success" = false ]; do
        retry_count=$((retry_count + 1))
        if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
          echo "Attempt ${retry_count}/${max_retries}: Installing TempoStack with multi-tenant mode..."
        else
          echo "Attempt ${retry_count}/${max_retries}: Installing TempoStack..."
        fi
        
        # Build and apply TempoStack spec based on multi-tenant mode
        if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
          # Multi-tenant TempoStack configuration
          local tempostack_file="${SCRIPT_DIR}/resources/tempostack-multi-tenant.yaml"
          if replace_yaml_vars "$tempostack_file" "TEMPO_NS" "$TEMPO_NS" | ${CLIENT_EXE} apply -n ${TEMPO_NS} -f -; then
            echo "TempoStack with multi-tenant installation successful"
            success=true
          else
            echo "TempoStack with multi-tenant installation failed on attempt ${retry_count}"
            if [ $retry_count -lt $max_retries ]; then
              echo "Waiting 10 seconds before retry..."
              sleep 10
            fi
          fi
        else
          # Single-tenant TempoStack configuration
          local tempostack_file="${SCRIPT_DIR}/resources/tempostack-single-tenant.yaml"
          if replace_yaml_vars "$tempostack_file" "TEMPO_NS" "$TEMPO_NS" | ${CLIENT_EXE} apply -n ${TEMPO_NS} -f -; then
            echo "TempoStack installation successful"
            success=true
          else
            echo "TempoStack installation failed on attempt ${retry_count}"
            if [ $retry_count -lt $max_retries ]; then
              echo "Waiting 10 seconds before retry..."
              sleep 10
            fi
          fi
        fi
      done
      
      if [ "$success" = false ]; then
        if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
          echo "ERROR: Failed to install TempoStack with multi-tenant after ${max_retries} attempts"
        else
          echo "ERROR: Failed to install TempoStack after ${max_retries} attempts"
        fi
        exit 1
      fi
    fi
    
    # Create RBAC resources for multi-tenant mode
    if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
      echo -e "Creating RBAC resources for multi-tenant traces...\n"
      create_multi_tenant_rbac "north"
      create_multi_tenant_rbac "south"
      
      # Install COO UI Plugin for distributed tracing if requested
      if [ "${INSTALL_COO_PLUGIN}" == "true" ]; then
        # Wait for TempoStack to be ready before installing UI Plugin
        echo -e "Waiting for TempoStack to be ready...\n"
        ${CLIENT_EXE} wait --for=condition=Ready TempoStack/cr -n ${TEMPO_NS} --timeout=10m 2>/dev/null || echo "Waiting for TempoStack pods to be ready..."
        
        # Wait for TempoStack pods to be ready
        ${CLIENT_EXE} wait pods --all -n ${TEMPO_NS} --for=condition=Ready --timeout=10m
        
        # Install COO UI Plugin for distributed tracing
        echo -e "Installing Cluster Observability UI Plugin for distributed tracing...\n"
        install_coo_ui_plugin
      else
        echo -e "Skipping COO UI Plugin installation (not requested)...\n"
      fi
    fi

  else
    echo -e "Installing Tempo with Helm Charts \n"
    TEMPO_PORT="3100"
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    helm install tempo-cr grafana/tempo-distributed -n tempo -f ${SCRIPT_DIR}/resources/helm.yaml

  fi
}

if [ "${DELETE_ALL}" == "true" ]; then
  DELETE_TEMPO="true"
fi

if [ "${DELETE_TEMPO}" == "true" ]; then
  echo -e "Deleting tempo \n"
  
  # Delete TempoStack resources first
  ${CLIENT_EXE} delete TempoStack cr -n ${TEMPO_NS} --ignore-not-found=true
  ${CLIENT_EXE} delete secret -n ${TEMPO_NS} tempostack-dev-minio --ignore-not-found=true
  
  # Delete operators based on installation method
  if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
    TEMPO_OPERATOR_NS="openshift-tempo-operator"
    # Delete UI Plugin first if it was installed
    if [ "${INSTALL_COO_PLUGIN}" == "true" ]; then
      ${CLIENT_EXE} delete UIPlugin distributed-tracing -n ${TEMPO_OPERATOR_NS} --ignore-not-found=true
    fi
    
    # Delete OLM subscriptions
    SUBSCRIPTIONS="my-tempo-operator my-opentelemetry-operator"
    if [ "${INSTALL_COO_PLUGIN}" == "true" ]; then
      SUBSCRIPTIONS="${SUBSCRIPTIONS} my-cluster-observability-operator"
    fi
    for sub in ${SUBSCRIPTIONS}; do
      ${CLIENT_EXE} delete subscription --ignore-not-found=true --namespace ${TEMPO_OPERATOR_NS} ${sub}
    done
    
    # Delete all CSVs related to tempo, opentelemetry, and optionally cluster-observability
    CSV_PATTERN="tempo|opentelemetry"
    if [ "${INSTALL_COO_PLUGIN}" == "true" ]; then
      CSV_PATTERN="${CSV_PATTERN}|cluster-observability"
    fi
    for csv in $(${CLIENT_EXE} get csv --namespace ${TEMPO_OPERATOR_NS} --no-headers -o custom-columns=N:.metadata.name 2>/dev/null | grep -E "${CSV_PATTERN}"); do
      ${CLIENT_EXE} delete --ignore-not-found=true csv --namespace ${TEMPO_OPERATOR_NS} ${csv}
    done
    ${CLIENT_EXE} delete OperatorGroup --ignore-not-found=true --namespace ${TEMPO_OPERATOR_NS} ${TEMPO_OPERATOR_NS}
    ${CLIENT_EXE} delete project ${TEMPO_OPERATOR_NS} --ignore-not-found=true
  else
    TEMPO_OPERATOR_NS="tempo-operator-system"
    # Delete community operator from GitHub
    ${CLIENT_EXE} delete -f https://github.com/grafana/tempo-operator/releases/latest/download/tempo-operator.yaml --ignore-not-found=true
  fi
  
  ${CLIENT_EXE} delete -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml --ignore-not-found=true
  
  # Delete namespaces
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE delete project ${TEMPO_NS} --ignore-not-found=true
    $CLIENT_EXE delete ns ${TEMPO_NS} --ignore-not-found=true
  else
    ${CLIENT_EXE} delete ns ${TEMPO_NS} --ignore-not-found=true
  fi
  
  # Delete ClusterRoles and ClusterRoleBindings for multi-tenant
  if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
    ${CLIENT_EXE} delete ClusterRole tempostack-traces-reader-north tempostack-traces-reader-south --ignore-not-found=true
    ${CLIENT_EXE} delete ClusterRoleBinding tempostack-traces-reader-north tempostack-traces-reader-south --ignore-not-found=true
  fi

  if [ "${DELETE_ALL}" == "true" ]; then
    ${SCRIPT_DIR}/../install-istio-via-istioctl.sh -c ${CLIENT_EXE} -di true
    ${SCRIPT_DIR}/../install-bookinfo-demo.sh -c ${CLIENT_EXE} -db true
  fi
else
  install_tempo 3 30

  if [ "${ONLY_TEMPO}" != "true" ]; then
    echo "Script Directory: ${SCRIPT_DIR}"

    # Wait for TempoStack to be ready before proceeding (especially for multi-tenant mode)
    if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
      echo -e "Waiting for TempoStack to be ready before configuring Istio...\n"
      ${CLIENT_EXE} wait --for=condition=Ready TempoStack/cr -n ${TEMPO_NS} --timeout=10m 2>/dev/null || echo "Waiting for TempoStack pods to be ready..."
      ${CLIENT_EXE} wait pods --all -n ${TEMPO_NS} --for=condition=Ready --timeout=10m 2>/dev/null || echo "TempoStack pods may still be initializing"
      
      # Wait for gateway service to be available
      echo -e "Waiting for Tempo gateway service to be available...\n"
      gateway_ready=false
      for i in {1..30}; do
        if ${CLIENT_EXE} get service tempo-cr-gateway -n ${TEMPO_NS} >/dev/null 2>&1; then
          gateway_ready=true
          break
        fi
        echo -n "."
        sleep 2
      done
      echo ""
      if [ "${gateway_ready}" == "true" ]; then
        echo "Tempo gateway service is ready"
      else
        echo "WARNING: Tempo gateway service may not be ready yet"
      fi
      
      # Install OpenTelemetryCollector for multi-tenant mode
      echo -e "Installing OpenTelemetryCollector for multi-tenant Tempo...\n"
      install_opentelemetry_collector "istio-system" "tempo-cr-gateway" "${TEMPO_NS}" "north"
    fi

    if [ "${INSTALL_ISTIO}" == "true" ]; then

      using_sail_operator=false
      
      if [ "${AMBIENT}" == "true" ]; then
        echo -e "Installing istio Ambient \n"
        if [ "${using_sail_operator}" == "true" ] && [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
          # For Sail operator with multi-tenant, pass extension provider configuration via -s parameter
          ${SCRIPT_DIR}/../install-istio-via-sail.sh -a "prometheus grafana tempo" -cp ambient \
            -s '.spec.values.meshConfig.enableTracing = true' \
            -s '.spec.values.meshConfig.extensionProviders[0].name = "otel-tracing"' \
            -s '.spec.values.meshConfig.extensionProviders[0].opentelemetry.port = 4317' \
            -s '.spec.values.meshConfig.extensionProviders[0].opentelemetry.service = "otel-collector.istio-system.svc.cluster.local"'
        else
          ${SCRIPT_DIR}/../install-istio-via-istioctl.sh -c ${CLIENT_EXE} -a "prometheus grafana" -cp ambient -s values.meshConfig.defaultConfig.tracing.zipkin.address="tempo-cr-distributor.tempo:9411"
        fi
      else
        echo -e "Installing istio \n"
        if [ "${using_sail_operator}" == "true" ] && [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
          # For Sail operator with multi-tenant, pass extension provider configuration via -s parameter
          ${SCRIPT_DIR}/../install-istio-via-sail.sh -a "prometheus grafana" \
            -s '.spec.values.meshConfig.enableTracing = true' \
            -s '.spec.values.meshConfig.extensionProviders[0].name = "otel-tracing"' \
            -s '.spec.values.meshConfig.extensionProviders[0].opentelemetry.port = 4317' \
            -s '.spec.values.meshConfig.extensionProviders[0].opentelemetry.service = "otel-collector.istio-system.svc.cluster.local"'
        else
          if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
            ${SCRIPT_DIR}/../install-istio-via-istioctl.sh -c ${CLIENT_EXE} -a "prometheus grafana" \
                      -s 'values.meshConfig.enableTracing=true' \
                      -s 'values.meshConfig.extensionProviders[0].name=otel-tracing' \
                      -s 'values.meshConfig.extensionProviders[0].opentelemetry.port=4317' \
                      -s 'values.meshConfig.extensionProviders[0].opentelemetry.service=otel-collector.istio-system.svc.cluster.local'
          else
            ${SCRIPT_DIR}/../install-istio-via-istioctl.sh -c ${CLIENT_EXE} -a "prometheus grafana" -s values.meshConfig.defaultConfig.tracing.zipkin.address="tempo-cr-distributor.tempo:9411"
          fi
        fi
      fi
      
      # Create Telemetry resource for multi-tenant mode (both Sail operator and istioctl)
      if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
        if [ "${using_sail_operator}" == "true" ]; then
          echo -e "Waiting for Istio to be ready before creating Telemetry resource...\n"
          sleep 10  # Give Istio some time to start
          
          # Wait for Istio CR to exist
          istio_ready=false
          for i in {1..30}; do
            if ${CLIENT_EXE} get istios default -n istio-system >/dev/null 2>&1; then
              istio_ready=true
              break
            fi
            echo -n "."
            sleep 2
          done
          echo ""
          
          if [ "${istio_ready}" == "true" ]; then
            create_telemetry_resource "istio-system"
          else
            echo "WARNING: Istio CR not found. Telemetry resource creation will be skipped."
          fi
        else
          # For istioctl, create Telemetry resource directly
          echo -e "Creating Telemetry resource for istioctl with multi-tenant mode...\n"
          create_telemetry_resource "istio-system"
        fi
      fi
    fi

    if [ "${INSTALL_KIALI}" == "true" ]; then
      kiali_namespace="istio-system"
      
      # Determine Tempo URLs based on mode
      tempo_internal_url=""
      tempo_external_url=""
      
      if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
        # Multi-tenant mode: use gateway with tenant-specific URL
        tempo_internal_url="https://tempo-cr-gateway.${TEMPO_NS}.svc.cluster.local:8080/api/traces/v1/north/tempo"
        tempo_external_url="$(${CLIENT_EXE} get route -n ${TEMPO_NS} -l app.kubernetes.io/name=tempo,app.kubernetes.io/component=gateway -o jsonpath='https://{..spec.host}/api/traces/v1/north/search' 2>/dev/null || echo "")"
      else
        # Single-tenant mode
        tempo_internal_url="http://cr-query-frontend.${TEMPO_NS}.svc.cluster.local:3200"
        if [ "${IS_OPENSHIFT}" == "true" ]; then
          tempo_external_url="$(${CLIENT_EXE} get route -n ${TEMPO_NS} -l app.kubernetes.io/name=tempo,app.kubernetes.io/component=query-frontend -o jsonpath='https://{..spec.host}' 2>/dev/null || echo "")"
        fi
      fi
      
      echo "Installing Kiali via helm"
      
      if [ "${IS_OPENSHIFT}" == "true" ]; then
        kiali_route_url="https://kiali-${kiali_namespace}.$(${CLIENT_EXE} get ingresses.config/cluster -o jsonpath='{.spec.domain}')"
      else
        kiali_route_url=""
      fi

      helm_args=(
        "upgrade"
        "--install"
        "--create-namespace"
        "--namespace" "${kiali_namespace}"
        "--set" "deployment.logger.log_level=trace"
        "--set" "external_services.tracing.enabled=true"
        "--set" "external_services.tracing.internal_url=${tempo_internal_url}"
        "--set" "external_services.tracing.provider=tempo"
        "--set" "external_services.tracing.use_grpc=false"
      )
      
      if [ -n "${tempo_external_url}" ]; then
        helm_args+=("--set" "external_services.tracing.external_url=${tempo_external_url}")
      fi
      
      if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
        helm_args+=(
          "--set" "external_services.tracing.tempo_config.namespace=${TEMPO_NS}"
          "--set" "external_services.tracing.tempo_config.name=cr"
          "--set" "external_services.tracing.tempo_config.tenant=north"
          "--set" "external_services.tracing.tempo_config.url_format=openshift"
          "--set" "external_services.tracing.tempo_config.org_id=1"
          "--set" "external_services.tracing.auth.type=bearer"
          "--set" "external_services.tracing.auth.use_kiali_token=true"
        )
      fi
      
      if [ -n "${kiali_route_url}" ]; then
        helm_args+=("--set" "kiali_route_url=${kiali_route_url}")
      fi
      
      helm_args+=("kiali-server" "kiali/kiali-server")
      
      helm "${helm_args[@]}"
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
