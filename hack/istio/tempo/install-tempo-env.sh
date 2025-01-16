#!/bin/bash

##############################################################################
# install-tempo-env
#
# Installs the Tempo environment using the Tempo operator.
#
# See --help for more details on options to this script.
#
##############################################################################

AMBIENT="false"
CLIENT_EXE_NAME="oc"
DELETE_ALL="false"
DELETE_TEMPO="false"
INSTALL_BOOKINFO="true"
INSTALL_ISTIO="true"
INSTALL_KIALI="false"
METHOD="operator"
ONLY_TEMPO="false"
SECURE_DISTRIBUTOR="false"
TEMPO_NS="tempo"
TEMPO_PORT="3200"

# process command line args
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -a|--ambient)
      AMBIENT="$2"
      shift;shift
      ;;
    -c|--client)
      CLIENT_EXE_NAME="$2"
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
    -im|--install-method)
      METHOD="$2"
      shift;shift
      ;;
    -ot|--only-tempo)
      ONLY_TEMPO="$2"
      shift;shift
      ;;
    -sd|--secure-distributor)
      SECURE_DISTRIBUTOR="$2"
      shift;shift
      ;;
    -t|--tempo-ns)
      TEMPO_NS="$2"
      shift;shift
      ;;
    -h|--help)
      cat <<HELPMSG
Valid command line arguments:
  -a|--ambient:
       Install Ambient mesh. false by default.
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
       If Kiali should be installed. false by default.
  -im|--install-method:
       If using "operator" or "helm". "operator" by default. Helm installation has other properties and uses a more updated version of Tempo.
       The recommendation resources for using helm in minikube:
  -ot|--only-tempo:
       Install only tempo. false by default.
  -sd|--secure-distributor:
       If the tempo distributor will use tls (Using a self signed certificate). false by default.
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
MINIO_FILE="${SCRIPT_DIR}/minio.yaml"

CLIENT_EXE=`which ${CLIENT_EXE_NAME}`
if [ "$?" = "0" ]; then
  echo "The cluster client executable is found here: ${CLIENT_EXE}"
else
  echo "You must install the cluster client ${CLIENT_EXE_NAME} in your PATH before you can continue"
  exit 1
fi

if [ "${METHOD}" != "operator" ] && [ "${METHOD}" != "helm" ]; then
  echo "method should be 'operator' or 'helm'"
  exit 1
fi

if ${CLIENT_EXE} api-versions | grep --quiet "route.openshift.io"; then
  IS_OPENSHIFT="true"
  echo "You are connecting to an OpenShift cluster"
else
  IS_OPENSHIFT="false"
  echo "You are connecting to a (non-OpenShift) Kubernetes cluster"
fi

echo "IS_OPENSHIFT=${IS_OPENSHIFT}"

