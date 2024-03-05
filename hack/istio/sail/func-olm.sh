#!/bin/bash

##########################################################
#
# Functions used to install OLM into a
# non-OpenShift cluster.
#
##########################################################

set -u

# In case we need to install a specific one, we can set it here.
OLM_VERSION="${OLM_VERSION:-latest}"

install_olm() {
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    # OpenShift already has OLM installed, nothing to do
    return
  elif ${OC} get deployment olm-operator -n olm > /dev/null 2>&1; then
      echo "OLM is already installed."
      return
  fi

  get_olm_version_we_want
  local olm_download_url="https://github.com/operator-framework/operator-lifecycle-manager/releases/download/${OLM_VERSION}/install.sh"

  if ! curl -sL ${olm_download_url} > /tmp/olm-install-script.sh; then
    echo "ERROR: Unable to download the OLM install script from GitHub"
    exit 1
  else
    chmod +x /tmp/olm-install-script.sh
  fi

  # force the OLM install script to go through our client executable when it executes kubectl commands
  kubectl() {
    ${OC} "$@"
  }
  export OC
  export -f kubectl

  # TODO: sometimes this crashes with segfault when running v0.27 of the OLM install script. Not sure why
  if ! /tmp/olm-install-script.sh "${OLM_VERSION}"; then
    echo "ERROR: Failed to install OLM"
    unset -f kubectl
    rm -f /tmp/olm-install-script.sh
    exit 1
  else
    echo "OLM [${OLM_VERSION}] is installed."
    unset -f kubectl
    rm -f /tmp/olm-install-script.sh
  fi
}

get_olm_version_we_want() {
  if [ "${OLM_VERSION}" != "latest" ]; then
    # the env var already tells us the version we want
    return
  fi
  OLM_VERSION="$(curl -s https://api.github.com/repos/operator-framework/operator-lifecycle-manager/releases 2> /dev/null | grep "tag_name" | sed -e 's/.*://' -e 's/ *"//' -e 's/",//' | grep -v "snapshot" | sort -t "." -k 1.2g,1 -k 2g,2 -k 3g | tail -n 1)"
	if [ -z "${OLM_VERSION}" ]; then
	  echo "Failed to obtain the latest OLM version from GitHub. You will need to specify an explicit version via OLM_VERSION environment variable."
	  exit 1
  else
	  echo "GitHub reports the latest OLM version is: ${OLM_VERSION}"
	fi
}
