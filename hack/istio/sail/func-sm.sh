#!/bin/bash

##########################################################
#
# Functions for managing Service Mesh installs.
#
##########################################################

set -u

install_servicemesh_operators() {
  # if not OpenShift, install from OperatorHub.io
  # This will create a subscription with the name "my-sail"
  if [ "${IS_OPENSHIFT}" == "false" ]; then
    errormsg "INSTALLING ON NON-OPENSHIFT CLUSTERS IS NOT YET SUPPORTED."
    errormsg "THIS WILL BE SUPPORTED WHEN SAIL OPERATOR IS PUBLISHED ON OPERATORHUB.IO."
    errormsg "WHEN THE FOLLOWING ISSUE IS FIXED, SUPPORT CAN BE ADDED: https://issues.redhat.com/browse/OSSM-4829"
    exit 1
    # TODO: When Sail is published on OperatorHub.io, delete the lines above, uncomment below,
    # and confirm what the name will be of the created subscription - that name should be the same
    # as the name of the subscription we create further below.
    #${OC} apply -f https://operatorhub.io/install/sail.yaml
    #return
  fi

  local catalog_source="${1}"

  case ${catalog_source} in
    redhat)
      local servicemesh_subscription_source="redhat-operators"
      local servicemesh_subscription_name="servicemeshoperator3"
      local servicemesh_subscription_channel="candidates"
      ;;
    community)
      local servicemesh_subscription_source="community-operators"
      local servicemesh_subscription_name="sailoperator"
      local servicemesh_subscription_channel="3.0-nightly"
      ;;
    *)
      local servicemesh_subscription_source="${catalog_source}"
      local servicemesh_subscription_name="servicemeshoperator3"
      local servicemesh_subscription_channel="candidates"
      ;;
  esac

  infomsg "Installing the Service Mesh Operators from the catalog source [${catalog_source}]"
  cat <<EOM | ${OC} apply -f -
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: my-sail
  namespace: ${OLM_OPERATORS_NAMESPACE}
spec:
  channel: ${servicemesh_subscription_channel}
  installPlanApproval: Automatic
  name: ${servicemesh_subscription_name}
  source: ${servicemesh_subscription_source}
  sourceNamespace: openshift-marketplace
EOM
}

