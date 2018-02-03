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

docker:
	@echo Building Docker Image...
	@mkdir -p _output/docker
	@cp -r deploy/docker/* _output/docker
	@cp sws _output/docker	
	docker build -t ${DOCKER_TAG} _output/docker

openshift-deploy: openshift-undeploy
	@echo Deploying Components to OpenShift
	oc create -f deploy/openshift/sws-configmap.yaml -n ${NAMESPACE}
	oc process -f deploy/openshift/sws.yaml -v IMAGE_VERSION=${DOCKER_VERSION} | oc create -n ${NAMESPACE} -f -

openshift-undeploy:
	@echo Undeploying Components from OpenShift
	oc delete all,secrets,sa,templates,configmaps,daemonsets,clusterroles --selector=app=sws -n ${NAMESPACE}

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

# Glide Targets
#   install-glide - Installs the Glide executable itself. Just need to do this once.
#   glide-create  - Examines all imports and creates Glide YAML file.
#   install-deps  - Installs the dependencies declared in the Glide Lock file in the
#                   vendor directory. Does an update and creates the Glide Lock file if necessary.
#                   Use this to install the dependencies after cloning the git repo.
#   update-deps   - Updates the dependencies found in the Glide YAML file and
#                   installs them in the vendor directory. Creates/Updates the Glide Lock file.
#                   Use this if you've updated or added dependencies.

install-glide:
	@echo Installing Glide itself
	@mkdir -p ${GOPATH}/bin
	@curl https://glide.sh/get | sh

glide-create:
	@echo Creating Glide YAML file
	@glide create

install-deps:
	@echo Installing dependencies in vendor directory
	@glide install --strip-vendor

update-deps:
	@echo Updating dependencies and storing in vendor directory
	@glide update --strip-vendor
