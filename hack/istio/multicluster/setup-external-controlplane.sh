#!/bin/bash
SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
source ${SCRIPT_DIR}/env.sh $*

set -e

CTX_EXTERNAL_CLUSTER="kind-controlplane"
CTX_REMOTE_CLUSTER="kind-dataplane"
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

if ! kind get clusters -q | grep -q "${EXTERNAL_CLUSTER_NAME}" ; then
    ./hack/start-kind.sh --load-balancer-range 255.70-255.84 -n "${EXTERNAL_CLUSTER_NAME}" -eir true -i "kindest/node:v1.27.3@sha256:3966ac761ae0136263ffdb6cfd4db23ef8a83cba8a463690e98317add2c9ba72"
fi
if ! kind get clusters -q | grep -q "${REMOTE_CLUSTER_NAME}" ; then
    ./hack/start-kind.sh --load-balancer-range 255.85-255.98 -n "${REMOTE_CLUSTER_NAME}" -eir true -i "kindest/node:v1.27.3@sha256:3966ac761ae0136263ffdb6cfd4db23ef8a83cba8a463690e98317add2c9ba72"
fi

# Following: https://istio.io/latest/docs/setup/install/external-controlplane/
# Create the Istio install configuration for the ingress gateway that will expose the external control plane ports to other clusters:

MANIFEST_DIR=$(mktemp -d)

"${ISTIOCTL}" install -f - -y --context="${CTX_EXTERNAL_CLUSTER}" <<EOF
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  namespace: istio-system
spec:
  components:
    ingressGateways:
      - name: istio-ingressgateway
        enabled: true
        k8s:
          service:
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
export SSL_SECRET_NAME=NONE

cat <<EOF > ${MANIFEST_DIR}/remote-config-cluster.yaml
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  namespace: external-istiod
spec:
  profile: remote
  values:
    global:
      istioNamespace: external-istiod
      configCluster: true
    pilot:
      configMap: true
    istiodRemote:
      injectionURL: https://${EXTERNAL_ISTIOD_ADDR}:15017/inject/cluster/${REMOTE_CLUSTER_NAME}/net/network1
    base:
      validationURL: https://${EXTERNAL_ISTIOD_ADDR}:15017/validate
EOF

sed  -i'.bk' \
  -e "s|injectionURL: https://${EXTERNAL_ISTIOD_ADDR}:15017|injectionPath: |" \
  -e "/istioNamespace:/a\\
      remotePilotAddress: ${EXTERNAL_ISTIOD_ADDR}" \
  -e '/base:/,+1d' \
  ${MANIFEST_DIR}/remote-config-cluster.yaml; rm ${MANIFEST_DIR}/remote-config-cluster.yaml.bk

kubectl get ns external-istiod --context="${CTX_REMOTE_CLUSTER}" || kubectl create namespace external-istiod --context="${CTX_REMOTE_CLUSTER}"
"${ISTIOCTL}" manifest generate -f ${MANIFEST_DIR}/remote-config-cluster.yaml --set values.defaultRevision=default | kubectl apply --context="${CTX_REMOTE_CLUSTER}" -f -

# Set up the control plane in the external cluster: https://istio.io/latest/docs/setup/install/external-controlplane/#set-up-the-control-plane-in-the-external-cluster

kubectl get ns external-istiod --context="${CTX_EXTERNAL_CLUSTER}" || kubectl create namespace external-istiod --context="${CTX_EXTERNAL_CLUSTER}"

KIND_IP=$(docker inspect ${REMOTE_CLUSTER_NAME}-control-plane --format "{{ .NetworkSettings.Networks.kind.IPAddress }}")
REMOTE_KUBE_API_SERVER_URL="https://${KIND_IP}:6443"
kubectl get sa istiod-service-account -n external-istiod --context="${CTX_EXTERNAL_CLUSTER}" || kubectl create sa istiod-service-account -n external-istiod --context="${CTX_EXTERNAL_CLUSTER}"
"${ISTIOCTL}" create-remote-secret \
  --context="${CTX_REMOTE_CLUSTER}" \
  --type=config \
  --namespace=external-istiod \
  --service-account=istiod \
  --server="${REMOTE_KUBE_API_SERVER_URL}" \
  --create-service-account=false | \
  kubectl apply -f - --context="${CTX_EXTERNAL_CLUSTER}"

cat <<EOF > ${MANIFEST_DIR}/external-istiod.yaml
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  namespace: external-istiod
spec:
  profile: empty
  meshConfig:
    rootNamespace: external-istiod
    defaultConfig:
      discoveryAddress: $EXTERNAL_ISTIOD_ADDR:15012
      proxyMetadata:
        XDS_ROOT_CA: /etc/ssl/certs/ca-certificates.crt
        CA_ROOT_CA: /etc/ssl/certs/ca-certificates.crt
  components:
    pilot:
      enabled: true
      k8s:
        overlays:
        - kind: Deployment
          name: istiod
          patches:
          - path: spec.template.spec.volumes[100]
            value: |-
              name: config-volume
              configMap:
                name: istio
          - path: spec.template.spec.volumes[100]
            value: |-
              name: inject-volume
              configMap:
                name: istio-sidecar-injector
          - path: spec.template.spec.containers[0].volumeMounts[100]
            value: |-
              name: config-volume
              mountPath: /etc/istio/config
          - path: spec.template.spec.containers[0].volumeMounts[100]
            value: |-
              name: inject-volume
              mountPath: /var/lib/istio/inject
        env:
        - name: INJECTION_WEBHOOK_CONFIG_NAME
          value: ""
        - name: VALIDATION_WEBHOOK_CONFIG_NAME
          value: ""
        - name: EXTERNAL_ISTIOD
          value: "true"
        - name: LOCAL_CLUSTER_SECRET_WATCHER
          value: "true"
        - name: CLUSTER_ID
          value: ${REMOTE_CLUSTER_NAME}
        - name: SHARED_MESH_CONFIG
          value: istio
  values:
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

