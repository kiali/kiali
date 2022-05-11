#!/usr/bin/env bash

set -euo pipefail

CONSOLE_IMAGE=${CONSOLE_IMAGE:="quay.io/openshift/origin-console:latest"}
CONSOLE_PORT=${CONSOLE_PORT:=9000}

echo "Starting local OpenShift console..."

BRIDGE_USER_AUTH="disabled"
BRIDGE_K8S_MODE="off-cluster"
BRIDGE_K8S_AUTH="bearer-token"
BRIDGE_K8S_MODE_OFF_CLUSTER_SKIP_VERIFY_TLS=true
BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT=$(oc whoami --show-server)
# Using CRC for development, so Thanos and AlertManager may require a lot of resources, disable them by default
# BRIDGE_K8S_MODE_OFF_CLUSTER_THANOS=$(oc -n openshift-config-managed get configmap monitoring-shared-config -o jsonpath='{.data.thanosPublicURL}')
# BRIDGE_K8S_MODE_OFF_CLUSTER_ALERTMANAGER=$(oc -n openshift-config-managed get configmap monitoring-shared-config -o jsonpath='{.data.alertmanagerPublicURL}')
BRIDGE_K8S_AUTH_BEARER_TOKEN=$(oc whoami --show-token 2>/dev/null)
BRIDGE_USER_SETTINGS_LOCATION="localstorage"

BRIDGE_PLUGINS="${npm_package_consolePlugin_name}=http://host.docker.internal:9001"

echo "API Server: $BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT"
echo "Console Image: $CONSOLE_IMAGE"
echo "Console URL: http://localhost:${CONSOLE_PORT}"

if [ -x "$(command -v podman)" ]; then
    echo "Using Podman"
    BRIDGE_PLUGINS="${npm_package_consolePlugin_name}=http://host.containers.internal:9001"
    podman run --add-host=host.containers.internal:172.17.0.1 --rm -p "$CONSOLE_PORT":9000 --env-file <(set | grep BRIDGE) $CONSOLE_IMAGE
else
    echo "Using Docker"
    BRIDGE_PLUGINS="${npm_package_consolePlugin_name}=http://host.docker.internal:9001"
    docker run --rm -p "$CONSOLE_PORT":9000 --env-file <(set | grep BRIDGE) $CONSOLE_IMAGE
fi
