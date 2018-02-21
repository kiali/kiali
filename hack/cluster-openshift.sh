#!/bin/sh

##############################################################################
# cluster-openshift.sh
#
# Run this script to start/stop OpenShift via the "oc cluster" command.
#
# This script takes one argument whose value is one of the following:
#       up: starts the OpenShift environment
#     down: stops the OpenShift environment
#   status: outputs the current status of the OpenShift environment
##############################################################################

# Change to the directory where this script is and set our env
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./env-openshift.sh

echo Will use OpenShift that is located here: ${OPENSHIFT_BINARY_DIR}
echo Will use oc that is located here: ${OPENSHIFT_EXE_OC}
cd ${OPENSHIFT_BINARY_DIR}

if [ "$1" = "up" ];then

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

  echo Will start the OpenShift cluster at ${OPENSHIFT_IP_ADDRESS}
  ${OPENSHIFT_EXE_OC} cluster up ${OPENSHIFT_VERSION_ARG} --public-hostname=${OPENSHIFT_IP_ADDRESS}

  echo 'Do you want the admin user to be assigned the cluster-admin role?'
  echo 'NOTE: This could expose your machine to root access!'
  echo 'Select "1" for Yes and "2" for No:'
  select yn in "Yes" "No"; do
    case $yn in
      Yes )
        echo Will assign the cluster-admin role to the admin user.
        ${OPENSHIFT_EXE_OC} login -u system:admin
        ${OPENSHIFT_EXE_OC} adm policy add-cluster-role-to-user cluster-admin admin
        break;;
      No )
        echo Admin user will not be assigned the cluster-admin role.
        break;;
    esac
  done

elif [ "$1" = "down" ];then

  echo Will shutdown the OpenShift cluster
  ${OPENSHIFT_EXE_OC} cluster down
  mount | grep "openshift.local.volumes" | awk '{ print $3}' | xargs -l -r sudo umount
  sudo rm -rf /var/lib/origin/* && sudo rmdir /var/lib/origin

elif [ "$1" = "status" ];then

  ${OPENSHIFT_EXE_OC} version
  ${OPENSHIFT_EXE_OC} login
  ${OPENSHIFT_EXE_OC} cluster status

else
  echo 'Required argument must be either: up, down, or status'
  exit 1
fi
