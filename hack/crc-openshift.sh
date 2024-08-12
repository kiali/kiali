#!/bin/bash

##############################################################################
# crc-openshift.sh
#
# Run this script to start/stop an OpenShift 4 cluster.
#
# This script takes one command whose value is one of the following:
#        start: starts the OpenShift environment
#         stop: stops the OpenShift environment
#       delete: deletes the OpenShift environment removing persisted data
#      cleanup: just like delete but also further cleans up the CRC environment
#       status: outputs the current status of the OpenShift environment
#          ssh: logs into the CRC VM via ssh so you can probe in the VM
#        sshoc: logs into the CRC VM via oc debug so you can probe in the VM
#       routes: outputs all known route URLs
#     services: outputs all known service endpoints (excluding internal openshift services)
#       expose: creates firewalld rules so remote clients can access the cluster
#     unexpose: removes firewalld rules so remote clients cannot access the cluster
# changedomain: change the cluster to use an nip.io domain rather than "crc.testing".
#
# This script accepts several options - see --help for details.
#
# This script utilizes the crc tool and its bundle.
# If you do not have it, this script will download it for you.
# Downloading will take some time, the images are large.
#
##############################################################################

infomsg() {
  echo "HACK: $1"
}

debug() {
  if [ "$_VERBOSE" == "true" ]; then
    infomsg "DEBUG: $1"
  fi
}

get_downloader() {
  if [ -z "$DOWNLOADER" ] ; then
    # Use wget command if available, otherwise try curl
    if which wget > /dev/null 2>&1 ; then
      DOWNLOADER="wget -O"
    else
      if which curl > /dev/null 2>&1 ; then
        DOWNLOADER="curl -L -o"
      fi
    fi

    if [ ! "$DOWNLOADER" ] ; then
      infomsg "ERROR: You must install either curl or wget to allow downloading."
      exit 1
    fi
  fi
  debug "Downloader command to be used: ${DOWNLOADER}"
}

# check_crc_running sets env var _CRC_RUNNING to true or false
check_crc_running() {
  if [ -z ${_CRC_RUNNING} ]; then
    if crc status | grep "CRC VM:.*Running" > /dev/null 2>&1; then
      _CRC_RUNNING="true"
    else
      _CRC_RUNNING="false"
    fi
    debug "CRC running status: ${_CRC_RUNNING}"
  fi
}

# get_console_url sets the env var CONSOLE_URL
get_console_url() {
  CONSOLE_URL="$(${CRC_OC} get console cluster -o jsonpath='{.status.consoleURL}' 2>/dev/null)"
  if [ "$?" != "0" -o "$CONSOLE_URL" == "" ]; then
    CONSOLE_URL="console-not-available"
  fi
}

# get_api_server_url sets the env var OPENSHIFT_API_SERVER_URL
get_api_server_url() {
  OPENSHIFT_API_SERVER_URL="$(${CRC_OC} whoami --show-server 2>/dev/null || echo 'unknown')"
}

# get_base_domain_name sets the env vars OPENSHIFT_BASE_DOMAIN_NAME as well as OPENSHIFT_API_SERVER_URL
get_base_domain_name() {
  get_api_server_url
  OPENSHIFT_BASE_DOMAIN_NAME="$(echo "${OPENSHIFT_API_SERVER_URL}" | awk -F[/:] '{sub(/^api\./, "", $4); print $4}')"
}

# get_machine_ip sets the env var MACHINE_IP
get_machine_ip() {
  MACHINE_IP="$(hostname -I | awk '{print $1}')"
}

# get_oauth_host sets the env var OPENSHIFT_OAUTH_HOST
get_oauth_host() {
  OPENSHIFT_OAUTH_HOST="$(${CRC_OC} get route oauth-openshift -n openshift-authentication -o jsonpath='{.spec.host}')"
}

# is_logged_in sets the env var OC_IS_LOGGED_IN to true or false
is_logged_in() {
  OC_IS_LOGGED_IN="$(${CRC_OC} whoami &> /dev/null < /dev/null && echo true || echo false)"
}

get_status() {
  check_crc_running
  echo "====================================================================="
  echo "oc:  ${CRC_OC}"
  echo "crc: ${CRC_COMMAND}"
  echo "====================================================================="
  echo "Version from crc command [${CRC_COMMAND}]"
  ${CRC_COMMAND} version
  echo "====================================================================="
  echo "Status from crc command [${CRC_COMMAND}]"
  ${CRC_COMMAND} status
  echo "====================================================================="
  if [ "${_CRC_RUNNING}" == "true" ]; then
    is_logged_in
    if [ "${OC_IS_LOGGED_IN}" == "true" ]; then
      get_registry_names
      get_console_url
      get_base_domain_name
      get_oauth_host
      echo "Logged in?: yes"
    else
      echo "Logged in?: no"
    fi
    echo "====================================================================="
    echo "To install 'oc' in your environment:"
    ${CRC_COMMAND} oc-env
    echo "====================================================================="
    echo "TOP output:"
    printf "%s\n" "$(exec_ssh 'top -b -n 1 | head -n 5')"
    echo "====================================================================="
    echo "Memory usage:"
    printf "%s\n" "$(exec_ssh 'free -ht')"
    echo "====================================================================="
    echo "Uptime of VM: $(exec_ssh 'uptime --pretty') (since $(exec_ssh 'uptime --since'))"
    if [ "${OC_IS_LOGGED_IN}" == "true" ]; then
      echo "====================================================================="
      echo "Version from oc command [${CRC_OC}]"
      ${CRC_OC} version
      echo "====================================================================="
      echo "Status from oc command [${CRC_OC}]"
      ${CRC_OC} status
      echo "====================================================================="
      echo "Number of CPUs: $(${CRC_OC} get $(${CRC_OC} get nodes -o name) -o jsonpath={.status.capacity.cpu})"
      echo "====================================================================="
      echo "Age of cluster: $(${CRC_OC} get namespace kube-system --no-headers | tr -s ' ' | cut -d ' ' -f3)"
      echo "====================================================================="
      echo "whoami: $(${CRC_OC} whoami 2>&1 < /dev/null) ($(${CRC_OC} whoami --show-server 2>&1 < /dev/null))"
      echo "====================================================================="
      echo "Domain Name: ${OPENSHIFT_BASE_DOMAIN_NAME}"
      echo "Console:     ${CONSOLE_URL}"
      echo "API URL:     ${OPENSHIFT_API_SERVER_URL}"
      echo "IP address:  $(${CRC_COMMAND} ip)"
      echo "Image Repo:  ${EXTERNAL_IMAGE_REGISTRY} (${INTERNAL_IMAGE_REGISTRY})"
      echo "OAuth Host:  ${OPENSHIFT_OAUTH_HOST}"
    fi
    echo "====================================================================="
    echo "kubeadmin password: $(cat ${CRC_KUBEADMIN_PASSWORD_FILE})"
    echo "$(${CRC_COMMAND} console --credentials | sed 's/crc.testing/'${OPENSHIFT_BASE_DOMAIN_NAME}'/')"
    echo "====================================================================="
    echo "To push images to the image repo you need to log in."
    echo "You can use docker or podman, and you can use kubeadmin or kiali user."
    echo "  oc login -u kubeadmin -p $(cat ${CRC_KUBEADMIN_PASSWORD_FILE}) --server ${OPENSHIFT_API_SERVER_URL:-<api url>}"
    echo '  docker login -u kubeadmin -p $(oc whoami -t)' ${EXTERNAL_IMAGE_REGISTRY:-<image registry>}
    echo "or"
    echo "  oc login -u kiali -p kiali --server ${OPENSHIFT_API_SERVER_URL:-<api url>}"
    echo '  podman login --tls-verify=false -u kiali -p $(oc whoami -t)' ${EXTERNAL_IMAGE_REGISTRY:-<image registry>}
    echo "====================================================================="
  else
    echo "CRC is not running."
  fi
}

