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

# FUNCTION: is_cluster_deployed - returns 'true' if the cluster is in the state of "deployed and ingress is healthy"
is_cluster_deployed() {
  local state="$(ibmcloud oc cluster get --cluster ${CLUSTER_NAME} --output json | jq -r '.lifecycle.masterState')"
  if [ "${state}" == "deployed" ]; then
    # Only try to get the ingress status after the cluster is online.
    local ingress_state="$(ibmcloud ks ingress status --cluster ${CLUSTER_NAME} --output json | jq -r '.status')"
    if [ "${ingress_state}" == "healthy" ]; then
      echo "true"
      return
    fi
  fi
  echo "false"
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
    local vpc_id="$(ibmcloud is vpc ${VPC_NAME} --output json | jq -r '.id')"
    infomsg "VPC: name=[${VPC_NAME}] id=[${vpc_id}]"
  fi

  # GATEWAY
  if ! (ibmcloud is public-gateway ${GATEWAY_NAME} &> /dev/null || ibmcloud is public-gateway-create ${GATEWAY_NAME} ${VPC_NAME} ${ZONE_NAME}) ; then
    errormsg "Failed to create public gateway [${GATEWAY_NAME}] in vpc/zone [${VPC_NAME}/${ZONE_NAME}]."
  else
    local gw_id="$(ibmcloud is public-gateway ${GATEWAY_NAME} --output json | jq -r '.id')"
    infomsg "Public Gateway: name=[${GATEWAY_NAME}] id=[${gw_id}]"
  fi

  # SUBNET
  if ! (ibmcloud is subnet ${SUBNET_NAME} &> /dev/null || ibmcloud is subnet-create ${SUBNET_NAME} ${VPC_NAME} --zone ${ZONE_NAME} --ipv4-address-count 256 --pgw ${GATEWAY_NAME}) ; then
    errormsg "Failed to create subnet [${SUBNET_NAME}] in vpc/zone [${VPC_NAME}/${ZONE_NAME}] on gateway [${GATEWAY_NAME}]."
  else
    local sn_id="$(ibmcloud is subnet ${SUBNET_NAME} --output json | jq -r '.id')"
    infomsg "Subnet: name=[${SUBNET_NAME}] id=[${sn_id}]"
  fi

  # CLOUD OBJECT STORAGE
  if ! (ibmcloud resource service-instance ${CLOUD_OBJECT_STORAGE_NAME} &> /dev/null || ibmcloud resource service-instance-create ${CLOUD_OBJECT_STORAGE_NAME} cloud-object-storage standard global -g Default) ; then
    errormsg "Failed to create cloud object storage resource [${CLOUD_OBJECT_STORAGE_NAME}]."
  else
    local cos_id="$(ibmcloud resource service-instance ${CLOUD_OBJECT_STORAGE_NAME} --output json | jq -r '.[0].id')"
    infomsg "Cloud Object Storage: name=[${CLOUD_OBJECT_STORAGE_NAME}] id=[${cos_id}]"
  fi

  # CLUSTER
  infomsg "COS ID: ${cos_id}"
  if ! ibmcloud oc cluster create vpc-gen2 --name ${CLUSTER_NAME} --zone ${ZONE_NAME} --version ${OPENSHIFT_VERSION} --flavor ${WORKER_FLAVOR} --workers ${WORKER_NODES} --vpc-id ${vpc_id} --subnet-id ${sn_id} --cos-instance ${cos_id} ; then
    errormsg "Failed to create OpenShift [${OPENSHIFT_VERSION}] cluster [${CLUSTER_NAME}] in zone [${ZONE_NAME}]."
  else
    local cluster_id="$(ibmcloud oc cluster get --cluster ${CLUSTER_NAME} --output json | jq -r '.id')"
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

  infomsg "Waiting for the cluster to completely go away"
  while ibmcloud oc cluster get --cluster ${CLUSTER_NAME} &> /dev/null ; do
    echo -n "."
    sleep 10
  done
  echo "Deleted."

  if ! ibmcloud resource service-instance-delete -f --recursive ${CLOUD_OBJECT_STORAGE_NAME} ; then
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
  infomsg "Ingress:"              && ibmcloud ks ingress status --cluster ${CLUSTER_NAME}
  [ "$(is_cluster_deployed)" == "true" ] && infomsg "Cluster is deployed" || infomsg "Cluster is NOT deployed!"
}

