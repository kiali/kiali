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
MINIO_FILE="${SCRIPT_DIR}/minio.yaml"

set -e

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
        # Check if the webhook pods are ready (try both label selectors for community and Red Hat operators)
        local ready_pods=$(${CLIENT_EXE} get pods -n "${namespace}" -l app.kubernetes.io/name=tempo-operator -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' 2>/dev/null)
        if [ -z "${ready_pods}" ]; then
          # Try alternative label selector for Red Hat operator
          ready_pods=$(${CLIENT_EXE} get pods -n "${namespace}" -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' 2>/dev/null | grep -i tempo || true)
        fi
        
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
  
  ${CLIENT_EXE} apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: tempostack-traces-reader-${tenant_name}
rules:
  - apiGroups:
      - 'tempo.grafana.com'
    resources:
      - ${tenant_name}
    resourceNames:
      - traces
    verbs:
      - 'get'
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: tempostack-traces-reader-${tenant_name}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: tempostack-traces-reader-${tenant_name}
subjects:
  - kind: Group
    apiGroup: rbac.authorization.k8s.io
    name: system:authenticated
EOF
}

# Function to install COO UI Plugin for distributed tracing
install_coo_ui_plugin() {
  local operator_namespace="${TEMPO_OPERATOR_NS:-openshift-tempo-operator}"
  
  echo -e "Creating COO UI Plugin for distributed tracing...\n"
  
  ${CLIENT_EXE} apply -f - <<EOF
apiVersion: observability.redhat.com/v1alpha1
kind: UIPlugin
metadata:
  name: distributed-tracing
  namespace: ${operator_namespace}
spec:
  displayName: Distributed Tracing
  type: tracing
  backend:
    tempo:
      enabled: true
      namespace: ${TEMPO_NS}
      name: cr
      tenant: north
EOF
  
  echo -e "Waiting for UI Plugin to be ready...\n"
  ${CLIENT_EXE} wait --for=condition=Ready UIPlugin/distributed-tracing -n ${operator_namespace} --timeout=5m 2>/dev/null || echo "UI Plugin may take longer to become ready"
}

# Function to install Kiali Operator using Helm
install_kiali_operator() {
  local kiali_namespace="${1:-istio-system}"
  local tempo_internal_url="${2:-}"
  local tempo_external_url="${3:-}"
  
  echo -e "Installing Kiali Operator using Helm...\n"
  
  # Check if helm is available
  if ! command -v helm >/dev/null 2>&1; then
    echo "ERROR: helm command not found. Please install Helm first."
    return 1
  fi
  
  # Add Kiali Helm repository
  echo -e "Adding Kiali Helm repository...\n"
  helm repo add kiali https://kiali.org/helm-charts --force-update
  helm repo update
  
  local operator_namespace="kiali-operator"
  
  # Build Helm install command with --set flags
  # We'll install the operator without creating the CR, then configure it separately
  local helm_args=(
    "upgrade"
    "--install"
    "--create-namespace"
    "--namespace" "${operator_namespace}"
    "--set" "cr.create=false"
    "--set" "allowAdHocKialiNamespace=true"
    "--set" "allowAdHocKialiImage=true"
    "--set" "allowSecurityContextOverride=true"
    "--set" "allowAllAccessibleNamespaces=true"
    "--set" "watchNamespace="
    "kiali-operator"
    "kiali/kiali-operator"
  )
  
  echo -e "Installing Kiali Operator...\n"
  helm "${helm_args[@]}"
  
  if [ "$?" != "0" ]; then
    echo "ERROR: Failed to install Kiali Operator via Helm."
    return 1
  fi
  
  echo -e "Waiting for Kiali CRD to be created...\n"
  local i=0
  while [ ${i} -lt 60 ] && ! ${CLIENT_EXE} get crd kialis.kiali.io >/dev/null 2>&1; do
    echo -n "."
    sleep 2
    (( i++ ))
  done
  echo ""
  
  if ! ${CLIENT_EXE} get crd kialis.kiali.io >/dev/null 2>&1; then
    echo "ERROR: Kiali CRD was not created after installing operator."
    return 1
  fi
  
  echo -e "Waiting for Kiali CRD to be established...\n"
  ${CLIENT_EXE} wait --for=condition=established --timeout=5m crd kialis.kiali.io
  
  echo -e "Waiting for Kiali operator deployment to be ready...\n"
  ${CLIENT_EXE} wait --for=condition=available --timeout=10m deployment/kiali-operator -n ${operator_namespace} 2>/dev/null || {
    echo "WARNING: Kiali operator deployment may still be initializing"
    echo "Checking pods:"
    ${CLIENT_EXE} get pods -n ${operator_namespace} | grep kiali || echo "No kiali pods found"
  }
  
  echo -e "Kiali Operator installed successfully.\n"
}

install_tempo() {
  local max_retries="${1:-3}"
  local retry_interval="${2:-30}"
  
  for ((attempt=1; attempt<=max_retries; attempt++)); do
    echo "Tempo installation attempt ${attempt}/${max_retries}"
    
    if install_tempo_single_attempt; then
      echo "Tempo installation completed successfully"
      
      # Wait for webhook readiness
      # Determine operator namespace based on installation method
      if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
        TEMPO_OPERATOR_NS="openshift-tempo-operator"
        WEBHOOK_SERVICE="tempo-operator-webhook-service"
      else
        TEMPO_OPERATOR_NS="tempo-operator-system"
        WEBHOOK_SERVICE="tempo-operator-webhook-service"
      fi
      
      if wait_for_webhook_readiness "${WEBHOOK_SERVICE}" "${TEMPO_OPERATOR_NS}" 30 10; then
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

  local kiali_namespace="${1:-istio-system}"

  # Install Tempo operator based on cluster type and multi-tenant mode
  if [ "${MULTI_TENANT}" == "true" ] && [ "${IS_OPENSHIFT}" == "true" ]; then
    # For multi-tenant mode in OpenShift, use Red Hat operator from OLM
    # cert-manager is NOT needed for Red Hat operators from OLM
    echo -e "Installing Red Hat Tempo operator from OLM (required for multi-tenant mode)...\n"
    export TEMPO_OPERATOR_NS="openshift-tempo-operator"
    
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
    fi
    
    # Wait a moment for namespace to be fully ready
    sleep 2
    
    # Create OperatorGroup
    ${CLIENT_EXE} apply -f - <<EOF
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: ${TEMPO_OPERATOR_NS}
  namespace: ${TEMPO_OPERATOR_NS}
spec:
  upgradeStrategy: Default
EOF
    
    # Create Subscription for Red Hat Tempo operator
    ${CLIENT_EXE} apply -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: my-tempo-operator
  namespace: ${TEMPO_OPERATOR_NS}
spec:
  channel: stable
  installPlanApproval: Automatic
  name: tempo-product
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF
    
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
    echo -e "Installing OpenTelemetry Operator from OLM...\n"
    ${CLIENT_EXE} apply -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: my-opentelemetry-operator
  namespace: ${TEMPO_OPERATOR_NS}
spec:
  channel: stable
  installPlanApproval: Automatic
  name: opentelemetry-product
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF
    
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
      ${CLIENT_EXE} apply -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: my-cluster-observability-operator
  namespace: ${TEMPO_OPERATOR_NS}
spec:
  channel: stable
  installPlanApproval: Automatic
  name: cluster-observability-operator
  source: redhat-operators
  sourceNamespace: openshift-marketplace
EOF
      
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
    
  else
    # For single-tenant or non-OpenShift, use community operator from GitHub
    # cert-manager IS needed for community operator from GitHub
    echo -e "Installing cert manager (required for community Tempo operator)...\n"
    ${CLIENT_EXE} apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
    echo -e "Waiting for cert-manager pods to be ready... \n"
    $CLIENT_EXE wait pods --all -n cert-manager --for=condition=Ready --timeout=5m

    # There's some issue with the cert-manager webhook where it fails to add the https cert to the webhook
    # before it is marked as ready. So we need to wait for a small period of time before installing the Tempo operator
    # because the tempo manifests rely on the cert-manager webhook to be ready.
    echo -e "Waiting for cert-manager webhook to be ready... \n"
    sleep 10
    
    echo -e "Installing latest Tempo operator from GitHub...\n"
    export TEMPO_OPERATOR_NS="tempo-operator-system"
    ${CLIENT_EXE} apply -f https://github.com/grafana/tempo-operator/releases/latest/download/tempo-operator.yaml
    echo -e "Waiting for Tempo operator to be ready... \n"
    $CLIENT_EXE wait pods --all -n ${TEMPO_OPERATOR_NS} --for=condition=Ready --timeout=5m
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
        if ${CLIENT_EXE} apply -n ${TEMPO_NS} -f - <<EOF
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
  observability:
    tracing:
      jaeger_agent_endpoint: 'localhost:6831'
  tenants:
    authentication:
      - tenantId: f78bf974-aee2-47e8-8bb4-9ba41a41824a
        tenantName: north
      - tenantId: ac4dd897-40da-4403-9cab-53905e22ef78
        tenantName: south
    mode: openshift
  managementState: Managed
  template:
    distributor:
      tls:
        enabled: true
        certName: tempo-cert
    gateway:
      enabled: true
    queryFrontend:
      component:
        resources:
          limits:
            cpu: "2"
            memory: 2Gi
      jaegerQuery:
        enabled: true
EOF
        then
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
        if ${CLIENT_EXE} apply -n ${TEMPO_NS} -f - <<EOF
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
        then
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
          if ${CLIENT_EXE} apply -n ${TEMPO_NS} -f - <<EOF
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
  observability:
    tracing:
      jaeger_agent_endpoint: 'localhost:6831'
  tenants:
    authentication:
      - tenantId: f78bf974-aee2-47e8-8bb4-9ba41a41824a
        tenantName: north
      - tenantId: ac4dd897-40da-4403-9cab-53905e22ef78
        tenantName: south
    mode: openshift
  managementState: Managed
  template:
    gateway:
      enabled: true
    queryFrontend:
      component:
        resources:
          limits:
            cpu: "2"
            memory: 2Gi
      jaegerQuery:
        enabled: true
EOF
          then
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
          if ${CLIENT_EXE} apply -n ${TEMPO_NS} -f - <<EOF
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
          then
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
    helm install tempo-cr grafana/tempo-distributed -n tempo -f ${SCRIPT_DIR}/helm.yaml

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

      echo "Installing Kiali via helm"

      kiali_route_url="https://kiali-${kiali_namespace}.$(kubectl get ingresses.config/cluster -o jsonpath='{.spec.domain}')"

      helm upgrade --install \
         --namespace "${kiali_namespace}" \
         --set deployment.logger.log_level="trace" \
         --set external_services.tracing.enabled="true" \
         --set external_services.tracing.internal_url="https://tempo-cr-gateway.tempo.svc:8080/api/traces/v1/north/tempo" \
         --set external_services.tracing.external_url="https://tempo-cr-gateway-tempo.apps-crc.testing/api/traces/v1/north/search" \
         --set external_services.tracing.provider="tempo" \
         --set external_services.tracing.use_grpc="false" \
         --set external_services.tracing.auth.ca_file="/var/run/secrets/kubernetes.io/serviceaccount/service-ca.crt" \
         --set external_services.tracing.auth.type="bearer" \
         --set external_services.tracing.auth.use_kiali_token="true" \
         --set kiali_route_url="${kiali_route_url}" \
         kiali-server \
         kiali/kiali-server
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
