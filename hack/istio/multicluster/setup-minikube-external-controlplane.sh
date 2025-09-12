#!/bin/bash
SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

set -e

infomsg() {
  echo "[INFO] ${1}"
}

CTX_EXTERNAL_CLUSTER="controlplane"
CTX_REMOTE_CLUSTER="dataplane"
REMOTE_CLUSTER_NAME="dataplane"
EXTERNAL_CLUSTER_NAME="controlplane"

# Find the hack script to be used to install bookinfo
INSTALL_BOOKINFO_SCRIPT=${SCRIPT_DIR}/../install-bookinfo-demo.sh
if [  -x "${INSTALL_BOOKINFO_SCRIPT}" ]; then
  echo "Bookinfo install script: ${INSTALL_BOOKINFO_SCRIPT}"
else
  echo "Cannot find the Bookinfo install script at: ${INSTALL_BOOKINFO_SCRIPT}"
  exit 1
fi

install_bookinfo() {
  local profile="${1}"
  local traffic_gen_enabled="${2}"
  local traffic_gen_arg=""
  if [ "${traffic_gen_enabled}" == "true" ]; then
    traffic_gen_arg="-tg"
  fi

  "${INSTALL_BOOKINFO_SCRIPT}"             \
    --client-exe "${CLIENT_EXE}"           \
    --istio-dir "${ISTIO_DIR}"             \
    --istio-namespace "${ISTIO_NAMESPACE}" \
    --namespace "${BOOKINFO_NAMESPACE}"    \
    --minikube-profile "${profile}"        \
    ${traffic_gen_arg}

  if [ "$?" != "0" ]; then
    echo "Failed to install bookinfo"
    exit 1
  fi
}

# Use the k8s-minikube.sh script to start minikube clusters with proper networking
K8S_MINIKUBE_SCRIPT="${SCRIPT_DIR}/../../k8s-minikube.sh"

if ! minikube profile list -o json 2>/dev/null | jq -e --arg profile "${EXTERNAL_CLUSTER_NAME}" '.valid[] | select(.Name == $profile)' > /dev/null; then
    infomsg "Creating minikube profile: ${EXTERNAL_CLUSTER_NAME}"
    "${K8S_MINIKUBE_SCRIPT}" --minikube-profile "${EXTERNAL_CLUSTER_NAME}" --load-balancer-addrs "70-84" start
fi

if ! minikube profile list -o json 2>/dev/null | jq -e --arg profile "${REMOTE_CLUSTER_NAME}" '.valid[] | select(.Name == $profile)' > /dev/null; then
    infomsg "Creating minikube profile: ${REMOTE_CLUSTER_NAME}"
    # Create second cluster on the same network as the first - use the network parameter
    "${K8S_MINIKUBE_SCRIPT}" --minikube-profile "${REMOTE_CLUSTER_NAME}" --load-balancer-addrs "85-98" -mf "--network=mk-${EXTERNAL_CLUSTER_NAME}" start
fi

# Set up kubectl contexts - minikube creates contexts with the profile names
# If contexts don't exist, create them; if they do exist, update them to point to the right clusters
EXTERNAL_CLUSTER_SERVER="https://$(minikube ip -p ${EXTERNAL_CLUSTER_NAME}):8443"
REMOTE_CLUSTER_SERVER="https://$(minikube ip -p ${REMOTE_CLUSTER_NAME}):8443"

# Create or update the external cluster context
kubectl config set-cluster ${CTX_EXTERNAL_CLUSTER} --server="${EXTERNAL_CLUSTER_SERVER}" --certificate-authority="${HOME}/.minikube/ca.crt"
kubectl config set-credentials ${CTX_EXTERNAL_CLUSTER} --client-certificate="${HOME}/.minikube/profiles/${EXTERNAL_CLUSTER_NAME}/client.crt" --client-key="${HOME}/.minikube/profiles/${EXTERNAL_CLUSTER_NAME}/client.key"
kubectl config set-context ${CTX_EXTERNAL_CLUSTER} --cluster=${CTX_EXTERNAL_CLUSTER} --user=${CTX_EXTERNAL_CLUSTER}