# FUNCTION: set_admin - Grants to the user full admin rights on the cluster.
set_admin() {
  infomsg "Adding you as a cluster admin user"
  ibmcloud oc cluster config --cluster ${CLUSTER_NAME} --admin
}

# FUNCTION: finish - Waits for the cluster to be deployed and then finishes the deployment.
finish() {
  infomsg "Waiting for the cluster to be fully deployed"
  while [ "$(is_cluster_deployed)" != "true" ]; do
    echo -n "."
    sleep 10
  done
  echo "Deployed."

  set_admin

  infomsg "The cluster is ready!"
}

# FUNCTION: create_apikey - Creates an API key and stores it in the file ./apikey.txt.
create_apikey() {
  local results="$(ibmcloud iam api-key-create -d "created by ibmcloud-openshift.sh script" ${APIKEY_NAME} --output json)"
  if [ "$?" != "0" ]; then
    errormsg "Failed to create the API Key"
  fi

  local outputfile="./apikey.txt"
  echo "${results}" | jq -r '.apikey' > ${outputfile}
  infomsg "API Key is stored in ${outputfile}. Protect that file. You can manage it further here: https://cloud.ibm.com/iam/apikeys"

  local masterurl="$(ibmcloud oc cluster get -c ${CLUSTER_NAME} --output json | jq -r '.masterURL')"
  infomsg "To use this key to log into OpenShift, run: oc login -u apikey -p \$(cat ${outputfile}) --server ${masterurl}"
}

DEFAULT_APIKEY_NAME="${USER}-apikey"
DEFAULT_NAME_PREFIX="${USER}"
DEFAULT_OPENSHIFT_VERSION="$(ibmcloud ks versions --show-version OpenShift -q | sort | tail -n1)"
DEFAULT_PLUGIN_INSTALL="true"
DEFAULT_PLUGIN_UPDATE="true"
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
    apikey) _CMD="apikey"; shift ;;
    admin)  _CMD="admin";  shift ;;

    # OPTIONS

    -an|--apikey-name)        APIKEY_NAME="$2";        shift;shift ;;
    -np|--name-prefix)        NAME_PREFIX="$2";        shift;shift ;;
    -ov|--openshift-version)  OPENSHIFT_VERSION="$2";  shift;shift ;;
    -pi|--plugin-install)     PLUGIN_INSTALL="$2";     shift;shift ;;
    -pu|--plugin-update)      PLUGIN_UPDATE="$2";      shift;shift ;;
    -r|--region)              REGION="$2";             shift;shift ;;
    -wf|--worker-flavor)      WORKER_FLAVOR="$2";      shift;shift ;;
    -wn|--worker-nodes)       WORKER_NODES="$2";       shift;shift ;;
    -zn|--zone-name)          ZONE_NAME="$2";          shift;shift ;;
    -h|--help )
      cat <<HELPMSG
$0 [option...] (create|delete|status|finish)
Valid options:
  -an|--apikey-name
      The name of the API Key that is created by the "apikey" command.
      This is only used for the "apikey" command.
      Default: ${DEFAULT_APIKEY_NAME}
  -np|--name-prefix
      All resources created will have names that start with this prefix.
      Typically you want this to be your username.
      Default: ${DEFAULT_NAME_PREFIX}
  -ov|--openshift-version
      The version of OpenShift to deploy. Must include at least the major.minor version.
      To see available versions, run: ibmcloud ks versions --show-version OpenShift
      Default: ${DEFAULT_OPENSHIFT_VERSION}
  -pi|--plugin-install
      When "true", the plugins will be installed. If the plugins are already installed, they are left as-is.
      If you want to update the plugins that are installed, see --plugin-update.
      If you know the plugins are already installed, you can set this to "false" to speed up the script a little bit.
      Default: ${DEFAULT_PLUGIN_INSTALL}
  -pu|--plugin-update
      When "true", the plugins will be updated. If the plugins are already up-to-date, they are left as-is.
      If the plugins are not yet installed, the script will abort - in this case, you must also use "--plugin-install true".
      If you know the plugins are already installed and up-to-date, you can set this to "false" to speed up the script a little bit.
      Default: ${DEFAULT_PLUGIN_UPDATE}
  -r|--region
      The region to target.
      To see available regions, run: ibmcloud regions
      Default: ${DEFAULT_REGION}
  -wf|--worker-flavor
      The flavor of the worker node which determines things such as the number of cores, amount of memory, network speed, etc.
      To see available flavors, run: ibmcloud ks flavors --zone <zone name>
      Default: ${DEFAULT_WORKER_FLAVOR}
  -wn|--worker-nodes
      The number of worker nodes per zone in the default worker pool. This must be set to at least 2.
      Default: ${DEFAULT_WORKER_NODES}
  -zn|--zone-name)
      The zone to use within the selected region.
      To see available zones, run: ibmcloud ks zone ls --provider vpc-gen2
      Default: Whatever --region is set to, appended with "-1" (e.g. "${DEFAULT_REGION}-1").

