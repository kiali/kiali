# Needed for Travis - it won't like the version regex check otherwise
SHELL=/bin/bash

# Directories based on the root project directory
ROOTDIR=$(CURDIR)
OUTDIR=${ROOTDIR}/_output

# Identifies the current build.
# These will be embedded in the app and displayed when it starts.
VERSION ?= v1.17.0-snapshot.0
COMMIT_HASH ?= $(shell git rev-parse HEAD)

# Indicates which version of the UI console is to be embedded
# in the container image. If "local" the CONSOLE_LOCAL_DIR is
# where the UI project has been git cloned and has its
# content built in its build/ subdirectory.
# WARNING: If you have previously build a container image but
# later want to change the CONSOLE_VERSION then you must run
# the 'clean' target first before re-building the container image.
CONSOLE_VERSION ?= 1.17.0-snapshot.0
CONSOLE_LOCAL_DIR ?= ${ROOTDIR}/../../../../../kiali-ui

# Version label is used in the OpenShift/K8S resources to identify
# their specific instances. Kiali resources will have labels of
# "app: kiali" and "version: ${VERSION_LABEL}"
# The default is the VERSION itself.
VERSION_LABEL ?= ${VERSION}

# The go commands and the minimum Go version that must be used to build the app.
GO ?= go
GOFMT ?= $(shell ${GO} env GOROOT)/bin/gofmt
GO_VERSION_KIALI = 1.14

# Identifies the Kiali container image that will be built.
IMAGE_ORG ?= kiali
CONTAINER_NAME ?= ${IMAGE_ORG}/kiali
CONTAINER_VERSION ?= dev

# These two vars allow Jenkins to override values.
QUAY_NAME ?= quay.io/${CONTAINER_NAME}
QUAY_TAG = ${QUAY_NAME}:${CONTAINER_VERSION}

# Identifies the Kiali operator container images that will be built
OPERATOR_CONTAINER_NAME ?= ${IMAGE_ORG}/kiali-operator
OPERATOR_CONTAINER_VERSION ?= ${CONTAINER_VERSION}
OPERATOR_QUAY_NAME ?= quay.io/${OPERATOR_CONTAINER_NAME}
OPERATOR_QUAY_TAG = ${OPERATOR_QUAY_NAME}:${OPERATOR_CONTAINER_VERSION}

# Declares the namespace/project where the objects are to be deployed.
NAMESPACE ?= istio-system

# A default go GOPATH if it isn't user defined
GOPATH ?= ${HOME}/go

# Environment variables set when running the Go compiler.
GOOS ?= $(shell go env GOOS)
GOARCH ?= $(shell go env GOARCH)
GO_BUILD_ENVVARS = \
	GOOS=$(GOOS) \
	GOARCH=$(GOARCH) \
	CGO_ENABLED=0 \

# Environment variables to shift between base images.
ifeq ($(GOARCH),amd64)
KIALI_DOCKER_FILE ?= Dockerfile-ubi7-minimal
else
KIALI_DOCKER_FILE ?= Dockerfile-ubi8-minimal
endif

# Determine if we should use Docker OR Podman - value must be one of "docker" or "podman"
DORP ?= docker

# Set this to 'minikube' if you want images to be tagged/pushed for minikube as opposed to OpenShift/AWS. Set to 'local' if the image should not be pushed to any remote cluster (requires the cluster to be able to pull from your local image repository).
CLUSTER_TYPE ?= openshift

# Find the client executable (either oc or kubectl). If minikube, only look for kubectl.
ifeq ($(CLUSTER_TYPE),minikube)
OC ?= $(shell which kubectl 2>/dev/null || echo "MISSING-KUBECTL-FROM-PATH")
else
OC ?= $(shell which oc 2>/dev/null || which kubectl 2>/dev/null || echo "MISSING-OC/KUBECTL-FROM-PATH")
endif

# Find the minikube executable (this is optional - if not using minikube we won't need this)
MINIKUBE ?= $(shell which minikube 2>/dev/null || echo "MISSING-MINIKUBE-FROM-PATH")

# Details about the Kiali operator image used when deploying to remote cluster
OPERATOR_IMAGE_PULL_POLICY ?= Always
OPERATOR_NAMESPACE ?= kiali-operator
OPERATOR_WATCH_NAMESPACE ?= kiali-operator

# When deploying the Kiali operator via make, this indicates if it should install Kiali also.
OPERATOR_INSTALL_KIALI ?= false

# When installing Kiali to a remote cluster via make, here are some configuration settings for it.
ACCESSIBLE_NAMESPACES ?= **
ifneq ($(CLUSTER_TYPE),openshift)
AUTH_STRATEGY ?= login
else
AUTH_STRATEGY ?= openshift
endif
CREDENTIALS_USERNAME ?= admin
CREDENTIALS_PASSPHRASE ?= admin
KIALI_IMAGE_PULL_POLICY ?= Always
SERVICE_TYPE ?= ClusterIP
VERBOSE_MODE ?= 3
KIALI_CR_SPEC_VERSION ?= default

# Determine if Maistra/ServiceMesh is deployed. If not, assume we are working with upstream Istio.
IS_MAISTRA ?= $(shell if ${OC} get namespace ${NAMESPACE} -o jsonpath='{.metadata.labels}' 2>/dev/null | grep -q maistra ; then echo "true" ; else echo "false" ; fi)

# Path to Kiali CR file which is different based on what Istio implementation is deployed (upstream or Maistra)
# This is used when deploying Kiali via make
ifeq ($(IS_MAISTRA),true)
KIALI_CR_FILE ?= ${ROOTDIR}/operator/deploy/kiali/kiali_cr_dev_servicemesh.yaml
else
KIALI_CR_FILE ?= ${ROOTDIR}/operator/deploy/kiali/kiali_cr_dev.yaml
endif

include make/Makefile.build.mk
include make/Makefile.container.mk
include make/Makefile.cluster.mk
include make/Makefile.operator.mk
include make/Makefile.molecule.mk

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
	@echo "Operator targets"
	@sed -n 's/^##//p' make/Makefile.operator.mk | column -t -s ':' |  sed -e 's/^/ /'
	@echo
	@echo "Molecule test targets"
	@sed -n 's/^##//p' make/Makefile.molecule.mk | column -t -s ':' |  sed -e 's/^/ /'
	@echo
	@echo "Misc targets"
	@sed -n 's/^##//p' $< | column -t -s ':' |  sed -e 's/^/ /'
	@echo

## git-init: Set the hooks under ./git/hooks
git-init:
	@echo Setting Git Hooks
	cp hack/hooks/* .git/hooks

.ensure-oc-exists:
	@if [ ! -x "${OC}" ]; then \
	  echo "Missing 'oc' or 'kubectl'"; exit 1; \
	fi

.ensure-minikube-exists:
	@if [ ! -x "${MINIKUBE}" ]; then \
	  echo "Missing 'minikube'"; exit 1; \
	fi
