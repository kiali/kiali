#!/bin/sh

##############################################################################
# cluster-openshift.sh
#
# Run this script to start/stop OpenShift cluster with Istio.
#
# This script takes one argument whose value is one of the following:
#       up: starts the OpenShift environment
#     down: stops the OpenShift environment
#   status: outputs the current status of the OpenShift environment
##############################################################################

# Change to the directory where this script is and set our env
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./env-openshift.sh

# Fail fast if we don't even have the correct location where the oc client should be
if [ ! -d "${OPENSHIFT_BIN_PATH}" ]; then
  echo "You must define OPENSHIFT_BIN_PATH to an existing location where you want the oc client tool to be. It is currently set to: ${OPENSHIFT_BIN_PATH}"
  exit 1
fi

# Download the oc client if we do not have it yet
if [[ ! -x "${OPENSHIFT_OC_EXE_PATH}" ]]; then
  echo "Downloading binary to ${OPENSHIFT_OC_EXE_PATH}"
  wget -O ${OPENSHIFT_OC_EXE_PATH} ${OPENSHIFT_OC_DOWNLOAD_LOCATION}
  chmod +x ${OPENSHIFT_OC_EXE_PATH}
fi

echo "oc command that will be used: ${OPENSHIFT_OC_COMMAND}"
cd ${OPENSHIFT_BIN_PATH}

if [ "$1" = "up" ]; then

  # The OpenShift docs say to define docker with an insecure registry setting. This checks such a setting is enabled.
  pgrep -a dockerd | grep '[-]-insecure-registry' > /dev/null 2>&1
  if [ "$?" != "0" ]; then
    grep 'OPTIONS=.*--insecure-registry' /etc/sysconfig/docker > /dev/null 2>&1
    if [ "$?" != "0" ]; then
      grep 'insecure-registries' /etc/docker/daemon.json > /dev/null 2>&1
      if [ "$?" != "0" ]; then
        echo 'WARNING: You must run Docker with the --insecure-registry argument with an appropriate value (usually "--insecure-registry 172.30.0.0/16"). See the OpenShift Origin documentation for more details: https://github.com/openshift/origin/blob/master/docs/cluster_up_down.md#linux'
      else
        echo /etc/docker/daemon.json has the insecure-registry setting. This is good.
      fi
    else
      echo /etc/sysconfig/docker has defined the insecure-registry setting. This is good.
    fi
  else
    echo Docker daemon is running with --insecure-registry setting. This is good.
  fi

  # The OpenShift docs say to disable firewalld for now. Just in case it is running, stop it now.
  # If firewalld was running and is shutdown, it changes the iptable rules and screws up docker,
  # so we must restart docker in order for it to rebuild its iptable rules.
  sudo systemctl status firewalld > /dev/null 2>&1
  if [ "$?" == "0" ]; then
    echo Turning off firewalld as per OpenShift recommendation and then restarting docker to rebuild iptable rules
    sudo systemctl stop firewalld
    sudo systemctl restart docker.service
  fi

  echo Will start the OpenShift cluster with Istio at ${OPENSHIFT_IP_ADDRESS}
  ${OPENSHIFT_OC_COMMAND} cluster up --istio ${OPENSHIFT_VERSION_ARG} --public-hostname=${OPENSHIFT_IP_ADDRESS} ${OPENSHIFT_PERSISTENCE_ARGS}

  echo 'Do you want the admin user to be assigned the cluster-admin role?'
  echo 'NOTE: This could expose your machine to root access!'
  echo 'Select "1" for Yes and "2" for No:'
  select yn in "Yes" "No"; do
    case $yn in
      Yes )
        echo Will assign the cluster-admin role to the admin user.
        ${OPENSHIFT_OC_COMMAND} login -u system:admin
        ${OPENSHIFT_OC_COMMAND} adm policy add-cluster-role-to-user cluster-admin admin
        break;;
      No )
        echo Admin user will not be assigned the cluster-admin role.
        break;;
    esac
  done

elif [ "$1" = "down" ];then

  echo Will shutdown the OpenShift cluster
  ${OPENSHIFT_OC_COMMAND} cluster down
  mount | grep "openshift.local.volumes" | awk '{ print $3}' | xargs -l -r sudo umount
  # only purge these if we do not want persistence
  if [ "${OPENSHIFT_PERSISTENCE_ARGS}" == "" ]; then
    echo "Purging /var/lib/origin files"
    sudo rm -rf /var/lib/origin/* && sudo rmdir /var/lib/origin
  else
    echo "OpenShift has left your persisted data here: ${OPENSHIFT_PERSISTENCE_DIR}"
  fi

elif [ "$1" = "status" ];then

  ${OPENSHIFT_OC_COMMAND} version
  ${OPENSHIFT_OC_COMMAND} cluster status

else
  echo 'Required argument must be either: up, down, or status'
  exit 1
fi
