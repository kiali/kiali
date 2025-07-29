#
# Targets for building of Kiali from source.
#

## check-ui: Check if the frontend UI is built
check-ui:
	@if [ ! -d ${ROOTDIR}/frontend/build ]; then \
		echo "The frontend UI is not built. Please run 'make build-ui' first."; \
		exit 1; \
	fi

## clean: Clean ${GOPATH}/bin/kiali, ${GOPATH}/pkg/*, ${OUTDIR}/docker and the kiali binary
clean:
	@echo Cleaning...
	@rm -f kiali
	@rm -rf ${GOPATH}/bin/kiali
	@[ -d ${GOPATH}/pkg ] && chmod -R +rw ${GOPATH}/pkg/* 2>/dev/null || true
	@rm -rf ${GOPATH}/pkg/*
	@rm -rf ${OUTDIR}/docker

## clean-ui: Removes the UI build/ and node_modules/ directories.
clean-ui:
	@echo Cleaning UI ...
	@rm -rf ${ROOTDIR}/frontend/node_modules
	@rm -rf ${ROOTDIR}/frontend/build

## clean-all: Runs `make clean` internally, removes the _output dir, and cleans the UI
clean-all: clean clean-ui
	@rm -rf ${OUTDIR}

## go-check: Check if the go version installed is supported by Kiali
go-check:
	@GO=${GO} hack/check_go_version.sh "${GO_VERSION_KIALI}"
	@$(eval GO_ACTUAL_VERSION ?= $(shell ${GO} version | grep -Eo  '[0-9]+\.[0-9]+\.[0-9]+'))
	@echo "Using actual Go version of: ${GO_ACTUAL_VERSION}"

## build: Runs `make go-check` internally and build Kiali binary
build: go-check check-ui
	@echo Building...
	${GO_BUILD_ENVVARS} ${GO} build \
		-o ${GOPATH}/bin/kiali -ldflags "-X main.version=${VERSION} -X main.commitHash=${COMMIT_HASH} -X main.goVersion=${GO_ACTUAL_VERSION}" ${GO_BUILD_FLAGS}

## build-ui: Runs the yarn commands to build the frontend UI
build-ui:
	@cd ${ROOTDIR}/frontend && yarn install --frozen-lockfile && yarn run build

## build-ui-test: Runs the yarn commands to build the dev frontend UI and runs the UI tests
build-ui-test: build-ui
	@cd ${ROOTDIR}/frontend && yarn run test

## build-linux-multi-arch: Build Kiali binary with arch suffix for multi-arch
build-linux-multi-arch: go-check
	@for arch in ${TARGET_ARCHS}; do \
		echo "Building for architecture [$${arch}]"; \
		${GO_BUILD_ENVVARS} GOOS=linux GOARCH=$${arch} ${GO} build \
			-o ${GOPATH}/bin/kiali-$${arch} -ldflags "-X main.version=${VERSION} -X main.commitHash=${COMMIT_HASH} -X main.goVersion=${GO_ACTUAL_VERSION}" ${GO_BUILD_FLAGS}; \
	done

## install: Install missing dependencies. Runs `go install` internally
install: go-check
	@echo Installing...
	${GO_BUILD_ENVVARS} ${GO} install \
		-ldflags "-X main.version=${VERSION} -X main.commitHash=${COMMIT_HASH} -X main.goVersion=${GO_ACTUAL_VERSION}"

## format: Format all the files excluding vendor. Runs `gofmt` and `goimports` internally
format:
	@# Exclude more paths find . \( -path './vendor' -o -path <new_path_to_exclude> \) -prune -o -type f -iname '*.go' -print
	@for gofile in $$(find . -path './vendor' -prune -o -type f -iname '*.go' -print); do \
			${GOFMT} -w $$gofile; \
	done; \
	$(shell ./hack/fix_imports.sh)

## build-system-test: Building executable for system tests with code coverage enabled
build-system-test: go-check
	@echo Building executable for system tests with code coverage enabled
	${GO} test -c -covermode=count -coverpkg $(shell ${GO} list ./... | grep -v test |  awk -vORS=, "{ print $$1 }" | sed "s/,$$//") \
	  -o ${GOPATH}/bin/kiali -ldflags "-X main.version=${VERSION} -X main.commitHash=${COMMIT_HASH} -X main.goVersion=${GO_ACTUAL_VERSION}"

## test: Run tests, excluding third party tests under vendor and frontend. Runs `go test` internally
test: .ensure-envtest-bin-dir-exists
	@echo Running tests, excluding third party tests under vendor
	${GO} test -tags exclude_frontend ${GO_TEST_FLAGS} $(shell ${GO} list -tags exclude_frontend ./... | grep -v -e /vendor/ -e /frontend/ -e /tests/integration/)

## test-integration-setup: Setup go library for converting test result into junit xml
test-integration-setup:
	@echo Setting up Integration tests
	go install github.com/jstemmer/go-junit-report@latest

## test-integration: Run Integration test suite
test-integration: test-integration-setup
	@echo Running Integration tests
	cd tests/integration/tests && ${GO} test ${GO_TEST_FLAGS} -v -timeout 30m 2>&1 | tee >(go-junit-report > ../junit-rest-report.xml) ../int-test.log
	@echo Test results can be found here: $$(ls -1 ${ROOTDIR}/tests/integration/junit-rest-report.xml)

## test-integration-controller: Run controller integration test suite. These are not real e2e tests like the other integration tests.
test-integration-controller: .ensure-envtest-bin-dir-exists .ensure-yq-exists
	$(eval ISTIO_VERSION ?= $(shell helm show chart --repo https://istio-release.storage.googleapis.com/charts base | yq '.version'))
	$(eval ISTIO_MINOR_VERSION := $(shell cut -d "." -f 1-2 <<< ${ISTIO_VERSION}))
	@if [[ "$(ISTIO_MINOR_VERSION)" == *latest ]]; then \
		$(eval latest := $(shell echo "$(ISTIO_MINOR_VERSION)" | sed 's/-latest$$//')) \
		if [ -z "$$latest" ]; then \
			$(eval ISTIO_MINOR_VERSION := $(shell echo ${latest})) \
			echo "Istio minor with latest: ${latest}"; \
		fi \
	fi
	$(eval CRD_FILE := tests/integration/controller/testdata/istio-crds/${ISTIO_MINOR_VERSION}.yaml)
	@if [ ! -f "${CRD_FILE}" ]; then \
		echo "the CRD yamls for Istio version '${ISTIO_MINOR_VERSION}' are missing at '${CRD_FILE}' - run 'make download-istio-crds' to download them and then check them into git" && exit 1; \
	fi
	@echo Running controller integration tests
	cd tests/integration/controller && ${GO} test -v

#
# Lint targets
#

## lint-install: Installs golangci-lint
lint-install:
	curl -sfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $$(${GO} env GOPATH)/bin v2.3.0

## lint: Runs golangci-lint
# doc.go is ommited for linting, because it generates lots of warnings.
lint:
	golangci-lint run -c ./.github/workflows/config/.golangci.yml

# Assuming here that if the bin dir exists then the tools also exist inside of it.
.ensure-envtest-bin-dir-exists: .ensure-envtest-exists
	@if [ ! -d "${OUTDIR}/k8s" ]; then \
		setup-envtest use --bin-dir "${OUTDIR}"; \
	fi

## Download setup-envtest locally if necessary.
.ensure-envtest-exists:
	@if [ ! -x envtest ]; then \
	  ${GO} install sigs.k8s.io/controller-runtime/tools/setup-envtest@latest; \
	fi

YQ := $(shell command -v yq 2> /dev/null)
.ensure-yq-exists:
ifndef YQ
	$(error "'yq' needs to be installed to run this command. Please install 'yq' and re-run this command.")
endif

## Download istio-crds to testdata dir if necessary.
## You can specify the istio version like this: make ISTIO_VERSION=1.24 download-istio-crds
download-istio-crds: .ensure-yq-exists
	$(eval ISTIO_VERSION ?= $(shell helm show chart --repo https://istio-release.storage.googleapis.com/charts base | yq '.version'))
	$(eval ISTIO_MINOR_VERSION := $(shell cut -d "." -f 1-2 <<< ${ISTIO_VERSION}))
	$(eval CRD_FILE := tests/integration/controller/testdata/istio-crds/${ISTIO_MINOR_VERSION}.yaml)
	@if [ ! -f "${CRD_FILE}" ]; then \
		echo "Downloading istio crds to ${CRD_FILE}"; \
		mkdir -p tests/integration/controller/testdata; \
		helm template --include-crds --version ${ISTIO_VERSION} --repo https://istio-release.storage.googleapis.com/charts base | yq ea 'select(.kind == "CustomResourceDefinition")' > ${CRD_FILE}; \
	fi