install_tempo() {
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
  ${CLIENT_EXE} apply --namespace ${TEMPO_NS} -f ${MINIO_FILE}

  # Create secret for minio
  ${CLIENT_EXE} create secret generic -n ${TEMPO_NS} tempostack-dev-minio \
    --from-literal=bucket="tempo-data" \
    --from-literal=endpoint="http://minio:9000" \
    --from-literal=access_key_id="minio" \
    --from-literal=access_key_secret="minio123"

  if [ "${METHOD}" == "operator" ]; then

    echo -e "Installing Tempo with the operator \n"

    if [ "${SECURE_DISTRIBUTOR}" == "true" ]; then
      # Create ca and cert for tls for the distributor
      echo -e "Creating ca and cert for tls for the distributor \n"
      subj="
C=ES
ST=ST
O=AR
localityName=Ar
commonName=Ct
organizationalUnitName=rh
emailAddress=not@mail
"
    openssl req -x509 -sha256 -nodes -newkey rsa:2048 -subj "$(echo -n "$subj" | tr "\n" "/")" -keyout /tmp/tls.key -out /tmp/service-ca.crt
    ${CLIENT_EXE} -n ${TEMPO_NS} create configmap tempo-ca --from-file=/tmp/service-ca.crt
    ${CLIENT_EXE} create secret tls tempo-cert -n ${TEMPO_NS} --key="/tmp/tls.key" --cert="/tmp/service-ca.crt"
    # Install TempoStack CR
    echo -e "Installing tempo with tls enabled \n"
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
  template:
    distributor:
      tls:
        enabled: true
        certName: tempo-cert
    queryFrontend:
      component:
        resources:
          limits:
            cpu: "2"
            memory: 2Gi
      jaegerQuery:
        enabled: false
EOF
    else
      # Install TempoStack CR
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
  template:
    queryFrontend:
      component:
        resources:
          limits:
            cpu: "2"
            memory: 2Gi
      jaegerQuery:
        enabled: false
EOF
    fi

  else
    echo -e "Installing Tempo with Helm Charts \n"
    TEMPO_PORT="3100"
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    helm install tempo-cr grafana/tempo-distributed -n tempo -f ${SCRIPT_DIR}/helm.yaml

  fi
}

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
  install_tempo

  if [ "${ONLY_TEMPO}" != "true" ]; then
    echo "Script Directory: ${SCRIPT_DIR}"

    if [ "${INSTALL_ISTIO}" == "true" ]; then
      if [ "${AMBIENT}" == "true" ]; then
        echo -e "Installing istio Ambient \n"
        ${SCRIPT_DIR}/../install-istio-via-istioctl.sh -c ${CLIENT_EXE} -a "prometheus grafana" -cp ambient -s values.meshConfig.defaultConfig.tracing.zipkin.address="tempo-cr-distributor.tempo:9411"
      else
        echo -e "Installing istio \n"
        ${SCRIPT_DIR}/../install-istio-via-istioctl.sh -c ${CLIENT_EXE} -a "prometheus grafana" -s values.meshConfig.defaultConfig.tracing.zipkin.address="tempo-cr-distributor.tempo:9411"
      fi
    fi

    if [ "${INSTALL_KIALI}" == "true" ]; then
      OUTPUT_DIR="${OUTPUT_DIR:-${SCRIPT_DIR}/../../../_output}"
      ISTIO_DIR=$(ls -dt1 ${OUTPUT_DIR}/istio-* | head -n1)
      echo "Istio directory where the Kiali addon yaml should be found: ${ISTIO_DIR}"
      ${CLIENT_EXE} apply -f ${ISTIO_DIR}/samples/addons/kiali.yaml
    fi

    if [ "${INSTALL_BOOKINFO}" == "true" ]; then
      echo -e "Installing bookinfo \n"
      if [ "${AMBIENT}" == "true" ]; then
         echo -e "Adding bookinfo in Ambient Mesh with a Waypoint proxy \n"
        ${SCRIPT_DIR}/../install-bookinfo-demo.sh -c ${CLIENT_EXE} -ai false -tg -w true
      else
        ${SCRIPT_DIR}/../install-bookinfo-demo.sh -c ${CLIENT_EXE} -tg
      fi
    fi

    # If OpenShift, we need to do some additional things
    if [ "${IS_OPENSHIFT}" == "true" ]; then
      $CLIENT_EXE expose svc/tempo-cr-query-frontend -n ${TEMPO_NS}
      $CLIENT_EXE expose svc/grafana -n istio-system
    fi

    echo -e "Installation finished. \n"
    if [ "${IS_OPENSHIFT}" != "true" ]; then
      echo "If you want to access Tempo from outside the cluster on your local machine, You can port forward the services with:
  ./run-kiali.sh -pg 13000:3000 -pp 19090:9090 -pt 3200:${TEMPO_PORT} -app 8080 -es false -iu http://127.0.0.1:15014 -tr tempo-cr-query-frontend -ts tempo-cr-query-frontend -tn tempo

  To configure Kiali to use this, set the external_services.tracing section with the following settings:
  tracing:
    enabled: true
    provider: \"tempo\"
    internal_url: http://localhost:3200
    external_url: http://localhost:3200
    use_grpc: false"
    fi
  fi

fi