Commands:
   create: Create an OpenShift cluster and the resources it needs on IBM Cloud.
   delete: Delete the OpenShift cluster and its resources. You may need to run this multiple times to fully clean up everything.
   status: Get information on the OpenShift cluster and its resources, if they exist.
   finish: If you canceled this script while it was waiting for the OpenShift cluster to be fully deployed, you can run this
           command to finish up. This command will resume waiting for the cluster to be deployed and then complete the rest of the tasks.
   apikey: Creates an apikey.txt file in the current directory that contains a new IBM API key that you can use to log into the cluster.
           For more details on this, see: https://cloud.ibm.com/docs/openshift?topic=openshift-access_cluster#access_api_key
           You can view the API keys you have created, and you can delete the keys, from here: https://cloud.ibm.com/iam/apikeys
   admin:  Configures the current user invoking the command to be granted admin rights on the cluster.
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
: ${APIKEY_NAME:=${DEFAULT_APIKEY_NAME}}
: ${NAME_PREFIX:=${DEFAULT_NAME_PREFIX}}
: ${OPENSHIFT_VERSION:=${DEFAULT_OPENSHIFT_VERSION}}
: ${PLUGIN_INSTALL:=${DEFAULT_PLUGIN_INSTALL}}
: ${PLUGIN_UPDATE:=${DEFAULT_PLUGIN_UPDATE}}
: ${REGION:=${DEFAULT_REGION}}
: ${WORKER_FLAVOR:=${DEFAULT_WORKER_FLAVOR}}
: ${WORKER_NODES:=${DEFAULT_WORKER_NODES}}

CLOUD_OBJECT_STORAGE_NAME="${NAME_PREFIX}-cos"
CLUSTER_NAME="${NAME_PREFIX}-cluster"
GATEWAY_NAME="${NAME_PREFIX}-gw"
SUBNET_NAME="${NAME_PREFIX}-sn"
VPC_NAME="${NAME_PREFIX}-vpc"
ZONE_NAME="${ZONE_NAME:-${REGION}-1}"

# Dump config
infomsg "==START CONFIG=="
cat<<EOM
command=$_CMD
APIKEY_NAME=$APIKEY_NAME
NAME_PREFIX=$NAME_PREFIX
OPENSHIFT_VERSION=$OPENSHIFT_VERSION
PLUGIN_INSTALL=$PLUGIN_INSTALL
PLUGIN_UPDATE=$PLUGIN_UPDATE
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
plugins_list="ks container-service container-registry observe-service infrastructure-service kubernetes-service"
if [ "${PLUGIN_INSTALL}" == "true" ]; then
  for p in $plugins_list; do
    if ibmcloud plugin show ${p} &> /dev/null; then
      infomsg "Plugin [${p}] already installed"
    else
      if ! ibmcloud plugin install ${p} ; then
        errormsg "Plugin [${p}] failed to install"
      fi
    fi
  done
fi

# Make sure the plugins are all updated
if [ "${PLUGIN_UPDATE}" == "true" ]; then
  for p in $plugins_list; do
    if ibmcloud plugin update -f ${p} &> /dev/null; then
      infomsg "Plugin [${p}] updated"
    else
      errormsg "Plugin [${p}] failed to update"
    fi
  done
fi

# Execute command

if [ "$_CMD" = "create" ]; then
  create
elif [ "$_CMD" = "delete" ]; then
  delete
elif [ "$_CMD" = "status" ]; then
  status
elif [ "$_CMD" = "finish" ]; then
  finish
elif [ "$_CMD" = "apikey" ]; then
  create_apikey
elif [ "$_CMD" = "admin" ]; then
  set_admin
else
  errormsg "Invalid command."
fi