get_registry_names() {
  local ext="not running"
  local int="not running"
  check_crc_running
  if [ "${_CRC_RUNNING}" == "true" ]; then
    ext=$(${CRC_OC} get image.config.openshift.io/cluster -o custom-columns=EXT:.status.externalRegistryHostnames[0] --no-headers 2>/dev/null)
    int=$(${CRC_OC} get image.config.openshift.io/cluster -o custom-columns=INT:.status.internalRegistryHostname --no-headers 2>/dev/null)
  fi
  EXTERNAL_IMAGE_REGISTRY=${ext:-<unknown>}
  INTERNAL_IMAGE_REGISTRY=${int:-<unknown>}
}

get_route_url() {
  # takes as input "routeName:routeNamespace"
  local routename=$(echo ${1} | cut -d: -f1)
  local routenamespace=$(echo ${1} | cut -d: -f2)
  local protocol="https"
  local termination=$(${CRC_OC} get route ${routename} -n ${routenamespace} -o custom-columns=T:spec.tls.termination --no-headers)
  if [ "${termination}" == "<none>" ]; then
    protocol="http"
  fi
  local host=$(${CRC_OC} get route ${routename} -n ${routenamespace} -o custom-columns=H:spec.host --no-headers)

  ROUTE_URL="${protocol}://${host}"
}

print_all_route_urls() {
  allnames_namespaces="$(${CRC_OC} get routes --all-namespaces --no-headers -o custom-columns=NAME:.metadata.name,NS:.metadata.namespace | sed ${SEDOPTIONS} 's/  */:/g')"
  for n in ${allnames_namespaces}
  do
    get_route_url ${n}
    printf '=====\n%s\n  %s\n' "${n}" "${ROUTE_URL}"
  done
}

get_service_endpoint() {
  # takes as input "serviceName:serviceNamespace"
  local servicename=$(echo ${1} | cut -d: -f1)
  local servicenamespace=$(echo ${1} | cut -d: -f2)
  local data="$(${CRC_OC} get service ${servicename} -n ${servicenamespace} -o custom-columns=I:spec.clusterIP,T:spec.type,NP:spec.ports[*].nodePort,P:spec.ports[*].port --no-headers | sed ${SEDOPTIONS} 's/  */:/g')"
  local clusterIP=$(echo ${data} | cut -d: -f1)
  local servicetype=$(echo ${data} | cut -d: -f2)
  local nodeports=$(echo ${data} | cut -d: -f3)
  local ports=$(echo ${data} | cut -d: -f4)
  local host="$(${CRC_COMMAND} ip)"
  # really only NodePort services are exposed outside of the CRC VM, so we just report those
  if [ ${servicetype} == "NodePort" ]; then
    SERVICE_ENDPOINT="${host}:${nodeports}"
  else
    if [ "${nodeports}" == "<none>" ]; then
      SERVICE_ENDPOINT="inaccessible - (${servicetype}) ${clusterIP}, ports=${ports}"
    else
      SERVICE_ENDPOINT="inaccessible - (${servicetype}) ${clusterIP}, ports=${nodeports}"
    fi
  fi
}

print_all_service_endpoints() {
  # we do filter out services from the internal openshift* and default namespaces
  allnames_namespaces="$(${CRC_OC} get services --all-namespaces --no-headers -o custom-columns=NAME:.metadata.name,NS:.metadata.namespace | sed ${SEDOPTIONS} 's/  */:/g' | grep -v ':openshift*' | grep -v ':default')"
  for n in ${allnames_namespaces}
  do
    get_service_endpoint ${n}
    printf '=====\n%s\n  %s\n' "${n}" "${SERVICE_ENDPOINT}"
  done
}

exec_ssh() {
  local sshcmd=${1}
  ssh -y -i ${CRC_ROOT_DIR}/machines/crc/id_ecdsa -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null core@$(${CRC_COMMAND} ip) ${sshcmd}
}

