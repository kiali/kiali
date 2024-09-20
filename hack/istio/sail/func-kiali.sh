#!/bin/bash

##########################################################
#
# Functions for managing Kiali installs.
#
##########################################################

set -u

install_kiali_operator() {
  # if not OpenShift, install from OperatorHub.io
  # This will create a subscription with the name "my-kiali"
  if [ "${IS_OPENSHIFT}" == "false" ]; then
    ${OC} apply -f https://operatorhub.io/install/kiali.yaml
    return
  fi

  local catalog_source="${1}"

  case ${catalog_source} in
    redhat)
      local kiali_subscription_source="redhat-operators"
      local kiali_subscription_name="kiali-ossm"
      ;;
    community)
      local kiali_subscription_source="community-operators"
      local kiali_subscription_name="kiali"
      ;;
    *)
      local kiali_subscription_source="${catalog_source}"
      local kiali_subscription_name="kiali-ossm"
      ;;
  esac

  infomsg "Installing the Kiali Operator from the catalog source [${catalog_source}]"
  cat <<EOM | ${OC} apply -f -
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: my-kiali
  namespace: ${OLM_OPERATORS_NAMESPACE}
spec:
  channel: stable
  installPlanApproval: Automatic
  name: ${kiali_subscription_name}
  source: ${kiali_subscription_source}
  sourceNamespace: openshift-marketplace
  config:
    env:
    - name: ALLOW_ALL_ACCESSIBLE_NAMESPACES
      value: "true"
    - name: ACCESSIBLE_NAMESPACES_LABEL
      value: ""
EOM
}

install_kiali_cr() {
  local control_plane_namespace="${1}"
  infomsg "Installing the Kiali CR after CRD has been established"
  echo -n "Waiting."
  while ! ${OC} get crd kialis.kiali.io >& /dev/null ; do echo -n '.'; sleep 1; done
  ${OC} wait --for condition=established crd/kialis.kiali.io

  if ! ${OC} get namespace ${control_plane_namespace} >& /dev/null; then
    errormsg "Control plane namespace does not exist [${control_plane_namespace}]"
    exit 1
  fi

  if [ -z "${TEMPO_NAMESPACE:-}" ]; then
    TEMPO_NAMESPACE="$(${OC} get pods -l app.kubernetes.io/name=tempo --all-namespaces --no-headers --ignore-not-found=true 2>/dev/null | head -n1 | awk '{print $1}')"
    if [ -z "${TEMPO_NAMESPACE:-}" ]; then
      errormsg "TEMPO_NAMESPACE not defined and cannot be auto-detected. Is Tempo installed?"
      exit 1
    fi
  fi

  # Try to determine the external URL for the tracing UI
  local tracing_external_url=""
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    # we installed TempoStack CR configured for "route" when on OpenShift, so look for the route URL
    tracing_external_url="$(${OC} get route -n ${TEMPO_NAMESPACE} -l app.kubernetes.io/name=tempo,app.kubernetes.io/component=query-frontend -o jsonpath='https://{..spec.host}')"
    infomsg "The tracing external URL is the OpenShift route located at [${tracing_external_url}]"
  else
    # we installed TempoStack CR configured for "ingress" when on vanilla Kubernetes, so look for the ingress URL
    local tracing_ingress_host="$(${OC} -n ${TEMPO_NAMESPACE} get ingress -l app.kubernetes.io/name=tempo,app.kubernetes.io/component=query-frontend -o jsonpath='{..status.loadBalancer.ingress[0].ip}' 2> /dev/null)"
    if [ -n "${tracing_ingress_host}" ]; then
      tracing_external_url="http://${tracing_ingress_host}:80"
      infomsg "The tracing external URL is the LoadBalancer endpoint located at [${tracing_external_url}]"
    else
      infomsg "The tracing external URL cannot be determined. Leaving it empty in the Kiali CR."
    fi
  fi

  # Try to determine the external URL for the Grafana UI
  local grafana_external_url=""
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    grafana_external_url="$(${OC} get route -n ${CONTROL_PLANE_NAMESPACE} grafana -o jsonpath='http://{..spec.host}')"
    infomsg "The Grafana external URL is the OpenShift route located at [${grafana_external_url}]"
  else
    local grafana_ingress_host="$(${OC} -n ${CONTROL_PLANE_NAMESPACE} get svc grafana -o jsonpath='{..status.loadBalancer.ingress[0].ip}' 2> /dev/null)"
    if [ -n "${grafana_ingress_host}" ]; then
      grafana_external_url="http://${grafana_ingress_host}:3000"
      infomsg "The Grafana external URL is the LoadBalancer endpoint located at [${grafana_external_url}]"
    else
      infomsg "The Grafana external URL cannot be determined. Leaving it empty in the Kiali CR."
    fi
  fi

  # OpenShift should always use its own auth strategy. For vanilla Kubernetes, set it to anonymous.
  local auth_strategy="anonymous"
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    auth_strategy="openshift"
  fi

  cat <<EOM | ${OC} apply -f -
apiVersion: kiali.io/v1alpha1
kind: Kiali
metadata:
  name: kiali
  namespace: ${control_plane_namespace}
spec:
  version: ${KIALI_VERSION}
  auth:
    strategy: ${auth_strategy}
  external_services:
    grafana:
      enabled: true
      in_cluster_url: "http://grafana.${CONTROL_PLANE_NAMESPACE}:3000"
      url: "${grafana_external_url}"
    tracing:
      enabled: true
      provider: tempo
      in_cluster_url: "http://tempo-tempo-query-frontend.${TEMPO_NAMESPACE}:3200"
      url: "${tracing_external_url}"
      use_grpc: false
EOM
}

