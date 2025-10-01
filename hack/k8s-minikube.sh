#!/bin/bash

##############################################################################
# k8s-minikube.sh
#
# This script can be used to help run Kubernetes via minikube.
# The typical order of commands used is the following:
#   start - starts the Kubernetes cluster via minikube
#   istio - installs Istio using Kiali's install hack script
#   docker - shows what is needed to put images in minikube's image registry
#   podman - shows what is needed to put images in minikube's image registry
#   (at this point, you can install Kiali into your Kubernetes environment)
#   dashboard - shows the Kubernetes GUI console
#   port-forward - forward a local port to the Kiali server
#   ingress - shows the Ingress URL which can get you to the Kiali GUI
#   bookinfo - installs bookinfo demo into your cluster
#   stop - shuts down the Kubernetes cluster, you can start it up again
#   delete - if you don't want your cluster anymore, this deletes it
#
##############################################################################

set -u

DEFAULT_CLIENT_EXE="kubectl"
DEFAULT_HYDRA_ENABLED="false"
DEFAULT_HYDRA_USER_NAMESPACES="bookinfo"
DEFAULT_HYDRA_VERSION="v2.2.0"
DEFAULT_INSECURE_REGISTRY_IP=""
DEFAULT_K8S_CNI="auto"
DEFAULT_K8S_CPU="4"
DEFAULT_K8S_DISK="40g"
DEFAULT_K8S_DRIVER="kvm2"
DEFAULT_K8S_MEMORY="8g"
DEFAULT_K8S_VERSION="stable"
DEFAULT_LB_ADDRESSES="" # example: "'192.168.99.70-192.168.99.84'"
DEFAULT_MINIKUBE_EXE="minikube"
DEFAULT_MINIKUBE_PROFILE="minikube"
DEFAULT_MINIKUBE_START_FLAGS=""
DEFAULT_OLM_ENABLED="false"
DEFAULT_OLM_VERSION="latest"
DEFAULT_OUTPUT_PATH="/tmp/k8s-minikube-tmpdir"

_VERBOSE="false"

debug() {
  if [ "$_VERBOSE" == "true" ]; then
    echo "DEBUG: $1"
  fi
}

ensure_minikube_is_running() {
  if ! ${MINIKUBE_EXEC_WITH_PROFILE} status > /dev/null 2>&1 ; then
    echo 'Minikube must be running in order to continue. Aborting.'
    exit 1
  fi
}

