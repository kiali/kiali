# Needed for Travis - it won't like the version regex check otherwise
SHELL=/bin/bash

# Identifies the current build.
# These will be embedded in the app and displayed when it starts.
VERSION ?= v1.2.0-SNAPSHOT
COMMIT_HASH ?= $(shell git rev-parse HEAD)

# Indicates which version of the UI console is to be embedded
# in the container image. If "local" the CONSOLE_LOCAL_DIR is
# where the UI project has been git cloned and has its
# content built in its build/ subdirectory.
# WARNING: If you have previously run the 'docker' target but
# later want to change the CONSOLE_VERSION then you must run
# the 'clean' target first before re-running the 'docker' target.
CONSOLE_VERSION ?= latest
CONSOLE_LOCAL_DIR ?= ../../../../../kiali-ui

# Version label is used in the OpenShift/K8S resources to identify
# their specific instances. Kiali resources will have labels of
# "app: kiali" and "version: ${VERSION_LABEL}"
# The default is the VERSION itself.
VERSION_LABEL ?= ${VERSION}

# The minimum Go version that must be used to build the app.
GO_VERSION_KIALI = 1.8.3

# Identifies the container image that will be built and deployed.
CONTAINER_NAME ?= kiali/kiali
CONTAINER_VERSION ?= dev

# These two vars allow Jenkins to override values.
DOCKER_NAME ?= ${CONTAINER_NAME}
QUAY_NAME ?= quay.io/${CONTAINER_NAME}

DOCKER_TAG = ${DOCKER_NAME}:${CONTAINER_VERSION}
QUAY_TAG = ${QUAY_NAME}:${CONTAINER_VERSION}

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
	@echo "Choose a make target to run:"
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

## build-system-test: Building executable for system tests with code coverage enabled
build-system-test:
	@echo Building executable for system tests with code coverage enabled
	go test -c -covermode=count -coverpkg ./...  -o ${GOPATH}/bin/kiali

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
	@${GOPATH}/bin/kiali -v 4 -config config.yaml

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

