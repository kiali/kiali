# Needed for Travis - it won't like the version regex check otherwise
SHELL=/bin/bash

# Directories based on the root project directory
ROOTDIR=$(CURDIR)
OUTDIR=${ROOTDIR}/_output
OPERATOR_DIR=${ROOTDIR}/operator

# list for multi-arch image publishing
TARGET_ARCHS ?= amd64 arm64 s390x ppc64le

# Identifies the current build.
# These will be embedded in the app and displayed when it starts.
VERSION ?= v2.5.0
COMMIT_HASH ?= $(shell git rev-parse HEAD)

# The path where the UI project has been git cloned. The UI should
# have been built before trying to create a kiali server container
# image. The UI project is configured to place its build
# output in the $UI_SRC_ROOT/build/ subdirectory.
CONSOLE_LOCAL_DIR ?= ${ROOTDIR}/frontend

# Version label is used in the OpenShift/K8S resources to identify
# their specific instances. Kiali resources will have labels of
# "app.kubernetes.io/name: kiali" and "app.kubernetes.io/version: ${VERSION_LABEL}"
# The default is the VERSION itself.
VERSION_LABEL ?= ${VERSION}

# The go commands and the minimum Go version that must be used to build the app.
GO ?= go
GOFMT ?= $(shell ${GO} env GOROOT)/bin/gofmt
GO_VERSION_KIALI = $(shell sed -rn 's/^go[[:space:]]+([[:digit:].]+)/\1/p' go.mod)
GO_TEST_FLAGS ?=

# Identifies the Kiali container image that will be built.
IMAGE_ORG ?= kiali
CONTAINER_NAME ?= ${IMAGE_ORG}/kiali
CONTAINER_VERSION ?= dev

# These two vars allow Jenkins to override values.
QUAY_NAME ?= quay.io/${CONTAINER_NAME}
QUAY_TAG ?= ${QUAY_NAME}:${CONTAINER_VERSION}

# Identifies the Kiali operator container images that will be built
OPERATOR_CONTAINER_NAME ?= ${IMAGE_ORG}/kiali-operator
OPERATOR_CONTAINER_VERSION ?= ${CONTAINER_VERSION}
OPERATOR_QUAY_NAME ?= quay.io/${OPERATOR_CONTAINER_NAME}
OPERATOR_QUAY_TAG ?= ${OPERATOR_QUAY_NAME}:${OPERATOR_CONTAINER_VERSION}

# Identifies the Kiali interation tests container image that will be built
INT_TESTS_CONTAINER_NAME ?= ${IMAGE_ORG}/kiali-int-tests
INT_TESTS_CONTAINER_VERSION ?= ${CONTAINER_VERSION}
INT_TESTS_QUAY_NAME ?= quay.io/${INT_TESTS_CONTAINER_NAME}
INT_TESTS_QUAY_TAG ?= ${INT_TESTS_QUAY_NAME}:${INT_TESTS_CONTAINER_VERSION}

# Identifies the Kiali cypress tests container image that will be built
CYPRESS_TESTS_CONTAINER_NAME ?= ${IMAGE_ORG}/kiali-cypress-tests
CYPRESS_TESTS_CONTAINER_VERSION ?= ${CONTAINER_VERSION}
CYPRESS_TESTS_QUAY_NAME ?= quay.io/${CYPRESS_TESTS_CONTAINER_NAME}
CYPRESS_TESTS_QUAY_TAG ?= ${CYPRESS_TESTS_QUAY_NAME}:${CYPRESS_TESTS_CONTAINER_VERSION}

# Where the control plane is
ISTIO_NAMESPACE ?= istio-system
# Declares the namespace/project where the Kiali objects are to be deployed.
NAMESPACE ?= ${ISTIO_NAMESPACE}
# Declares the namespace/project where the OSSM Console objects are to be deployed.
OSSMCONSOLE_NAMESPACE ?= ossmconsole

# Local arch details needed when downloading tools
OS := $(shell uname -s | tr '[:upper:]' '[:lower:]')
ARCH := $(shell uname -m | sed 's/x86_64/amd64/')

# A default go GOPATH if it isn't user defined
GOPATH ?= ${HOME}/go

