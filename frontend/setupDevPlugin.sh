#!/bin/bash

set -u

errormsg() {
  echo -e "\U0001F6A8 ERROR: ${1}"
}

infomsg() {
  echo -e "\U0001F4C4 ${1}"
}

# Determine where this script is and make it the cwd

DEFAULT_FRONTEND_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
DEFAULT_ENABLE_PLUGIN="true"

cd ${DEFAULT_FRONTEND_PATH}

PLUGIN_PATH="${DEFAULT_FRONTEND_PATH}/core"
KIALI_UI_PATH="${DEFAULT_FRONTEND_PATH}/kiali-ui"
KIALI_UI_REACT="${KIALI_UI_PATH}/node_modules/react"
KIALI_UI_REACT_DOM="${KIALI_UI_PATH}/node_modules/react-dom"


while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ep|--enable-plugin)       ENABLE_PLUGIN="$2";                shift;shift ;;
    -h|--help )
      cat <<HELPMSG

$0 [option...]
Valid options:
  -ep|--enable-plugin
      The option to perform the setup of plugin.
      If you set this to disable the script will remove all the links.
      If you want the script to set up the plugin for you, normally keep the default value.
      Default: ${DEFAULT_ENABLE_PLUGIN}
HELPMSG
      exit 1
      ;;
    *)
      errormsg "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

ENABLE_PLUGIN="${ENABLE_PLUGIN:-${DEFAULT_ENABLE_PLUGIN}}"


if [ "${ENABLE_PLUGIN}" == "true" ]; then
    infomsg "Installing kiali-ui libraries"
    cd ${KIALI_UI_PATH}
    yarn install

    infomsg "Creating link for react (${KIALI_UI_REACT})"
    cd ${KIALI_UI_REACT}
    yarn link

    infomsg "Creating link for react-dom (${KIALI_UI_REACT_DOM})"
    cd ${KIALI_UI_REACT_DOM}
    yarn link

    infomsg "Creating link for Kiali Core package (${PLUGIN_PATH})"
    cd ${PLUGIN_PATH}
    yarn link

    infomsg "Installing mapiodules plugin"
    yarn install


    infomsg "Linking react library..."
    yarn link react

    infomsg "Linking react-dom library..."
    yarn link react-dom

    infomsg "Linking package to kiali-ui"
    cd ${KIALI_UI_PATH}
    yarn link @kiali/core
else
    infomsg "Unlink in kiali-ui the plugin"
    cd ${KIALI_UI_PATH}
    yarn unlink @kiali/core

    infomsg "Reinstalling kiali-ui"
    yarn install

    infomsg "Unlink in package react"
    cd ${PLUGIN_PATH}
    yarn unlink react
    infomsg "Unlink in package react-dom"
    yarn unlink react-dom

    infomsg "Reinstalling plugin libs"
    yarn install
fi

cd ${DEFAULT_FRONTEND_PATH}
