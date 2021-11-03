#!/bin/bash

##############################################################################
# configure-operator.sh
#
# Configures the operator environment variables to enable/disable features.
# See: https://kiali.io/docs/faq/installation/#operator-configuration
##############################################################################

set -eu

DEFAULT_ANSIBLE_DEBUG_LOGS=""
DEFAULT_ANSIBLE_VERBOSITY_KIALI_KIALI_IO=""
DEFAULT_ALLOW_AD_HOC_KIALI_IMAGE=""
DEFAULT_ALLOW_AD_HOC_KIALI_NAMESPACE=""
DEFAULT_CLIENT="oc"
DEFAULT_OPERATOR_NAMESPACE=""
DEFAULT_PROFILER=""

# Change to the directory where this script is and set our env
cd "$(dirname "${BASH_SOURCE[0]}")"

_CMD=""
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -adl|--ansible-debug-logs)    ANSIBLE_DEBUG_LOGS="$2";               shift;shift ;;
    -av|--ansible-verbosity)      ANSIBLE_VERBOSITY_KIALI_KIALI_IO="$2"; shift;shift ;;
    -aai|--allow-adhoc-image)     ALLOW_AD_HOC_KIALI_IMAGE="$2";         shift;shift ;;
    -aan|--allow-adhoc-namespace) ALLOW_AD_HOC_KIALI_NAMESPACE="$2";     shift;shift ;;
    -c|--client)                  CLIENT="$2";                           shift;shift ;;
    -on|--operator-namespace)     OPERATOR_NAMESPACE="$2";               shift;shift ;;
    -p|--profiler)                PROFILER="$2";                         shift;shift ;;
    -h|--help)
      cat <<HELPMSG

$0 [option...] command

Configures the Kiali operator with environment variables used to control certain operator features.
If a setting is empty string ("") then that feature's configuration will remain unchanged.

Valid options:
  -adl|--ansible-debug-logs <true|false>
      If true, the operator will turn on ansible debug log messages.
      Default: "${DEFAULT_ANSIBLE_DEBUG_LOGS}"
  -av|--ansible-verbosity <0-7>
      0 will log only the most severe messages, up to 7 which logs all debugging messages.
      Default: "${DEFAULT_ANSIBLE_VERBOSITY_KIALI_KIALI_IO}"
  -aai|--allow-adhoc-image <true|false>
      If true, the operator will allow you to change image_version or image_name in spec.deployment.
      Default: "${DEFAULT_ALLOW_AD_HOC_KIALI_IMAGE}"
  -aan|--allow-adhoc-namespace <true|false>
      If true, the operator will allow you to install a Kiali CR in a different namespace than spec.deployment.namespace.
      Default: "${DEFAULT_ALLOW_AD_HOC_KIALI_NAMESPACE}"
  -c|--client
      The OpenShift 'oc' client executable or the 'kubectl' client executable.
      Default: "${DEFAULT_CLIENT}"
  -on|--operator-namespace
      The namespace where the operator is installed.
      If not set, an attempt to auto-detect the namespace will be done.
      Default: "${DEFAULT_OPERATOR_NAMESPACE}"
  -p|--profiler <true|false>
      If true, enable the profiler to run during operator reconcilation.
      Default: "${DEFAULT_PROFILER}"
HELPMSG
      exit 1
      ;;
    *)
      echo "Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

: ${ANSIBLE_DEBUG_LOGS:=${DEFAULT_ANSIBLE_DEBUG_LOGS}}
: ${ANSIBLE_VERBOSITY_KIALI_KIALI_IO:=${DEFAULT_ANSIBLE_VERBOSITY_KIALI_KIALI_IO}}
: ${ALLOW_AD_HOC_KIALI_IMAGE:=${DEFAULT_ALLOW_AD_HOC_KIALI_IMAGE}}
: ${ALLOW_AD_HOC_KIALI_NAMESPACE:=${DEFAULT_ALLOW_AD_HOC_KIALI_NAMESPACE}}
: ${CLIENT:=${DEFAULT_CLIENT}}
: ${OPERATOR_NAMESPACE:=${DEFAULT_OPERATOR_NAMESPACE}}
: ${PROFILER:=${DEFAULT_PROFILER}}

