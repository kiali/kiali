#!/bin/bash

##############################################################################
# install-istio-ambient
#
# Installs istio ambient and environment to be tested
# Requirements:
# - Istio ambient must be downloaded
#   https://gcsweb.istio.io/gcs/istio-build/dev/0.0.0-ambient.191fe680b52c1754ee72a06b3e0d3f9d116f2e82
# - kind installed
#
# Creates a kind cluster
# Creates metallb loadbalancer
#
# Installs Istio into the cluster
#
# Installs addons and kiali
# Installs bookinfo application
#
# Generates test traffic
#
# See --help for more details on options to this script.
#
##############################################################################

ADDONS="prometheus grafana jaeger kiali"
CLIENT_EXE="kubectl"
ISTIOCTL="$HOME/Downloads/istio-ambient/bin/istioctl"
ISTIO_DIR="$HOME/Downloads/istio-ambient"
NAMESPACE="istio-system"
TRAFFIC="false"
WAYPOINT="false"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -cn|--cluster-name)
      CLUSTER_NAME="$2"
      shift;shift
      ;;
    -di|--delete-istio)
      if [ "${2}" == "true" ] || [ "${2}" == "false" ]; then
        DELETE_ISTIO="$2"
      else
        echo "ERROR: The --delete-istio flag must be 'true' or 'false'"
        exit 1
      fi
      shift;shift
      ;;
    -ic|--istioctl)
      ISTIOCTL="$2"
      shift;shift
      ;;
    -id|--istiodir)
      ISTIO_DIR="$2"
      shift;shift
      ;;
    -n|--namespace)
      NAMESPACE="$2"
      shift;shift
      ;;
    -t|--traffic)
      TRAFFIC="$2"
      shift;shift
      ;;
    -w|--waypoint)
      WAYPOINT="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Installs istio ambient and environment to be tested
Requirements:
 - Istio ambient must be downloaded
   https://gcsweb.istio.io/gcs/istio-build/dev/0.0.0-ambient.191fe680b52c1754ee72a06b3e0d3f9d116f2e82
 - kind installed
Valid command line arguments:
  -cn|--cluster-name <cluster name>:
       Installs istio as part of cluster with the given name.
       Default: unset (use Istio default of "Kubernetes")
  -di|--delete-istio (true|false):
       Set to 'true' if you want to delete Istio, rather than install it.
       By default, it will remove all Istio resources, including cluster-scoped resources.
       If you want to keep Istio control planes in other namespaces, set --purge-uninstall to 'false'.
       Default: false
  -ic|--istioctl <path to istioctl binary>:
       Where the istioctl executable is found. Use this when developing Istio installer and testing it.
       Default: $ISTIOCTL
  -id|--istiodir <path to istiodir directory>:
       Where the istioctl executable is found. Use this when developing Istio installer and testing it.
       Default: $ISTIO_DIR
  -n|--namespace <name>:
       Install Istio in this namespace.
       Default: istio-system
  -t|--traffic (true|false)
       Generate traffic
       Default: false
  -w|--waypoint (true|false)
       Install waypoint proxy to get L7 features
       Default: false
  -h|--help:
       this message
HELPMSG
      exit 1
      ;;
    *)
      echo "ERROR: Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

create_cluster() {
  echo "Creating Kind Cluster"
  cat <<EOF | kind create cluster --config -
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: ambient
nodes:
  - role: control-plane
  - role: worker
  - role: worker
EOF

  ${CLIENT_EXE} config use-context kind-ambient
}

install_ambient() {
  echo "Install Istio with ambient profile"
  ${ISTIOCTL} install --set profile=ambient ${INSTALL_OPTIONS}
}

install_addons() {
  echo "Install addons"
  echo "Installing Addons: [${ADDONS}]"
  for addon in ${ADDONS}; do
    echo "Installing addon: [${addon}]"
    echo "${CLIENT_EXE} apply -f ${ISTIO_DIR}/samples/addons/${addon}.yaml"
    while ! (${CLIENT_EXE} apply -f ${ISTIO_DIR}/samples/addons/${addon}.yaml)
    do
      echo "Failed to install addon [${addon}] - will retry in 10 seconds..."
      sleep 10
    done
  done
}

