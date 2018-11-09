#! /bin/sh
#
#
# Install Kiali 



JAEGER_URL="http://jaeger-query-istio-system.127.0.0.1.nip.io"
GRAFANA_URL="http://grafana-istio-system.127.0.0.1.nip.io"
VERSION_LABEL="v0.9.0"
IMAGE_PULL_POLICY_TOKEN="imagePullPolicy: Always"
NAMESPACE="istio-system"

@echo Deploying to OpenShift project ${NAMESPACE}
cat deploy/openshift/configmap.yaml | VERSION_LABEL=${VERSION_LABEL} JAEGER_URL=${JAEGER_URL} GRAFANA_URL=${GRAFANA_URL}ISTIO_NAMESPACE=${NAMESPACE}  envsubst | oc create -n ${NAMESPACE} -f -
cat deploy/openshift/secret.yaml | VERSION_LABEL=${VERSION_LABEL} envsubst | oc create -n ${NAMESPACE} -f -
cat deploy/openshift/serviceaccount.yaml | VERSION_LABEL=${VERSION_LABEL} envsubst | oc create -n ${NAMESPACE} -f -
cat deploy/openshift/service.yaml | VERSION_LABEL=${VERSION_LABEL} envsubst | oc create -n ${NAMESPACE} -f -
cat deploy/openshift/route.yaml | VERSION_LABEL=${VERSION_LABEL} envsubst | oc create -n ${NAMESPACE} -f -
cat deploy/openshift/deployment.yaml | IMAGE_NAME=${DOCKER_NAME} IMAGE_VERSION=${VERSION_LABEL} NAMESPACE=${NAMESPACE} VERSION_LABEL=${VERSION_LABEL} VERBOSE_MODE=${VERBOSE_MODE} IMAGE_PULL_POLICY_TOKEN=${IMAGE_PULL_POLICY_TOKEN} envsubst |oc create -n ${NAMESPACE} -f -
cat deploy/openshift/clusterrole.yaml | VERSION_LABEL=${VERSION_LABEL} envsubst | oc create -n ${NAMESPACE} -f -
cat deploy/openshift/clusterrolebinding.yaml | VERSION_LABEL=${VERSION_LABEL} NAMESPACE=${NAMESPACE} envsubst | oc create -n ${NAMESPACE} -f -
cat deploy/openshift/ingress.yaml | VERSION_LABEL=${VERSION_LABEL} | oc create -n ${NAMESPACE} -f -
