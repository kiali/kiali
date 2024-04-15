#
# Targets for building of Kiali from source.
#

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
build: go-check
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
test:
	@echo Running tests, excluding third party tests under vendor
	${GO} test ${GO_TEST_FLAGS} $(shell ${GO} list ./... | grep -v -e /vendor/ -e /frontend/ -e /tests/integration/)

## test-integration-setup: Setup go library for converting test result into junit xml
test-integration-setup:
	@echo Setting up Integration tests
	go install github.com/jstemmer/go-junit-report@latest

## test-integration: Run Integration test suite
test-integration: test-integration-setup
	@echo Running Integration tests
	cd tests/integration/tests && ${GO} test ${GO_TEST_FLAGS} -v -timeout 30m 2>&1 | tee >(go-junit-report > ../junit-rest-report.xml) ../int-test.log
	@echo Test results can be found here: $$(ls -1 ${ROOTDIR}/tests/integration/junit-rest-report.xml)

#
# Lint targets
#

## lint-install: Installs golangci-lint
lint-install:
	curl -sfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $$(${GO} env GOPATH)/bin v1.57.2

## lint: Runs golangci-lint
# doc.go is ommited for linting, because it generates lots of warnings.
lint:
	golangci-lint run -c ./.github/workflows/config/.golangci.yml