expose_cluster() {
  check_crc_running
  if [ "${_CRC_RUNNING}" != "true" ]; then
    infomsg "CRC is not running. Aborting."
    exit 1
  fi

  local virt_interface="crc"
  local crc_ip="$(${CRC_COMMAND} ip 2>/dev/null)"
  local sudo=$(test "$(whoami)" = "root" && echo "" || echo "sudo")

  # make sure the platform has all the requirements needed to do this
  local ip_fwd=$(cat /proc/sys/net/ipv4/ip_forward)
  if [ "$ip_fwd" != "1" ]; then infomsg "ERROR: IP forwarding not enabled. /proc/sys/net/ipv4/ip_forward=$ip_fwd"; exit 1; fi
  if ! which firewall-cmd >& /dev/null; then infomsg "ERROR: You do not have firewall-cmd in your PATH"; exit 1; fi
  if ! systemctl -q is-active firewalld; then infomsg "ERROR: firewalld is not running"; exit 1; fi
  if [ -z "${crc_ip}" ]; then infomsg "ERROR: The CRC cluster is not running"; exit 1; fi

  # If we already have existing port forwards, abort
  local existing_fwds=$($sudo firewall-cmd --list-forward-ports | grep "^port=80:proto=tcp:\|^port=443:proto=tcp:\|^port=6443:proto=tcp:")
  if [ -n "$existing_fwds" ]; then
    infomsg "ERROR: Existing port forwarding rules were found which are conflicting and must be deleted:"
    for x in ${existing_fwds}; do
      echo " $sudo firewall-cmd --remove-forward-port=\"$x\""
    done
    infomsg "You can use the 'unexpose' command to remove these rules."
    exit 1
  fi

  for c in \
    "firewall-cmd --add-forward-port=port=443:proto=tcp:toaddr=${crc_ip}:toport=443" \
    "firewall-cmd --add-forward-port=port=6443:proto=tcp:toaddr=${crc_ip}:toport=6443" \
    "firewall-cmd --add-forward-port=port=80:proto=tcp:toaddr=${crc_ip}:toport=80"
  do
    echo -n "EXECUTING: $sudo $c ... "
    $sudo $c
  done

  # give some hints to the user about how to access it
  infomsg "When accessing this cluster from outside make sure that cluster FQDNs resolve from outside."

  is_logged_in
  if [ "${OC_IS_LOGGED_IN}" == "true" ]; then
    get_machine_ip
    get_base_domain_name
    get_registry_names
    get_oauth_host
    local console_host="$(${CRC_OC} get route console -n openshift-console -o jsonpath='{.spec.host}')"
    infomsg "For basic api/console access, something like the following in an /etc/hosts entry should work:"
    infomsg "${MACHINE_IP:-<IP-of-this-host>} api.${OPENSHIFT_BASE_DOMAIN_NAME:-} ${console_host:-} ${EXTERNAL_IMAGE_REGISTRY} ${OPENSHIFT_OAUTH_HOST:-}"
  fi
}

unexpose_cluster() {
  local sudo=$(test "$(whoami)" = "root" && echo "" || echo "sudo")

  # make sure the platform has all the requirements needed to do this
  local ip_fwd=$(cat /proc/sys/net/ipv4/ip_forward)
  if [ "$ip_fwd" != "1" ]; then infomsg "ERROR: IP forwarding not enabled. /proc/sys/net/ipv4/ip_forward=$ip_fwd"; exit 1; fi
  if ! which firewall-cmd >& /dev/null; then infomsg "ERROR: You do not have firewall-cmd in your PATH"; exit 1; fi
  if ! systemctl -q is-active firewalld; then infomsg "ERROR: firewalld is not running"; exit 1; fi

  local existing_fwds=$($sudo firewall-cmd --list-forward-ports | grep "^port=80:proto=tcp:\|^port=443:proto=tcp:\|^port=6443:proto=tcp:")
  if [ -n "${existing_fwds}" ]; then
    for x in ${existing_fwds}; do
      echo -n "EXECUTING: $sudo firewall-cmd --remove-forward-port=\"$x\" ... "
      $sudo firewall-cmd --remove-forward-port="$x"
    done
  else
    infomsg "No relevant firewalld rules exist - nothing needs to be removed."
  fi
}

wait_for_cluster_operators() {
  while true; do

    infomsg "Waiting for the cluster operators to be ready..."
    sleep 10

    local co_status
    co_status=$(${CRC_OC} get clusteroperators --no-headers 2> /dev/null)
    if [ "$?" != "0" ]; then
      infomsg "Could not get info on cluster operators. Assuming the API Server is not ready..."
      continue
    fi
    if [ "$(echo "$co_status" | wc -l 2>/dev/null)" -lt "3" ]; then
      infomsg "OpenShift cluster is still starting up..."
      continue
    fi

    # if there are any operators NOT AVAILABLE, exit code will be 0.
    echo "$co_status" | awk '{print $3}' | grep False &>/dev/null
    local available_operators=$?
    # if there are any operators PROGRESSING, exit code will be 0.
    echo "$co_status" | awk '{print $4}' | grep True &>/dev/null
    local progressing_operators=$?
    # if there are any operators DEGRADED, exit code will be 0.
    echo "$co_status" | awk '{print $5}' | grep True &>/dev/null
    local degraded_operators=$?
    if [ "$available_operators" != "0" -a "$progressing_operators" != "0" -a "$degraded_operators" != "0" ]; then
      infomsg "All cluster operators appear to be ready."
      break
    fi
  done
}

