# Needed for Travis - it won't like the version regex check otherwise
SHELL=/bin/bash

# Identifies the current build.
# These will be embedded in the app and displayed when it starts.
VERSION ?= 0.3.2.Alpha-SNAPSHOT
COMMIT_HASH ?= $(shell git rev-parse HEAD)

# Indicates which version of the UI console is to be embedded
# in the docker image. If "local" the CONSOLE_LOCAL_DIR is
# where the UI project has been git cloned and has its
# content built in its build/ subdirectory.
# WARNING: If you have previously run the 'docker' target but
# later want to change the CONSOLE_VERSION then you must run
# the 'clean' target first before re-running the 'docker' target.
CONSOLE_VERSION ?= latest
CONSOLE_LOCAL_DIR ?= ../../../../../kiali-ui

# Version label is used in the OpenShift/K8S resources to identify
# their specific instances. These resources will have labels of
# "app: kiali" and "version: ${VERSION_LABEL}" In this development
# environment, setting the label names equal to the branch names
# allows developers to build and deploy multiple Kiali instances
# at the same time which is useful for debugging and testing.
# Due to restrictions on allowed characters in label values,
# we ensure only alphanumeric, underscore, dash, and dot are allowed.
# Due to restrictions on allowed characters in names, we convert
# uppercase characters to lowercase characters and
# underscores/dots/spaces to dashes.
# If we are deploying from a branch, we must ensure all the OS/k8s
# names to be created are unique - the NAME_SUFFIX will be appended
# to all names so they are unique.
VERSION_LABEL ?= $(shell git rev-parse --abbrev-ref HEAD)
ifneq ($(shell [[ ${VERSION_LABEL} =~ ^[a-zA-Z0-9]([-_.a-zA-Z0-9]*[a-zA-Z0-9])?$$ ]] && echo valid),valid)
  $(error Your version label value '${VERSION_LABEL}' is invalid and cannot be used.)
endif
ifeq (${VERSION_LABEL},master)
  NAME_SUFFIX ?=
else
  # note: we want to start suffix with a dash so it is between the name and the suffix
  NAME_SUFFIX ?= $(shell echo -n "-${VERSION_LABEL}" | tr '[:upper:][:space:]_.' '[:lower:]---')
  ifneq ($(shell [[ ${NAME_SUFFIX} =~ ^([-a-z0-9]*[a-z0-9])?$$ ]] && echo valid),valid)
    $(error Your name suffix '${NAME_SUFFIX}' is invalid and cannot be used.)
  endif
endif

# The minimum Go version that must be used to build the app.
GO_VERSION_KIALI = 1.8.3

# Identifies the docker image that will be built and deployed.
# Note that if building from a non-master branch, the default
# version will be the same name as the branch allowing you to
# deploy different builds at the same time.
DOCKER_NAME ?= kiali/kiali
ifeq  ("${VERSION_LABEL}","master")
  DOCKER_VERSION ?= dev
else
  DOCKER_VERSION ?= ${VERSION_LABEL}
endif
DOCKER_TAG = ${DOCKER_NAME}:${DOCKER_VERSION}

# Indicates the log level the app will use when started.
# <4=INFO
#  4=DEBUG
#  5=TRACE
VERBOSE_MODE ?= 4

# Declares the namespace where the objects are to be deployed.
# For OpenShift, this is the name of the project.
NAMESPACE ?= istio-system

# Environment variables set when running the Go compiler.
GO_BUILD_ENVVARS = \
	GOOS=linux \
	GOARCH=amd64 \
	CGO_ENABLED=0 \

all: build