# Environment variables set when running the Go compiler.
GOOS ?= $(shell ${GO} env GOOS)
GOARCH ?= $(shell ${GO} env GOARCH)
CGO_ENABLED ?= 0
GO_BUILD_ENVVARS = \
	GOOS=$(GOOS) \
	GOARCH=$(GOARCH) \
	CGO_ENABLED=$(CGO_ENABLED)

# Extra build flags passed to the go compiler.
GO_BUILD_FLAGS ?= 

# Determine which Dockerfile is used to build the server container
KIALI_DOCKER_FILE ?= Dockerfile-distroless

# Determine if we should use Docker OR Podman - value must be one of "docker" or "podman"
DORP ?= docker

# Set this to 'minikube' if you want images to be tagged/pushed for minikube as opposed to OpenShift/AWS. Set to 'local' if the image should not be pushed to any remote cluster (requires the cluster to be able to pull from your local image repository).
CLUSTER_TYPE ?= openshift

# Find the client executable (either oc or kubectl). If minikube or kind, only look for kubectl (though we might not need be so strict)
ifeq ($(CLUSTER_TYPE),minikube)
OC ?= $(shell which kubectl 2>/dev/null || echo "MISSING-KUBECTL-FROM-PATH")
else ifeq ($(CLUSTER_TYPE),kind)
OC ?= $(shell which kubectl 2>/dev/null || echo "MISSING-KUBECTL-FROM-PATH")
else
OC ?= $(shell which oc 2>/dev/null || which kubectl 2>/dev/null || echo "MISSING-OC/KUBECTL-FROM-PATH")
endif

# Find the minikube executable (this is optional - if not using minikube we won't need this)
MINIKUBE ?= $(shell which minikube 2>/dev/null || echo "MISSING-MINIKUBE-FROM-PATH")
MINIKUBE_PROFILE ?= minikube

# Find the kind executable (this is optional - if not using kind we won't need this)
KIND ?= $(shell which kind 2>/dev/null || echo "MISSING-KIND-FROM-PATH")
KIND_NAME ?= kind

# Determine if the OC is operational or not. Useful for other commands that might timeout if the OC exists but is not responding.
ifeq ($(CLUSTER_TYPE),minikube)
OC_READY ?= $(shell if ${MINIKUBE} -p ${MINIKUBE_PROFILE} status &>/dev/null ; then echo "true" ; else echo "false" ; fi)
else ifeq ($(CLUSTER_TYPE),kind)
OC_READY ?= $(shell if ${OC} cluster-info --context=kind-${KIND_NAME} --request-timeout=1s &>/dev/null ; then echo "true" ; else echo "false" ; fi)
else
OC_READY ?= $(shell if ${OC} status --request-timeout=1s &>/dev/null ; then echo "true" ; else echo "false" ; fi)
endif

# Details about the Kiali operator image used when deploying to remote cluster
ifeq ($(CLUSTER_TYPE),kind)
OPERATOR_IMAGE_PULL_POLICY ?= IfNotPresent
else
OPERATOR_IMAGE_PULL_POLICY ?= Always
endif
OPERATOR_NAMESPACE ?= kiali-operator
OPERATOR_PROFILER_ENABLED ?= false
OPERATOR_WATCH_NAMESPACE ?= \"\"