install_istio() {
  local control_plane_namespace="${1}"
  local istio_version="${2}"
  local istio_yaml_file="${3:-}"

  # Obtained this list of CRDs by "oc get crds -oname | grep istio.io". We can't actually do that here programatically
  # because the CRDs may not even be created yet. That's why there is a while loop in here - to wait for them to be created.
  infomsg "Waiting for CRDs to be established."
  for crd in \
     authorizationpolicies.security.istio.io \
     destinationrules.networking.istio.io \
     envoyfilters.networking.istio.io \
     gateways.networking.istio.io \
     istios.operator.istio.io \
     peerauthentications.security.istio.io \
     proxyconfigs.networking.istio.io \
     requestauthentications.security.istio.io \
     serviceentries.networking.istio.io \
     sidecars.networking.istio.io \
     telemetries.telemetry.istio.io \
     virtualservices.networking.istio.io \
     wasmplugins.extensions.istio.io \
     workloadentries.networking.istio.io \
     workloadgroups.networking.istio.io
  do
    infomsg "Expecting CRD [${crd}] to be established"
    echo -n "Waiting."
    while ! ${OC} get crd ${crd} >& /dev/null ; do echo -n '.'; sleep 1; done
    ${OC} wait --for condition=established crd/${crd}
  done

  infomsg "Expecting Service Mesh operator deployment to be created"
  echo -n "Waiting."
  while ! ${OC} get deployment -n ${OLM_OPERATORS_NAMESPACE} -o name | grep -E 'sail|servicemesh|istio' >& /dev/null ; do echo -n '.'; sleep 1; done
  echo "done."
  local servicemesh_deployment="$(${OC} get deployment -n ${OLM_OPERATORS_NAMESPACE} -o name | grep -E 'sail|servicemesh|istio')"

  infomsg "Waiting for operator deployments to start..."
  for op in ${servicemesh_deployment}
  do
    infomsg "Expecting [${op}] to be ready"
    echo -n "Waiting."
    local readyReplicas="0"
    while [ "$?" != "0" -o "$readyReplicas" == "0" ]
    do
      sleep 1
      echo -n '.'
      readyReplicas="$(${OC} get ${op} -n ${OLM_OPERATORS_NAMESPACE} -o jsonpath='{.status.readyReplicas}' 2> /dev/null)"
    done
    echo "done."
  done

  infomsg "Wait for the servicemesh operator to be Ready."
  ${OC} wait --for condition=Ready $(${OC} get pod -n ${OLM_OPERATORS_NAMESPACE} -o name | grep -E 'sail|servicemesh|istio') --timeout 300s -n ${OLM_OPERATORS_NAMESPACE}
  infomsg "done."

  # TODO: Sail has no webhooks (yet)
  #infomsg "Wait for the servicemesh validating webhook to be created."
  #while [ "$(${OC} get validatingwebhookconfigurations -o name | grep -E 'sail|servicemesh|istio')" == "" ]; do echo -n '.'; sleep 5; done
  #infomsg "done."
  #
  #infomsg "Wait for the servicemesh mutating webhook to be created."
  #while [ "$(${OC} get mutatingwebhookconfigurations -o name | grep -E 'sail|servicemesh|istio')" == "" ]; do echo -n '.'; sleep 5; done
  #infomsg "done."

  if ! ${OC} get namespace ${control_plane_namespace} >& /dev/null; then
    infomsg "Creating control plane namespace: ${control_plane_namespace}"
    ${OC} create namespace ${control_plane_namespace}
  fi

  infomsg "Installing Istio CR"
  if [ "${istio_yaml_file}" == "" ]; then
    istio_yaml_file="/tmp/istio-cr.yaml"
    cat <<EOM > ${istio_yaml_file}
apiVersion: operator.istio.io/v1alpha1
kind: Istio
metadata:
  name: istio-${control_plane_namespace}
spec:
  version: ${istio_version}
  namespace: ${control_plane_namespace}
  updateStrategy:
    type: RevisionBased
  values:
    cni:
      chained: false
      cniBinDir: /var/lib/cni/bin
      cniConfDir: /etc/cni/multus/net.d
      cniConfFileName: istio-cni.conf
      excludeNamespaces:
      - istio-system
      - kube-system
      logLevel: info
      privileged: true
      provider: multus
    global:
      platform: openshift
    istio_cni:
      chained: false
      enabled: true
    meshConfig:
      defaultConfig:
        tracing:
          zipkin:
            address: "tempo-tempo-distributor.${TEMPO_NAMESPACE}:9411"
EOM
  fi

  while ! ${OC} apply -f ${istio_yaml_file}
  do
    errormsg "WARNING: Failed to apply [${istio_yaml_file}] to namespace [${control_plane_namespace}] - will retry in 5 seconds to see if the error condition clears up..."
    sleep 5
  done
  infomsg "[${istio_yaml_file}] has been successfully applied to namespace [${control_plane_namespace}]."
}

