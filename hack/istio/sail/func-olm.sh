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
      infomsg "OLM is already installed."
      return
  fi

  get_olm_version_we_want
  local olm_download_url="https://github.com/operator-framework/operator-lifecycle-manager/releases/download/${OLM_VERSION}/install.sh"
  infomsg "Will install OLM now. Downloading installer from: ${olm_download_url}"

  # Download the OLM install script with retry logic (2 hours, 60 seconds between retries)
  infomsg "Downloading OLM install script..."
  for i in {1..120}; do
    local olm_install_script=""
    infomsg "Attempt $i/120: Downloading OLM install script from GitHub..."

    # Try to download the OLM install script
    olm_install_script=$(curl -sL ${olm_download_url} 2>/dev/null)
    local curl_exit_code=$?

    # Check if curl succeeded
    if [ $curl_exit_code -ne 0 ]; then
      if [ $i -lt 120 ]; then
        infomsg "Retry $i/120: curl command failed with exit code [$curl_exit_code], retrying in 60 seconds..."
        sleep 60
      fi
      continue
    fi

    # Check if we got a non-empty response
    if [ -z "$olm_install_script" ]; then
      if [ $i -lt 120 ]; then
        infomsg "Retry $i/120: curl returned empty response, retrying in 60 seconds..."
        sleep 60
      fi
      continue
    fi

    # Check if the response looks like a valid shell script (basic check)
    if ! echo "$olm_install_script" | grep -q '#!/bin/bash\|#!/bin/sh\|bash\|kubectl'; then
      if [ $i -lt 120 ]; then
        infomsg "Retry $i/120: downloaded content does not appear to be a valid shell script, retrying in 60 seconds..."
        sleep 60
      fi
      continue
    fi

    # If we got here, everything worked
    infomsg "Successfully downloaded OLM install script from GitHub"
    break
  done

  # Final check - if we still don't have the script after all retries, fail
  if [ -z "${olm_install_script:-}" ]; then
    errormsg "Failed to download OLM install script from GitHub after 120 attempts over 2 hours."
    exit 1
  fi

  # Write the downloaded script to a temporary file
  echo "$olm_install_script" > /tmp/olm-install-script.sh
  chmod +x /tmp/olm-install-script.sh

  # Run the OLM install script with PATH set so it picks up our kubectl executable.
  if ! PATH="$(dirname "$OC"):$PATH" /tmp/olm-install-script.sh "${OLM_VERSION}"; then
    errormsg "ERROR: Failed to install OLM"
    rm -f /tmp/olm-install-script.sh
    exit 1
  else
    infomsg "OLM [${OLM_VERSION}] is installed."
    rm -f /tmp/olm-install-script.sh
  fi
}

get_olm_version_we_want() {
  if [ "${OLM_VERSION}" != "latest" ]; then
    # the env var already tells us the version we want
    return
  fi

  # Try for 2 hours (120 attempts * 60 seconds)
  local curl_output=""
  OLM_VERSION=""
  for i in {1..120}; do
    infomsg "Attempt $i/120: Attempting to get the latest OLM version from GitHub..."

    # Try to get the releases from GitHub
    curl_output=$(curl -s https://api.github.com/repos/operator-framework/operator-lifecycle-manager/releases 2>/dev/null)
    local curl_exit_code=$?

    # Check if curl succeeded
    if [ $curl_exit_code -ne 0 ]; then
      if [ $i -lt 120 ]; then
        infomsg "Retry $i/120: curl command failed with exit code [$curl_exit_code], retrying in 60 seconds..."
        sleep 60
      fi
      continue
    fi

    # Check if we got a non-empty response
    if [ -z "$curl_output" ]; then
      if [ $i -lt 120 ]; then
        infomsg "Retry $i/120: curl returned empty response, retrying in 60 seconds..."
        sleep 60
      fi
      continue
    fi

    # Check if the response looks like valid JSON (basic check)
    if ! echo "$curl_output" | grep -q '"tag_name"'; then
      if [ $i -lt 120 ]; then
        infomsg "Retry $i/120: curl response does not contain expected JSON structure, retrying in 60 seconds..."
        sleep 60
      fi
      continue
    fi

    # Try to extract the OLM version
    local OLM_VERSION_TEMP="$(echo "$curl_output" | grep "tag_name" | sed -e 's/.*://' -e 's/ *"//' -e 's/",//' | grep -v "snapshot" | sort -t "." -k 1.2g,1 -k 2g,2 -k 3g | tail -n 1)"

    # Check if version extraction succeeded
    if [ -z "${OLM_VERSION_TEMP}" ]; then
      if [ $i -lt 120 ]; then
        infomsg "Retry $i/120: failed to extract latest OLM version from GitHub response, retrying in 60 seconds..."
        sleep 60
      fi
      continue
    fi

    # If we got here, everything worked
    OLM_VERSION="${OLM_VERSION_TEMP}"
    infomsg "Successfully obtained latest OLM version from GitHub: ${OLM_VERSION}"
    break
  done

  # Final check - if we still don't have a version after all retries, fail
  if [ -z "${OLM_VERSION:-}" ]; then
    errormsg "Failed to obtain the latest OLM version from GitHub after 120 attempts over 2 hours. You will need to specify an explicit version via OLM_VERSION environment variable."
    exit 1
  else
    infomsg "GitHub reports the latest OLM version is: ${OLM_VERSION}"
  fi
}
