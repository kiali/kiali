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
		-o ${GOPATH}/bin/sws -ldflags "-X main.version=${VERSION} -X main.commitHash=${COMMIT_HASH}"

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
	@./sws -v ${VERBOSE_MODE} -config config.yaml

# dep targets - dependency management

dep-install:
	@echo Installing Glide itself
	@mkdir -p ${GOPATH}/bin
	# We want to pin on a specific version
	# @curl https://glide.sh/get | sh
	@curl https://glide.sh/get | awk '{gsub("get TAG https://glide.sh/version", "TAG=v0.13.1", $$0); print}' | sh

dep-update:
	@echo Updating dependencies and storing in vendor directory
	@glide update --strip-vendor

# cloud targets - building images and deploying

docker:
	@echo Building Docker Image...
	@mkdir -p _output/docker
	@cp -r deploy/docker/* _output/docker
	@cp ${GOPATH}/bin/sws _output/docker
	@npm --prefix _output/docker/npm -g install swsui
	docker build -t ${DOCKER_TAG} _output/docker

openshift-deploy: openshift-undeploy
	@echo Deploying to OpenShift
	oc create -f deploy/openshift/sws-configmap.yaml -n ${NAMESPACE}
	oc process -f deploy/openshift/sws.yaml -p IMAGE_VERSION=${DOCKER_VERSION} | oc create -n ${NAMESPACE} -f -

openshift-undeploy:
	@echo Undeploying from OpenShift
	oc delete all,secrets,sa,templates,configmaps,daemonsets,clusterroles --selector=app=sws -n ${NAMESPACE}

k8s-deploy: k8s-undeploy
	@echo Deploying to Kubernetes
	kubectl create -f deploy/kubernetes/sws-configmap.yaml -n ${NAMESPACE}
	kubectl create -f deploy/kubernetes/sws.yaml -n ${NAMESPACE}

k8s-undeploy:
	@echo Undeploying from Kubernetes
	kubectl delete all,secrets,sa,configmaps,daemonsets,clusterroles --selector=app=sws -n ${NAMESPACE}