# When deploying the Kiali operator via make, this indicates if it should install Kiali also and where to put the CR
OPERATOR_INSTALL_KIALI ?= false
OPERATOR_ALLOW_AD_HOC_KIALI_NAMESPACE ?= true
OPERATOR_ALLOW_AD_HOC_KIALI_IMAGE ?= true
OPERATOR_ALLOW_AD_HOC_OSSMCONSOLE_IMAGE ?= true
ifeq ($(OPERATOR_WATCH_NAMESPACE),\"\")
OPERATOR_INSTALL_KIALI_CR_NAMESPACE ?= ${OPERATOR_NAMESPACE}
else
OPERATOR_INSTALL_KIALI_CR_NAMESPACE ?= ${OPERATOR_WATCH_NAMESPACE}
endif

# When installing Kiali to a remote cluster via make, here are some configuration settings for it.
CLUSTER_WIDE_ACCESS ?= true
ifneq ($(CLUSTER_TYPE),openshift)
AUTH_STRATEGY ?= anonymous
else
AUTH_STRATEGY ?= openshift
endif
ifeq ($(CLUSTER_TYPE),kind)
KIALI_IMAGE_PULL_POLICY ?= IfNotPresent
else
KIALI_IMAGE_PULL_POLICY ?= Always
endif
SERVICE_TYPE ?= ClusterIP
KIALI_CR_SPEC_VERSION ?= default

# Path to Kiali CR file. This is used when deploying Kiali via make
KIALI_CR_FILE ?= ${ROOTDIR}/operator/deploy/kiali/kiali_cr_dev.yaml

# When creating a OSSMConsole CR, these can customize it
OSSMCONSOLE_CR_FILE ?= ${ROOTDIR}/operator/deploy/ossmconsole/ossmconsole_cr_dev.yaml
OSSMCONSOLE_CR_SPEC_VERSION ?= default

# When ensuring the helm chart repo exists, by default the make infrastructure will pull the latest code from git.
# If you do not want this to happen (i.e. if you want to retain the local copies of your helm charts), set this to false.
HELM_CHARTS_REPO_PULL ?= true

.PHONY: default_target
default_target:
	@echo
	@echo "Apparently, you didn't specify a target."
	@echo "This Makefile requires you to explicitly call a target."
	@echo "Run '$(MAKE) help' to learn about the available targets."

include make/Makefile.build.mk
include make/Makefile.container.mk
include make/Makefile.cluster.mk
include make/Makefile.helm.mk
include make/Makefile.operator.mk
include make/Makefile.molecule.mk
include make/Makefile.ui.mk
include make/Makefile.olm.mk

.PHONY: help
help: Makefile
	@echo
	@echo "Build targets"
	@sed -n 's/^##//p' make/Makefile.build.mk | column -t -s ':' |  sed -e 's/^/ /'
	@echo
	@echo "Container targets"
	@sed -n 's/^##//p' make/Makefile.container.mk | column -t -s ':' |  sed -e 's/^/ /'
	@echo
	@echo "Cluster targets"
	@sed -n 's/^##//p' make/Makefile.cluster.mk | column -t -s ':' |  sed -e 's/^/ /'
	@echo
	@echo "Helm targets"
	@sed -n 's/^##//p' make/Makefile.helm.mk | column -t -s ':' |  sed -e 's/^/ /'
	@echo
	@echo "Operator targets"
	@sed -n 's/^##//p' make/Makefile.operator.mk | column -t -s ':' |  sed -e 's/^/ /'
	@echo
	@echo "Molecule test targets"
	@sed -n 's/^##//p' make/Makefile.molecule.mk | column -t -s ':' |  sed -e 's/^/ /'
	@echo
	@echo "UI targets"
	@sed -n 's/^##//p' make/Makefile.ui.mk | column -t -s ':' |  sed -e 's/^/ /'
	@echo
	@echo "OLM targets"
	@sed -n 's/^##//p' make/Makefile.olm.mk | column -t -s ':' |  sed -e 's/^/ /'
	@echo
	@echo "Misc targets"
	@sed -n 's/^##//p' $< | column -t -s ':' |  sed -e 's/^/ /'
	@echo

.ensure-oc-exists:
	@if [ ! -x "${OC}" ]; then \
	  echo "Missing 'oc' or 'kubectl'"; exit 1; \
	fi

.ensure-oc-login: .ensure-oc-exists
	@if [[ "${OC}" = *"oc" ]]; then if ! ${OC} whoami &> /dev/null; then echo "You are not logged into an OpenShift cluster. Run 'oc login' before continuing."; exit 1; fi; fi

.ensure-minikube-exists:
	@if [ ! -x "${MINIKUBE}" ]; then \
	  echo "Missing 'minikube'"; exit 1; \
	fi

.ensure-kind-exists:
	@if [ ! -x "${KIND}" ]; then \
	  echo "Missing 'kind'"; exit 1; \
	fi

.ensure-operator-repo-exists:
	@if [ ! -d "${ROOTDIR}/operator" ]; then \
	  echo "================ ERROR ================"; \
	  echo "You are missing the operator."; \
	  echo "To fix this, run the following command:"; \
	  echo "  git clone git@github.com:kiali/kiali-operator.git ${ROOTDIR}/operator"; \
	  echo "======================================="; \
	  exit 1; \
	fi
