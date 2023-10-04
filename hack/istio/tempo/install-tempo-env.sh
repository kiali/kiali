#!/bin/bash

##############################################################################
# install-tempo-env
#
# Installs the Tempo environment using the Tempo operator.
#
# See --help for more details on options to this script.
#
##############################################################################

CLIENT_EXE="oc"
DELETE_ALL="false"
DELETE_TEMPO="false"
INSTALL_BOOKINFO="true"
INSTALL_ISTIO="true"
INSTALL_KIALI="true"
TEMPO_NS="tempo"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -c|--client)
      CLIENT_EXE="$2"
      shift;shift
      ;;
    -da|--delete-all)
      DELETE_ALL="$2"
      shift;shift
      ;;
    -dt|--delete-tempo)
      DELETE_TEMPO="$2"
      shift;shift
      ;;
    -ib|--install-bookinfo)
      INSTALL_BOOKINFO="$2"
      shift;shift
      ;;
    -ii|--install-istio)
      INSTALL_ISTIO="$2"
      shift;shift
      ;;
    -ik|--install-kiali)
      INSTALL_KIALI="$2"
      shift;shift
      ;;
    -t|--tempo-ns)
      TEMPO_NS="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -c|--client:
       client exe. kubectl and oc are supported. oc by default.
  -da|--delete-all:
       Delete tempo and all the components installed (Including Istio, Kiali & bookinfo).
  -dt|--delete-tempo:
       Delete tempo, tempo operator and cert manager.
  -ib|--install-bookinfo:
       If bookinfo should be installed. true by default.
  -ii|--install-istio:
       If istio should be installed. true by default.
  -ik|--install-kiali:
       If Kiali should be installed. true by default.
  -t|--tempo-ns:
       Tempo namespace. Tempo by default.
  -h|--help:
       this message
HELPMSG
      exit 1
      ;;
    *)
      echo "ERROR: Unknown argument [$key]. Aborting."
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"

if [ "${CLIENT_EXE}" == "" ]; then
  CLIENT_EXE=`which "${CLIENT_EXE_NAME}"`
  if [ "$?" = "0" ]; then
    echo "The cluster client executable is found here: ${CLIENT_EXE}"
  else
    echo "ERROR: You must install the cluster client ${CLIENT_EXE_NAME} in your PATH before you can continue."
    exit 1
  fi
fi

if ${CLIENT_EXE} api-versions | grep --quiet "route.openshift.io"; then
  IS_OPENSHIFT="true"
  echo "You are connecting to an OpenShift cluster"
else
  IS_OPENSHIFT="false"
  echo "You are connecting to a (non-OpenShift) Kubernetes cluster"
fi

echo "IS_OPENSHIFT=${IS_OPENSHIFT}"

if [ "${DELETE_ALL}" == "true" ]; then
  DELETE_TEMPO="true"
fi

if [ "${DELETE_TEMPO}" == "true" ]; then
  echo -e "Deleting tempo \n"
  ${CLIENT_EXE} delete -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
  ${CLIENT_EXE} delete -f https://github.com/grafana/tempo-operator/releases/latest/download/tempo-operator.yaml
  ${CLIENT_EXE} delete secret -n ${TEMPO_NS} tempostack-dev-minio
  ${CLIENT_EXE} delete TempoStack cr -n ${TEMPO_NS}
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE delete project ${TEMPO_NS}
    $CLIENT_EXE delete ns ${TEMPO_NS}
  else
    ${CLIENT_EXE} delete ns ${TEMPO_NS}
  fi

  if [ "${DELETE_ALL}" == "true" ]; then
    ${SCRIPT_DIR}/../install-istio-via-istioctl.sh -c ${CLIENT_EXE} -di true
    ${SCRIPT_DIR}/../install-bookinfo-demo.sh -c ${CLIENT_EXE} -db true
  fi
else
  echo -e "Installing cert manager...\n"
  ${CLIENT_EXE} apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
  echo -e "Waiting for cert-manager pods to be ready... \n"
  $CLIENT_EXE wait pods --all -n cert-manager --for=condition=Ready --timeout=5m

  echo -e "Installing latest Tempo operator \n"
  ${CLIENT_EXE} apply -f https://github.com/grafana/tempo-operator/releases/latest/download/tempo-operator.yaml
  echo -e "Waiting for Tempo operator to be ready... \n"
  $CLIENT_EXE wait pods --all -n tempo-operator-system --for=condition=Ready --timeout=5m

  # If OpenShift, we need to do some additional things
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE new-project ${TEMPO_NS}
  else
    $CLIENT_EXE create namespace ${TEMPO_NS}
  fi

  echo -e "Installing minio and create secret \n"
  ${CLIENT_EXE} apply --namespace ${TEMPO_NS} -f ${SCRIPT_DIR}/minio.yaml

  ${CLIENT_EXE} create secret generic -n ${TEMPO_NS} tempostack-dev-minio \
    --from-literal=bucket="tempo-data" \
    --from-literal=endpoint="http://minio:9000" \
    --from-literal=access_key_id="minio" \
    --from-literal=access_key_secret="minio123"

  echo -e "Installing tempo \n"
  ${CLIENT_EXE} apply -n ${TEMPO_NS} -f - <<EOF
apiVersion: tempo.grafana.com/v1alpha1
kind: TempoStack
metadata:
  name: cr
spec:
  storageSize: 1Gi
  storage:
    secret:
      type: s3
      name: tempostack-dev-minio
  resources:
    total:
      limits:
        memory: 2Gi
        cpu: 2000m
  template:
    queryFrontend:
      jaegerQuery:
        enabled: false
EOF


  echo "Script Directory: ${SCRIPT_DIR}"

  if [ "${INSTALL_ISTIO}" == "true" ]; then
    echo -e "Installing istio \n"
    ${SCRIPT_DIR}/../install-istio-via-istioctl.sh -c ${CLIENT_EXE} -a "prometheus grafana" -s values.meshConfig.defaultConfig.tracing.zipkin.address="tempo-cr-distributor.tempo:9411"
  fi

  if [ "${INSTALL_KIALI}" == "true" ]; then
    OUTPUT_DIR="${OUTPUT_DIR:-${SCRIPT_DIR}/../../../_output}"
    ISTIO_DIR=$(ls -dt1 ${OUTPUT_DIR}/istio-* | head -n1)
    echo "Istio directory where the Kiali addon yaml should be found: ${ISTIO_DIR}"
    ${CLIENT_EXE} apply -f ${ISTIO_DIR}/samples/addons/kiali.yaml
  fi

  if [ "${INSTALL_BOOKINFO}" == "true" ]; then
    echo -e "Installing bookinfo \n"
    ${SCRIPT_DIR}/../install-bookinfo-demo.sh -c ${CLIENT_EXE} -tg
  fi

  # If OpenShift, we need to do some additional things
  if [ "${IS_OPENSHIFT}" == "true" ]; then
    $CLIENT_EXE expose svc/tempo-cr-query-frontend -n ${TEMPO_NS}
  fi

  echo -e "Installation finished. You can port forward the services with: \n"
  echo "./run-kiali.sh -pg 13000:3000 -pp 19090:9090 -pt 3200:3200 -app 8080 -es false -iu http://127.0.0.1:15014 -tr tempo-cr-query-frontend -ts tempo-cr-query-frontend -tn tempo"

fi