delete_servicemesh_operators() {
  local abort_operation="false"
  for cr in \
    $(${OC} get istio --all-namespaces -o custom-columns=K:.kind,NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g' )
  do
    abort_operation="true"
    local res_kind=$(echo ${cr} | cut -d: -f1)
    local res_namespace=$(echo ${cr} | cut -d: -f2)
    local res_name=$(echo ${cr} | cut -d: -f3)
    errormsg "A [${res_kind}] resource named [${res_name}] in namespace [${res_namespace}] still exists. You must delete it first."
  done
  if [ "${abort_operation}" == "true" ]; then
    errormsg "Aborting"
    exit 1
  fi

  infomsg "Unsubscribing from the Sail operator"
  ${OC} delete subscription --ignore-not-found=true --namespace ${OLM_OPERATORS_NAMESPACE} my-sail

  infomsg "Deleting OLM CSVs which uninstalls the operators and their related resources"
  for csv in $(${OC} get csv --all-namespaces --no-headers -o custom-columns=NS:.metadata.namespace,N:.metadata.name | sed 's/  */:/g' | grep -E 'sail|servicemesh|istio')
  do
    ${OC} delete csv -n $(echo -n $csv | cut -d: -f1) $(echo -n $csv | cut -d: -f2)
  done

  # TODO: Sail operator doesn't leave any cluster-scoped resources behind (yet)
  #infomsg "Deleting any cluster-scoped resources that are getting left behind"
  #for r in \
  #  $(${OC} get clusterroles -o name | grep -E 'istio')
  #do
  #  ${OC} delete ${r}
  #done

  infomsg "Delete any resources that are getting left behind"
  for r in \
    $(${OC} get secrets -n ${OLM_OPERATORS_NAMESPACE} cacerts --no-headers -o custom-columns=K:kind,NS:.metadata.namespace,N:.metadata.name | sed 's/  */:/g') \
    $(${OC} get configmaps --all-namespaces --no-headers -o custom-columns=K:kind,NS:.metadata.namespace,N:.metadata.name | sed 's/  */:/g' | grep -E 'sail|servicemesh|istio')
  do
    local res_kind=$(echo ${r} | cut -d: -f1)
    local res_namespace=$(echo ${r} | cut -d: -f2)
    local res_name=$(echo ${r} | cut -d: -f3)
    infomsg "Deleting resource [${res_name}] of kind [${res_kind}] in namespace [${res_namespace}]"
    ${OC} delete ${res_kind} -n ${res_namespace} ${res_name}
  done

  infomsg "Delete the CRDs"
  ${OC} get crds -o name | grep '.*\.istio\.io' | xargs -r -n 1 ${OC} delete
}

delete_istio() {
  infomsg "Deleting all Istio CRs (if they exist) which uninstalls all the Service Mesh components"
  local doomed_namespaces=""
  for cr in \
    $(${OC} get istio -o custom-columns=K:.kind,NS:.spec.namespace,N:.metadata.name --no-headers | sed 's/  */:/g' )
  do
    local res_kind=$(echo ${cr} | cut -d: -f1)
    local res_namespace=$(echo ${cr} | cut -d: -f2)
    local res_name=$(echo ${cr} | cut -d: -f3)
    ${OC} delete ${res_kind} ${res_name}
    doomed_namespaces="$(echo ${res_namespace} ${doomed_namespaces} | tr ' ' '\n' | sort -u)"
  done

  infomsg "Deleting the control plane namespaces"
  for ns in ${doomed_namespaces}
  do
    ${OC} delete namespace ${ns}
  done
}

status_servicemesh_operators() {
  infomsg ""
  infomsg "===== SERVICEMESH OPERATOR SUBSCRIPTION"
  local sub_name="$(${OC} get subscriptions -n ${OLM_OPERATORS_NAMESPACE} -o name my-sail)"
  if [ ! -z "${sub_name}" ]; then
    ${OC} get --namespace ${OLM_OPERATORS_NAMESPACE} ${sub_name}
    infomsg ""
    infomsg "===== SERVICEMESH OPERATOR PODS"
    local all_pods="$(${OC} get pods -n ${OLM_OPERATORS_NAMESPACE} -o name | grep -E 'sail|servicemesh|istio')"
    [ ! -z "${all_pods}" ] && ${OC} get --namespace ${OLM_OPERATORS_NAMESPACE} ${all_pods} || infomsg "There are no pods"
  else
    infomsg "There are no Subscriptions for the Service Mesh Operators"
  fi
}

status_istio() {
  infomsg ""
  infomsg "===== Istio CRs"
  if [ "$(${OC} get istio 2> /dev/null | wc -l)" -gt "0" ] ; then
    infomsg "One or more Istio CRs exist in the cluster"
    ${OC} get istio
    infomsg ""
    for cr in \
      $(${OC} get istio -o custom-columns=NS:.spec.namespace,N:.metadata.name --no-headers | sed 's/  */:/g' )
    do
      local res_namespace=$(echo ${cr} | cut -d: -f1)
      local res_name=$(echo ${cr} | cut -d: -f2)
      infomsg "Istio [${res_name}] control plane namespace [${res_namespace}]:"
      ${OC} get pods -n ${res_namespace}
    done
  else
    infomsg "There are no Istio CRs in the cluster"
  fi
}