sed  -i'.bk' \
  -e '/proxyMetadata:/,+2d' \
  -e '/INJECTION_WEBHOOK_CONFIG_NAME/{n;s/value: ""/value: istio-sidecar-injector-external-istiod/;}' \
  -e '/VALIDATION_WEBHOOK_CONFIG_NAME/{n;s/value: ""/value: istio-validator-external-istiod/;}' \
  ${MANIFEST_DIR}/external-istiod.yaml ; rm ${MANIFEST_DIR}/external-istiod.yaml.bk

"${ISTIOCTL}" install -y -f ${MANIFEST_DIR}/external-istiod.yaml --context="${CTX_EXTERNAL_CLUSTER}"

INGRESS_IP=$(kubectl get service istio-ingressgateway --context="${CTX_EXTERNAL_CLUSTER}" -n istio-system -o=jsonpath='{.status.loadBalancer.ingress[0].ip}')

cat <<EOF > ${MANIFEST_DIR}/external-istiod-gw.yaml
apiVersion: networking.istio.io/v1beta1
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
        protocol: https
        name: https-XDS
      tls:
        mode: SIMPLE
        credentialName: $SSL_SECRET_NAME
      hosts:
      - $EXTERNAL_ISTIOD_ADDR
    - port:
        number: 15017
        protocol: https
        name: https-WEBHOOK
      tls:
        mode: SIMPLE
        credentialName: $SSL_SECRET_NAME
      hosts:
      - $EXTERNAL_ISTIOD_ADDR
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
   name: external-istiod-vs
   namespace: external-istiod
spec:
    hosts:
    - $EXTERNAL_ISTIOD_ADDR
    gateways:
    - external-istiod-gw
    http:
    - match:
      - port: 15012
      route:
      - destination:
          host: istiod.external-istiod.svc.cluster.local
          port:
            number: 15012
    - match:
      - port: 15017
      route:
      - destination:
          host: istiod.external-istiod.svc.cluster.local
          port:
            number: 443
---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: external-istiod-dr
  namespace: external-istiod
spec:
  host: istiod.external-istiod.svc.cluster.local
  trafficPolicy:
    portLevelSettings:
    - port:
        number: 15012
      tls:
        mode: SIMPLE
      connectionPool:
        http:
          h2UpgradePolicy: UPGRADE
    - port:
        number: 443
      tls:
        mode: SIMPLE
EOF

sed  -i'.bk' \
  -e '55,$d' \
  -e 's/mode: SIMPLE/mode: PASSTHROUGH/' -e '/credentialName:/d' -e "s/${EXTERNAL_ISTIOD_ADDR}/\"*\"/" \
  -e 's/http:/tls:/' -e 's/https/tls/' -e '/route:/i\
        sniHosts:\
        - "*"' \
  ${MANIFEST_DIR}/external-istiod-gw.yaml; rm ${MANIFEST_DIR}/external-istiod-gw.yaml.bk

kubectl apply -f ${MANIFEST_DIR}/external-istiod-gw.yaml --context="${CTX_EXTERNAL_CLUSTER}"

# Install prometheus on both clusters.
cat ${ISTIO_DIR}/samples/addons/prometheus.yaml | ${CLIENT_EXE} apply --context "${CTX_EXTERNAL_CLUSTER}" -n "istio-system" -f -
cat ${ISTIO_DIR}/samples/addons/prometheus.yaml | sed "s/istio-system/external-istiod/g" | ${CLIENT_EXE} apply --context "${CTX_REMOTE_CLUSTER}" -n external-istiod -f -

# There's no istio on the remote cluster so install gateway CRDs. 
kubectl get crd gateways.gateway.networking.k8s.io --context="${CTX_REMOTE_CLUSTER}" &> /dev/null || \
  { kubectl kustomize "github.com/kubernetes-sigs/gateway-api/config/crd?ref=v1.0.0" | kubectl apply -f - --context="${CTX_REMOTE_CLUSTER}"; }

# Configure Prometheus federation
# Open up remote prom for scraping by the centralized prom.
${CLIENT_EXE} patch svc prometheus -n external-istiod --context ${CTX_REMOTE_CLUSTER} -p "{\"spec\": {\"type\": \"LoadBalancer\"}}"
kubectl wait --context ${CTX_REMOTE_CLUSTER} --for=jsonpath='{.status.loadBalancer.ingress}' -n external-istiod service/prometheus

WEST_PROMETHEUS_ADDRESS=$(${CLIENT_EXE} --context=${CTX_REMOTE_CLUSTER} -n external-istiod get svc prometheus -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
cat ${SCRIPT_DIR}/prometheus.yaml | sed -e "s/WEST_PROMETHEUS_ADDRESS/${WEST_PROMETHEUS_ADDRESS}/g" -e "s/CLUSTER_NAME/${REMOTE_CLUSTER_NAME}/g" | ${CLIENT_EXE} apply -n istio-system --context ${CTX_EXTERNAL_CLUSTER} -f -
