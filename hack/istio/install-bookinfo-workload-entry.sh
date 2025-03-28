#!/bin/bash

# This script deploys parts of the bookinfo application in podman
# pods running on your local machine. It also deploys the necessary
# Istio configs (WorkloadEntry/ServiceEntry) so that they are included
# as part of the mesh.
#
# The primary purpose of this script is to enable local testing of
# WorkloadEntry features without relying on third party clouds.
# The podman pods mimic VMs running in a cloud and they run on the
# same network as minikube.
#
# This script requires:
# - podman
# - minikube installed with podman driver
# - Istio bookinfo application
#
# Note: if you are running minikube with the podman driver on Fedora
# and are getting errors on 'minikube install', try passing
# --feature-gates="LocalStorageCapacityIsolation=false". See:
# https://github.com/kubernetes/minikube/issues/7923#issuecomment-737058797
# for more details.

set -e

DATA_DIR="$(mktemp -d)"
TEMPLATE_DIR="$(dirname "$0")/workloadentry"
EXTERNAL_IP=""

if [ "$(ps -ef | grep "minikube tunnel" | grep -v grep)" == "" ]; then
    echo "Starting minikube tunnel"
    minikube tunnel > /dev/null 2>&1 &
fi

function create_ingress_and_wait_till_ready {
    kubectl apply -f ${TEMPLATE_DIR}/istiod-ingress.yaml

    # Ripped from: https://stackoverflow.com/a/49989421
    # Obligatory link to license: https://creativecommons.org/licenses/by-sa/3.0/
    # Variable names modified.
    while [ -z $EXTERNAL_IP ]; do
    echo "Waiting for end point..."
    EXTERNAL_IP=$(kubectl get svc istiod-ingress -n istio-system --template="{{range .status.loadBalancer.ingress}}{{.ip}}{{end}}")
    [ -z "$EXTERNAL_IP" ] && sleep 10
    done
    echo 'End point ready:' && echo $EXTERNAL_IP
}

# Starts the istio init container and proxy within the pod.
function inject_sidecar {
    local POD_NAME=$1
    local WORKLOAD_NAME=$2
    echo "Injecting Istio Sidecar for workload: ${WORKLOAD_NAME}"

    sudo podman run --name ${WORKLOAD_NAME}-istio-init \
        --pod "${POD_NAME}" -d \
        --cap-add NET_ADMIN \
        --cap-add NET_RAW \
        --volume ${DATA_DIR}/root-cert.pem:/var/run/secrets/istio/root-cert.pem:Z \
        --volume ${DATA_DIR}/mesh.yaml:/etc/istio/config/mesh:Z \
        --volume ${DATA_DIR}/istio-token:/var/run/secrets/tokens/istio-token:Z \
        --add-host istiod.istio-system.svc:$EXTERNAL_IP \
        gcr.io/istio-release/proxyv2:1.9.5 istio-iptables -p "15001" -z "15006" -u "1337" -m REDIRECT -i '*' -x "" -b '*' -d 15090,15021,15020
    sudo podman wait ${WORKLOAD_NAME}-istio-init
    
    # 1337 is the istio-proxy uid/gid. The container needs to run as this user in part
    # because traffic from this user is excluded from the iptables rules set by the init container.
    # istio needs to write to /etc/istio/proxy so it's mounted in as tmpfs otherwise container fails with permission issues
    sudo podman run --name ${WORKLOAD_NAME}-istio \
        --user 1337:1337 \
        --pod "${POD_NAME}" -d \
        --mount=type=tmpfs,tmpfs-size=32M,destination=/etc/istio/proxy \
        --volume ${DATA_DIR}/root-cert.pem:/var/run/secrets/istio/root-cert.pem:Z \
        --volume ${DATA_DIR}/mesh.yaml:/etc/istio/config/mesh:Z \
        --volume ${DATA_DIR}/istio-token:/var/run/secrets/tokens/istio-token:Z \
        --add-host istiod.istio-system.svc:$EXTERNAL_IP \
        gcr.io/istio-release/proxyv2:1.9.5 proxy sidecar \
        --log_output_level all:debug
}

function create_workload_pod {
    local WORKLOAD_NAME=$1
    local POD_NAME=${WORKLOAD_NAME}-pod

    istioctl x workload entry configure -f ${TEMPLATE_DIR}/workloadgroup_template.yaml -o ${DATA_DIR}

    echo "Creating workload pod: ${POD_NAME}..."
    # Running the pod within the same network as minikube makes things simpler.
    sudo podman pod create --replace --net minikube --name "${POD_NAME}" 
    inject_sidecar "${POD_NAME}" "${WORKLOAD_NAME}"
    sudo podman run --name ${WORKLOAD_NAME} \
        -d --rm --pod "${POD_NAME}" \
        quay.io/sail-dev/examples-bookinfo-${WORKLOAD_NAME}:latest
    # Wait for pod to be running to ensure it has been assigned an IP address.
    sudo podman wait "${WORKLOAD_NAME}" --condition "running"
    cat ${TEMPLATE_DIR}/bookinfo-service-entry.yaml | \
        RATINGS_V1_POD_IP="$(sudo podman inspect -f "{{.NetworkSettings.Networks.minikube.IPAddress}}" ${WORKLOAD_NAME}-istio)" \
        envsubst | kubectl apply -f -
}

create_ingress_and_wait_till_ready
create_workload_pod ratings-v1