change_crc_domain_name() {
  check_crc_running
  if [ "${_CRC_RUNNING}" != "true" ]; then
    infomsg "CRC is not running - cannot set CRC domain name. Aborting."
    exit 1
  fi

  is_logged_in
  if [ "${OC_IS_LOGGED_IN}" != "true" ]; then
    infomsg "You are not logged into the OpenShift cluster."
    exit 1
  fi

  get_machine_ip
  if ! ping -c 1 "${MACHINE_IP}" >/dev/null; then
    infomsg "Cannot determine the machine IP. Aborting."
    exit 1
  fi

  if [ ! -f /etc/haproxy/haproxy.cfg ] ; then
    echo "haproxy is not installed. Run: sudo dnf -y install haproxy policycoreutils-python-utils"
    exit 1
  fi

  local sudo=$(test "$(whoami)" = "root" && echo "" || echo "sudo")

  # firewall screws things up. Have never been able to figure it out. Disable it.
  if systemctl -q is-active firewalld; then
    infomsg "Shutting down the firewalld service."
    $sudo systemctl stop firewalld
  fi

  local crc_ip="$(${CRC_COMMAND} ip)"

  infomsg "Setting up HAProxy"
  cat << EOF > /tmp/haproxy.cfg.crc
global
        maxconn 4000

defaults
        balance roundrobin
        log global
        timeout connect 10s
        timeout client 2000s
        timeout server 2000s

frontend fe-api
        bind 0.0.0.0:6443
        mode tcp
        option tcplog
        default_backend be-api

frontend fe-https
        bind 0.0.0.0:443
        mode tcp
        option tcplog
        default_backend be-https

frontend fe-http
        bind 0.0.0.0:80
        mode tcp
        option tcplog
        default_backend be-http

backend be-api
        mode tcp
        option ssl-hello-chk
        server crcvm ${crc_ip}:6443 check

backend be-https
        mode tcp
        option ssl-hello-chk
        server crcvm ${crc_ip}:443 check

backend be-http
        mode tcp
        server crcvm ${crc_ip}:80 check
EOF

  if [ ! -f /etc/haproxy/haproxy.cfg.ORIGINAL ] ; then
    infomsg "Backing up original haproxy config file"
    $sudo cp /etc/haproxy/haproxy.cfg /etc/haproxy/haproxy.cfg.ORIGINAL
  fi

  $sudo cp /tmp/haproxy.cfg.crc /etc/haproxy/haproxy.cfg
  $sudo systemctl restart haproxy
  infomsg "HAProxy is ready"

  # the new CRC base domain name
  BASE_DOMAIN="${MACHINE_IP}.nip.io"
  infomsg "Will change CRC cluster domain name to [${BASE_DOMAIN}]"

  # create new certificate with the new base domain name
  infomsg "Generating new certificate..."
  openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout /tmp/crc-nip.key -out /tmp/crc-nip.crt -subj "/CN=${BASE_DOMAIN}" -addext "subjectAltName=DNS:apps.${BASE_DOMAIN},DNS:*.apps.${BASE_DOMAIN},DNS:api.${BASE_DOMAIN}"
  if [ "$?" != "0" ]; then infomsg "Cannot create certificate" && exit 1; fi

  # put the new certificate in a secret within the openshift-config namespace
  infomsg "New certificate generated. Now configuring OpenShift..."
  ${CRC_OC} create secret tls crc-nip-secret --cert=/tmp/crc-nip.crt --key=/tmp/crc-nip.key -n openshift-config
  if [ "$?" != "0" ]; then infomsg "Cannot create secret with the new certificate" && exit 1; fi

  # configure some additional places in the OpenShift cluster that need to know about the new domain name
  ${CRC_OC} patch route default-route -n openshift-image-registry --type=merge -p "{\"spec\": {\"host\": \"default-route-openshift-image-registry.$BASE_DOMAIN\"}}"
  if [ "$?" != "0" ]; then infomsg "Failed to patch openshift-image-registry/default-route" && exit 1; fi

  cat <<EOF > /tmp/crc-ingress-patch.yaml
spec:
  appsDomain: apps.${BASE_DOMAIN}
  componentRoutes:
  - hostname: console-openshift-console.apps.${BASE_DOMAIN}
    name: console
    namespace: openshift-console
    servingCertKeyPairSecret:
      name: crc-nip-secret
  - hostname: oauth-openshift.apps.${BASE_DOMAIN}
    name: oauth-openshift
    namespace: openshift-authentication
    servingCertKeyPairSecret:
      name: crc-nip-secret
EOF
  ${CRC_OC} patch ingresses.config.openshift.io cluster --type=merge --patch-file=/tmp/crc-ingress-patch.yaml
  if [ "$?" != "0" ]; then infomsg "Failed to patch cluster ingress" && exit 1; fi

  ${CRC_OC} patch apiserver cluster --type=merge -p "{\"spec\":{\"servingCerts\": {\"namedCertificates\":[{\"names\":[\"api.${BASE_DOMAIN}\"],\"servingCertificate\": {\"name\": \"crc-nip-secret\"}}]}}}"
  if [ "$?" != "0" ]; then infomsg "Failed to patch cluster apiserver" && exit 1; fi

  infomsg "The server will soon be accessible via web console at: https://console-openshift-console.apps.${BASE_DOMAIN}"
  infomsg "To log into the cluster via 'oc': oc login -u <username> -p <password> https://api.${BASE_DOMAIN}:6443"

  # wait for the cluster to fully incorporate these changes
  wait_for_cluster_operators

  infomsg "The API server URL has changed. Logging out of the obsolete session"
  ${CRC_OC} logout
  infomsg "Using the CRC oc client to login as kubeadmin"
  ${CRC_OC} login --insecure-skip-tls-verify=true -u kubeadmin -p $(cat ${CRC_KUBEADMIN_PASSWORD_FILE}) --server https://api.${BASE_DOMAIN}:6443

  if which oc &> /dev/null; then
    infomsg "Using the 'oc' client found in PATH to login as kubeadmin"
    oc login --insecure-skip-tls-verify=true -u kubeadmin -p $(cat ${CRC_KUBEADMIN_PASSWORD_FILE}) --server https://api.${BASE_DOMAIN}:6443
  else
    infomsg "You need to log back into the cluster via your 'oc' client."
  fi
  infomsg "Login Command: oc login -u <username> -p <password> --server https://api.${BASE_DOMAIN}:6443"
}

# Change to the directory where this script is and set our environment
SCRIPT_ROOT="$( cd "$(dirname "$0")" ; pwd -P )"
cd ${SCRIPT_ROOT}

# The default version of the crc tool to be downloaded
DEFAULT_CRC_DOWNLOAD_VERSION="2.40.0"

