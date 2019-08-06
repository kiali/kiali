SHELL := /bin/bash

# Details about the Kiali operator image.
OPERATOR_IMAGE_REPO ?= quay.io
OPERATOR_IMAGE_NAME ?= ${OPERATOR_IMAGE_REPO}/kiali/kiali-operator
OPERATOR_IMAGE_PULL_POLICY ?= IfNotPresent
OPERATOR_IMAGE_VERSION ?= dev
OPERATOR_NAMESPACE ?= kiali-operator
OPERATOR_WATCH_NAMESPACE ?= kiali-operator

# When deploying the Kiali operator via operator-create target, this indicates if it should install Kiali also.
OPERATOR_INSTALL_KIALI ?= false

# When installing Kiali, here are some configuration settings for it.
AUTH_STRATEGY ?= openshift
CREDENTIALS_USERNAME ?= admin
CREDENTIALS_PASSPHRASE ?= admin
KIALI_IMAGE_REPO ?= quay.io
KIALI_IMAGE_NAME ?= ${KIALI_IMAGE_REPO}/kiali/kiali
KIALI_IMAGE_PULL_POLICY ?= IfNotPresent
KIALI_IMAGE_VERSION ?= ${OPERATOR_IMAGE_VERSION}
NAMESPACE ?= istio-system
VERBOSE_MODE ?= 3
SERVICE_TYPE ?= ClusterIP

# Path to CR file for any other parameter
KIALI_CR_FILE ?= deploy/kiali/kiali_cr_dev.yaml

# Find the client executable (either istiooc or oc or kubectl)
OC ?= $(shell which istiooc 2>/dev/null || which oc 2>/dev/null || which kubectl 2>/dev/null || echo "MISSING-OC/KUBECTL-FROM-PATH")

.PHONY: help
all: help
help: Makefile
	@echo
	@echo "Choose a make target to run:"
	@echo
	@sed -n 's/^##//p' $< | column -t -s ':' |  sed -e 's/^/ /'
	@echo

.download-operator-sdk-if-needed:
	@if [ "$(shell which operator-sdk 2>/dev/null || echo -n "")" == "" ]; then \
	  mkdir -p ../_output/operator-sdk-install ;\
	  if [ -x "../_output/operator-sdk-install/operator-sdk" ]; then \
	    echo "You do not have operator-sdk installed in your PATH. Will use the one found here: ../_output/operator-sdk-install/operator-sdk" ;\
	  else \
	    echo "You do not have operator-sdk installed in your PATH. The binary will be downloaded to ../_output/operator-sdk-install/operator-sdk" ;\
	    curl -L https://github.com/operator-framework/operator-sdk/releases/download/v0.9.0/operator-sdk-v0.9.0-x86_64-linux-gnu > ../_output/operator-sdk-install/operator-sdk ;\
	    chmod +x ../_output/operator-sdk-install/operator-sdk ;\
	  fi ;\
	fi

.ensure-operator-sdk-exists: .download-operator-sdk-if-needed
	@$(eval OP_SDK ?= $(shell which operator-sdk 2>/dev/null || echo "../_output/operator-sdk-install/operator-sdk"))
	@"${OP_SDK}" version

## operator-build: Build the Kiali operator container image
# Requires operator-sdk - download it from https://github.com/operator-framework/operator-sdk/releases
operator-build: .ensure-operator-sdk-exists
	@echo Build operator
	"${OP_SDK}" build "${OPERATOR_IMAGE_NAME}:${OPERATOR_IMAGE_VERSION}"

