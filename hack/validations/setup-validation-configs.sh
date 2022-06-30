#!/bin/bash

#
# Refer to the --help output for a description of this script and its available options.
#

infomsg() {
  echo "[INFO] ${1}"
}

helpmsg() {
  cat <<HELP
This script will run setup Validation prerequisites for Istio configs
Options:
-ec|--error-code
    Error code used for finding examples in https://kiali.io/docs/features/validations
HELP
}

# process command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -ec|--error-code)     ERRORCODE="$2";                  shift;shift; ;;
    -h|--help)                    helpmsg;                    exit 1       ;;
    *) echo "Unknown argument: [$key]. Aborting."; helpmsg; exit 1 ;;
  esac
done

# abort on any error
set -e

infomsg "Make sure everything exists"
which kubectl > /dev/null || (infomsg "kubectl executable is missing"; exit 1)

if [ "${ERRORCODE}" == "KIA0101" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/801.yaml"
elif [ "${ERRORCODE}" == "KIA0102" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/802.yaml"
elif [ "${ERRORCODE}" == "KIA0104" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/804.yaml"
elif [ "${ERRORCODE}" == "KIA0106" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/806.yaml"
elif [ "${ERRORCODE}" == "KIA0201" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/001.yaml"
elif [ "${ERRORCODE}" == "KIA0202" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/002.yaml"
elif [ "${ERRORCODE}" == "KIA0203" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/003.yaml"
elif [ "${ERRORCODE}" == "KIA0204" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/005.yaml"
elif [ "${ERRORCODE}" == "KIA0205" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/004.yaml"
elif [ "${ERRORCODE}" == "KIA0206" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/006.yaml"
elif [ "${ERRORCODE}" == "KIA0207" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/007.yaml"
elif [ "${ERRORCODE}" == "KIA0208" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/008.yaml"
elif [ "${ERRORCODE}" == "KIA0301" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/201.yaml"
elif [ "${ERRORCODE}" == "KIA0302" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/202.yaml"
elif [ "${ERRORCODE}" == "KIA0401" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/401.yaml"
elif [ "${ERRORCODE}" == "KIA0501" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/501.yaml"
elif [ "${ERRORCODE}" == "KIA0505" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/305.yaml"
elif [ "${ERRORCODE}" == "KIA0506" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/306.yaml"
elif [ "${ERRORCODE}" == "KIA0601" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/701.yaml"
elif [ "${ERRORCODE}" == "KIA0602" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/602.yaml"
elif [ "${ERRORCODE}" == "KIA0701" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/702.yaml"
elif [ "${ERRORCODE}" == "KIA0801" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/402.yaml"
elif [ "${ERRORCODE}" == "KIA0901" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/501.yaml"
elif [ "${ERRORCODE}" == "KIA0902" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/502.yaml"
elif [ "${ERRORCODE}" == "KIA0903" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/601.yaml"
elif [ "${ERRORCODE}" == "KIA1003" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/903.yaml"
elif [ "${ERRORCODE}" == "KIA1004" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/904.yaml"
elif [ "${ERRORCODE}" == "KIA1006" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/906.yaml"
elif [ "${ERRORCODE}" == "KIA1101" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/101.yaml"
elif [ "${ERRORCODE}" == "KIA1102" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/102.yaml"
elif [ "${ERRORCODE}" == "KIA1103" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/103.yaml"
elif [ "${ERRORCODE}" == "KIA1104" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/106.yaml"
elif [ "${ERRORCODE}" == "KIA1105" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/111.yaml"
elif [ "${ERRORCODE}" == "KIA1106" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/104.yaml"
elif [ "${ERRORCODE}" == "KIA1107" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/105.yaml"
elif [ "${ERRORCODE}" == "KIA1108" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/112.yaml"
elif [ "${ERRORCODE}" == "KIA0002" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/302.yaml"
elif [ "${ERRORCODE}" == "KIA0003" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/303.yaml"
elif [ "${ERRORCODE}" == "KIA0004" ]; then
  FILEPATH="https://github.com/kiali/kiali.io/raw/current/static/files/validation_examples/304.yaml"
else
  echo "Error code ${ERRORCODE} not found, or validation reproduction example yaml file does not exist for it in kiali.io."
  exit 1
fi

infomsg "Create Validation configs $FILEPATH"

kubectl delete -f $FILEPATH > /dev/null 2>&1

kubectl apply -f $FILEPATH

infomsg "Validations env is prepared."

