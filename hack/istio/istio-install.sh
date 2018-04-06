#!/bin/sh

# Go to the main output directory
HACK_SCRIPT_DIR="$(cd $(dirname "${BASH_SOURCE[0]}") && pwd)"
OUTPUT_DIR="${HACK_SCRIPT_DIR}/../../_output"
mkdir -p $OUTPUT_DIR
cd $OUTPUT_DIR
OUTPUT_DIR="$(pwd)" # remove the .. references

# make sure Ansible is installed
which ansible-playbook > /dev/null 2>&1
if [ "$?" != 0 ]; then
  ANSIBLE_DIR="${OUTPUT_DIR}/ansible"
  ANSIBLE_ENV_SETUP_SCRIPT="${ANSIBLE_DIR}/hacking/env-setup"
  if [ ! -f ${ANSIBLE_ENV_SETUP_SCRIPT} ]; then
    echo "You do not have Ansible installed yet - attempting to install a local copy at $ANSIBLE_DIR"
    cd $OUTPUT_DIR && git clone git://github.com/ansible/ansible.git --recursive
    echo "Ansible has been downloaded here: ${ANSIBLE_DIR}"
    echo "Will now attempt to pip install required dependencies."
    pip2 install -r ${ANSIBLE_DIR}/requirements.txt > /dev/null 2>&1
    if [ "$?" != 0 ]; then
      echo "==========================================================="
      echo "Looks like some Python dependencies might not be installed."
      echo "If you get errors while trying to install and run Istio,"
      echo "run this command and then re-run this script:"
      echo "   sudo pip install -r ${ANSIBLE_DIR}/requirements.txt"
      echo "==========================================================="
    fi
  fi
  echo "Setting up environment to use the local installation of Ansible"
  source ${ANSIBLE_ENV_SETUP_SCRIPT}
  which ansible-playbook > /dev/null 2>&1
  if [ "$?" != 0 ]; then
    echo "Cannot install Ansible automatically. You need to install Ansible and put it in your PATH."
    exit 1
  fi
fi

set -e

# See if Istio source repository is git cloned already - if not, clone it now
if [ ! -d "./istio" ]; then
  git clone git://github.com/istio/istio.git
fi

# Go to the directory where the Istio Ansible Installer scripts are in the github source - must run them from here
cd ./istio/install/ansible
echo "Istio Ansible installer scripts are found here: $(pwd)"

# Now install Istio using the Istio Ansible Installer
ISTIO_INSTALL_DIR=$OUTPUT_DIR/istio-versions
echo "Installing Istio here: $ISTIO_INSTALL_DIR"
echo "You must have access to a running Kubernetes or Openshift cluster via kubectl or oc respectively."
echo "You must also be authenticated to the cluster."
echo "If installing on OpenShift, your cluster user must have the admin role."

# PASS COMMAND LINE ARGUMENTS OR EDIT THE ANSIBLE PLAYBOOK COMMAND ENVIRONMENT BELOW
# TO ALTER WHAT YOU WANT TO BE INSTALLED.

# defaults
RELEASE_TAG_NAME=""
CLUSTER_FLAVOUR="ocp"
DELETE_RESOURCES="true"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -v)
      RELEASE_TAG_NAME="$2"
      shift;shift
      ;;
    -c)
      CLUSTER_FLAVOUR="$2"
      shift;shift
      ;;
    -k)
      DELETE_RESOURCES="false"
      shift
      ;;
    -h)
      cat <<HELPMSG
Valid command line arguments:
  -v : Istio version to install, do not specify this for the latest version
  -c : Cluster type where istio is to be installed - valid values are "k8s" or "ocp" (the default)
  -k : Keep old Istio resources that might already exist. The default is to attempt to delete existing resources.
  -h : this message
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

ISTIO_INSTALLER_ENV=$(cat <<EOF
{
  "cluster_flavour": "$CLUSTER_FLAVOUR",
  "istio": {
    "release_tag_name": "$RELEASE_TAG_NAME",
    "delete_resources": $DELETE_RESOURCES,
    "dest": "$ISTIO_INSTALL_DIR",
    "addon": ["grafana","prometheus","jaeger","servicegraph"],
    "samples": ["bookinfo"]
  }
}
EOF
)

ansible-playbook main.yml --verbose -e ''"$ISTIO_INSTALLER_ENV"''

echo "Installed Istio here: $ISTIO_INSTALL_DIR"
