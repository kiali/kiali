#!/bin/bash

# This file contains useful functions which are used in other hack scripts in this dirrectory.

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