# The default version of the crc bundle - this is typically the version included with the CRC download
DEFAULT_CRC_LIBVIRT_DOWNLOAD_VERSION="4.16.4"

# The default virtual CPUs assigned to the CRC VM
DEFAULT_CRC_CPUS="6"

# The default memory (in GB) assigned to the CRC VM
DEFAULT_CRC_MEMORY="32"

# The default virtual disk size (in GB) assigned to the CRC VM
DEFAULT_CRC_VIRTUAL_DISK_SIZE="48"

# If true the OpenShift bundle will be downloaded when needed.
DEFAULT_DOWNLOAD_BUNDLE="false"

# Enables cluster monitoring in the CRC cluster
DEFAULT_ENABLE_CLUSTER_MONITORING="false"

# process command line args to override environment
_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    start|up)
      _CMD="start"
      shift
      ;;
    stop|down)
      _CMD="stop"
      shift
      ;;
    delete)
      _CMD="delete"
      shift
      ;;
    cleanup)
      _CMD="cleanup"
      shift
      ;;
    status)
      _CMD="status"
      shift
      ;;
    ssh)
      _CMD="ssh"
      shift
      ;;
    sshoc)
      _CMD="sshoc"
      shift
      ;;
    routes)
      _CMD="routes"
      shift
      ;;
    services)
      _CMD="services"
      shift
      ;;
    expose)
      _CMD="expose"
      shift
      ;;
    unexpose)
      _CMD="unexpose"
      shift
      ;;
    changedomain)
      _CMD="changedomain"
      shift
      ;;
    -b|--bin-dir)
      OPENSHIFT_BIN_PATH="$2"
      shift;shift
      ;;
    -ca|--crc-arch)
      CRC_DOWNLOAD_ARCH="$2"
      shift;shift
      ;;
    -clv|--crc-libvirt-version)
      CRC_LIBVIRT_DOWNLOAD_VERSION="$2"
      shift;shift
      ;;
    -ccpus|--crc-cpus)
      CRC_CPUS="$2"
      shift;shift
      ;;
    -cmem|--crc-memory)
      CRC_MEMORY="$2"
      shift;shift
      ;;
    -cp|--crc-platform)
      CRC_DOWNLOAD_PLATFORM="$2"
      shift;shift
      ;;
    -cv|--crc-version)
      CRC_DOWNLOAD_VERSION="$2"
      shift;shift
      ;;
    -cvdisk|--crc-virtual-disk-size)
      CRC_VIRTUAL_DISK_SIZE="$2"
      shift;shift
      ;;
    -db|--download-bundle)
      DOWNLOAD_BUNDLE="$2"
      shift;shift
      ;;
    -ecm|--enable-cluster-monitoring)
      ENABLE_CLUSTER_MONITORING="$2"
      shift;shift
      ;;
    -p|--pull-secret-file)
      PULL_SECRET_FILE="$2"
      shift;shift
      ;;
    -v|--verbose)
      _VERBOSE=true
      shift
      ;;
    -h|--help)
      cat <<HELPMSG

$0 [option...] command

Valid options:
  -b|--bin-dir <dir>
      Directory where the OpenShift binaries are or will be stored when downloaded.
      Default: ${HOME}/bin
  -ca|--crc-arch <architecture>
      The architecture of the crc binary to use.
      Default: amd64
  -clv|--crc-libvirt-version <version>
      The version of the crc libvirt bundle to use.
      If one does not exist in the bin directory, it will be downloaded there.
      Default: ${DEFAULT_CRC_LIBVIRT_DOWNLOAD_VERSION}
  -ccpus|--crc-cpus <num CPUs>
      Number of virtual CPUs to assign to the VM.
      Default: ${DEFAULT_CRC_CPUS}
      Used only for the 'start' command.
  -cmem|--crc-memory <memory size>
      Amount of memory (in GB) to assign to the VM.
      Default: ${DEFAULT_CRC_MEMORY}
      Used only for the 'start' command.
  -cp|--crc-platform <platform>
      The platform indicator to determine what crc binary to download.
      Default: linux (darwin if Mac is detected)
  -cv|--crc-version <version>
      The version of the crc binary to use.
      If one does not exist in the bin directory, it will be downloaded there.
      Default: ${DEFAULT_CRC_DOWNLOAD_VERSION}
  -cvdisk|--crc-virtual-disk-size <disk size>
      The size of the virtual disk (in GB) to assign to the VM.
      Default: ${DEFAULT_CRC_VIRTUAL_DISK_SIZE}
      Used only for the 'start' command.
  -db|--download-bundle (true|false)
      If true, the OpenShift bundle image will be downloaded by this script if needed.
      You usually do not need to set this to true - crc itself will download the bundle if it is needed.
      Default: ${DEFAULT_DOWNLOAD_BUNDLE}
      Used only for the 'start' command.
  -ecm|--enable-cluster-monitoring (true|false)
      If true, the cluster will have monitoring enabled.
      Default: ${DEFAULT_ENABLE_CLUSTER_MONITORING}
      Used only for the 'start' command.
  -h|--help : this message
  -p|--pull-secret-file <filename>
      Specifies the file containing your Image pull secret.
      You can download it from https://cloud.redhat.com/openshift/install/metal/user-provisioned
      CRC will ignore this if the pull secret was already installed during a previous start.
      Used only for the 'start' command.
      Default: not set (you will be prompted for the pull secret json at startup if it does not exist yet)
  -v|--verbose
      Enable logging of debug messages from this script.

The command must be one of:

  * start: Starts the CRC VM with OpenShift 4.x.
  * stop: Stops the CRC VM retaining all data. 'start' will then bring up the CRC VM in the same state.
  * delete: Stops the CRC VM and removes all persistent data. 'start' will then bring up a clean CRC VM.
  * cleanup: Just like delete but also further cleans up the CRC environment including the large downloaded bundles.
  * status: Information about the CRC VM and the OpenShift cluster running inside it.
  * ssh: Provides a command line prompt with root access inside the CRC VM. Logs in via ssh.
  * sshoc: Provides a command line prompt with root access inside the CRC VM. Logs in via oc debug.
  * routes: Outputs URLs for all known routes.
  * services: Outputs URLs for all known service endpoints (excluding internal openshift services).
  * expose: Creates firewalld rules so remote clients can access the cluster.
  * unexpose: Removes firewalld rules so remote clients cannot access the cluster.
  * changedomain: Changes the CRC cluster base domain name from 'crc.testing' to a unique 'nip.io' name.

