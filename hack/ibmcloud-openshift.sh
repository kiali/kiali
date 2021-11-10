#!/bin/bash

##############################################################################
# ibmcloud-openshift.sh
#
# Will assist in deploying an OpenShift cluster to the IBM Cloud.
#
# Pass --help for usage information.
#
##############################################################################

set -u

errormsg() {
  echo -e "\U0001F6A8 ERROR: ${1}"
  exit 1
}

infomsg() {
  echo -e "\U0001F4C4 ${1}"
}

# FUNCTION: get_id - Extract the ID from the output of the given command
get_id() {
  local cmd="${1} | grep -E '^ID:?' | sed -E 's/^ID[:]? +(.+)/\1/'"
  echo $(eval ${cmd})
}

# FUNCTION: is_cluster_deployed - returns 'true' if the cluster is in the state of "deployed"
is_cluster_deployed() {
  local state="$(ibmcloud oc cluster get --cluster ${CLUSTER_NAME} | awk '/^Master/,/^State:/' | grep -E '^State:' |  sed -E 's/^State: +(.+)/\1/' | cut -d ' ' -f1)"
  [ "${state}" == "deployed" ] && echo "true" || echo "false"
}

# FUNCTION: create - Creates the main resources if they do not yet exist
create() {
  if ibmcloud oc cluster get --cluster ${CLUSTER_NAME} &> /dev/null ; then
    errormsg "A cluster [${CLUSTER_NAME}] already exists. Aborting."
  fi

  # VPC
  if ! (ibmcloud is vpc ${VPC_NAME} &> /dev/null || ibmcloud is vpc-create ${VPC_NAME}) ; then
    errormsg "Failed to create the VPC [${VPC_NAME}]."
  else
    local vpc_id=$(get_id "ibmcloud is vpc ${VPC_NAME}")
    infomsg "VPC: name=[${VPC_NAME}] id=[${vpc_id}]"
  fi

  # GATEWAY
  if ! (ibmcloud is public-gateway ${GATEWAY_NAME} &> /dev/null || ibmcloud is public-gateway-create ${GATEWAY_NAME} ${VPC_NAME} ${ZONE_NAME}) ; then
    errormsg "Failed to create public gateway [${GATEWAY_NAME}] in vpc/zone [${VPC_NAME}/${ZONE_NAME}]."
  else
    local gw_id=$(get_id "ibmcloud is public-gateway ${GATEWAY_NAME}")
    infomsg "Public Gateway: name=[${GATEWAY_NAME}] id=[${gw_id}]"
  fi

  # SUBNET
  if ! (ibmcloud is subnet ${SUBNET_NAME} &> /dev/null || ibmcloud is subnet-create ${SUBNET_NAME} ${VPC_NAME} --zone ${ZONE_NAME} --ipv4-address-count 256 --pgw ${GATEWAY_NAME}) ; then
    errormsg "Failed to create subnet [${SUBNET_NAME}] in vpc/zone [${VPC_NAME}/${ZONE_NAME}] on gateway [${GATEWAY_NAME}]."
  else
    local sn_id=$(get_id "ibmcloud is subnet ${SUBNET_NAME}")
    infomsg "Subnet: name=[${SUBNET_NAME}] id=[${sn_id}]"
  fi

  # CLOUD OBJECT STORAGE
  if ! (ibmcloud resource service-instance ${CLOUD_OBJECT_STORAGE_NAME} &> /dev/null || ibmcloud resource service-instance-create ${CLOUD_OBJECT_STORAGE_NAME} cloud-object-storage standard global -g Default) ; then
    errormsg "Failed to create cloud object storage resource [${CLOUD_OBJECT_STORAGE_NAME}]."
  else
    local cos_id=$(get_id "ibmcloud resource service-instance ${CLOUD_OBJECT_STORAGE_NAME}")
    infomsg "Cloud Object Storage: name=[${CLOUD_OBJECT_STORAGE_NAME}] id=[${cos_id}]"
  fi

  # CLUSTER
  if ! ibmcloud oc cluster create vpc-gen2 --name ${CLUSTER_NAME} --zone ${ZONE_NAME} --version ${OPENSHIFT_VERSION} --flavor ${WORKER_FLAVOR} --workers ${WORKER_NODES} --vpc-id ${vpc_id} --subnet-id ${sn_id} --cos-instance ${cos_id} ; then
    errormsg "Failed to create OpenShift [${OPENSHIFT_VERSION}] cluster [${CLUSTER_NAME}] in zone [${ZONE_NAME}]."
  else
    local cluster_id=$(get_id "ibmcloud oc cluster get --cluster ${CLUSTER_NAME}")
    infomsg "Cluster: name=[${CLUSTER_NAME}] id=[${cluster_id}]"
  fi

  # Wait for the cluster to come up (will take a long time) and then finish the deployment
  finish
}

