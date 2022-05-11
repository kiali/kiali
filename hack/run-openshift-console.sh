#!/bin/bash

SCRIPT_ROOT="$( cd "$(dirname "$0")" ; pwd -P )"
KIALI_SRC_HOME="${KIALI_SRC_HOME:-${SCRIPT_ROOT}/..}"
KIALI_SRC_HOME="$(cd "${KIALI_SRC_HOME}"; pwd -P)"

cd $KIALI_SRC_HOME/plugins/openshift && yarn run start-console