#!/bin/bash
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -d|--datadir)
      DATA_DIR="$2"
      shift;shift
      ;;
    -ib|--install-bookinfo)
      INSTALL_BOOKINFO="$2"
      shift;shift
      ;;
    -ism|--install-service-mesh)
      INSTALL_SERVICEMESH="$2"
      shift;shift
      ;;
    -iui|--install-upstream-istio)
      INSTALL_UPSTREAM_ISTIO="$2"
      shift;shift
      ;;
    -uip|--upstream-istio-profile)
      UPSTREAM_ISTIO_PROFILE="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG

$0 [option...] command

-d|--datadir:                  Where installation files are placed.
                               You must put your OpenShift pull secret in here
                               under the name "pull-secret.txt".
                               default "${HOME}/openshift"
-ib|--install-bookinfo:        If true, the Bookinfo demo will be installed. default "false"
-ism|--install-service-mesh:   If true, Service Mesh will be installed. default "false"
-iui|--install-upstream-istio  If true, upstream Istio will be installed. default "false"
-uip|--upstream-istio-profile: If upstream Istio will be installed, this is the profile used. default "default"
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown option: [$key]. Aborting."
      exit 1
      ;;
  esac
done

INSTALL_SERVICEMESH="${INSTALL_SERVICEMESH:-false}"
INSTALL_UPSTREAM_ISTIO="${INSTALL_UPSTREAM_ISTIO:-false}"
UPSTREAM_ISTIO_PROFILE="${UPSTREAM_ISTIO_PROFILE:-default}"
INSTALL_BOOKINFO="${INSTALL_BOOKINFO:-false}"
DATA_DIR="${DATA_DIR:-${HOME}/openshift}"

echo "===== SETTINGS ====="
echo INSTALL_SERVICEMESH="${INSTALL_SERVICEMESH}"
echo INSTALL_UPSTREAM_ISTIO="${INSTALL_UPSTREAM_ISTIO}"
echo UPSTREAM_ISTIO_PROFILE="${UPSTREAM_ISTIO_PROFILE}"
echo INSTALL_BOOKINFO="${INSTALL_BOOKINFO}"
echo DATA_DIR="${DATA_DIR}"

if [ "${INSTALL_SERVICEMESH}" == "true" -a "${INSTALL_UPSTREAM_ISTIO}" == "true" ]; then
  echo "You can only install one but not both of service mesh or Upstream istio"
  exit 1
fi


# Make sure a pull secret exists
pull_secret_file="${DATA_DIR}/pull-secret.txt"
if [ ! -f "${pull_secret_file}" ]; then
  echo "The pull secret does not exist. Please store the pull secret here: ${pull_secret_file}"
  exit 1
fi

# If there is a public RSA key available, use it (this is useful to pull logs down on install failure)
id_rsa_pub_file="${HOME}/.ssh/id_rsa.pub"
if [ -f "${id_rsa_pub_file}" ]; then
  sk_argument="-sk ${id_rsa_pub_file}"
else
  echo "There is no public SSH key. This is not required; we simply will not provide the installer with one. If you want to be able to pull logs down in order to debug installer failures, then create an SSH key and make sure this file exists: ${id_rsa_pub_file}."
  sk_argument=""
fi

# unset this to avoid some problems with the installer
unset SSH_AUTH_SOCK

# Where this script is - all our hack files are assumed to be in here
script_root="$( cd "$(dirname "$0")" ; pwd -P )"
hack_dir="$script_root"

# Destroy any existing cluster
time ${hack_dir}/aws-openshift.sh -v destroy

rm -rf ${DATA_DIR}/*/install_dir

# Create a new cluster
time ${hack_dir}/aws-openshift.sh create -v -kuca true -p ${pull_secret_file} ${sk_argument}

if [ "$?" != "0" ]; then
  echo "Failed to start AWS cluster!"
  exit 1
fi

# Login via the correct oc client - retry until the cluster is up and accepting login requests
echo "Prepare AWS oc environment"
n=0
until [ $n -ge 10 ]; do
  eval $(${hack_dir}/aws-openshift.sh oc-env) && break
  echo "Warning: AWS environment not yet ready"
  n=$[$n+1]
  sleep 5
done
echo "Log into AWS cluster"
n=0
until [ $n -ge 10 ]; do
  oc login -u kiali -p kiali https://$(${hack_dir}/aws-openshift.sh api-host) && break
  echo "Warning: AWS login failed"
  n=$[$n+1]
  sleep 5
done

if [ "${INSTALL_SERVICEMESH}" == "true" ]; then
  echo "Installing Service Mesh"

  # Install Service Mesh
  ${hack_dir}/istio/install-sm11.sh sm-install

  # Install Bookinfo
  if [ "${INSTALL_BOOKINFO}" == "true" ]; then
    ${hack_dir}/istio/install-sm11.sh bi-install
  fi

  echo "AWS and Maistra installation done."
  exit 0
fi

if [ "${INSTALL_UPSTREAM_ISTIO}" == "true" ]; then
  echo "Installing Upstream Istio"

  # Install Istio
  ${hack_dir}/istio/install-istio-via-istioctl.sh -cp ${UPSTREAM_ISTIO_PROFILE}

  # Install Bookinfo
  if [ "${INSTALL_BOOKINFO}" == "true" ]; then
    ${hack_dir}/istio/install-bookinfo-demo.sh --mongo -tg -c oc
  fi

  echo "AWS and Upstream Istio installation done."
  exit 0
fi

echo "AWS installation done."
exit 0
