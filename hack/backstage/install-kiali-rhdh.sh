#!/usr/bin/env bash
#
# hack/install-rhdh-kiali.sh - Install RHDH and configure the Kiali plugin on OpenShift
#
# Usage:
#   $(basename "$0") [-h] [-U KIALI_URL] [-F FRONTEND_TAG] [-B BACKEND_TAG] [-H BASE_URL]
#
# Options:
#   -h                Show this help message and exit
#   -U KIALI_URL      Kiali URL to configure in app-config       (default: https://kiali-istio-system.apps-crc.testing/)
#   -F FRONTEND_TAG   Kiali plugin image tag (frontend)          (default: pr_1368__1.40.0)
#   -B BACKEND_TAG    Kiali plugin image tag (backend)           (default: pr_1368__1.23.0)
#   -H BASE_URL       Backstage baseUrl                          (default: https://backstage-developer-hub-rhdh.apps-crc.testing)
#
# Example:
#   $(basename "$0") -U https://kiali-istio-system.apps-crc.testing/
#
set -euo pipefail

show_help() { sed -n '1,999p' "$0" | sed -n '1,30p'; }

# Defaults
OP_NS="openshift-operators"
APP_NS="rhdh"
CHANNEL="fast"
SOURCE="redhat-operators"
KIALI_URL="https://kiali-istio-system.apps-crc.testing/"
FRONTEND_TAG="pr_1368__1.40.0"
BACKEND_TAG="pr_1368__1.23.0"
BASE_URL="https://backstage-developer-hub-rhdh.apps-crc.testing"

while getopts ":hU:F:B:H:" opt; do
  case ${opt} in
    h) show_help; exit 0 ;;
    U) KIALI_URL="$OPTARG" ;;
    F) FRONTEND_TAG="$OPTARG" ;;
    B) BACKEND_TAG="$OPTARG" ;;
    H) BASE_URL="$OPTARG" ;;
    \?) echo "Error: Invalid option -$OPTARG" >&2; show_help; exit 1 ;;
    :)  echo "Error: Option -$OPTARG requires an argument." >&2; show_help; exit 1 ;;
  esac
done

log() { echo -e "👉 \e[1m$*\e[0m"; }
ok()  { echo -e "✅ $*"; }

# Preflight checks
command -v oc >/dev/null 2>&1 || { echo "oc CLI not found in PATH"; exit 1; }
oc whoami >/dev/null 2>&1 || { echo "No active oc session (oc login required)"; exit 1; }

log "Operator NS: ${OP_NS} | App NS: ${APP_NS}"
log "Channel: ${CHANNEL} | Source: ${SOURCE}"
log "Kiali URL: ${KIALI_URL}"
log "Plugin tags -> frontend: ${FRONTEND_TAG} | backend: ${BACKEND_TAG}"
log "Backstage BASE_URL: ${BASE_URL}"

# 0) Namespaces
log "Ensuring namespaces exist..."
oc get ns "${OP_NS}" >/dev/null 2>&1 || oc new-project "${OP_NS}" >/dev/null
oc get ns "${APP_NS}" >/dev/null 2>&1 || oc new-project "${APP_NS}" >/dev/null
ok "Namespaces ready"

# 1) RHDH Operator Subscription
log "Creating/updating RHDH Subscription in ${OP_NS}..."
cat <<EOF | oc apply -f -
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: rhdh
  namespace: ${OP_NS}
spec:
  channel: ${CHANNEL}
  installPlanApproval: Automatic
  name: rhdh
  source: ${SOURCE}
  sourceNamespace: openshift-marketplace
EOF
ok "Subscription applied"

# 2) app-config ConfigMap
log "Creating app-config ConfigMap in ${APP_NS}..."
cat <<EOF | oc apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: ${APP_NS}
data:
  app-config.yaml: |-
    app:
      title: Red Hat Developer Hub
      baseUrl: ${BASE_URL}
    backend:
      baseUrl: ${BASE_URL}
      cors:
        origin: ${BASE_URL}
    auth:
      environment: development
      providers:
        guest:
          dangerouslyAllowOutsideDevelopment: true
    catalog:
      locations:
        - type: url
          target: https://github.com/backstage/community-plugins/blob/main/workspaces/kiali/examples/kialiEntities.yaml
    kiali:
      providers:
        - name: default
          url: ${KIALI_URL}
          skipTLSVerify: true
EOF
ok "app-config ConfigMap ready"

# 3) dynamic-plugins ConfigMap
log "Creating dynamic-plugins ConfigMap in ${APP_NS}..."
cat <<EOF | oc apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: dynamic-plugins
  namespace: ${APP_NS}
data:
  dynamic-plugins.yaml: |
    includes:
      - dynamic-plugins.default.yaml
    plugins:
    - package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-kiali:${FRONTEND_TAG}!backstage-community-plugin-kiali
      disabled: false
      pluginConfig:
        mountPoints:
          - mountPoint: entity.page.kiali
            importName: EntityKialiContent
          - mountPoint: entity.page/overview/cards
            importName: EntityKialiGraphCard
            config:
              layouts:
                lg: 'span 4'
                md: 'span 6'
                xs: 'span 12'
        dynamicPlugins:
          frontend:
            backstage-community.plugin-kiali:
              appIcons:
                - importName: KialiIcon
                  name: kialiIcon
              dynamicRoutes:
                - importName: KialiPage
                  menuItem:
                    icon: kialiIcon
                    text: Kiali
                  path: /kiali
    - package: oci://ghcr.io/redhat-developer/rhdh-plugin-export-overlays/backstage-community-plugin-kiali-backend:${BACKEND_TAG}!backstage-community-plugin-kiali-backend
      disabled: false
EOF
ok "dynamic-plugins ConfigMap ready"

# 4) Backstage CR
log "Creating Backstage CR in ${APP_NS}..."
cat <<EOF | oc apply -f -
apiVersion: rhdh.redhat.com/v1alpha3
kind: Backstage
metadata:
  name: developer-hub
  namespace: ${APP_NS}
spec:
  application:
    appConfig:
      configMaps:
        - name: app-config
      mountPath: /opt/app-root/src
    dynamicPluginsConfigMapName: dynamic-plugins
    extraEnvs:
      envs:
        - name: NODE_TLS_REJECT_UNAUTHORIZED
          value: '0'
    extraFiles:
      mountPath: /opt/app-root/src
    replicas: 1
    route:
      enabled: true
  database:
    enableLocalDb: true
EOF
ok "Backstage CR applied"

echo
ok "Done."
