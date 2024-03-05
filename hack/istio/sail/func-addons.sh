#!/bin/bash

##########################################################
#
# Functions used to install Istio addons that
# Kiali needs to fully function.
#
##########################################################

set -u

# This is the main function that should be used to install an addon.
# Call this function with the name of one of the addons.
# This function accepts the following addon names:
# - prometheus
# - jaeger
# - grafana
# - loki
#
# TODO: in the future we can add support for things like
# prometheus-requiring-credentials, etc.
install_addon() {
  # Make sure we have the SCC
  create_openshift_scc_for_addons

  case "$1" in
    prometheus) install_addon_prometheus ;;
    jaeger)     install_addon_jaeger     ;;
    grafana)    install_addon_grafana    ;;
    loki)       install_addon_loki       ;;
    *)
      echo "Unsupported addon - cannot install [$1]"
      return 1
      ;;
  esac
}

# This is the main function that should be used to remove an addon.
# Call this function with the name of one of the addons.
# This function accepts the following addon names:
# - prometheus
# - jaeger
# - grafana
# - loki
delete_addon() {
  case "$1" in
    prometheus) delete_addon_prometheus ;;
    jaeger)     delete_addon_jaeger     ;;
    grafana)    delete_addon_grafana    ;;
    loki)       delete_addon_loki       ;;
    *)
      echo "Unsupported addon - cannot remove [$1]"
      return 1
      ;;
  esac
}

# Call this if you want to wipe the cluster of all possible addons.
delete_all_addons() {
  echo "Removing all addons..."
  delete_addon_prometheus
  delete_addon_jaeger
  delete_addon_grafana
  delete_addon_loki

  # we no longer need the SCC
  delete_openshift_scc_for_addons
}

# ===
#
# The following should be considered internal functions that
# are not to be called from other scripts. These are to be
# used soley by the install_addon and delete_addon functions.

create_openshift_scc_for_addons() {
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    echo "Creating OpenShift SCC for addons"
    cat <<SCC | ${OC} apply -f -
apiVersion: security.openshift.io/v1
kind: SecurityContextConstraints
metadata:
  name: istio-addons-scc
runAsUser:
  type: RunAsAny
seLinuxContext:
  type: RunAsAny
supplementalGroups:
  type: RunAsAny
fsGroup:
  type: RunAsAny
seccompProfiles:
- '*'
priority: 9
users:
- "system:serviceaccount:${CONTROL_PLANE_NAMESPACE}:default"
- "system:serviceaccount:${CONTROL_PLANE_NAMESPACE}:prometheus"
- "system:serviceaccount:${CONTROL_PLANE_NAMESPACE}:grafana"
- "system:serviceaccount:${CONTROL_PLANE_NAMESPACE}:loki"
SCC
  fi
}

delete_openshift_scc_for_addons() {
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    echo "Deleting OpenShift SCC for addons"
    ${OC} delete --ignore-not-found=true scc istio-addons-scc
  fi
}

install_addon_prometheus() {
  echo "Installing Addon: prometheus"
  local addon_name="prometheus"
  local yaml_file="/tmp/prometheus.yaml"
  download_istio_addon_yaml "${addon_name}" "${yaml_file}"
  apply_istio_addon_yaml "${yaml_file}"
}

delete_addon_prometheus() {
  echo "Removing Addon: prometheus"
  local addon_name="prometheus"
  local yaml_file="/tmp/prometheus.yaml"
  download_istio_addon_yaml "${addon_name}" "${yaml_file}"
  delete_istio_addon_yaml "${yaml_file}"
}

install_addon_jaeger() {
  echo "Installing Addon: jaeger"
  local addon_name="jaeger"
  local yaml_file="/tmp/jaeger.yaml"
  download_istio_addon_yaml "${addon_name}" "${yaml_file}"
  apply_istio_addon_yaml "${yaml_file}"
}

delete_addon_jaeger() {
  echo "Removing Addon: jaeger"
  local addon_name="jaeger"
  local yaml_file="/tmp/jaeger.yaml"
  download_istio_addon_yaml "${addon_name}" "${yaml_file}"
  delete_istio_addon_yaml "${yaml_file}"
}

install_addon_grafana() {
  echo "Installing Addon: grafana"
  local addon_name="grafana"
  local yaml_file="/tmp/grafana.yaml"
  download_istio_addon_yaml "${addon_name}" "${yaml_file}"
  apply_istio_addon_yaml "${yaml_file}"
  ${OC} expose service/grafana --namespace ${CONTROL_PLANE_NAMESPACE}
}

delete_addon_grafana() {
  echo "Removing Addon: grafana"
  local addon_name="grafana"
  local yaml_file="/tmp/grafana.yaml"
  download_istio_addon_yaml "${addon_name}" "${yaml_file}"
  delete_istio_addon_yaml "${yaml_file}"
}

install_addon_loki() {
  echo "Installing Addon: loki"
  local addon_name="loki"
  local yaml_file="/tmp/loki.yaml"
  download_istio_addon_yaml "${addon_name}" "${yaml_file}"
  apply_istio_addon_yaml "${yaml_file}"
}

delete_addon_loki() {
  echo "Removing Addon: loki"
  local addon_name="loki"
  local yaml_file="/tmp/loki.yaml"
  download_istio_addon_yaml "${addon_name}" "${yaml_file}"
  delete_istio_addon_yaml "${yaml_file}"
}

# $1 = name of addon, $2 is the file path where the yaml is to be stored
download_istio_addon_yaml() {
  local addon_url="https://raw.githubusercontent.com/istio/istio/master/samples/addons/$1.yaml"
  echo "Istio addon URL to download: $addon_url"
  while ! curl --silent --output "$2" --location ${addon_url}
  do
    echo "Failed to download Istio addon yaml from [${addon_url}] - will retry in 10 seconds..."
    sleep 10
  done
  echo "Istio addon yaml for [$1] is stored at [$2]"
}

# $1 = file path where the yaml is found
apply_istio_addon_yaml() {
  local yaml_file="$1"
  if ! (cat ${yaml_file} | sed "s/istio-system/${CONTROL_PLANE_NAMESPACE}/g" | ${OC} apply -n ${CONTROL_PLANE_NAMESPACE} -f -); then
    echo "Failed to apply Istio addon [${yaml_file}]"
    return 1
  fi
}

# $1 = file path where the yaml is found
delete_istio_addon_yaml() {
  local yaml_file="$1"
  cat ${yaml_file} | sed "s/istio-system/${CONTROL_PLANE_NAMESPACE}/g" | ${OC} delete --ignore-not-found=true -n ${CONTROL_PLANE_NAMESPACE} -f -
}