HELPMSG
      exit 1
      ;;
    *)
      infomsg "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

########################################
# Environment setup section starts here.

#--------------------------------------------------------------
# Variables below have values that can be overridden by
# command line options (see above) or by environment variables.
#--------------------------------------------------------------

# if sed is gnu-sed then set option to work in posix mode to be compatible with non-gnu-sed versions
if sed --posix 's/ / /' < /dev/null > /dev/null 2>&1 ; then
  SEDOPTIONS="--posix"
fi

# This is where you want the OpenShift binaries to go
OPENSHIFT_BIN_PATH="${OPENSHIFT_BIN_PATH:=${HOME}/bin}"

# The platform is either "linux" or "darwin".
DEFAULT_OS_PLATFORM=linux
DETECTED_OS_PLATFORM=`uname | tr '[:upper:]' '[:lower:]'`
if [ "${DETECTED_OS_PLATFORM}" = "linux" -o "${DETECTED_OS_PLATFORM}" = "darwin" ] ; then
  DEFAULT_OS_PLATFORM=${DETECTED_OS_PLATFORM}
  debug "The operating system has been detected as ${DEFAULT_OS_PLATFORM}"
fi
CRC_DOWNLOAD_VERSION="${CRC_DOWNLOAD_VERSION:-${DEFAULT_CRC_DOWNLOAD_VERSION}}"
CRC_DOWNLOAD_PLATFORM="${CRC_DOWNLOAD_PLATFORM:-${DEFAULT_OS_PLATFORM}}"
CRC_DOWNLOAD_ARCH="${CRC_DOWNLOAD_ARCH:-amd64}"
CRC_LIBVIRT_DOWNLOAD_VERSION="${CRC_LIBVIRT_DOWNLOAD_VERSION:-${DEFAULT_CRC_LIBVIRT_DOWNLOAD_VERSION}}"
CRC_ROOT_DIR="${HOME}/.crc"
CRC_KUBEADMIN_PASSWORD_FILE="${CRC_ROOT_DIR}/machines/crc/kubeadmin-password"
CRC_KUBECONFIG="${CRC_ROOT_DIR}/machines/crc/kubeconfig"
CRC_MACHINE_IMAGE="${CRC_ROOT_DIR}/machines/crc/crc"
CRC_OC_BIN="${CRC_ROOT_DIR}/bin/oc/oc"
DOWNLOAD_BUNDLE="${DOWNLOAD_BUNDLE:-${DEFAULT_DOWNLOAD_BUNDLE}}"
ENABLE_CLUSTER_MONITORING="${ENABLE_CLUSTER_MONITORING:-${DEFAULT_ENABLE_CLUSTER_MONITORING}}"

# VM configuration
CRC_CPUS=${CRC_CPUS:-${DEFAULT_CRC_CPUS}}
CRC_MEMORY=${CRC_MEMORY:-${DEFAULT_CRC_MEMORY}}
CRC_VIRTUAL_DISK_SIZE=${CRC_VIRTUAL_DISK_SIZE:-${DEFAULT_CRC_VIRTUAL_DISK_SIZE}}

#--------------------------------------------------------------
# Variables below have values derived from the variables above.
# These variables below are not meant for users to change.
#--------------------------------------------------------------

# Determine where to get the binaries and their full paths and how to execute them.

# To see versions of crc and openshift, go to either:
# * http://cdk-builds.usersys.redhat.com/builds/crc/releases
# * https://developers.redhat.com/content-gateway/rest/mirror/pub/openshift-v4/clients/crc
# Pick a version, and drill down into release-info.json - it will tell you what OpenShift it has inside, for example.

#CRC_DOWNLOAD_LOCATION="https://mirror.openshift.com/pub/openshift-v4/clients/crc/${CRC_DOWNLOAD_VERSION}/crc-${CRC_DOWNLOAD_PLATFORM}-${CRC_DOWNLOAD_ARCH}.tar.xz"
CRC_DOWNLOAD_LOCATION="https://developers.redhat.com/content-gateway/rest/mirror/pub/openshift-v4/clients/crc/${CRC_DOWNLOAD_VERSION}/crc-${CRC_DOWNLOAD_PLATFORM}-${CRC_DOWNLOAD_ARCH}.tar.xz"
CRC_DOWNLOAD_LOCATION_ALT="http://cdk-builds.usersys.redhat.com/builds/crc/releases/${CRC_DOWNLOAD_VERSION}/crc-${CRC_DOWNLOAD_PLATFORM}-${CRC_DOWNLOAD_ARCH}.tar.xz"
CRC_EXE_NAME=crc
CRC_EXE_PATH="${OPENSHIFT_BIN_PATH}/${CRC_EXE_NAME}"
CRC_COMMAND="${CRC_EXE_PATH}"
if [ "${_VERBOSE}" == "true" ]; then
  CRC_COMMAND="${CRC_COMMAND} --log-level debug"
fi

CRC_LIBVIRT_DOWNLOAD_LOCATION="https://mirror.openshift.com/pub/openshift-v4/clients/crc/bundles/openshift/${CRC_LIBVIRT_DOWNLOAD_VERSION}/crc_libvirt_${CRC_LIBVIRT_DOWNLOAD_VERSION}_${CRC_DOWNLOAD_ARCH}.crcbundle"
CRC_LIBVIRT_PATH="${OPENSHIFT_BIN_PATH}/crc_libvirt_${CRC_LIBVIRT_DOWNLOAD_VERSION}_${CRC_DOWNLOAD_ARCH}.crcbundle"

CRC_OC="${CRC_OC_BIN} --kubeconfig ${CRC_KUBECONFIG}"