if ! which ${CLIENT} >& /dev/null; then
  echo "The client [${CLIENT}] is not valid. Use --client to specify a path to a 'kubectl' or 'oc' client executable."
  exit 1
fi

if [ -z "${OPERATOR_NAMESPACE}" ]; then
  echo "Will attempt to locate the operator namespace"
  OPERATOR_NAMESPACE="$(${CLIENT} get deployments --all-namespaces  | grep kiali-operator | cut -d ' ' -f 1 | head -n 1)"
  if [ -z "${OPERATOR_NAMESPACE}" ]; then
    echo "Operator namespace could not be determined. Make sure you have a Kial Operator installed."
    exit 1
  fi
fi

# Determine if the operator was installed via OLM or not
if ${CLIENT} get subscriptions -n ${OPERATOR_NAMESPACE}  | grep -q kiali; then
  IS_OLM="true"
else
  IS_OLM="false"
fi

echo "ANSIBLE_DEBUG_LOGS=$ANSIBLE_DEBUG_LOGS"
echo "ANSIBLE_VERBOSITY_KIALI_KIALI_IO=$ANSIBLE_VERBOSITY_KIALI_KIALI_IO"
echo "ALLOW_AD_HOC_KIALI_IMAGE=$ALLOW_AD_HOC_KIALI_IMAGE"
echo "ALLOW_AD_HOC_KIALI_NAMESPACE=$ALLOW_AD_HOC_KIALI_NAMESPACE"
echo "CLIENT=$CLIENT"
echo "IS_OLM=$IS_OLM"
echo "OPERATOR_NAMESPACE=$OPERATOR_NAMESPACE"
echo "PROFILER=$PROFILER"

if [ -z "${PROFILER}" ]; then
  ANSIBLE_CONFIG=""
else
  if [ "${PROFILER}" == "true" ]; then
    ANSIBLE_CONFIG="/opt/ansible/ansible-profiler.cfg"
  else
    ANSIBLE_CONFIG="/etc/ansible/ansible.cfg"
  fi
fi

echo "Setting new environment in the operator deployment"

for e in \
  ANSIBLE_DEBUG_LOGS \
  ANSIBLE_VERBOSITY_KIALI_KIALI_IO \
  ALLOW_AD_HOC_KIALI_IMAGE \
  ALLOW_AD_HOC_KIALI_NAMESPACE \
  ANSIBLE_CONFIG
do
  ENV_NAME="$e"
  ENV_VALUE="${!e}"

  if [ ! -z "${ENV_VALUE}" ]; then
    echo "Setting operator environment variable: $ENV_NAME=$ENV_VALUE"
    if [ "${IS_OLM}" == "false" ]; then
      ${CLIENT} -n ${OPERATOR_NAMESPACE} set env deploy/kiali-operator "${ENV_NAME}=${ENV_VALUE}"
    else
      ${CLIENT} -n ${OPERATOR_NAMESPACE} patch $(${CLIENT} -n ${OPERATOR_NAMESPACE} get csv -o name | grep kiali) --type=json -p "[{'op':'replace','path':"/spec/install/spec/deployments/0/spec/template/spec/containers/0/env/$(${CLIENT} -n ${OPERATOR_NAMESPACE} get $(${CLIENT} -n ${OPERATOR_NAMESPACE} get csv -o name | grep kiali) -o jsonpath='{.spec.install.spec.deployments[0].spec.template.spec.containers[0].env[*].name}' | tr ' ' '\n' | cat --number | grep ${ENV_NAME} | cut -f 1 | xargs echo -n | cat - <(echo "-1") | bc)/value",'value':"\"${ENV_VALUE}\""}]"
    fi
  fi
done
