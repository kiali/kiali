#!/bin/bash

##########################################################
#
# Functions for managing Tempo installs.
# Temp provides distributed tracing to the Istio mesh.
#
# See: https://docs.openshift.com/container-platform/4.14/distr_tracing/distr_tracing_tempo/distr-tracing-tempo-installing.html
#
##########################################################

set -u

source ${SCRIPT_ROOT}/func-minio.sh

determine_tempo_namespaces() {
  TEMPO_NAMESPACE="tempo"

  if [ "${IS_OPENSHIFT}" == "true" ]; then
    TEMPO_OPERATOR_NAMESPACE="openshift-tempo-operator"
  else
    TEMPO_OPERATOR_NAMESPACE="${OLM_OPERATORS_NAMESPACE}"
  fi
}

install_tempo_operator() {
  # if not OpenShift, install from OperatorHub.io
  # This will create a subscription with the name "my-tempo-operator"
  if [ "${IS_OPENSHIFT}" == "false" ]; then
    ${OC} apply -f https://operatorhub.io/install/tempo-operator.yaml
    return
  fi

  determine_tempo_namespaces

  local catalog_source="${1}"

  case ${catalog_source} in
    redhat)
      local tempo_subscription_source="redhat-operators"
      local tempo_subscription_name="tempo-product"
      local tempo_subscription_channel="stable"
      ;;
    community)
      local tempo_subscription_source="community-operators"
      local tempo_subscription_name="tempo-operator"
      local tempo_subscription_channel="alpha"
      ;;
    *)
      echo "ERROR! Invalid catalog source for Tempo operator. Must be 'redhat' or 'community'."
      return 1
      ;;
  esac

  echo "Installing the Tempo Operator from the catalog source [${catalog_source}]"
  cat <<EOM | ${OC} apply -f -
---
apiVersion: project.openshift.io/v1
kind: Project
metadata:
  labels:
    kubernetes.io/metadata.name: ${TEMPO_OPERATOR_NAMESPACE}
    openshift.io/cluster-monitoring: "true"
  name: ${TEMPO_OPERATOR_NAMESPACE}
---
apiVersion: operators.coreos.com/v1
kind: OperatorGroup
metadata:
  name: ${TEMPO_OPERATOR_NAMESPACE}
  namespace: ${TEMPO_OPERATOR_NAMESPACE}
spec:
  upgradeStrategy: Default
---
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: my-tempo-operator
  namespace: ${TEMPO_OPERATOR_NAMESPACE}
spec:
  channel: ${tempo_subscription_channel}
  installPlanApproval: Automatic
  name: ${tempo_subscription_name}
  source: ${tempo_subscription_source}
  sourceNamespace: openshift-marketplace
EOM
}

install_tempo() {

  determine_tempo_namespaces

  # Obtained this list of CRDs by "oc get crds -oname | grep tempo". We can't actually do that here programatically
  # because the CRDs may not even be created yet. That's why there is a while loop in here - to wait for them to be created.
  echo "Waiting for CRDs to be established."
  for crd in \
     tempostacks.tempo.grafana.com
  do
    echo -n "Waiting for CRD [${crd}]..."
    while ! ${OC} get crd ${crd} >& /dev/null ; do echo -n '.'; sleep 1; done
    ${OC} wait --for condition=established crd/${crd}
  done

  echo -n "Waiting for Tempo operator deployment to be created..."
  while ! ${OC} get deployment --namespace ${TEMPO_OPERATOR_NAMESPACE} -o name | grep tempo >& /dev/null ; do echo -n '.'; sleep 1; done
  echo "done."
  local tempo_deployment="$(${OC} get deployment --namespace ${TEMPO_OPERATOR_NAMESPACE} -o name | grep tempo)"

  echo "Waiting for operator deployments to start..."
  for op in ${tempo_deployment}
  do
    echo -n "Waiting for ${op} to be ready..."
    local readyReplicas="0"
    while [ "$?" != "0" -o "$readyReplicas" == "0" ]
    do
      sleep 1
      echo -n '.'
      readyReplicas="$(${OC} get ${op} --namespace ${TEMPO_OPERATOR_NAMESPACE} -o jsonpath='{.status.readyReplicas}' 2> /dev/null)"
    done
    echo "done."
  done

  echo "Wait for the tempo operator to be Ready."
  ${OC} wait --for condition=Ready $(${OC} get pod --namespace ${TEMPO_OPERATOR_NAMESPACE} -o name | grep tempo) --timeout 300s --namespace ${TEMPO_OPERATOR_NAMESPACE}
  echo "done."

  echo "Wait for the tempo validating webhook to be created."
  while [ "$(${OC} get validatingwebhookconfigurations -o name | grep tempo)" == "" ]; do echo -n '.'; sleep 5; done
  echo "done."

  echo "Wait for the tempo mutating webhook to be created."
  while [ "$(${OC} get mutatingwebhookconfigurations -o name | grep tempo)" == "" ]; do echo -n '.'; sleep 5; done
  echo "done."

  if ! ${OC} get namespace ${TEMPO_NAMESPACE} >& /dev/null; then
    echo "Creating Tempo namespace: ${TEMPO_NAMESPACE}"
    ${OC} create namespace ${TEMPO_NAMESPACE}
  fi

  echo "Installing Minio..."
  install_minio ${TEMPO_NAMESPACE}

  echo "Installing TempoStack CR"
  ${OC} apply --namespace ${TEMPO_NAMESPACE} -f - <<EOM
apiVersion: tempo.grafana.com/v1alpha1
kind: TempoStack
metadata:
  name: tempo
spec:
  storageSize: 1Gi
  storage:
    secret:
      type: s3
      name: "${MINIO_SECRET_NAME}"
  resources:
    total:
      limits:
        memory: 2Gi
        cpu: 2000m
  template:
    distributor:
      tls:
        enabled: false
    queryFrontend:
      jaegerQuery:
        enabled: true
        ingress:
          route:
            termination: edge
          type: route
EOM

  echo "Waiting for things to start..."
  sleep 5
  ${OC} wait pod --for condition=Ready --namespace ${TEMPO_NAMESPACE} --all --timeout=5m
}