# Environment setup section stops here.
########################################

debug "ENVIRONMENT:
  command=$_CMD
  CRC_COMMAND=$CRC_COMMAND
  CRC_CPUS=$CRC_CPUS
  CRC_DOWNLOAD_LOCATION=$CRC_DOWNLOAD_LOCATION
  CRC_DOWNLOAD_LOCATION_ALT=$CRC_DOWNLOAD_LOCATION_ALT
  CRC_DOWNLOAD_PLATFORM=$CRC_DOWNLOAD_PLATFORM
  CRC_DOWNLOAD_VERSION=$CRC_DOWNLOAD_VERSION
  CRC_EXE_NAME=$CRC_EXE_NAME
  CRC_EXE_PATH=$CRC_EXE_PATH
  CRC_KUBEADMIN_PASSWORD_FILE=$CRC_KUBEADMIN_PASSWORD_FILE
  CRC_KUBECONFIG=$CRC_KUBECONFIG
  CRC_LIBVIRT_DOWNLOAD_LOCATION=$CRC_LIBVIRT_DOWNLOAD_LOCATION
  CRC_LIBVIRT_DOWNLOAD_VERSION=$CRC_LIBVIRT_DOWNLOAD_VERSION
  CRC_LIBVIRT_PATH=$CRC_LIBVIRT_PATH
  CRC_MACHINE_IMAGE=$CRC_MACHINE_IMAGE
  CRC_MEMORY=$CRC_MEMORY
  CRC_OC=$CRC_OC
  CRC_ROOT_DIR=$CRC_ROOT_DIR
  CRC_VIRTUAL_DISK_SIZE=$CRC_VIRTUAL_DISK_SIZE
  ENABLE_CLUSTER_MONITORING=$ENABLE_CLUSTER_MONITORING
  OPENSHIFT_BIN_PATH=$OPENSHIFT_BIN_PATH
  "

# Fail fast if we don't even have the correct location where the oc client should be
if [ ! -d "${OPENSHIFT_BIN_PATH}" ]; then
  infomsg "ERROR: You must define OPENSHIFT_BIN_PATH to an existing location where you want the downloaded tools to be. It is currently set to: ${OPENSHIFT_BIN_PATH}"
  exit 1
fi

# Download the crc tool if we do not have it yet
if [ -f "${CRC_EXE_PATH}" ]; then
  _existingVersion=$(${CRC_EXE_PATH} version 2>/dev/null | head -n 1 | sed ${SEDOPTIONS} "s/^C.*: \([A-Za-z0-9.]*\)[A-Za-z0-9.-]*+[a-z0-9]*$/\1/")
  _crc_major_minor_patch_version="$(echo -n ${CRC_DOWNLOAD_VERSION} | sed -E 's/([0-9]+.[0-9]+.[0-9]+).*/\1/')"
  if [ "${_existingVersion}" != "${CRC_DOWNLOAD_VERSION}" -a "${_existingVersion}" != "${_crc_major_minor_patch_version}" ]; then
    infomsg "===== WARNING ====="
    infomsg "You already have the crc tool but it does not match the version you want."
    infomsg "Either delete your existing binary and let this script download another one,"
    infomsg "or change the version passed to this script to match the version of your crc tool."
    infomsg "crc is here: ${CRC_EXE_PATH}"
    infomsg "The version of the crc binary is: ${_existingVersion}"
    infomsg "You asked for version: ${CRC_DOWNLOAD_VERSION}"
    infomsg "===== WARNING ====="
    exit 1
  fi
else
  infomsg "Downloading crc binary to ${CRC_EXE_PATH}"

  get_downloader
  eval ${DOWNLOADER} "${CRC_EXE_PATH}.tar.xz" ${CRC_DOWNLOAD_LOCATION}
  if [ "$?" != "0" ]; then
    eval ${DOWNLOADER} "${CRC_EXE_PATH}.tar.xz" ${CRC_DOWNLOAD_LOCATION_ALT}
    if [ "$?" != "0" ]; then
      infomsg "===== WARNING ====="
      infomsg "Could not download the client binary for the version you want."
      infomsg "Make sure this is valid: ${CRC_DOWNLOAD_LOCATION}"
      infomsg "Or this is valid: ${CRC_DOWNLOAD_LOCATION_ALT}"
      infomsg "===== WARNING ====="
      rm "${CRC_EXE_PATH}.tar.xz"
      exit 1
    fi
  fi
  tar xvf "${CRC_EXE_PATH}.tar.xz" --wildcards -C "$(dirname ${CRC_EXE_PATH})" --strip 1 '*/crc'
  chmod +x ${CRC_EXE_PATH}
  rm "${CRC_EXE_PATH}.tar.xz"
fi

debug "crc command that will be used: ${CRC_COMMAND}"
debug "$(${CRC_COMMAND} version)"

# Download the crc libvirt image if we do not have it yet
if [ "${DOWNLOAD_BUNDLE}" == "true" ]; then
  CRC_BUNDLE_FILE="${CRC_LIBVIRT_PATH}"
  if [ -f "${CRC_LIBVIRT_PATH}" ]; then
    debug "crc libvirt bundle that will be used: ${CRC_LIBVIRT_PATH}"
  elif [ "$(stat -c '%s' ${CRC_EXE_PATH})" -gt "1000000000" ]; then
    debug "crc appears to have the bundle already included. It will be used: $(stat -c '%n (%s bytes)' ${CRC_EXE_PATH})"
    CRC_BUNDLE_FILE=""
  else
    infomsg "Downloading crc libvirt bundle to ${CRC_LIBVIRT_PATH}"

    get_downloader
    eval ${DOWNLOADER} "${CRC_LIBVIRT_PATH}" ${CRC_LIBVIRT_DOWNLOAD_LOCATION}
    if [ "$?" != "0" ]; then
      infomsg "===== WARNING ====="
      infomsg "Could not download the crc libvirt bundle."
      infomsg "Make sure this is valid: ${CRC_LIBVIRT_DOWNLOAD_LOCATION}"
      infomsg "===== WARNING ====="
      rm "${CRC_LIBVIRT_PATH}"
      exit 1
    fi
  fi
