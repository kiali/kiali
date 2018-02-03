VERSION ?= 0.0.1.Final-SNAPSHOT
COMMIT_HASH ?= $(shell git rev-parse HEAD)

DOCKER_NAME = jmazzitelli/sws
DOCKER_VERSION ?= dev
DOCKER_TAG = ${DOCKER_NAME}:${DOCKER_VERSION}

VERBOSE_MODE ?= 4
NAMESPACE ?= default

GO_BUILD_ENVVARS = \
	GOOS=linux \
	GOARCH=amd64 \
	CGO_ENABLED=0 \

all: build

clean:
	@echo Cleaning...
	@rm -f sws
	@rm -rf ${GOPATH}/bin/sws
	@rm -rf ${GOPATH}/pkg/*
	@rm -rf _output/*

build:  clean
	@echo Building...
	${GO_BUILD_ENVVARS} go build \
		-ldflags "-X main.version=${VERSION} -X main.commitHash=${COMMIT_HASH}"

install:
	@echo Installing...
	${GO_BUILD_ENVVARS} go install \
		-ldflags "-X main.version=${VERSION} -X main.commitHash=${COMMIT_HASH}"

build-test:
	@echo Building and installing test dependencies to help speed up test runs.
	go test -i $(shell go list ./... | grep -v -e /vendor/)

test:
	@echo Running tests, excluding third party tests under vendor
	go test $(shell go list ./... | grep -v -e /vendor/)

test-debug:
	@echo Running tests in debug mode, excluding third party tests under vendor
	go test -v $(shell go list ./... | grep -v -e /vendor/)

run:
	@echo Running...
	@sws -v ${VERBOSE_MODE} -config config.yaml

# dep targets - dependency management

dep-install:
	@echo Installing dep itself
	@mkdir -p ${GOPATH}/bin
	@hack/get-go-dep.sh

dep-update:
	@echo Updating dependencies and storing in vendor directory
	@dep ensure

# cloud targets - building images and deploying

docker:
	@echo Building Docker Image...
	@mkdir -p _output/docker
	@cp -r deploy/docker/* _output/docker
	@cp sws _output/docker
	docker build -t ${DOCKER_TAG} _output/docker

openshift-deploy: openshift-undeploy
	@echo Deploying to OpenShift
	oc create -f deploy/openshift/sws-configmap.yaml -n ${NAMESPACE}
	oc process -f deploy/openshift/sws.yaml -p IMAGE_VERSION=${DOCKER_VERSION} | oc create -n ${NAMESPACE} -f -

openshift-undeploy:
	@echo Undeploying from OpenShift
	oc delete all,secrets,sa,templates,configmaps,daemonsets,clusterroles --selector=app=sws -n ${NAMESPACE}