delete_tempo_operator() {

  determine_tempo_namespaces

  local abort_operation="false"
  for cr in \
    $(${OC} get TempoStack --all-namespaces -o custom-columns=K:.kind,NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g' )
  do
    abort_operation="true"
    local res_kind=$(echo ${cr} | cut -d: -f1)
    local res_namespace=$(echo ${cr} | cut -d: -f2)
    local res_name=$(echo ${cr} | cut -d: -f3)
    echo "A [${res_kind}] resource named [${res_name}] in namespace [${res_namespace}] still exists. You must delete it first."
  done
  if [ "${abort_operation}" == "true" ]; then
    echo "Aborting"
    exit 1
  fi

  echo "Unsubscribing from the Tempo operator"
  ${OC} delete subscription --ignore-not-found=true --namespace ${TEMPO_OPERATOR_NAMESPACE} my-tempo-operator

  echo "Deleting OLM CSVs which uninstalls the operators and their related resources"
  for csv in $(${OC} get csv --all-namespaces --no-headers -o custom-columns=NS:.metadata.namespace,N:.metadata.name | sed 's/  */:/g' | grep -E 'tempo')
  do
    ${OC} delete --ignore-not-found=true csv --namespace $(echo -n $csv | cut -d: -f1) $(echo -n $csv | cut -d: -f2)
  done

  echo "Deleting Tempo OperatorGroup"
  for og in $(${OC} get OperatorGroup --all-namespaces --no-headers -o custom-columns=NS:.metadata.namespace,N:.metadata.name | sed 's/  */:/g' | grep -E 'tempo')
  do
    ${OC} delete --ignore-not-found=true OperatorGroup --namespace $(echo -n $og | cut -d: -f1) $(echo -n $og | cut -d: -f2)
  done

  echo "Deleting Tempo Operator Namespace"
  ${OC} delete project --ignore-not-found=true ${TEMPO_OPERATOR_NAMESPACE}

  echo "Delete the CRDs"
  ${OC} get crds -o name | grep 'tempo' | xargs -r -n 1 ${OC} delete
}

delete_tempo() {
  echo "Deleting all TempoStack CRs (if they exist) which uninstalls all the Tempo components"
  local doomed_namespaces=""
  for cr in \
    $(${OC} get TempoStack --all-namespaces -o custom-columns=K:.kind,NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g' )
  do
    local res_kind=$(echo ${cr} | cut -d: -f1)
    local res_namespace=$(echo ${cr} | cut -d: -f2)
    local res_name=$(echo ${cr} | cut -d: -f3)
    ${OC} delete --namespace ${res_namespace} ${res_kind} ${res_name}
    doomed_namespaces="$(echo ${res_namespace} ${doomed_namespaces} | tr ' ' '\n' | sort -u)"
  done

  echo "Deleting Minio..."
  delete_minio ${TEMPO_NAMESPACE}

  echo "Deleting the Tempo namespaces"
  for ns in ${doomed_namespaces}
  do
    ${OC} delete namespace ${ns}
  done
}

status_tempo_operator() {

  determine_tempo_namespaces

  echo
  echo "===== TEMPO OPERATOR SUBSCRIPTIONS"
  local sub_name="$(${OC} get subscriptions -n ${TEMPO_OPERATOR_NAMESPACE} -o name my-tempo-operator)"
  if [ ! -z "${sub_name}" ]; then
    ${OC} get --namespace ${TEMPO_OPERATOR_NAMESPACE} ${sub_name}
    echo
    echo "===== TEMPO OPERATOR PODS"
    local all_pods="$(${OC} get pods -n ${TEMPO_OPERATOR_NAMESPACE} -o name | grep -E 'tempo')"
    [ ! -z "${all_pods}" ] && ${OC} get --namespace ${TEMPO_OPERATOR_NAMESPACE} ${all_pods} || echo "There are no pods"
  else
    echo "There are no Subscriptions for the Tempo Operator"
  fi
}

status_tempo() {
  echo
  echo "===== TempoStack CRs"
  if [ "$(${OC} get TempoStack --all-namespaces 2> /dev/null | wc -l)" -gt "0" ] ; then
    echo "One or more TempoStack CRs exist in the cluster"
    ${OC} get TempoStack --all-namespaces
    echo
    for cr in \
      $(${OC} get TempoStack --all-namespaces -o custom-columns=NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g' )
    do
      local res_namespace=$(echo ${cr} | cut -d: -f1)
      local res_name=$(echo ${cr} | cut -d: -f2)
      echo "TempoStack [${res_name}] namespace [${res_namespace}]:"
      ${OC} get pods --namespace ${res_namespace}
      echo
      echo -n "Tempo Web Console can be accessed here: "
      ${OC} get route -n ${res_namespace} -l app.kubernetes.io/name=tempo,app.kubernetes.io/component=query-frontend -o jsonpath='https://{..spec.host}'
      echo
    done
  else
    echo "There are no TempoStack CRs in the cluster"
  fi
}
