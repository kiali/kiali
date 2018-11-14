# Needed for Travis - it won't like the version regex check otherwise
SHELL=/bin/bash

# Identifies the current build.
# These will be embedded in the app and displayed when it starts.
VERSION ?= v0.11.0-SNAPSHOT
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

# External Services Configuration
JAEGER_URL ?= http://jaeger-query-istio-system.127.0.0.1.nip.io
GRAFANA_URL ?= http://grafana-istio-system.127.0.0.1.nip.io

# Version label is used in the OpenShift/K8S resources to identify
# their specific instances. Kiali resources will have labels of
# "app: kiali" and "version: ${VERSION_LABEL}"
# The default is the VERSION itself.
VERSION_LABEL ?= ${VERSION}

# The minimum Go version that must be used to build the app.
GO_VERSION_KIALI = 1.8.3

# Identifies the docker image that will be built and deployed.
DOCKER_NAME ?= kiali/kiali
DOCKER_VERSION ?= dev
DOCKER_TAG = ${DOCKER_NAME}:${DOCKER_VERSION}

# If the IMAGE_PULL_POLICY is not defined and its the short version (eg vX.Y and not vX.Y.Z)
# then we need to use the image pull policy of 'Always' otherwise the latest update to that
# branch may not be brought in for users
ifndef IMAGE_PULL_POLICY
	SHORT_VERSION=$(shell if [[ ${DOCKER_VERSION} =~ ^v[0-9]+\.[0-9]+$$ ]]; then echo true; fi)
	ifeq (${SHORT_VERSION}, true)
		IMAGE_PULL_POLICY = Always
	endif

	ifeq ("${DOCKER_VERSION}", "latest")
		IMAGE_PULL_POLICY = Always
	endif

	ifeq ("${DOCKER_VERSION}", "dev")
		IMAGE_PULL_POLICY = IfNotPresent
	endif

endif
# If the IMAGE_PULL_POLICY is defined, then we need to update the token so it can be added
# Otherwise we just use the k8s defaults.
ifdef IMAGE_PULL_POLICY
	IMAGE_PULL_POLICY_TOKEN="imagePullPolicy: ${IMAGE_PULL_POLICY}"
endif

# Indicates the log level the app will use when started.
# <4=INFO
#  4=DEBUG
#  5=TRACE
VERBOSE_MODE ?= 3

# Declares the namespace where the objects are to be deployed.
# For OpenShift, this is the name of the project.
NAMESPACE ?= istio-system

# Use default go1.8 GOPATH if it isn't user defined
GOPATH ?= ${HOME}/go

# Environment variables set when running the Go compiler.
GO_BUILD_ENVVARS = \
	GOOS=linux \
	GOARCH=amd64 \
	CGO_ENABLED=0 \

.PHONY: help
all: help
help: Makefile
	@echo
	@echo " Choose a command run in "$(PROJECTNAME)":"
	@echo
	@sed -n 's/^##//p' $< | column -t -s ':' |  sed -e 's/^/ /'
	@echo