install_ossmconsole_cr() {
  local ossmconsole_namespace="${1}"
  infomsg "Installing the OSSMConsole CR after CRD has been established"
  echo -n "Waiting."
  while ! ${OC} get crd ossmconsoles.kiali.io >& /dev/null ; do echo -n '.'; sleep 1; done
  ${OC} wait --for condition=established crd/ossmconsoles.kiali.io

  if ! ${OC} get kiali --all-namespaces &> /dev/null; then
    errormsg "OSSMC cannot be installed because Kiali is not yet installed."
    return 1
  fi

  if ! ${OC} get namespace ${ossmconsole_namespace} >& /dev/null; then
    infomsg "Creating OSSMConsole plugin namespace: ${ossmconsole_namespace}"
    ${OC} create namespace ${ossmconsole_namespace}
  fi

  cat <<EOM | ${OC} apply -f -
apiVersion: kiali.io/v1alpha1
kind: OSSMConsole
metadata:
  name: ossmconsole
  namespace: ${ossmconsole_namespace}
spec:
  version: ${KIALI_VERSION}
EOM
}

delete_kiali_operator() {
  local abort_operation="false"
  for cr in \
    $(${OC} get kiali --all-namespaces -o custom-columns=K:.kind,NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g' ) \
    $(${OC} get ossmconsole --all-namespaces -o custom-columns=K:.kind,NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g' )
  do
    abort_operation="true"
    local res_kind=$(echo ${cr} | cut -d: -f1)
    local res_namespace=$(echo ${cr} | cut -d: -f2)
    local res_name=$(echo ${cr} | cut -d: -f3)
    errormsg "A [${res_kind}] CR named [${res_name}] in namespace [${res_namespace}] still exists. It must be deleted first."
  done
  if [ "${abort_operation}" == "true" ]; then
    errormsg "Aborting"
    exit 1
  fi

  infomsg "Unsubscribing from the Kiali Operator"
  ${OC} delete subscription --ignore-not-found=true --namespace ${OLM_OPERATORS_NAMESPACE} my-kiali

  infomsg "Deleting OLM CSVs which uninstalled the Kiali Operator and its related resources"
  for csv in $(${OC} get csv --all-namespaces --no-headers -o custom-columns=NS:.metadata.namespace,N:.metadata.name | sed 's/  */:/g' | grep kiali-operator)
  do
    ${OC} delete csv -n $(echo -n $csv | cut -d: -f1) $(echo -n $csv | cut -d: -f2)
  done

  infomsg "Delete Kiali CRDs"
  ${OC} get crds -o name | grep '.*\.kiali\.io' | xargs -r -n 1 ${OC} delete
}