get_gateway_url() {
  if [ "$1" == "" ] ; then
    INGRESS_PORT="<port>"
  else
    jsonpath="{.spec.ports[?(@.name==\"$1\")].nodePort}"
    INGRESS_PORT=$(${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- -n istio-system get service istio-ingressgateway -o jsonpath=${jsonpath})
  fi

  INGRESS_HOST=$(${MINIKUBE_EXEC_WITH_PROFILE} ip)
  GATEWAY_URL=$INGRESS_HOST:${INGRESS_PORT:-?}
}

print_all_gateway_urls() {
  echo "Gateway URLs for all known ports are:"
  allnames=$(${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- -n istio-system get service istio-ingressgateway -o jsonpath={.spec.ports['*'].name})
  for n in ${allnames}
  do
    get_gateway_url ${n}
    echo ${n}: ${GATEWAY_URL}
  done
}

check_insecure_registry() {
  if which podman > /dev/null 2>&1; then
    # looks like this machine is using podman - ignore this check
    return
  fi
  local _registry="$(${MINIKUBE_EXEC_WITH_PROFILE} ip):5000"
  pgrep -a dockerd | grep "[-]-insecure-registry.*${_registry}" > /dev/null 2>&1
  if [ "$?" != "0" ]; then
    grep "OPTIONS=.*--insecure-registry.*${_registry}" /etc/sysconfig/docker > /dev/null 2>&1
    if [ "$?" != "0" ]; then
      grep "insecure-registries.*${_registry}" /etc/docker/daemon.json > /dev/null 2>&1
      if [ "$?" != "0" ]; then
        echo "WARNING: You must tell Docker about the insecure image registry (e.g. --insecure-registry ${_registry})."
      else
        debug "/etc/docker/daemon.json has the insecure-registry setting. This is good."
      fi
    else
      debug "/etc/sysconfig/docker has defined the insecure-registry setting. This is good."
    fi
  else
    debug "Docker daemon is running with --insecure-registry setting. This is good."
  fi
}


install_hydra() {
  echo 'Installing Ory Hydra for OpenID Connect support...'

  # Find minikube ip
  MINIKUBE_IP=$(${MINIKUBE_EXEC_WITH_PROFILE} ip)
  echo "Minikube IP is ${MINIKUBE_IP}"

  MINIKUBE_IP_DASHED=$(echo -n ${MINIKUBE_IP} | sed 's/\./-/g')
  KUBE_HOSTNAME="${MINIKUBE_IP_DASHED}.nip.io"
  echo "Hostname will be ${KUBE_HOSTNAME}"

  # Create output directory for Hydra
  HYDRA_PATH="${OUTPUT_PATH}/hydra"
  mkdir -p ${HYDRA_PATH}

  # Generate certificates using our existing gencert.sh script
  CERTS_PATH="${HYDRA_PATH}/ssl_${KUBE_HOSTNAME}"
  if [ ! -d "${CERTS_PATH}" ]; then
    echo "Generating TLS certificates for Hydra..."
    # Use the gencert.sh script from our Hydra implementation (use absolute path)
    HYDRA_GENCERT_SCRIPT="$(pwd)/ory-hydra/scripts/gencert.sh"
    if [ ! -f "${HYDRA_GENCERT_SCRIPT}" ]; then
      echo "ERROR: Hydra gencert.sh script not found at ${HYDRA_GENCERT_SCRIPT}"
      exit 1
    fi

    # Run certificate generation
    mkdir -p ${CERTS_PATH}
    MINIKUBE_IP=${MINIKUBE_IP} KUBE_HOSTNAME=${KUBE_HOSTNAME} bash ${HYDRA_GENCERT_SCRIPT} "${KUBE_HOSTNAME}" "${MINIKUBE_IP}" "${CERTS_PATH}/ssl"
    [ "$?" != "0" ] && echo "ERROR: Failed to generate certificates for Hydra" && exit 1
  fi

  # Copy certificates to minikube cluster
  mkdir -p ${OUTPUT_PATH}
  local tmp_known_hosts="${OUTPUT_PATH}/minikube-known-hosts"
  rm -f ${tmp_known_hosts}
  ${MINIKUBE_EXEC_WITH_PROFILE} ssh -- mkdir -p hydra_certs
  scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=${tmp_known_hosts} -i $(${MINIKUBE_EXEC_WITH_PROFILE} ssh-key) ${CERTS_PATH}/ssl/* docker@$(${MINIKUBE_EXEC_WITH_PROFILE} ip):hydra_certs/
  ${MINIKUBE_EXEC_WITH_PROFILE} ssh -- sudo mkdir -p /var/lib/minikube/certs/
  ${MINIKUBE_EXEC_WITH_PROFILE} ssh -- sudo cp /home/docker/hydra_certs/* /var/lib/minikube/certs/

  # Deploy Hydra using our existing install script
  echo "Deploying Ory Hydra..."
  HYDRA_INSTALL_SCRIPT="./ory-hydra/scripts/install-hydra.sh"
  if [ ! -f "${HYDRA_INSTALL_SCRIPT}" ]; then
    echo "ERROR: Hydra install script not found at ${HYDRA_INSTALL_SCRIPT}"
    exit 1
  fi

  # Run Hydra installation with minikube context
  MINIKUBE_IP=${MINIKUBE_IP} KUBE_HOSTNAME=${KUBE_HOSTNAME} KUBECTL_CMD="${MINIKUBE_EXEC_WITH_PROFILE} kubectl --" HYDRA_VERSION=${HYDRA_VERSION} MINIKUBE_PROFILE=${MINIKUBE_PROFILE} bash ${HYDRA_INSTALL_SCRIPT}
  [ "$?" != "0" ] && echo "ERROR: Failed to install Hydra" && exit 1

  # Restart minikube with OIDC configuration
  echo "Restarting minikube with proper flags for API server and the autodetected registry IP..."
  ${MINIKUBE_EXEC_WITH_PROFILE} stop
  ${MINIKUBE_EXEC_WITH_PROFILE} start \
    ${MINIKUBE_START_FLAGS} \
    ${INSECURE_REGISTRY_START_ARG} \
    --insecure-registry ${MINIKUBE_IP}:5000 \
    --cni=${K8S_CNI} \
    --cpus=${K8S_CPU} \
    --memory=${K8S_MEMORY} \
    --disk-size=${K8S_DISK} \
    --driver=${K8S_DRIVER} \
    --kubernetes-version=${K8S_VERSION} \
    --extra-config=apiserver.oidc-issuer-url=https://$(echo ${MINIKUBE_IP} | sed 's/\./-/g').nip.io:30967 \
    --extra-config=apiserver.oidc-username-claim=email \
    --extra-config=apiserver.oidc-ca-file=/var/lib/minikube/certs/hydra-ca.pem \
    --extra-config=apiserver.oidc-client-id=kiali-app \
    --extra-config=apiserver.oidc-groups-claim=groups
  [ "$?" != "0" ] && echo "ERROR: Failed to restart minikube in preparation for Hydra" && exit 1

  # Wait for Hydra to be ready again after minikube restart
  echo "Waiting for Hydra to be ready after minikube restart..."
  for i in {1..60}; do
    if ${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- get pods -n ory -l app.kubernetes.io/name=hydra --no-headers 2>/dev/null | grep -q "1/1.*Running"; then
      break
    fi
    echo "Waiting for Hydra to restart... (attempt $i/60)"
    sleep 5
  done
  if ${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- get pods -n ory -l app.kubernetes.io/name=hydra --no-headers 2>/dev/null | grep -q "1/1.*Running"; then
    echo "Hydra is ready after restart!"
  else
    echo "Error: Hydra failed to become ready after restart!"
    exit 1
  fi

  # Verify Hydra is accessible via nip.io after restart
  echo "Verifying Hydra OIDC endpoint is accessible..."
  for i in {1..40}; do
    if curl -k -s "https://$(echo ${MINIKUBE_IP} | sed 's/\./-/g').nip.io:30967/.well-known/openid-configuration" > /dev/null 2>&1; then
      echo "Hydra OIDC endpoint is accessible!"
      break
    fi
    echo "Waiting for Hydra OIDC endpoint... (attempt $i/40)"
    sleep 2
  done
  if curl -k -s "https://$(echo ${MINIKUBE_IP} | sed 's/\./-/g').nip.io:30967/.well-known/openid-configuration" > /dev/null 2>&1; then
    echo "Hydra OIDC endpoint is accessible!"
  else
    echo "Error: Hydra OIDC endpoint is not accessible!"
    exit 1
  fi

  echo "Creating istio-system namespace for Kiali deployment"
  ${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- create namespace istio-system

  # Deploy OAuth2 Proxy for header authentication testing
  echo "Deploying OAuth2 Proxy for header authentication..."
  cat <<EOF | ${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- apply -f -
apiVersion: v1
kind: Namespace
metadata:
  name: oauth2-proxy
spec: {}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: oauth2-proxy
  namespace: oauth2-proxy
data:
  oauth2-proxy.conf: |-
    http_address="0.0.0.0:4180"
    cookie_secret="secretxxsecretxx"
    provider="oidc"
    email_domains="example.com"
    oidc_issuer_url="https://${KUBE_HOSTNAME}:30967"
    client_id="kiali-app"
    cookie_secure="false"
    redirect_url="http://kiali-proxy.${KUBE_HOSTNAME}:30805/oauth2/callback"
    upstreams="http://kiali.istio-system.svc:20001"
    pass_authorization_header = true
    set_authorization_header = true
    ssl_insecure_skip_verify = true
    client_secret="doNotTell"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  labels:
    k8s-app: oauth2-proxy
  name: oauth2-proxy
  namespace: oauth2-proxy
spec:
  replicas: 1
  selector:
    matchLabels:
      k8s-app: oauth2-proxy
  template:
    metadata:
      labels:
        k8s-app: oauth2-proxy
    spec:
      containers:
      - args:
        - --config
        - /etc/oauthproxy/oauth2-proxy.conf
        env: []
        image: quay.io/oauth2-proxy/oauth2-proxy:v7.6.0
        imagePullPolicy: Always
        livenessProbe:
          httpGet:
            path: /ping
            port: 4180
          initialDelaySeconds: 10
          periodSeconds: 20
        name: oauth2-proxy
        ports:
        - containerPort: 4180
          protocol: TCP
        volumeMounts:
        - mountPath: /etc/oauthproxy
          name: config
      volumes:
      - configMap:
          name: oauth2-proxy
        name: config
---
apiVersion: v1
kind: Service
metadata:
  labels:
    k8s-app: oauth2-proxy
  name: oauth2-proxy
  namespace: oauth2-proxy
spec:
  ports:
  - name: http
    port: 4180
    protocol: TCP
    targetPort: 4180
    nodePort: 30805
  type: NodePort
  selector:
    k8s-app: oauth2-proxy
EOF
  [ "$?" != "0" ] && echo "ERROR: Failed to deploy OAuth2 Proxy" && exit 1

  echo "Minikube should now be configured with Ory Hydra OpenID connect and OAuth2 Proxy. Just wait for all pods to start."

  cat <<EOF
Commands to query Hydra deployments and pods:
  ${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- get deployments -n ory
  ${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- get pods -n ory

OpenID configuration for Kiali CR (confidential client - secret required):
  auth:
    strategy: openid
    openid:
      client_id: "kiali-app"
      insecure_skip_verify_tls: true
      issuer_uri: "https://$(echo ${MINIKUBE_IP} | sed 's/\./-/g').nip.io:30967"
      username_claim: "email"

OpenID user is:
  Username: admin@example.com
  Password: password

NOTE: kiali-app is configured as a confidential OAuth2 client (client secret required).
A Kubernetes secret containing the OAuth2 client secret needs to be created for Kiali to authenticate with this client.

EOF

  if [ "${HYDRA_USER_NAMESPACES}" != "none" ]; then
    if [ "${HYDRA_USER_NAMESPACES}" == "all" ]; then
      echo "!!!CAUTION!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
      echo "!! The user 'admin@example.com' will be granted cluster-admin permissions ! "
      echo "!!!CAUTION!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
      ${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- create clusterrolebinding hydra-rolebinding-admin --clusterrole=cluster-admin --user="admin@example.com"
    else
      echo "After you install Kiali, execute these commands to grant the user 'admin@example.com' permission to see specific namespaces:"
      for ns in ${HYDRA_USER_NAMESPACES}; do
        echo ${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- create rolebinding hydra-rolebinding-${ns} --clusterrole=kiali --user="admin@example.com" --namespace=${ns}
      done
    fi
  fi
}

install_olm() {
  echo 'Installing OLM...'

  if [ "${OLM_VERSION}" == "latest" ]; then
    # Try for 2 hours (120 attempts * 60 seconds)
    local curl_output=""
    OLM_VERSION=""
    for i in {1..120}; do
      echo "Attempt $i/120: Attempting to get the latest OLM version from GitHub..."

      # Try to get the releases from GitHub
      curl_output=$(curl -s https://api.github.com/repos/operator-framework/operator-lifecycle-manager/releases 2>/dev/null)
      local curl_exit_code=$?

      # Check if curl succeeded
      if [ $curl_exit_code -ne 0 ]; then
        if [ $i -lt 120 ]; then
          echo "Retry $i/120: curl command failed with exit code [$curl_exit_code], retrying in 60 seconds..."
          sleep 60
        fi
        continue
      fi

      # Check if we got a non-empty response
      if [ -z "$curl_output" ]; then
        if [ $i -lt 120 ]; then
          echo "Retry $i/120: curl returned empty response, retrying in 60 seconds..."
          sleep 60
        fi
        continue
      fi

      # Check if the response looks like valid JSON (basic check)
      if ! echo "$curl_output" | grep -q '"tag_name"'; then
        if [ $i -lt 120 ]; then
          echo "Retry $i/120: curl response does not contain expected JSON structure, retrying in 60 seconds..."
          sleep 60
        fi
        continue
      fi

      # Try to extract the OLM version
      local OLM_VERSION_TEMP="$(echo "$curl_output" | grep "tag_name" | sed -e 's/.*://' -e 's/ *"//' -e 's/",//' | grep -v "snapshot" | sort -t "." -k 1.2g,1 -k 2g,2 -k 3g | tail -n 1)"

      # Check if version extraction succeeded
      if [ -z "${OLM_VERSION_TEMP}" ]; then
        if [ $i -lt 120 ]; then
          echo "Retry $i/120: failed to extract latest OLM version from GitHub response, retrying in 60 seconds..."
          sleep 60
        fi
        continue
      fi

      # If we got here, everything worked
      OLM_VERSION="${OLM_VERSION_TEMP}"
      echo "Successfully obtained latest OLM version from GitHub: ${OLM_VERSION}"
      break
    done

    # Final check - if we still don't have a version after all retries, fail
    if [ -z "${OLM_VERSION:-}" ]; then
      echo "Failed to obtain the latest OLM version from GitHub after 120 attempts over 2 hours. You will need to specify an explicit version via --olm-version."
      exit 1
    else
      echo "Github reports the latest OLM version is: ${OLM_VERSION}"
    fi
  fi

  # Download the OLM install script with retry logic (2 hours, 60 seconds between retries)
  echo "Downloading OLM install script..."
  for i in {1..120}; do
    local olm_install_script=""
    echo "Attempt $i/120: Downloading OLM install script from GitHub..."

    # Try to download the OLM install script
    olm_install_script=$(curl -sL https://github.com/operator-framework/operator-lifecycle-manager/releases/download/${OLM_VERSION}/install.sh 2>/dev/null)
    local curl_exit_code=$?

    # Check if curl succeeded
    if [ $curl_exit_code -ne 0 ]; then
      if [ $i -lt 120 ]; then
        echo "Retry $i/120: curl command failed with exit code [$curl_exit_code], retrying in 60 seconds..."
        sleep 60
      fi
      continue
    fi

    # Check if we got a non-empty response
    if [ -z "$olm_install_script" ]; then
      if [ $i -lt 120 ]; then
        echo "Retry $i/120: curl returned empty response, retrying in 60 seconds..."
        sleep 60
      fi
      continue
    fi

    # Check if the response looks like a valid shell script (basic check)
    if ! echo "$olm_install_script" | grep -q '#!/bin/bash\|#!/bin/sh\|bash\|kubectl'; then
      if [ $i -lt 120 ]; then
        echo "Retry $i/120: downloaded content does not appear to be a valid shell script, retrying in 60 seconds..."
        sleep 60
      fi
      continue
    fi

    # If we got here, everything worked
    echo "Successfully downloaded OLM install script from GitHub"
    break
  done

  # Final check - if we still don't have the script after all retries, fail
  if [ -z "${olm_install_script:-}" ]; then
    echo "Failed to download OLM install script from GitHub after 120 attempts over 2 hours."
    exit 1
  fi

  # force the install.sh script to go through minikube kubectl when it executes kubectl commands
  kubectl() {
    ${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- $@
  }
  export MINIKUBE_EXEC_WITH_PROFILE
  export -f kubectl

  # Run the downloaded script (no retry - fail immediately if it fails)
  echo "Running OLM install script..."
  echo "$olm_install_script" | bash -s ${OLM_VERSION}
  [ "$?" != "0" ] && echo "ERROR: Failed to install OLM" && exit 1
  unset -f kubectl

  echo "OLM ${OLM_VERSION} is installed."
}

determine_full_lb_range() {
  local host_ip=$(${MINIKUBE_EXEC_WITH_PROFILE} ip)
  local subnet=$(echo ${host_ip} | sed -E 's/([0-9]+\.[0-9]+\.[0-9]+)\.[0-9]+/\1/')
  local first_ip="${subnet}.$(echo "${LB_ADDRESSES}" | cut -d '-' -f 1)"
  local last_ip="${subnet}.$(echo "${LB_ADDRESSES}" | cut -d '-' -f 2)"
  LB_ADDRESSES="'${first_ip}-${last_ip}'"
  echo "Full Load Balancer addresses: ${LB_ADDRESSES}"
}

# Change to the directory where this script is and set our env
cd "$(dirname "${BASH_SOURCE[0]}")"

_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    start|up) _CMD="start"; shift ;;
    stop|down) _CMD="stop"; shift ;;
    status) _CMD="status"; shift ;;
    delete) _CMD="delete"; shift ;;
    docker) _CMD="docker"; shift ;;
    podman) _CMD="podman"; shift ;;
    dashboard) _CMD="dashboard"; shift ;;
    port-forward) _CMD="port-forward"; shift ;;
    ingress) _CMD="ingress"; shift ;;
    istio) _CMD="istio"; shift ;;
    bookinfo) _CMD="bookinfo"; shift ;;
    gwurl)
      _CMD="gwurl"
      if [ "${2:-}" != "" ]; then
        _CMD_OPT="$2"
        shift
      else
        _CMD_OPT="all"
      fi
      shift
      ;;
    resetclock) _CMD="resetclock"; shift ;;
    olm) _CMD="olm"; shift ;;
    -ce|--client-exe) CLIENT_EXE="$2"; shift;shift ;;
    -he|--hydra-enabled) HYDRA_ENABLED="$2"; shift;shift ;;
    -hun|--hydra-user-namespaces) HYDRA_USER_NAMESPACES="$2"; shift;shift ;;
    -hv|--hydra-version) HYDRA_VERSION="$2"; shift;shift ;;
    -iri|--insecure-registry-ip) INSECURE_REGISTRY_IP="$2"; shift;shift ;;
    -kc|--kubernetes-cpu) K8S_CPU="$2"; shift;shift ;;
    -kcni|--kubernetes-cni) K8S_CNI="$2"; shift;shift ;;
    -kd|--kubernetes-disk) K8S_DISK="$2"; shift;shift ;;
    -kdr|--kubernetes-driver) K8S_DRIVER="$2"; shift;shift ;;
    -km|--kubernetes-memory) K8S_MEMORY="$2"; shift;shift ;;
    -kv|--kubernetes-version) K8S_VERSION="$2"; shift;shift ;;
    -lba|--load-balancer-addrs) LB_ADDRESSES="$2"; shift;shift ;;
    -me|--minikube-exe) MINIKUBE_EXE="$2"; shift;shift ;;
    -mf|--minikube-flags) MINIKUBE_START_FLAGS="$2"; shift;shift ;;
    -mp|--minikube-profile) MINIKUBE_PROFILE="$2"; shift;shift ;;
    -oe|--olm-enabled) OLM_ENABLED="$2"; shift;shift ;;
    -op|--output-path) OUTPUT_PATH="$2"; shift;shift ;;
    -ov|--olm-version) OLM_VERSION="$2"; shift;shift ;;
    -v|--verbose) _VERBOSE=true; shift ;;
    -h|--help)
      cat <<HELPMSG

$0 [option...] command

Valid options:
  -ce|--client-exe
      The kubectl client to use.
      Only used for needing to install Istio or the Bookinfo demo. The "minikube kubectl" command will be used instead when possible.
      Default: ${DEFAULT_CLIENT_EXE}
  -he|--hydra-enabled
      If true, install and configure Ory Hydra. This provides an OpenID Connect implementation with multi-audience support.
      Only used for the 'start' command.
      Default: ${DEFAULT_HYDRA_ENABLED}
  -hun|--hydra-user-namespaces
      A space-separated list of namespaces that you would like the admin@example.com user to be able to see.
      If this value is set to "all", the admin@example.com user will immediately be granted cluster-admin permissions.
      If this value is set to "none", nothing is done.
      Any other value and this will not trigger actual creation of role bindings but instead the script merely
      outputs the commands in the final summary that you should then execute in order to grant those permissions.
      This is because the namespaces may not exist yet (such as "bookinfo") nor will the Kiali role exist.
      Only used for the 'start' command and when Hydra is to be installed (--hydra-enabled=true).
      Default: ${DEFAULT_HYDRA_USER_NAMESPACES}
  -hv|--hydra-version
      The version of Ory Hydra to be installed.
      Only used for the 'start' command and when Hydra is to be installed (--hydra-enabled=true).
      Default: ${DEFAULT_HYDRA_VERSION}
  -iri|--insecure-registry-ip
      This is used for the setting up an insecure registry IP within the minikube docker daemon.
      This is needed to easily authenticate and push images to the docker daemon.
      This IP is usually the minikube IP, but that IP varies depending on the driver being used.
      This IP is needed during startup, but it cannot be determined until after minikube starts;
      hence that is why this script cannot auto-detect what you need. If the default is incorrect
      for the driver you are using, you can set this value if you know what it will be. Otherwise,
      you will need to obtain the minikube IP, then 'stop' and then 'start' minikube with this
      value appropriately set.
      Only used for the 'start' commmand.
      Default: ${DEFAULT_INSECURE_REGISTRY_IP}
  -kc|--kubernetes-cpu
      The number of CPUs to give to Kubernetes at startup.
      Only used for the 'start' command.
      Default: ${DEFAULT_K8S_CPU}
  -kcni|--kubernetes-cni
      The CNI implementation used by minikube. See 'minikube start --help' for the --cni options.
      Only used for the 'start' command.
      Default: ${DEFAULT_K8S_CNI}
  -kd|--kubernetes-disk
      The amount of disk space to give to Kubernetes at startup.
      Only used for the 'start' command.
      Default: ${DEFAULT_K8S_DISK}
  -kdr|--kubernetes-driver
      The hypervisor to use. Examples of valid values: virtualbox, hyperkit, kvm2, none.
      Only used for the 'start' command.
      Default: ${DEFAULT_K8S_DRIVER}
  -km|--kubernetes-memory
      The amount of memory to give to Kubernetes at startup.
      Only used for the 'start' command.
      Default: ${DEFAULT_K8S_MEMORY}
  -kv|--kubernetes-version
      The version of Kubernetes to start.
      Only used for the 'start' command.
      Default: ${DEFAULT_K8S_VERSION}
  -lba|--load-balancer-addrs
      When specified, the "metallb" addon is enabled and these are the load balancer addresses it uses.
      The format for this value is simply two numbers, dash-separated such as "70-84". This means the
      load balancer will use IPs in that range, using the subnet determined by "minikube ip". So if
      the "minikube ip" is 192.168.99.100, the load balancer addrs will be "192.168.99.70-192.168.99.84".
      Only used for the 'start' command.
      Default: ${DEFAULT_LB_ADDRESSES}
  -me|--minikube-exe
      The minikube executable.
      Default: ${DEFAULT_MINIKUBE_EXE}
  -mf|--minikube-flags
      Additional flags to pass to the 'minikube start' command.
      Only used for the 'start' command.
      Default: ${DEFAULT_MINIKUBE_START_FLAGS}
  -mp|--minikube-profile
      The profile which minikube will be started with.
      Default: ${DEFAULT_MINIKUBE_PROFILE}
  -oe|--olm-enabled
      If true, OLM will be installed in the minikube cluster allowing you to install operators using the OLM API.
      Only used for the 'start' command.
      Default: ${DEFAULT_OLM_ENABLED}
  -op|--output-path
      A path this script can use to store files it needs or generates.
      This path will be created if it does not exist, but it will
      only be created if it is needed by the script.
      Default: ${DEFAULT_OUTPUT_PATH}
  -ov|--olm-version
      If OLM is enabled, this is the version of OLM to install.
      If set to "latest", github will be queried to determine the latest release, and that version will be installed.
      Only used for the 'start' command.
      Default: ${DEFAULT_OLM_VERSION}
  -v|--verbose
      Enable logging of debug messages from this script.

The command must be either:
  start:        starts the minikube cluster (alias: up)
  stop:         stops the minikube cluster (alias: down)
  status:       gets the status of the minikube cluster
  delete:       completely removes the minikube cluster VM destroying all state
  docker:       information on the minikube docker environment
  podman:       information on the minikube podman environment
  dashboard:    enables access to the Kubernetes GUI within minikube
  port-forward: forward a local port to the Kiali server
  ingress:      enables access to the Kubernetes ingress URL within minikube
  istio:        installs Istio into the minikube cluster
  bookinfo:     installs Istio's bookinfo demo (make sure Istio is installed first)
  gwurl [<portName>|'all']:
                displays the Ingress Gateway URL. If a port name is given, the gateway port is also shown.
                If the port name is "all" then all the URLs for all known ports are shown.
  resetclock:   If the VM's clock gets skewed (e.g. by sleeping) run this to reset it to the current time.
  olm:          Install OLM.
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# Prepare some env vars
: ${CLIENT_EXE:=${DEFAULT_CLIENT_EXE}}
: ${HYDRA_ENABLED:=${DEFAULT_HYDRA_ENABLED}}
: ${HYDRA_USER_NAMESPACES:=${DEFAULT_HYDRA_USER_NAMESPACES}}
: ${HYDRA_VERSION:=${DEFAULT_HYDRA_VERSION}}
: ${INSECURE_REGISTRY_IP:=${DEFAULT_INSECURE_REGISTRY_IP}}
: ${K8S_CNI:=${DEFAULT_K8S_CNI}}
: ${K8S_CPU:=${DEFAULT_K8S_CPU}}
: ${K8S_DISK:=${DEFAULT_K8S_DISK}}
: ${K8S_DRIVER:=${DEFAULT_K8S_DRIVER}}
: ${K8S_VERSION:=${DEFAULT_K8S_VERSION}}
: ${K8S_MEMORY:=${DEFAULT_K8S_MEMORY}}
: ${LB_ADDRESSES:=${DEFAULT_LB_ADDRESSES}}
: ${MINIKUBE_EXE:=${DEFAULT_MINIKUBE_EXE}}
: ${MINIKUBE_START_FLAGS:=${DEFAULT_MINIKUBE_START_FLAGS}}
: ${MINIKUBE_PROFILE:=${DEFAULT_MINIKUBE_PROFILE}}
: ${OLM_ENABLED:=${DEFAULT_OLM_ENABLED}}
: ${OLM_VERSION:=${DEFAULT_OLM_VERSION}}
: ${OUTPUT_PATH:=${DEFAULT_OUTPUT_PATH}}

MINIKUBE_EXEC_WITH_PROFILE="${MINIKUBE_EXE} -p ${MINIKUBE_PROFILE}"

if [ ! -z "${INSECURE_REGISTRY_IP}" ]; then
  INSECURE_REGISTRY_START_ARG="--insecure-registry ${INSECURE_REGISTRY_IP}:5000"
else
  INSECURE_REGISTRY_START_ARG=""
fi

debug "CLIENT_EXE=$CLIENT_EXE"
debug "HYDRA_ENABLED=$HYDRA_ENABLED"
debug "HYDRA_USER_NAMESPACES=$HYDRA_USER_NAMESPACES"
debug "HYDRA_VERSION=$HYDRA_VERSION"
debug "INSECURE_REGISTRY_IP=$INSECURE_REGISTRY_IP"
debug "INSECURE_REGISTRY_START_ARG=$INSECURE_REGISTRY_START_ARG"
debug "K8S_CNI=$K8S_CNI"
debug "K8S_CPU=$K8S_CPU"
debug "K8S_DISK=$K8S_DISK"
debug "K8S_DRIVER=$K8S_DRIVER"
debug "K8S_MEMORY=$K8S_MEMORY"
debug "K8S_VERSION=$K8S_VERSION"
debug "LB_ADDRESSES=$LB_ADDRESSES"
debug "MINIKUBE_EXE=$MINIKUBE_EXE"
debug "MINIKUBE_START_FLAGS=$MINIKUBE_START_FLAGS"
debug "MINIKUBE_PROFILE=$MINIKUBE_PROFILE"
debug "OLM_ENABLED=$OLM_ENABLED"
debug "OLM_VERSION=$OLM_VERSION"
debug "OUTPUT_PATH=$OUTPUT_PATH"

# If minikube executable is not found, abort.
if ! which ${MINIKUBE_EXE} > /dev/null 2>&1 ; then
  echo "You do not have minikube installed [${MINIKUBE_EXE}]. Aborting."
  exit 1
fi

debug "This script is located at $(pwd)"
debug "minikube is located at $(which ${MINIKUBE_EXE})"

if [ "$_CMD" = "start" ]; then
  echo 'Starting minikube...'

  # Check if no-kubernetes flag is present. If so, we shouldn't try to provide a kube version,
  # start addons, or apply additional yaml
  if grep -q 'no-kubernetes' <<< "${MINIKUBE_START_FLAGS}"
  then
    ${MINIKUBE_EXEC_WITH_PROFILE} start \
      ${MINIKUBE_START_FLAGS} \
      ${INSECURE_REGISTRY_START_ARG} \
      --cni=${K8S_CNI} \
      --cpus=${K8S_CPU} \
      --memory=${K8S_MEMORY} \
      --disk-size=${K8S_DISK} \
      --driver=${K8S_DRIVER}

    [ "$?" != "0" ] && echo "ERROR: Failed to start minikube" && exit 1

    exit 0
  fi

  ${MINIKUBE_EXEC_WITH_PROFILE} start \
    ${MINIKUBE_START_FLAGS} \
    ${INSECURE_REGISTRY_START_ARG} \
    --cni=${K8S_CNI} \
    --cpus=${K8S_CPU} \
    --memory=${K8S_MEMORY} \
    --disk-size=${K8S_DISK} \
    --driver=${K8S_DRIVER} \
    --kubernetes-version=${K8S_VERSION}
  [ "$?" != "0" ] && echo "ERROR: Failed to start minikube" && exit 1
  echo 'Enabling the ingress addon'
  ${MINIKUBE_EXEC_WITH_PROFILE} addons enable ingress
  [ "$?" != "0" ] && echo "ERROR: Failed to enable ingress addon" && exit 1
  echo 'Enabling the image registry'
  ${MINIKUBE_EXEC_WITH_PROFILE} addons enable registry
  [ "$?" != "0" ] && echo "ERROR: Failed to enable registry addon" && exit 1

  if [ ! -z "${LB_ADDRESSES}" ]; then
    echo 'Enabling the metallb load balancer'
    ${MINIKUBE_EXEC_WITH_PROFILE} addons enable metallb
    [ "$?" != "0" ] && echo "ERROR: Failed to enable metallb addon" && exit 1
    determine_full_lb_range
    cat <<LBCONFIGMAP | ${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- apply -f -
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
      addresses: [${LB_ADDRESSES}]
LBCONFIGMAP
    [ "$?" != "0" ] && echo "ERROR: Failed to configure metallb addon" && exit 1
  fi

  if [ "${HYDRA_ENABLED}" == "true" ]; then
    install_hydra
  fi

  if [ "${OLM_ENABLED}" == "true" ]; then
    install_olm
  fi

  echo 'Minikube has started.'

elif [ "$_CMD" = "stop" ]; then
  ensure_minikube_is_running
  echo 'Stopping minikube'
  ${MINIKUBE_EXEC_WITH_PROFILE} stop

elif [ "$_CMD" = "status" ]; then
  ensure_minikube_is_running
  check_insecure_registry
  echo 'Status report for minikube'
  ${MINIKUBE_EXEC_WITH_PROFILE} status

elif [ "$_CMD" = "delete" ]; then
  echo 'Deleting the entire minikube VM'
  ${MINIKUBE_EXEC_WITH_PROFILE} delete

elif [ "$_CMD" = "dashboard" ]; then
  ensure_minikube_is_running
  echo 'Accessing the Kubernetes console GUI. This runs in foreground, press Control-C to kill it.'
  ${MINIKUBE_EXEC_WITH_PROFILE} dashboard

elif [ "$_CMD" = "port-forward" ]; then
  ensure_minikube_is_running
  echo 'Forwarding port 20001 to the Kiali server. This runs in foreground, press Control-C to kill it.'
  echo 'To access Kiali, point your browser to http://localhost:20001/kiali/console'
  ${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- -n istio-system port-forward $(${MINIKUBE_EXEC_WITH_PROFILE} kubectl -- -n istio-system get pod -l app.kubernetes.io/name=kiali -o jsonpath='{.items[0].metadata.name}') 20001:20001

elif [ "$_CMD" = "ingress" ]; then
  ensure_minikube_is_running
  echo 'Accessing the Kubernetes Ingress URL.'
  gio open "http://$(${MINIKUBE_EXEC_WITH_PROFILE} ip)"

elif [ "$_CMD" = "istio" ]; then
  ensure_minikube_is_running
  echo 'Installing Istio'
  if [ "${MINIKUBE_PROFILE}" != "${DEFAULT_MINIKUBE_PROFILE}" ]; then
    ./istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE} -cn ${MINIKUBE_PROFILE}
  else
    ./istio/install-istio-via-istioctl.sh -c ${CLIENT_EXE}
  fi

elif [ "$_CMD" = "bookinfo" ]; then
  ensure_minikube_is_running
  echo 'Installing Bookinfo'
  ./istio/install-bookinfo-demo.sh --mongo -tg -c ${CLIENT_EXE} -mp ${MINIKUBE_PROFILE}
  get_gateway_url http2
  echo 'To access the Bookinfo application, access this URL:'
  echo "http://${GATEWAY_URL}/productpage"
  echo 'To push requests into the Bookinfo application, execute this command:'
  echo "watch -n 1 curl -o /dev/null -s -w '%{http_code}' http://${GATEWAY_URL}/productpage"

elif [ "$_CMD" = "gwurl" ]; then
  ensure_minikube_is_running
  if [ "${_CMD_OPT}" == "all" ]; then
    print_all_gateway_urls
  else
    get_gateway_url $_CMD_OPT
    echo 'The Gateway URL is:'
    echo "${GATEWAY_URL}"
  fi

elif [ "$_CMD" = "docker" ]; then
  ensure_minikube_is_running
  echo 'Your current minikube docker environment is the following:'
  ${MINIKUBE_EXEC_WITH_PROFILE} docker-env
  echo 'Run the above command in your shell before building container images so your images will go in the minikube image registry'

elif [ "$_CMD" = "podman" ]; then
  ensure_minikube_is_running
  echo 'Your current minikube podman environment is the following:'
  ${MINIKUBE_EXEC_WITH_PROFILE} podman-env
  echo 'Run the above command in your shell before building container images so your images will go in the minikube image registry'

elif [ "$_CMD" = "resetclock" ]; then
  ensure_minikube_is_running
  echo "Resetting the clock in the minikube VM"
  ${MINIKUBE_EXEC_WITH_PROFILE} ssh -- sudo date -u $(date -u +%m%d%H%M%Y.%S)

elif [ "$_CMD" = "olm" ]; then
  ensure_minikube_is_running
  install_olm

else
  echo "ERROR: Missing required command"
  exit 1
fi