## crc-operator-push: Push the Kiali operator container image to a CRC VM repo
crc-operator-push:
	# OpenShift 4 container registry stores images in the namespace as declared in the image name.
	@echo Make sure the image namespace exists
	@${OC} get namespace $(shell echo ${OPERATOR_IMAGE_NAME} | sed -e 's/.*\/\(.*\)\/.*/\1/') > /dev/null 2>&1 || \
     ${OC} create namespace $(shell echo ${OPERATOR_IMAGE_NAME} | sed -e 's/.*\/\(.*\)\/.*/\1/') > /dev/null 2>&1
	@echo Push operator image to image repo
	docker push "${OPERATOR_IMAGE_NAME}:${OPERATOR_IMAGE_VERSION}"
	${OC} policy add-role-to-user system:image-puller system:serviceaccount:${OPERATOR_NAMESPACE}:kiali-operator --namespace=$(shell echo ${OPERATOR_IMAGE_NAME} | sed -e 's/.*\/\(.*\)\/.*/\1/') > /dev/null 2>&1

## operator-push: Push the Kiali operator container image to a remote repo
operator-push:
	@echo Push operator image to image repo
	docker push "${OPERATOR_IMAGE_NAME}:${OPERATOR_IMAGE_VERSION}"

.ensure-operator-ns-does-not-exist:
	@_cmd="${OC} get namespace ${OPERATOR_NAMESPACE}"; \
	$$_cmd > /dev/null 2>&1 ; \
	while [ $$? -eq 0 ]; do \
	  echo "Waiting for the operator namespace [${OPERATOR_NAMESPACE}] to terminate" ; \
	  sleep 4 ; \
	  $$_cmd 2> /dev/null; \
	done ; \
	exit 0

## operator-create: Deploy the Kiali operator to the cluster using the install script.
# By default, this target will not deploy Kiali - it will only deploy the operator.
# You can tell it to also install Kiali by setting OPERATOR_INSTALL_KIALII=true.
# The Kiali operator does not create secrets, but this calls the install script
# which can create a Kiali secret for you as a convienence so you don't have
# to remember to do it yourself. It will only do this if it was told to install Kiali.
operator-create: operator-delete .ensure-operator-ns-does-not-exist
	@echo Deploy Operator
	deploy/deploy-kiali-operator.sh \
    --operator-image-name      "${OPERATOR_IMAGE_NAME}" \
    --operator-image-pull-policy "${OPERATOR_IMAGE_PULL_POLICY}" \
    --operator-image-version   "${OPERATOR_IMAGE_VERSION}" \
    --operator-namespace       "${OPERATOR_NAMESPACE}" \
    --operator-watch-namespace "${OPERATOR_WATCH_NAMESPACE}" \
    --operator-install-kiali   "${OPERATOR_INSTALL_KIALI}" \
    --accessible-namespaces    "${ACCESSIBLE_NAMESPACES}" \
    --auth-strategy            "${AUTH_STRATEGY}" \
    --credentials-username     "${CREDENTIALS_USERNAME}" \
    --credentials-passphrase   "${CREDENTIALS_PASSPHRASE}" \
    --kiali-image-name         "${KIALI_IMAGE_NAME}" \
    --kiali-image-pull-policy  "${KIALI_IMAGE_PULL_POLICY}" \
    --kiali-image-version      "${KIALI_IMAGE_VERSION}" \
    --namespace                "${NAMESPACE}"

## operator-delete: Remove the Kiali operator resources from the cluster along with Kiali itself
operator-delete: purge-kiali
	@echo Remove Operator
	${OC} delete --ignore-not-found=true all,sa,deployments,clusterroles,clusterrolebindings,customresourcedefinitions --selector="app=kiali-operator" -n "${OPERATOR_NAMESPACE}"
	${OC} delete --ignore-not-found=true namespace "${OPERATOR_NAMESPACE}"

## secret-create: Create a Kiali secret using CREDENTIALS_USERNAME and CREDENTIALS_PASSPHRASE.
secret-create:
	@echo Create the secret
	${OC} create secret generic kiali -n "${NAMESPACE}" --from-literal "username=${CREDENTIALS_USERNAME}" --from-literal "passphrase=${CREDENTIALS_PASSPHRASE}"
	${OC} label secret kiali app=kiali -n "${NAMESPACE}"