.prepare-docker-image-files:
	@CONSOLE_VERSION=${CONSOLE_VERSION} CONSOLE_LOCAL_DIR=${CONSOLE_LOCAL_DIR} deploy/get-console.sh
	@echo Preparing container image files...
	@mkdir -p _output/docker
	@cp -r deploy/docker/* _output/docker
	@cp ${GOPATH}/bin/kiali _output/docker

## docker-build-kiali: Build Kiali container image into local docker daemon.
docker-build-kiali: .prepare-docker-image-files
	@echo Building container image for Kiali into local docker daemon...
	docker build -t ${DOCKER_TAG} _output/docker
	docker tag ${DOCKER_TAG} ${QUAY_TAG}

## docker-build-operator: Build Kiali operator container image into local docker daemon.
docker-build-operator:
	@echo Building container image for Kiali operator into local docker daemon...
	OPERATOR_IMAGE_VERSION=${CONTAINER_VERSION} "$(MAKE)" -C operator operator-build

## docker-build: Build Kiali and Kiali operator container images into local docker daemon.
docker-build: docker-build-kiali docker-build-operator

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

## minikube-docker: Build container image into minikube docker daemon.
minikube-docker: .prepare-minikube .prepare-docker-image-files
	@echo Building container image into minikube docker daemon...
	@eval $$(minikube docker-env) ; \
	docker build -t ${DOCKER_TAG} _output/docker
	docker tag ${DOCKER_TAG} ${QUAY_TAG}
	OPERATOR_IMAGE_VERSION=${CONTAINER_VERSION} "$(MAKE)" -C operator operator-build

container-push-operator:
	OPERATOR_IMAGE_VERSION=${CONTAINER_VERSION} "$(MAKE)" -C operator operator-push

container-push-kiali:
	@echo Pushing current image to ${QUAY_TAG}
	docker push ${QUAY_TAG}
	@echo Pushing current image to ${DOCKER_TAG}
	docker push ${DOCKER_TAG}

## container-push: Pushes current container images to remote container repos.
container-push: container-push-kiali container-push-operator

## operator-create: Delegates to the operator-create target of the operator Makefile
operator-create: docker-build-operator
	OPERATOR_IMAGE_VERSION=${CONTAINER_VERSION} "$(MAKE)" -C operator operator-create

.ensure-oc-exists:
	@$(eval OC ?= $(shell which istiooc 2>/dev/null || which oc 2>/dev/null || which kubectl))

.ensure-operator-is-running: .ensure-oc-exists
	@${OC} get pods -l app=kiali-operator -n kiali-operator 2>/dev/null | grep "^kiali-operator.*Running" > /dev/null ;\
	RETVAL=$$?; \
	if [ $$RETVAL -ne 0 ]; then \
	  echo "The Operator is not running. To start it, run: make operator-create"; exit 1; \
	fi

## openshift-deploy: Delegates to the kiali-create target of the operator Makefile
openshift-deploy: openshift-undeploy
	KIALI_IMAGE_VERSION=${CONTAINER_VERSION} "$(MAKE)" -C operator kiali-create

## openshift-undeploy: Delegates to the kiali-delete target of the operator Makefile
openshift-undeploy: .ensure-operator-is-running
	"$(MAKE)" -C operator kiali-delete

## k8s-deploy: Delegates to the kiali-create target of the operator Makefile
k8s-deploy: openshift-deploy

## k8s-undeploy: Delegates to the kiali-delete target of the operator Makefile
k8s-undeploy: openshift-undeploy

## openshift-reload-image: Refreshing image in Openshift project.
openshift-reload-image: .ensure-oc-exists
	@echo Refreshing Kiali image project ${NAMESPACE}
	${OC} delete pod --selector=app=kiali -n ${NAMESPACE}

## k8s-reload-image: Refreshing image in Kubernetes namespace.
k8s-reload-image: openshift-reload-image

#
# Targets when using a CRC-OpenShift VM environment
#

.prepare-crc-vars: .ensure-oc-exists
	@$(eval CRC_REPO_INTERNAL ?= $(shell ${OC} get image.config.openshift.io/cluster -o custom-columns=INT:.status.internalRegistryHostname --no-headers 2>/dev/null))
	@$(eval CRC_REPO ?= $(shell ${OC} get image.config.openshift.io/cluster -o custom-columns=EXT:.status.externalRegistryHostnames[0] --no-headers 2>/dev/null))
	@$(eval CRC_NAME ?= ${CRC_REPO}/${CONTAINER_NAME})
	@$(eval CRC_TAG ?= ${CRC_NAME}:${CONTAINER_VERSION})
	@if [ "${CRC_REPO_INTERNAL}" == "" -o "${CRC_REPO_INTERNAL}" == "<none>" ]; then echo "Cannot determine internal registry hostname"; exit 1; fi
	@if [ "${CRC_REPO}" == "" -o "${CRC_REPO}" == "<none>" ]; then echo "Cannot determine external registry hostname. The OpenShift image registry has not been made available for external client access"; exit 1; fi
	@echo "CRC repos: external=[${CRC_REPO}] internal=[${CRC_REPO_INTERNAL}]"

## crc-docker-build: Builds the images for local development on CRC VM
crc-docker-build: crc-docker-build-operator crc-docker-build-kiali

## crc-docker-build-operator: Builds the operator image for local development on CRC VM
crc-docker-build-operator: .prepare-crc-vars
	@echo Building Kiali Operator for CRC
	OPERATOR_IMAGE_REPO=${CRC_REPO} OPERATOR_IMAGE_VERSION=${CONTAINER_VERSION} "$(MAKE)" -C operator operator-build

## crc-docker-build-kiali: Builds the Kiali image for local development on CRC VM
crc-docker-build-kiali: .prepare-crc-vars .prepare-docker-image-files
	@echo Building Kiali for CRC
	docker build -t ${CRC_TAG} _output/docker

## crc-push: Pushes current container images to CRC VM
crc-push: crc-push-operator crc-push-kiali

## crc-push-operator: Pushes current Kiali operator container image to CRC VM
crc-push-operator: crc-docker-build-operator
	@echo Pushing current Kiali operator image to ${CRC_REPO}
	OPERATOR_IMAGE_REPO=${CRC_REPO} OPERATOR_IMAGE_VERSION=${CONTAINER_VERSION} "$(MAKE)" -C operator crc-operator-push

## crc-push-kiali: Pushes current Kiali container image to CRC VM
crc-push-kiali: crc-docker-build-kiali
	@echo Make sure the image namespace exists
	@${OC} get namespace $(shell echo ${CRC_TAG} | sed -e 's/.*\/\(.*\)\/.*/\1/') > /dev/null 2>&1 || \
     ${OC} create namespace $(shell echo ${CRC_TAG} | sed -e 's/.*\/\(.*\)\/.*/\1/') > /dev/null 2>&1
	@echo Pushing current Kiali image to ${CRC_REPO}
	docker push ${CRC_TAG}
	${OC} policy add-role-to-user system:image-puller system:serviceaccount:${NAMESPACE}:kiali-service-account --namespace=$(shell echo ${CRC_TAG} | sed -e 's/.*\/\(.*\)\/.*/\1/') > /dev/null 2>&1

## crc-operator-create: Creates the operator in the CRC VM
crc-operator-create: .prepare-crc-vars
	OPERATOR_IMAGE_REPO=${CRC_REPO_INTERNAL} OPERATOR_IMAGE_VERSION=${CONTAINER_VERSION} OPERATOR_IMAGE_PULL_POLICY="Always" "$(MAKE)" -C operator operator-create

## crc-kiali-create: Deploys Kiali to CRC VM
crc-kiali-create: .prepare-crc-vars openshift-undeploy
	KIALI_IMAGE_REPO=${CRC_REPO_INTERNAL} KIALI_IMAGE_NAME=${CRC_REPO_INTERNAL}/${CONTAINER_NAME} KIALI_IMAGE_VERSION=${CONTAINER_VERSION} "$(MAKE)" KIALI_IMAGE_PULL_POLICY="Always" -C operator kiali-create

## lint-install: Installs golangci-lint
lint-install:
	curl -sfL https://install.goreleaser.com/github.com/golangci/golangci-lint.sh | sh -s -- -b $$(go env GOPATH)/bin v1.17.1

## lint: Runs golangci-lint
# doc.go is ommited for linting, because it generates lots of warnings.
lint:
	golangci-lint run --skip-files "doc\.go" --tests -D errcheck

## lint-all: Runs gometalinter with items from good to have list but does not run during travis
lint-all:
	gometalinter --disable-all --enable=vet --enable=vetshadow --enable=varcheck --enable=structcheck \
	--enable=ineffassign --enable=unconvert --enable=goimports -enable=gosimple --enable=staticcheck \
	--enable=nakedret --tests  --vendor ./...
