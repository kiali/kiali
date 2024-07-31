#!/bin/bash

# This file contains useful functions which are used in other hack scripts in this dirrectory.


# Given a namepace, prepare it for inclusion in Maistra's control plane
# This means:
# 1. Create a SMM (this is skipped for the cluster wide mode)
# 2. Label the member namespace (only for the cluster wide mode)
# 3. Annotate all of the namespace's Deployments with the sidecar injection annotation if enabled
#! Be sure, that ISTIO_NAMESPACE and (ENABLE_INJECTION or AUTO_INJECTION) are properly set in the script where the function is called!
prepare_maistra() {
  local ns="${1}"
  if $(is_cluster_wide);
  then
    echo "Cluster wide mode detected."
    ${CLIENT_EXE} label namespace ${ns} "istio-injection=enabled" --overwrite
  else
    cat <<EOM | ${CLIENT_EXE} apply -f -
apiVersion: maistra.io/v1
kind: ServiceMeshMember
metadata:
  name: default
  namespace: ${ns}
spec:
  controlPlaneRef:
    namespace: ${ISTIO_NAMESPACE}
    name: "$(${CLIENT_EXE} get smcp -n ${ISTIO_NAMESPACE} -o jsonpath='{.items[0].metadata.name}' )"
EOM
    # let's wait for smmr to be Ready before enabling sidecar injection
    ${CLIENT_EXE} wait --for condition=Ready -n ${ISTIO_NAMESPACE} smmr/default --timeout 300s
  fi

  if [ "${ENABLE_INJECTION}" == "true" ] || [ "${AUTO_INJECTION}" == "true" ]; then
    ${CLIENT_EXE} wait pods -n ${ns} --for condition=Ready --timeout=60s --all
    for d in $(${CLIENT_EXE} get deployments -n ${ns} -o name)
    do
      echo "Enabling sidecar injection for deployment: ${d}"
      ${CLIENT_EXE} patch ${d} -n ${ns} -p '{"spec":{"template":{"metadata":{"annotations":{"sidecar.istio.io/inject": "true"}}}}}' --type=merge
    done
  fi
}


# Returns 0 if a smcp in given namespaces contains .spec.mode=ClusterWide, 1 otherwise.
is_cluster_wide() {
  local mode=$(${CLIENT_EXE} get smcp -n ${ISTIO_NAMESPACE} -o=jsonpath='{.items[0].spec.mode}' 2> /dev/null || true)
  if [ "${mode}" = "ClusterWide" ]
    then
      # 0 = true
      return 0
    else
      # 1 = false
      return 1
  fi
}