install_metallb() {
  printf "\nInstall load balancer \n"
  ${CLIENT_EXE} apply -f https://raw.githubusercontent.com/metallb/metallb/v0.13.5/config/manifests/metallb-native.yaml
  subnet=$(docker network inspect -f '{{.IPAM.Config}}' kind)
  subnet_trimmed=($(echo ${subnet} | grep -oE '((1?[0-9][0-9]?|2[0-4][0-9]|25[0-5])\.){3}(1?[0-9][0-9]?|2[0-4][0-9]|25[0-5])'))
  first_ip="${subnet_trimmed[0]}"
  last_ip="${subnet_trimmed[1]}"

  cat <<LBCONFIGMAP | ${CLIENT_EXE} apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  namespace: metallb-system
  name: config
data:
  config: |
    address-pools:
    - name: default
      protocol: layer2
      addresses: ['${first_ip}-${last_ip}']
LBCONFIGMAP
}

install_bookinfo() {
  printf "\nInstalling Bookinfo demo\n"
  ${CLIENT_EXE} apply -f ${ISTIO_DIR}/samples/bookinfo/platform/kube/bookinfo.yaml
  ${CLIENT_EXE} apply -f https://raw.githubusercontent.com/linsun/sample-apps/main/sleep/sleep.yaml
  ${CLIENT_EXE} apply -f https://raw.githubusercontent.com/linsun/sample-apps/main/sleep/notsleep.yaml

  printf "\nApply gateway and label dataplane mode\n"
  ${CLIENT_EXE} apply -f ${ISTIO_DIR}/samples/bookinfo/networking/bookinfo-gateway.yaml
  ${CLIENT_EXE} label namespace default istio.io/dataplane-mode=ambient
}

send_traffic() {
  printf "\nSending some test traffic\n"
  ${CLIENT_EXE} exec deploy/sleep -- curl -s http://istio-ingressgateway.istio-system/productpage | head -n1
  ${CLIENT_EXE} exec deploy/sleep -- curl -s http://productpage:9080/ | head -n1
  ${CLIENT_EXE} exec deploy/notsleep -- curl -s http://productpage:9080/ | head -n1
}

install_waypoint() {
  # GW API
  ${CLIENT_EXE} apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v0.5.1/standard-install.yaml

  # Increase fs.inotify max values
  docker exec ambient-worker sysctl "fs.inotify.max_user_instances=1024"
  docker exec ambient-worker2 sysctl "fs.inotify.max_user_instances=1024"

  # Create waypoint proxy for the productpage service
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1alpha2
kind: Gateway
metadata:
 name: productpage
 annotations:
   istio.io/service-account: bookinfo-productpage
spec:
 gatewayClassName: istio-mesh
 listeners:
 - name: default
   port: 80
   protocol: HTTP
   allowedRoutes:
     namespaces:
       from: All
EOF

}

if [ ! -f "${ISTIOCTL}" ]; then
   echo "ERROR: istioctl cannot be found at: ${ISTIOCTL}"
   exit 1
fi

echo "istioctl is found here: ${ISTIOCTL}"

INSTALL_OPTIONS=" \
    --set components.egressGateways[0].name=istio-egressgateway \
    --set components.egressGateways[0].enabled=true"

# Delete Istio and Cluster
if [ "${DELETE_ISTIO}" == "true" ]; then
  echo DELETING ISTIO!

  echo Deleting Addons
  for addon in $(ls -1 ${ISTIO_DIR}/samples/addons/*.yaml); do
    echo "Deleting addon [${addon}]"
    cat ${addon} | sed "s/istio-system/${NAMESPACE}/g" | ${CLIENT_EXE} delete --ignore-not-found=true -n ${NAMESPACE} -f -
  done

  echo Deleting Core Istio
  ${ISTIOCTL} manifest generate | ${CLIENT_EXE} delete -f -

  echo "Deleting the istio namespace [${NAMESPACE}]"
  ${CLIENT_EXE} delete namespace ${NAMESPACE}

  echo "Delete cluster"
  kind delete cluster --name ambient
else
  if [ "${WAYPOINT}" == "true" ]; then
    ${CLIENT_EXE} config use-context kind-ambient
    install_waypoint
  else
    if [ "${TRAFFIC}" == "true" ]; then
      send_traffic
    else
      echo Installing Istio...
      create_cluster

      install_ambient

      install_addons

      install_metallb

      install_bookinfo

      send_traffic

      printf "\nPort forward to Kiali access:\n"
      printf "\n  kubectl port-forward svc/kiali 20001:20001 -n istio-system\n"
    fi
  fi
fi