## clean: Clean ${GOPATH}/bin/kiali, ${GOPATH}/pkg/*, _output/docker and the kilai binary
clean:
	@echo Cleaning...
	@rm -f kiali
	@rm -rf ${GOPATH}/bin/kiali
	@rm -rf ${GOPATH}/pkg/*
	@rm -rf _output/docker

## clean-all: Runs `make clean` internally and remove the _output dir
clean-all: clean
	@rm -rf _output

## git-init: Set the hooks under ./git/hooks
git-init:
	@echo Setting Git Hooks
	cp hack/hooks/* .git/hooks

## go-check: Check if the go version installed is supported by Kiali
go-check:
	@hack/check_go_version.sh "${GO_VERSION_KIALI}"

## build: Runs `make go-check` internally and build Kiali binary
build: go-check
	@echo Building...
	${GO_BUILD_ENVVARS} go build \
		-o ${GOPATH}/bin/kiali -ldflags "-X main.version=${VERSION} -X main.commitHash=${COMMIT_HASH}"

## install: Install missing dependencies. Runs `go install` internally
install:
	@echo Installing...
	${GO_BUILD_ENVVARS} go install \
		-ldflags "-X main.version=${VERSION} -X main.commitHash=${COMMIT_HASH}"

## format: Format all the files excluding vendor. Runs `gofmt` internally
format:
	@# Exclude more paths find . \( -path './vendor' -o -path <new_path_to_exclude> \) -prune -o -type f -iname '*.go' -print
	@for gofile in $$(find . -path './vendor' -prune -o -type f -iname '*.go' -print); do \
			gofmt -w $$gofile; \
	done

## build-test: Run tests and installing test dependencies, excluding third party tests under vendor. Runs `go test -i` internally
build-test:
	@echo Building and installing test dependencies to help speed up test runs.
	go test -i $(shell go list ./... | grep -v -e /vendor/)

## test: Run tests, excluding third party tests under vendor. Runs `go test` internally
test:
	@echo Running tests, excluding third party tests under vendor
	go test $(shell go list ./... | grep -v -e /vendor/)

## test-debug: Run tests in debug mode, excluding third party tests under vendor. Runs `go test -v` internally
test-debug:
	@echo Running tests in debug mode, excluding third party tests under vendor
	go test -v $(shell go list ./... | grep -v -e /vendor/)

## test-race: Run tests with race detection, excluding third party tests under vendor. Runs `go test -race` internally
test-race:
	@echo Running tests with race detection, excluding third party tests under vendor
	go test -race $(shell go list ./... | grep -v -e /vendor/)

## test-e2e-setup: Setup Python environment for running test suite
test-e2e-setup:
	@echo Setting up E2E tests
	cd tests/e2e && ./setup.sh

## test-e2e: Run E2E test suite
test-e2e:
	@echo Running E2E tests
	cd tests/e2e && source .kiali-e2e/bin/activate && pytest -s tests/

## run: Run kiali binary
run:
	@echo Running...
	@${GOPATH}/bin/kiali -v ${VERBOSE_MODE} -config config.yaml

#
# dep targets - dependency management
#

## dep-install: Install Glide.
dep-install:
	@echo Installing Glide itself
	@mkdir -p ${GOPATH}/bin
	# We want to pin on a specific version
	# @curl https://glide.sh/get | sh
	@curl https://glide.sh/get | awk '{gsub("get TAG https://glide.sh/version", "TAG=v0.13.1", $$0); print}' | sh

## dep-update: Updating dependencies and storing in vendor directory. Runs `glide update` internally
dep-update:
	@echo Updating dependencies and storing in vendor directory
	@glide update --strip-vendor

#
# Swagger Documentation
#

## swagger-install: Install swagger. Runs `go get swagger` internally
swagger-install:
	go get -u github.com/go-swagger/go-swagger/cmd/swagger

## swagger-validate: Validate that swagger.json is correctly. Runs `swagger validate` internally
swagger-validate:
	@swagger validate ./swagger.json

## swagger-gen: Generate that swagger.json from Code. Runs `swagger generate` internally
swagger-gen:
	@swagger generate spec -o ./swagger.json

## swagger-serve: Serve the swagger.json in a website in local. Runs `swagger serve` internally
swagger-serve: swagger-validate
	@swagger serve ./swagger.json

## swagger-travis: Check that swagger.json is the correct one
swagger-travis: swagger-validate
	@swagger generate spec -o ./swagger_copy.json
	@cmp -s swagger.json swagger_copy.json; \
	RETVAL=$$?; \
	if [ $$RETVAL -ne 0 ]; then \
            echo "SWAGGER FILE IS NOT CORRECT"; exit 1; \
	fi

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
		echo "Downloading console (${CONSOLE_VERSION})..." && \
		mkdir _output/docker/console && \
		curl $$(npm view @kiali/kiali-ui@${CONSOLE_VERSION} dist.tarball) \
		| tar zxf - --strip-components=2 --directory _output/docker/console package/build && \
		echo "$$(npm view @kiali/kiali-ui@${CONSOLE_VERSION} version)" > _output/docker/console/version.txt ;\
	fi
endif
	@echo "Console version being packaged: $$(cat _output/docker/console/version.txt)"

.prepare-docker-image-files: .get-console
	@echo Preparing docker image files...
	@mkdir -p _output/docker
	@cp -r deploy/docker/* _output/docker
	@cp ${GOPATH}/bin/kiali _output/docker

## docker-build: Build docker image into local docker daemon. Runs `docker build` internally
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

## minikube-docker: Build docker image into minikube docker daemon. Runs `docker build` internally
minikube-docker: .prepare-minikube .prepare-docker-image-files
	@echo Building docker image into minikube docker daemon...
	@eval $$(minikube docker-env) ; \
	docker build -t ${DOCKER_TAG} _output/docker

## docker-push: Pushing current docker image to ${DOCKER_TAG}. Runs `docker push` internally
docker-push:
	@echo Pushing current docker image to ${DOCKER_TAG}
	docker push ${DOCKER_TAG}

.openshift-validate:
	@$(eval OC ?= $(shell which istiooc 2>/dev/null || which oc))
	@${OC} get project ${NAMESPACE} > /dev/null

## openshift-deploy: Deploy docker image in Openshift project.
openshift-deploy: openshift-undeploy
	IMAGE_NAME="${DOCKER_NAME}" \
IMAGE_VERSION="${DOCKER_VERSION}" \
IMAGE_PULL_POLICY_TOKEN=${IMAGE_PULL_POLICY_TOKEN} \
VERSION_LABEL="${VERSION_LABEL}" \
NAMESPACE="${NAMESPACE}" \
JAEGER_URL="${JAEGER_URL}" \
GRAFANA_URL="${GRAFANA_URL}"  \
VERBOSE_MODE="${VERBOSE_MODE}" \
deploy/openshift/deploy-kiali-to-openshift.sh

## openshift-undeploy: Undeploy from Openshift project.
openshift-undeploy: .openshift-validate
	@echo Undeploying from OpenShift project ${NAMESPACE}
	${OC} delete all,secrets,sa,templates,configmaps,deployments,clusterroles,clusterrolebindings,virtualservices,destinationrules,ingresses --selector=app=kiali -n ${NAMESPACE}

## openshift-reload-image: Refreshing image in Openshift project.
openshift-reload-image: .openshift-validate
	@echo Refreshing image in OpenShift project ${NAMESPACE}
	${OC} delete pod --selector=app=kiali -n ${NAMESPACE}

.k8s-validate:
	@$(eval KUBECTL ?= $(shell which kubectl))
	@${KUBECTL} get namespace ${NAMESPACE} > /dev/null

## k8s-deploy: Deploy docker image in Kubernetes namespace.
k8s-deploy: k8s-undeploy
	IMAGE_NAME="${DOCKER_NAME}" \
IMAGE_VERSION="${DOCKER_VERSION}" \
IMAGE_PULL_POLICY_TOKEN=${IMAGE_PULL_POLICY_TOKEN} \
VERSION_LABEL="${VERSION_LABEL}" \
NAMESPACE="${NAMESPACE}" \
JAEGER_URL="${JAEGER_URL}" \
GRAFANA_URL="${GRAFANA_URL}"  \
VERBOSE_MODE="${VERBOSE_MODE}" \
deploy/kubernetes/deploy-kiali-to-kubernetes.sh

## k8s-undeploy: Undeploy docker image in Kubernetes namespace.
k8s-undeploy: .k8s-validate
	@echo Undeploying from Kubernetes namespace ${NAMESPACE}
	${KUBECTL} delete all,secrets,sa,configmaps,deployments,ingresses,clusterroles,clusterrolebindings,virtualservices,destinationrules --selector=app=kiali -n ${NAMESPACE}

## k8s-reload-image: Refreshing image in Kubernetes namespace.
k8s-reload-image: .k8s-validate
	@echo Refreshing image in Kubernetes namespace ${NAMESPACE}
	${KUBECTL} delete pod --selector=app=kiali -n ${NAMESPACE}