# Create or update the remote cluster context  
kubectl config set-cluster ${CTX_REMOTE_CLUSTER} --server="${REMOTE_CLUSTER_SERVER}" --certificate-authority="${HOME}/.minikube/ca.crt"
kubectl config set-credentials ${CTX_REMOTE_CLUSTER} --client-certificate="${HOME}/.minikube/profiles/${REMOTE_CLUSTER_NAME}/client.crt" --client-key="${HOME}/.minikube/profiles/${REMOTE_CLUSTER_NAME}/client.key"
kubectl config set-context ${CTX_REMOTE_CLUSTER} --cluster=${CTX_REMOTE_CLUSTER} --user=${CTX_REMOTE_CLUSTER}

# Verify the contexts are working
kubectl config use-context ${CTX_EXTERNAL_CLUSTER}
kubectl cluster-info --context ${CTX_EXTERNAL_CLUSTER} || {
  echo "Error: Cannot connect to external cluster context '${CTX_EXTERNAL_CLUSTER}'"
  exit 1
}

kubectl config use-context ${CTX_REMOTE_CLUSTER}
kubectl cluster-info --context ${CTX_REMOTE_CLUSTER} || {
  echo "Error: Cannot connect to remote cluster context '${CTX_REMOTE_CLUSTER}'"
  exit 1
}

# Following: https://github.com/istio-ecosystem/sail-operator/tree/main/docs#external-control-plane
# Create the Istio install configuration for the ingress gateway that will expose the external control plane ports to other clusters:

EXTERNAL_ISTIO_YAML=$(mktemp)
cat <<EOF > "$EXTERNAL_ISTIO_YAML"
spec:
  values:
    global:
      multiCluster:
        clusterName: "${EXTERNAL_CLUSTER_NAME}"
      network: network1
EOF

switch_cluster "${CTX_EXTERNAL_CLUSTER}"
install_istio --patch-file "${EXTERNAL_ISTIO_YAML}" -a "prometheus"
kubectl wait --context "${CTX_EXTERNAL_CLUSTER}" --for=condition=Ready istios/default --timeout=3m

helm upgrade --install --kube-context "${CTX_EXTERNAL_CLUSTER}" --wait -n istio-system istio-ingressgateway gateway --repo https://istio-release.storage.googleapis.com/charts -f - <<EOF
service:
  type: LoadBalancer
  ports:
    - port: 15021
      targetPort: 15021
      name: status-port
    - port: 15012
      targetPort: 15012
      name: tls-xds
    - port: 15017
      targetPort: 15017
      name: tls-webhook
EOF

kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' -n istio-system service/istio-ingressgateway --context="${CTX_EXTERNAL_CLUSTER}"