## secret-delete: Delete the Kiali secret.
secret-delete:
	@echo Delete the secret
	${OC} delete --ignore-not-found=true secret --selector="app=kiali" -n "${NAMESPACE}"

## kiali-create: Create a Kiali CR to the cluster, informing the Kiali operator to install Kiali.
ifeq ($(AUTH_STRATEGY),login)
kiali-create: secret-create
else
kiali-create:
endif
	@echo Deploy Kiali using the settings found in ${KIALI_CR_FILE}
	cat ${KIALI_CR_FILE} | \
AUTH_STRATEGY="${AUTH_STRATEGY}" \
KIALI_IMAGE_NAME=${KIALI_IMAGE_NAME} \
KIALI_IMAGE_PULL_POLICY=${KIALI_IMAGE_PULL_POLICY} \
KIALI_IMAGE_VERSION=${KIALI_IMAGE_VERSION} \
NAMESPACE="${NAMESPACE}" \
VERBOSE_MODE="${VERBOSE_MODE}" \
SERVICE_TYPE="${SERVICE_TYPE}" \
envsubst | ${OC} apply -n "${OPERATOR_WATCH_NAMESPACE}" -f -

## kiali-delete: Remove a Kiali CR from the cluster, informing the Kiali operator to uninstall Kiali.
kiali-delete: secret-delete
	@echo Remove Kiali
	${OC} delete --ignore-not-found=true kiali kiali -n "${OPERATOR_WATCH_NAMESPACE}"

## purge-kiali: Purges all Kiali resources directly without going through the operator or ansible.
purge-kiali:
	@echo Purge Kiali resources
	${OC} patch kiali kiali -n "${OPERATOR_WATCH_NAMESPACE}" -p '{"metadata":{"finalizers": []}}' --type=merge ; true
	${OC} delete --ignore-not-found=true all,secrets,sa,templates,configmaps,deployments,roles,rolebindings,clusterroles,clusterrolebindings,ingresses,customresourcedefinitions --selector="app=kiali" -n "${NAMESPACE}"
	${OC} delete --ignore-not-found=true oauthclients.oauth.openshift.io --selector="app=kiali" -n "${NAMESPACE}" ; true

## run-playbook: Run the dev playbook to run the Ansible script locally.
run-playbook:
	ansible-playbook -vvv -i dev-hosts dev-playbook.yml

## run-playbook-tag: Run a tagged set of tasks via dev playbook to run parts of the Ansible script locally.
# To use this, add "tags: test" to one or more tasks - those are the tasks that will be run.
run-playbook-tag:
	ansible-playbook -vvv -i dev-hosts dev-playbook.yml --tags test

#
# MOLECULE TARGETS
#

MOLECULE_SCENARIO ?= default
ifeq ($(MOLECULE_DEBUG),true)
MOLECULE_DEBUG_ARG = --debug
endif
ifeq ($(MOLECULE_DESTROY_NEVER),true)
MOLECULE_DESTROY_NEVER_ARG = --destroy never
endif

.molecule-docker-build-if-needed:
	@if [ "$(shell docker image ls -q kiali-molecule:latest 2>/dev/null || echo -n "")" == "" ]; then \
	  $(MAKE) molecule-docker-build ;\
	fi

## molecule-docker-build: Builds a docker image that can be used to run Molecule without requiring the host to have the proper python/pip installation
molecule-docker-build:
	docker build -t kiali-molecule:latest molecule/docker

## molecule-test: Runs Molecule tests using the Molecule docker image
molecule-test: .molecule-docker-build-if-needed
	docker run --rm -it -v "${PWD}":/tmp/$(basename "${PWD}"):ro -v "${HOME}/.kube":/root/.kube:ro -v /var/run/docker.sock:/var/run/docker.sock -w /tmp/$(basename "${PWD}") --network="host" --add-host="api.crc.testing:192.168.130.11" kiali-molecule:latest molecule ${MOLECULE_DEBUG_ARG} test ${MOLECULE_DESTROY_NEVER_ARG} --scenario-name ${MOLECULE_SCENARIO}