delete_kiali_cr() {
  infomsg "Deleting all Kiali CRs in the cluster"
  for cr in $(${OC} get kiali --all-namespaces -o custom-columns=NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g' )
  do
    local res_namespace=$(echo ${cr} | cut -d: -f1)
    local res_name=$(echo ${cr} | cut -d: -f2)
    ${OC} delete -n ${res_namespace} kiali ${res_name}
  done
}

delete_ossmconsole_cr() {
  infomsg "Deleting all OSSMConsole CRs in the cluster"
  for cr in $(${OC} get ossmconsole --all-namespaces -o custom-columns=NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g' )
  do
    local res_namespace=$(echo ${cr} | cut -d: -f1)
    local res_name=$(echo ${cr} | cut -d: -f2)
    ${OC} delete -n ${res_namespace} ossmconsole ${res_name}
  done
}

status_kiali_operator() {
  infomsg ""
  infomsg "===== KIALI OPERATOR SUBSCRIPTION"
  local sub_name="$(${OC} get subscriptions -n ${OLM_OPERATORS_NAMESPACE} -o name my-kiali)"
  if [ ! -z "${sub_name}" ]; then
    infomsg "A Subscription exists for the Kiali Operator"
    ${OC} get --namespace ${OLM_OPERATORS_NAMESPACE} ${sub_name}
    infomsg ""
    infomsg "===== KIALI OPERATOR POD"
    local op_name="$(${OC} get pod -n ${OLM_OPERATORS_NAMESPACE} -o name | grep kiali)"
    [ ! -z "${op_name}" ] && ${OC} get --namespace ${OLM_OPERATORS_NAMESPACE} ${op_name} || infomsg "There is no pod"
  else
    infomsg "There is no Subscription for the Kiali Operator"
  fi
}

status_kiali_cr() {
  infomsg ""
  infomsg "===== Kiali CRs"
  if [ "$(${OC} get kiali --all-namespaces 2> /dev/null | wc -l)" -gt "0" ] ; then
    infomsg "One or more Kiali CRs exist in the cluster"
    ${OC} get kiali --all-namespaces
    infomsg ""
    for cr in \
      $(${OC} get kiali --all-namespaces -o custom-columns=NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g' )
    do
      local res_namespace=$(echo ${cr} | cut -d: -f1)
      local res_name=$(echo ${cr} | cut -d: -f2)
      infomsg "Kiali [${res_name}] namespace [${res_namespace}]:"
      ${OC} get pods --namespace ${res_namespace} -l app.kubernetes.io/name=kiali
      infomsg ""
      infomsg "Kiali Web Console can be accessed here: "
      if [ "${IS_OPENSHIFT}" == "true" ]; then
        ${OC} get route -n ${res_namespace} -l app.kubernetes.io/name=kiali -o jsonpath='https://{..spec.host}{"\n"}'
      else
        infomsg "Cannot determine where the UI is on non-OpenShift clusters."
      fi
    done
  else
    infomsg "There are no Kiali CRs in the cluster"
  fi
}

status_ossmconsole_cr() {
  infomsg ""
  infomsg "===== OSSMConsole CRs"
  if [ "$(${OC} get ossmconsole --all-namespaces 2> /dev/null | wc -l)" -gt "0" ] ; then
    infomsg "One or more OSSMConsole CRs exist in the cluster"
    ${OC} get ossmconsole --all-namespaces
    infomsg ""
    for cr in \
      $(${OC} get ossmconsole --all-namespaces -o custom-columns=NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g' )
    do
      local res_namespace=$(echo ${cr} | cut -d: -f1)
      local res_name=$(echo ${cr} | cut -d: -f2)
      infomsg "OSSMConsole [${res_name}] namespace [${res_namespace}]:"
      ${OC} get pods --namespace ${res_namespace} -l app.kubernetes.io/name=ossmconsole
      infomsg ""
    done
  else
    infomsg "There are no OSSMConsole CRs in the cluster"
  fi
}