# FUNCTION: delete - Removes the main resources
delete() {
  if ! ibmcloud oc cluster rm --cluster ${CLUSTER_NAME} -f --force-delete-storage ; then
    infomsg "Failed to delete cluster [${CLUSTER_NAME}] ... will keep going."
  fi

  if ! ibmcloud resource service-instance-delete -f ${CLOUD_OBJECT_STORAGE_NAME} ; then
    infomsg "Failed to delete cloud object storage [${CLOUD_OBJECT_STORAGE_NAME}] ... will keep going."
  fi

  if ! ibmcloud is subnet-delete -f ${SUBNET_NAME} ; then
    infomsg "Failed to delete subnet [${SUBNET_NAME}] ... will keep going."
  fi

  if ! ibmcloud is public-gateway-delete -f ${GATEWAY_NAME} ; then
    infomsg "Failed to delete public gateway [${GATEWAY_NAME}] ... will keep going."
  fi

  if ! ibmcloud is vpc-delete -f ${VPC_NAME} ; then
    infomsg "Failed to delete the VPC [${VPC_NAME}] ... will keep going."
  fi
}

# FUNCTION: status - Retrieves information about resources that are expected to exist when a cluster is running.
status() {
  infomsg "VPC:"                  && ibmcloud is vpc ${VPC_NAME}
  infomsg "Gateway:"              && ibmcloud is public-gateway ${GATEWAY_NAME}
  infomsg "Subnet:"               && ibmcloud is subnet ${SUBNET_NAME}
  infomsg "Cloud Object Storage:" && ibmcloud resource service-instance ${CLOUD_OBJECT_STORAGE_NAME}
  infomsg "Cluster:"              && ibmcloud oc cluster get --cluster ${CLUSTER_NAME}
  [ "$(is_cluster_deployed)" == "true" ] && infomsg "Cluster is deployed" || infomsg "Cluster is NOT deployed!"
}

# FUNCTION: finish - Waits for the cluster to be deployed and then finishes the deployment.
finish() {
  infomsg "Waiting for the cluster to be fully deployed"
  while [ "$(is_cluster_deployed)" != "true" ]; do
    echo -n "."
    sleep 10
  done

  infomsg "Adding you as a cluster admin user"
  ibmcloud oc cluster config --cluster ${CLUSTER_NAME} --admin

  infomsg "The cluster is ready!"
}

DEFAULT_NAME_PREFIX="${USER}"
DEFAULT_OPENSHIFT_VERSION="4.7_openshift"
DEFAULT_REGION="us-east"
DEFAULT_WORKER_NODES="3"
DEFAULT_WORKER_FLAVOR="bx2.8x32"

_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in

    # COMMANDS
    create) _CMD="create"; shift ;;
    delete) _CMD="delete"; shift ;;
    status) _CMD="status"; shift ;;
    finish) _CMD="finish"; shift ;;

    # OPTIONS

    -np|--name-prefix)        NAME_PREFIX="$2";        shift;shift ;;
    -ov|--openshift-version)  OPENSHIFT_VERSION="$2";  shift;shift ;;
    -r|--region)              REGION="$2";             shift;shift ;;
    -wf|--worker-flavor)      WORKER_FLAVOR="$2";      shift;shift ;;
    -wn|--worker-nodes)       WORKER_NODES="$2";       shift;shift ;;
    -h|--help )
      cat <<HELPMSG
