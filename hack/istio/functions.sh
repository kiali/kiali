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

# Returns 0 if the istio version is greater than specified, 0 otherwise.
is_istio_version_eq_greater_than() {
  local expected_version=$1
  local istio_version=$(${ISTIOCTL} version)
  istio_parsed_version=$(echo "$istio_version" | grep "client version" | awk '{print $3}' | cut -d'-' -f1)

  istio_expected_version=$(echo "$expected_version" | cut -d'-' -f1)

  IFS='.' read -r major minor patch <<< "$istio_parsed_version"
  IFS='.' read -r major_expected minor_expected patch_expected <<< "$istio_expected_version"
  IFS=' '
  if [ "${major}" -lt "${major_expected}" ]; then
    return 1
  else
    if [ "${major}" -eq "${major_expected}" ]; then
      if [ "${minor}" -lt "${minor_expected}" ]; then
        return 0
      else
        return 1
      fi
    else
      return 0
    fi
  fi

}