export EXTERNAL_ISTIOD_ADDR=$(kubectl -n istio-system --context="${CTX_EXTERNAL_CLUSTER}" get svc istio-ingressgateway -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

REMOTE_ISTIO_YAML=$(mktemp)
cat <<EOF > "$REMOTE_ISTIO_YAML"
metadata:
  name: external-istiod
spec:
  namespace: external-istiod
  profile: remote
  values:
    defaultRevision: external-istiod
    global:
      istioNamespace: external-istiod
      remotePilotAddress: ${EXTERNAL_ISTIOD_ADDR}
      configCluster: true
    pilot:
      configMap: true
    istiodRemote:
      injectionPath: /inject/cluster/${REMOTE_CLUSTER_NAME}/net/network1
EOF

switch_cluster "${CTX_REMOTE_CLUSTER}"
install_istio --patch-file "${REMOTE_ISTIO_YAML}" -a "prometheus" --wait false

# Set up the control plane in the external cluster: https://istio.io/latest/docs/setup/install/external-controlplane/#set-up-the-control-plane-in-the-external-cluster

kubectl get ns external-istiod --context="${CTX_EXTERNAL_CLUSTER}" || kubectl create namespace external-istiod --context="${CTX_EXTERNAL_CLUSTER}"

REMOTE_IP=$(minikube ip -p ${REMOTE_CLUSTER_NAME})
REMOTE_KUBE_API_SERVER_URL="https://${REMOTE_IP}:8443"
[ "$(kubectl get istios external-istiod -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}')" = "True" ] || kubectl --context="${CTX_REMOTE_CLUSTER}" wait --for='jsonpath={.status.conditions[?(@.type=="Ready")].message}="readiness probe on remote istiod failed"' istios/external-istiod --timeout=1m
"${ISTIOCTL}" create-remote-secret \
  --context="${CTX_REMOTE_CLUSTER}" \
  --type=config \
  --namespace=external-istiod \
  --service-account=istiod-external-istiod \
  --server="${REMOTE_KUBE_API_SERVER_URL}" \
  --create-service-account=false | \
  kubectl apply -f - --context="${CTX_EXTERNAL_CLUSTER}"

kubectl apply --context "${CTX_EXTERNAL_CLUSTER}" -f - <<EOF
apiVersion: sailoperator.io/v1
kind: Istio
metadata:
  name: external-istiod
spec:
  namespace: external-istiod
  profile: empty
  values:
    meshConfig:
      rootNamespace: external-istiod
      defaultConfig:
        discoveryAddress: $EXTERNAL_ISTIOD_ADDR:15012
    pilot:
      enabled: true
      volumes:
        - name: config-volume
          configMap:
            name: istio-external-istiod
        - name: inject-volume
          configMap:
            name: istio-sidecar-injector-external-istiod
      volumeMounts:
        - name: config-volume
          mountPath: /etc/istio/config
        - name: inject-volume
          mountPath: /var/lib/istio/inject
      env:
        INJECTION_WEBHOOK_CONFIG_NAME: "istio-sidecar-injector-external-istiod-external-istiod"
        VALIDATION_WEBHOOK_CONFIG_NAME: "istio-validator-external-istiod-external-istiod"
        EXTERNAL_ISTIOD: "true"
        LOCAL_CLUSTER_SECRET_WATCHER: "true"
        CLUSTER_ID: ${REMOTE_CLUSTER_NAME}
        SHARED_MESH_CONFIG: istio
    global:
      caAddress: $EXTERNAL_ISTIOD_ADDR:15012
      istioNamespace: external-istiod
      operatorManageWebhooks: true
      configValidation: false
      meshID: mesh1
      multiCluster:
        clusterName: ${REMOTE_CLUSTER_NAME}
      network: network1
EOF

kubectl apply --context "${CTX_EXTERNAL_CLUSTER}" -f - <<EOF
apiVersion: networking.istio.io/v1
kind: Gateway
metadata:
  name: external-istiod-gw
  namespace: external-istiod
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 15012
        protocol: tls
        name: tls-XDS
      tls:
        mode: PASSTHROUGH
      hosts:
      - "*"
    - port:
        number: 15017
        protocol: tls
        name: tls-WEBHOOK
      tls:
        mode: PASSTHROUGH
      hosts:
      - "*"
---
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: external-istiod-vs
  namespace: external-istiod
spec:
    hosts:
    - "*"
    gateways:
    - external-istiod-gw
    tls:
    - match:
      - port: 15012
        sniHosts:
        - "*"
      route:
      - destination:
          host: istiod-external-istiod.external-istiod.svc.cluster.local
          port:
            number: 15012
    - match:
      - port: 15017
        sniHosts:
        - "*"
      route:
      - destination:
          host: istiod-external-istiod.external-istiod.svc.cluster.local
          port:
            number: 443
EOF

kubectl wait --context="${CTX_REMOTE_CLUSTER}" --for=condition=Ready istios/external-istiod --timeout=3m

# There's no istio on the remote cluster so install gateway CRDs. 
kubectl get crd gateways.gateway.networking.k8s.io --context="${CTX_REMOTE_CLUSTER}" &> /dev/null || \
  { kubectl kustomize "github.com/kubernetes-sigs/gateway-api/config/crd?ref=v1.3.0" | kubectl apply -f - --context="${CTX_REMOTE_CLUSTER}"; }

# Configure Prometheus federation
# Open up remote prom for scraping by the centralized prom.
${CLIENT_EXE} patch svc prometheus -n external-istiod --context ${CTX_REMOTE_CLUSTER} -p "{\"spec\": {\"type\": \"LoadBalancer\"}}"
kubectl wait --context ${CTX_REMOTE_CLUSTER} --for=jsonpath='{.status.loadBalancer.ingress}' -n external-istiod service/prometheus

WEST_PROMETHEUS_ADDRESS=$(${CLIENT_EXE} --context=${CTX_REMOTE_CLUSTER} -n external-istiod get svc prometheus -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
cat ${SCRIPT_DIR}/prometheus.yaml | sed -e "s/WEST_PROMETHEUS_ADDRESS/${WEST_PROMETHEUS_ADDRESS}/g" -e "s/CLUSTER_NAME/${REMOTE_CLUSTER_NAME}/g" | ${CLIENT_EXE} apply -n istio-system --context ${CTX_EXTERNAL_CLUSTER} -f -