clean:
	@echo Cleaning...
	@rm -f kiali
	@rm -rf ${GOPATH}/bin/kiali
	@rm -rf ${GOPATH}/pkg/*
	@rm -rf _output/docker

clean-all: clean
	@rm -rf _output

git-init:
	@echo Setting Git Hooks
	cp hack/hooks/* .git/hooks

go-check:
	@hack/check_go_version.sh "${GO_VERSION_KIALI}"

build: go-check
	@echo Building...
	${GO_BUILD_ENVVARS} go build \
		-o ${GOPATH}/bin/kiali -ldflags "-X main.version=${VERSION} -X main.commitHash=${COMMIT_HASH}"

install:
	@echo Installing...
	${GO_BUILD_ENVVARS} go install \
		-ldflags "-X main.version=${VERSION} -X main.commitHash=${COMMIT_HASH}"

format:
	@# Exclude more paths find . \( -path './vendor' -o -path <new_path_to_exclude> \) -prune -o -type f -iname '*.go' -print
	@for gofile in $$(find . -path './vendor' -prune -o -type f -iname '*.go' -print); do \
			gofmt -w $$gofile; \
	done
build-test:
	@echo Building and installing test dependencies to help speed up test runs.
	go test -i $(shell go list ./... | grep -v -e /vendor/)

test:
	@echo Running tests, excluding third party tests under vendor
	go test $(shell go list ./... | grep -v -e /vendor/)

test-debug:
	@echo Running tests in debug mode, excluding third party tests under vendor
	go test -v $(shell go list ./... | grep -v -e /vendor/)

test-race:
	@echo Running tests with race detection, excluding third party tests under vendor
	go test -race $(shell go list ./... | grep -v -e /vendor/)

run:
	@echo Running...
	@${GOPATH}/bin/kiali -v ${VERBOSE_MODE} -config config.yaml

#
# dep targets - dependency management
#

dep-install:
	@echo Installing Glide itself
	@mkdir -p ${GOPATH}/bin
	# We want to pin on a specific version
	# @curl https://glide.sh/get | sh
	@curl https://glide.sh/get | awk '{gsub("get TAG https://glide.sh/version", "TAG=v0.13.1", $$0); print}' | sh

dep-update:
	@echo Updating dependencies and storing in vendor directory
	@glide update --strip-vendor

#
# cloud targets - building images and deploying
#

.get-console:
	@mkdir -p _output/docker
ifeq ("${CONSOLE_VERSION}", "local")
	echo "Copying local console files from ${CONSOLE_LOCAL_DIR}"
	rm -rf _output/docker/console && mkdir _output/docker/console
	cp -r ${CONSOLE_LOCAL_DIR}/build/* _output/docker/console
	@echo "$$(cd ${CONSOLE_LOCAL_DIR} && npm view ${CONSOLE_LOCAL_DIR} version)-local-$$(cd ${CONSOLE_LOCAL_DIR} && git rev-parse HEAD)" > _output/docker/console/version.txt
else
	@if [ ! -d "_output/docker/console" ]; then \
		echo "Downloading console (${CONSOLE_VERSION})..." ; \
		mkdir _output/docker/console ; \
		curl $$(npm view @kiali/kiali-ui@${CONSOLE_VERSION} dist.tarball) \
		| tar zxf - --strip-components=2 --directory _output/docker/console package/build ; \
		echo "$$(npm view @kiali/kiali-ui@${CONSOLE_VERSION} version)" > _output/docker/console/version.txt ; \
	fi
endif
	@echo "Console version being packaged: $$(cat _output/docker/console/version.txt)"

.prepare-docker-image-files: .get-console
	@echo Preparing docker image files...
	@mkdir -p _output/docker
	@cp -r deploy/docker/* _output/docker
	@cp ${GOPATH}/bin/kiali _output/docker

docker-build: .prepare-docker-image-files
	@echo Building docker image into local docker daemon...
	docker build -t ${DOCKER_TAG} _output/docker

.prepare-minikube:
	@minikube addons list | grep -q "ingress: enabled" ; \
	if [ "$$?" != "0" ]; then \
		echo "Enabling ingress support to minikube" ; \
		minikube addons enable ingress ; \
	fi
	@grep -q kiali /etc/hosts ; \
	if [ "$$?" != "0" ]; then \
		echo "/etc/hosts should have kiali so you can access the ingress"; \
	fi

minikube-docker: .prepare-minikube .prepare-docker-image-files
	@echo Building docker image into minikube docker daemon...
	@eval $$(minikube docker-env) ; \
	docker build -t ${DOCKER_TAG} _output/docker

docker-push:
	@echo Pushing current docker image to ${DOCKER_TAG}
	docker push ${DOCKER_TAG}

.openshift-validate:
	@$(eval OC ?= $(shell which istiooc 2>/dev/null || which oc))
	@${OC} get project ${NAMESPACE} > /dev/null

openshift-deploy: openshift-undeploy
	@if ! which envsubst > /dev/null 2>&1; then echo "You are missing 'envsubst'. Please install it and retry. If on MacOS, you can get this by installing the gettext package"; exit 1; fi
	@echo Deploying to OpenShift project ${NAMESPACE}
	cat deploy/openshift/kiali-configmap.yaml | VERSION_LABEL=${VERSION_LABEL} NAME_SUFFIX=${NAME_SUFFIX} envsubst | ${OC} create -n ${NAMESPACE} -f -
	cat deploy/openshift/kiali.yaml | IMAGE_NAME=${DOCKER_NAME} IMAGE_VERSION=${DOCKER_VERSION} NAMESPACE=${NAMESPACE} VERSION_LABEL=${VERSION_LABEL} NAME_SUFFIX=${NAME_SUFFIX} VERBOSE_MODE=${VERBOSE_MODE} envsubst | ${OC} create -n ${NAMESPACE} -f -

openshift-undeploy: .openshift-validate
	@echo Undeploying from OpenShift project ${NAMESPACE}
	${OC} delete all,secrets,sa,templates,configmaps,deployments,clusterroles,clusterrolebindings,routerules --selector=app=kiali --selector=version=${VERSION_LABEL} -n ${NAMESPACE}

openshift-reload-image: .openshift-validate
	@echo Refreshing image in OpenShift project ${NAMESPACE}
	${OC} delete pod --selector=app=kiali --selector=version=${VERSION_LABEL} -n ${NAMESPACE}

.k8s-validate:
	@$(eval KUBECTL ?= $(shell which kubectl))
	@${KUBECTL} get namespace ${NAMESPACE} > /dev/null

k8s-deploy: k8s-undeploy
	@if ! which envsubst > /dev/null 2>&1; then echo "You are missing 'envsubst'. Please install it and retry. If on MacOS, you can get this by installing the gettext package"; exit 1; fi
	@echo Deploying to Kubernetes namespace ${NAMESPACE}
	cat deploy/kubernetes/kiali-configmap.yaml | VERSION_LABEL=${VERSION_LABEL} NAME_SUFFIX=${NAME_SUFFIX} envsubst | ${KUBECTL} create -n ${NAMESPACE} -f -
	cat deploy/kubernetes/kiali.yaml | IMAGE_NAME=${DOCKER_NAME} IMAGE_VERSION=${DOCKER_VERSION} NAMESPACE=${NAMESPACE} VERSION_LABEL=${VERSION_LABEL} NAME_SUFFIX=${NAME_SUFFIX} VERBOSE_MODE=${VERBOSE_MODE} envsubst | ${KUBECTL} create -n ${NAMESPACE} -f -

k8s-undeploy: .k8s-validate
	@echo Undeploying from Kubernetes namespace ${NAMESPACE}
	${KUBECTL} delete all,secrets,sa,configmaps,deployments,ingresses,clusterroles,clusterrolebindings,routerules --selector=app=kiali --selector=version=${VERSION_LABEL} -n ${NAMESPACE}

k8s-reload-image: .k8s-validate
	@echo Refreshing image in Kubernetes namespace ${NAMESPACE}
	${KUBECTL} delete pod --selector=app=kiali --selector=version=${VERSION_LABEL} -n ${NAMESPACE}