$0 [option...] (create|delete|status|finish)
Valid options:
  -np|--name-prefix
      All resources created will have names that start with this prefix.
      Typically you want this to be your username.
      Default: ${DEFAULT_NAME_PREFIX}
  -ov|--openshift-version
      The version of OpenShift to deploy. Must include at least the major.minor version.
      To see available versions, run: ibmcloud ks versions --show-version OpenShift
      Default: ${DEFAULT_OPENSHIFT_VERSION}
  -r|--region
      The region to target. Should be one of: https://cloud.ibm.com/docs/openwhisk?topic=openwhisk-cloudfunctions_regions
      Default: ${DEFAULT_REGION}
  -wf|--worker-flavor
      The flavor of the worker node which determines things such as the number of cores, amount of memory, network speed, etc.
      To see available flavors, run: ibmcloud ks flavors --zone <zone name>
      Default: ${DEFAULT_WORKER_FLAVOR}
  -wn|--worker-nodes
      The number of worker nodes per zone in the default worker pool. This must be set to at least 2.
      Default: ${DEFAULT_WORKER_NODES}
HELPMSG
      exit 1
      ;;
    *)
      errormsg "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

# Set the config
: ${NAME_PREFIX:=${DEFAULT_NAME_PREFIX}}
: ${OPENSHIFT_VERSION:=${DEFAULT_OPENSHIFT_VERSION}}
: ${REGION:=${DEFAULT_REGION}}
: ${WORKER_FLAVOR:=${DEFAULT_WORKER_FLAVOR}}
: ${WORKER_NODES:=${DEFAULT_WORKER_NODES}}

CLOUD_OBJECT_STORAGE_NAME="${NAME_PREFIX}-cos"
CLUSTER_NAME="${NAME_PREFIX}-cluster"
GATEWAY_NAME="${NAME_PREFIX}-gw"
SUBNET_NAME="${NAME_PREFIX}-sn"
VPC_NAME="${NAME_PREFIX}-vpc"
ZONE_NAME="${REGION}-1" # assume the -1 is the zone we want

# Dump config
infomsg "==START CONFIG=="
cat<<EOM
command=$_CMD
NAME_PREFIX=$NAME_PREFIX
OPENSHIFT_VERSION=$OPENSHIFT_VERSION
REGION=$REGION
CLOUD_OBJECT_STORAGE_NAME=$CLOUD_OBJECT_STORAGE_NAME
CLUSTER_NAME=$CLUSTER_NAME
GATEWAY_NAME=$GATEWAY_NAME
SUBNET_NAME=$SUBNET_NAME
VPC_NAME=$VPC_NAME
WORKER_FLAVOR=$WORKER_FLAVOR
WORKER_NODES=$WORKER_NODES
ZONE_NAME=$ZONE_NAME
EOM
infomsg "==END CONFIG=="

# Make sure ibmcloud client is available
if ! which ibmcloud &> /dev/null ; then
  errormsg "You do not have 'ibmcloud' in your PATH. Download it from https://github.com/IBM-Cloud/ibm-cloud-cli-release/releases/ and install it in your PATH."
else
  infomsg "$(ibmcloud version)"
fi

# Make sure we are logged in
if ! ibmcloud account show > /dev/null;  then
  infomsg "Will now attempt to perform SSO login. If you have another login mechanism, abort, log in yourself, and re-run this script."
  if ! ibmcloud login -r "${REGION}" --sso ; then
    errormsg "Failed to login. Cannot continue."
  fi
fi

# Target the region we want if not already targeting it
if ! ibmcloud target | grep -i "region:" | grep -q "${REGION}" ; then
  if ibmcloud target -r "${REGION}" > /dev/null;  then
    infomsg "Now targeting region [${REGION}]"
  else
    errormsg "Failed to target region [${REGION}]. Aborting."
  fi
else
  infomsg "Already targeting region [${REGION}]"
fi

# Make sure the necessary plugins are installed
plugins="container-service container-registry observe-service infrastructure-service"
for p in $plugins; do
  if ibmcloud plugin show ${p} &> /dev/null; then
    infomsg "Plugin [${p}] already installed"
  else
    if ! ibmcloud plugin install ${p} ; then
      errormsg "Plugin [${p}] failed to install"
    fi
  fi
done

# Make sure the plugins are all updated - including the kubernetes-service plugin
plugins="${plugins} kubernetes-service"
for p in $plugins; do
  if ibmcloud plugin update -f ${p} &> /dev/null; then
    infomsg "Plugin [${p}] updated"
  else
    errormsg "Plugin [${p}] failed to update"
  fi
done

# Execute command

if [ "$_CMD" = "create" ]; then
  create
elif [ "$_CMD" = "delete" ]; then
  delete
elif [ "$_CMD" = "status" ]; then
  status
elif [ "$_CMD" = "finish" ]; then
  finish
else
  errormsg "Invalid command."
fi