else
  CRC_BUNDLE_FILE=""
  infomsg "Was asked to not download the crc libvirt bundle"
fi

cd ${OPENSHIFT_BIN_PATH}

if [ "$_CMD" = "start" ]; then

  infomsg "Defining the CRC configuration..."
  if [ ! -z "${CRC_BUNDLE_FILE}" ]; then
    ${CRC_COMMAND} config set bundle ${CRC_BUNDLE_FILE}
  else
    ${CRC_COMMAND} config unset bundle
  fi
  ${CRC_COMMAND} config set consent-telemetry no
  ${CRC_COMMAND} config set cpus ${CRC_CPUS}
  ${CRC_COMMAND} config set disable-update-check true
  ${CRC_COMMAND} config set disk-size ${CRC_VIRTUAL_DISK_SIZE}
  ${CRC_COMMAND} config set enable-cluster-monitoring ${ENABLE_CLUSTER_MONITORING}
  ${CRC_COMMAND} config set kubeadmin-password kiali
  ${CRC_COMMAND} config set memory $(expr ${CRC_MEMORY} '*' 1024)
  if [ ! -z "${PULL_SECRET_FILE}" ]; then
    ${CRC_COMMAND} config set pull-secret-file ${PULL_SECRET_FILE}
  else
    ${CRC_COMMAND} config unset pull-secret-file
  fi

  # Unsure if we need these
  #${CRC_COMMAND} config set network-mode user
  #${CRC_COMMAND} config set host-network-access true

  infomsg "Setting up the requirements for the OpenShift cluster..."
  debug "${CRC_COMMAND} setup"
  ${CRC_COMMAND} setup

  if [ "$?" != "0" ]; then
    infomsg "ERROR: failed to setup the requirements for OpenShift."
    exit 1
  fi

  infomsg "Starting the OpenShift cluster..."
  debug "${CRC_COMMAND} start"
  ${CRC_COMMAND} start

  if [ "$?" != "0" ]; then
    infomsg "ERROR: failed to start the VM."
    exit 1
  fi

  ${CRC_OC} login -u kubeadmin -p $(cat ${CRC_KUBEADMIN_PASSWORD_FILE})

  # see https://docs.openshift.com/container-platform/4.8/authentication/identity_providers/configuring-htpasswd-identity-provider.html
  # we need to be admin in order to create the htpasswd oauth and users
  if which htpasswd; then
    infomsg "Creating user 'kiali'"
    ${CRC_OC} get secret -n openshift-config htpass-secret -o jsonpath={.data.htpasswd} | base64 -d | sed -e '$a\' > /tmp/crc.htpasswd.kiali && htpasswd -b /tmp/crc.htpasswd.kiali kiali kiali
    ${CRC_OC} patch secret -n openshift-config htpass-secret --patch '{"data": {"htpasswd": "'$(cat /tmp/crc.htpasswd.kiali | base64 -w 0)'" }}'
    rm /tmp/crc.htpasswd.kiali

    # Add cluster role to the kiali user once it that user is available
    for i in {1..20}
    do
      infomsg "Waiting for kiali user to be created before attempting to assign it cluster-admin role..."
      sleep 10
      if ${CRC_OC} login -u kiali -p kiali &>/dev/null; then
        infomsg "Will assign the cluster-admin role to the kiali user."
        ${CRC_OC} login -u kubeadmin -p $(cat ${CRC_KUBEADMIN_PASSWORD_FILE})
        ${CRC_OC} adm policy add-cluster-role-to-user cluster-admin kiali
        break
      fi
    done
  else
    infomsg "Not adding user 'kiali' because you do not have htpasswd installed - use the default users that come with CRC"
  fi

  # Make sure the image registry is exposed via the default route
  if [ "$(${CRC_OC} get config.imageregistry.operator.openshift.io/cluster -o jsonpath='{.spec.defaultRoute}')" != "true" ]; then
    infomsg "Manually patching image registry operator to expose the internal image registry"
    ${CRC_OC} patch config.imageregistry.operator.openshift.io/cluster --patch '{"spec":{"defaultRoute":true}}' --type=merge
  else
    debug "The image registry operator has exposed the internal image registry"
  fi

  # show the status message
  get_status

elif [ "$_CMD" = "stop" ]; then

  infomsg "Will shutdown the OpenShift cluster."
  ${CRC_COMMAND} stop

elif [ "$_CMD" = "delete" ]; then

  infomsg "Will delete the OpenShift cluster. This removes all persisted data but downloaded bundles remain."
  ${CRC_COMMAND} delete --force

elif [ "$_CMD" = "cleanup" ]; then

  infomsg "Will cleanup the CRC environment, including the large bundles that were downloaded."
  ${CRC_COMMAND} delete --clear-cache --force
  infomsg "Further cleaning up of the CRC environment"
  ${CRC_COMMAND} cleanup
  infomsg "If CRC is not cleaned up fully, execute: sudo virsh destroy crc && sudo virsh undefine crc"

elif [ "$_CMD" = "status" ]; then

  get_status

elif [ "$_CMD" = "ssh" ]; then

  infomsg "Logging into the CRC VM via ssh..."
  exec_ssh ""

elif [ "$_CMD" = "sshoc" ]; then

  infomsg "Logging into the CRC VM via oc debug..."
  ${CRC_OC} debug $(${CRC_OC} get nodes -o name)

elif [ "$_CMD" = "routes" ]; then

  print_all_route_urls

elif [ "$_CMD" = "services" ]; then

  print_all_service_endpoints

elif [ "$_CMD" = "expose" ]; then

  expose_cluster

elif [ "$_CMD" = "unexpose" ]; then

  unexpose_cluster

elif [ "$_CMD" = "changedomain" ]; then

  change_crc_domain_name

else
  infomsg "ERROR: Required command must be either: start, stop, delete, status, ssh, sshoc, routes, services, expose, unexpose, changedomain"
  exit 1
fi
