#
# These targets build the containers without any cluster environment in mind.
# Instead, the containers built are tagged for publishing to quay.io and/or docker.io.
#

.prepare-kiali-image-files:
	@CONSOLE_LOCAL_DIR=${CONSOLE_LOCAL_DIR} deploy/get-console.sh
	@echo Preparing container image files
	@mkdir -p ${OUTDIR}/docker
	@cp -r deploy/docker/* ${OUTDIR}/docker
	@cp ${GOPATH}/bin/kiali* ${OUTDIR}/docker

## container-build-kiali: Build Kiali container image.
container-build-kiali: .prepare-kiali-image-files
ifeq ($(DORP),docker)
	@echo Building container image for Kiali using docker
	docker build --pull -t ${QUAY_TAG} -f ${OUTDIR}/docker/${KIALI_DOCKER_FILE} ${OUTDIR}/docker
else
	@echo Building container image for Kiali using podman
	podman build --pull -t ${QUAY_TAG} -f ${OUTDIR}/docker/${KIALI_DOCKER_FILE} ${OUTDIR}/docker
endif

## container-build-operator: Build Kiali operator container image.
container-build-operator: .ensure-operator-repo-exists
	@echo Building container image for Kiali operator
	$(MAKE) -C "${ROOTDIR}/operator" -e "OPERATOR_QUAY_TAG=${OPERATOR_QUAY_TAG}" build

## container-build: Build Kiali and Kiali operator container images
# On x86_64 machine, build both kiali and operator images.
ifeq ($(GOARCH),amd64)
container-build: container-build-kiali container-build-operator
# On other achitectures, only build kiali image.
else
container-build: container-build-kiali
endif

## container-build-int-tests: Build Kiali integration tests container image
container-build-int-tests:
ifeq ($(DORP),docker)
	@echo Building container image for Kiali integration tests using docker
	docker build --pull -t ${INT_TESTS_QUAY_TAG} --build-arg="GO_VERSION=${GO_VERSION_KIALI}" -f tests/integration/Dockerfile .
else
	@echo Building container image for Kiali integration tests using podman
	podman build --pull -t ${INT_TESTS_QUAY_TAG} --build-arg="GO_VERSION=${GO_VERSION_KIALI}" -f tests/integration/Dockerfile .
endif

## container-build-cypress-tests: Build Kiali cypress tests container image
container-build-cypress-tests:
ifeq ($(DORP),docker)
	@echo Building container image for Kiali cypress tests using docker
	docker build --pull -t ${CYPRESS_TESTS_QUAY_TAG} -f deploy/docker/Dockerfile-cypress .
else
	@echo Building container image for Kiali cypress tests using podman
	podman build --pull -t ${CYPRESS_TESTS_QUAY_TAG} -f deploy/docker/Dockerfile-cypress .
endif

## container-push-kiali-quay: Pushes the Kiali image to quay.
container-push-kiali-quay:
ifeq ($(DORP),docker)
	@echo Pushing Kiali image to ${QUAY_TAG} using docker
	docker push ${QUAY_TAG}
else
	@echo Pushing Kiali image to ${QUAY_TAG} using podman
	podman push ${QUAY_TAG}
endif

## container-push-operator-quay: Pushes the operator image to quay.
container-push-operator-quay:
	$(MAKE) -C "${ROOTDIR}/operator" -e "OPERATOR_QUAY_TAG=${OPERATOR_QUAY_TAG}" push

## container-push: Pushes all container images to quay
container-push: container-push-kiali-quay container-push-operator-quay

## container-push-int-tests-quay: Pushes the Kiali integration test image to quay.
container-push-int-tests-quay:
ifeq ($(DORP),docker)
	@echo Pushing Kiali integration test image to ${INT_TESTS_QUAY_TAG} using docker
	docker push ${INT_TESTS_QUAY_TAG}
else
	@echo Pushing Kiali integration test image to ${INT_TESTS_QUAY_TAG} using podman
	podman push ${INT_TESTS_QUAY_TAG}
endif

## container-push-cypress-tests-quay: Pushes the Kiali cypress test image to quay.
container-push-cypress-tests-quay:
ifeq ($(DORP),docker)
	@echo Pushing Kiali cypress test image to ${CYPRESS_TESTS_QUAY_TAG} using docker
	docker push ${CYPRESS_TESTS_QUAY_TAG}
else
	@echo Pushing Kiali cypress test image to ${CYPRESS_TESTS_QUAY_TAG} using podman
	podman push ${CYPRESS_TESTS_QUAY_TAG}
endif

# Ensure "docker buildx" is available and enabled. For more details, see: https://github.com/docker/buildx/blob/master/README.md
# This does a few things:
#  1. Makes sure docker is in PATH
#  2. Downloads and installs buildx if no version of buildx is installed yet
#  3. Makes sure any installed buildx is a required version or newer
#  4. Makes sure the user has enabled buildx (either by default or by setting DOCKER_CLI_EXPERIMENTAL env var to 'enabled')
#  Thus, this target will only ever succeed if a required (or newer) version of 'docker buildx' is available and enabled.
.ensure-docker-buildx:
	@if ! which docker > /dev/null 2>&1; then echo "'docker' is not in your PATH."; exit 1; fi
	@required_buildx_version="0.4.2"; \
	if ! DOCKER_CLI_EXPERIMENTAL="enabled" docker buildx version > /dev/null 2>&1 ; then \
	  buildx_download_url="https://github.com/docker/buildx/releases/download/v$${required_buildx_version}/buildx-v$${required_buildx_version}.${GOOS}-${GOARCH}"; \
	  echo "You do not have 'docker buildx' installed. Will now download from [$${buildx_download_url}] and install it to [${HOME}/.docker/cli-plugins]."; \
	  mkdir -p ${HOME}/.docker/cli-plugins; \
	  curl -L --output ${HOME}/.docker/cli-plugins/docker-buildx "$${buildx_download_url}"; \
	  chmod a+x ${HOME}/.docker/cli-plugins/docker-buildx; \
	  installed_version="$$(DOCKER_CLI_EXPERIMENTAL="enabled" docker buildx version || echo "unknown")"; \
	  if docker buildx version > /dev/null 2>&1; then \
	    echo "'docker buildx' has been installed and is enabled [version=$${installed_version}]"; \
	  else \
	    echo "An attempt to install 'docker buildx' has been made but it either failed or is not enabled by default. [version=$${installed_version}]"; \
	    echo "Set DOCKER_CLI_EXPERIMENTAL=enabled to enable it."; \
	    exit 1; \
	  fi \
	fi; \
	current_buildx_version="$$(DOCKER_CLI_EXPERIMENTAL=enabled docker buildx version 2>/dev/null | sed -E 's/.*v([0-9]+\.[0-9]+\.[0-9]+).*/\1/g')"; \
	is_valid_buildx_version="$$(if [ "$$(printf $${required_buildx_version}\\n$${current_buildx_version} | sort -V | head -n1)" == "$${required_buildx_version}" ]; then echo "true"; else echo "false"; fi)"; \
	if [ "$${is_valid_buildx_version}" == "true" ]; then \
	  echo "A valid version of 'docker buildx' is available: $${current_buildx_version}"; \
	else \
	  echo "You have an older version of 'docker buildx' that is not compatible. Please upgrade to at least v$${required_buildx_version}"; \
	  exit 1; \
	fi; \
	if docker buildx version > /dev/null 2>&1; then \
	  echo "'docker buildx' is enabled"; \
	else \
	  echo "'docker buildx' is not enabled. Set DOCKER_CLI_EXPERIMENTAL=enabled if you want to use it."; \
	  exit 1; \
	fi

# Ensure a local builder for multi-arch build. For more details, see: https://github.com/docker/buildx/blob/master/README.md#building-multi-platform-images
.ensure-buildx-builder: .ensure-docker-buildx
	@if ! docker buildx inspect kiali-builder > /dev/null 2>&1; then \
	  echo "The buildx builder instance named 'kiali-builder' does not exist. Creating one now."; \
	  if ! docker buildx create --name=kiali-builder --driver-opt=image=moby/buildkit:v0.13.2; then \
	    echo "Failed to create the buildx builder 'kiali-builder'"; \
	    exit 1; \
	  fi \
	fi; \
	if [[ $$(uname -s) == "Linux" ]]; then \
	  echo "Ensuring QEMU is set up for this Linux host"; \
	  if ! docker run --privileged --rm tonistiigi/binfmt:latest --install all; then \
	    echo "Failed to ensure QEMU is set up. This build will be allowed to continue, but it may fail at a later step."; \
	  fi \
	fi


## container-multi-arch-push-kiali-operator-quay: Pushes the Kiali Operator multi-arch image to quay.
container-multi-arch-push-kiali-operator-quay: .ensure-operator-repo-exists .ensure-buildx-builder
	@echo Pushing Kiali Operator multi-arch image to ${OPERATOR_QUAY_TAG} using docker buildx
	docker buildx build --push --pull --no-cache --builder=kiali-builder $(foreach arch,${TARGET_ARCHS},--platform=linux/${arch}) $(foreach tag,${OPERATOR_QUAY_TAG},--tag=${tag}) -f ${ROOTDIR}/operator/build/Dockerfile ${ROOTDIR}/operator

## container-multi-arch-push-kiali-quay: Pushes the Kiali multi-arch image to quay.
container-multi-arch-push-kiali-quay: .ensure-buildx-builder .prepare-kiali-image-files
	@echo Pushing Kiali multi-arch image to ${QUAY_TAG}-distro using docker buildx
	docker buildx build --push --pull --no-cache --builder=kiali-builder $(foreach arch,${TARGET_ARCHS},--platform=linux/${arch}) $(foreach tag,${QUAY_TAG},--tag=${tag}-distro) -f ${OUTDIR}/docker/Dockerfile-multi-arch ${OUTDIR}/docker

## container-multi-arch-distroless-push-kiali-quay: Pushes the Kiali multi-arch distroless image to quay.
container-multi-arch-distroless-push-kiali-quay: .ensure-buildx-builder .prepare-kiali-image-files
	@echo Pushing Kiali multi-arch distroless image to ${QUAY_TAG} using docker buildx
	docker buildx build --push --pull --no-cache --builder=kiali-builder $(foreach arch,${TARGET_ARCHS},--platform=linux/${arch}) $(foreach tag,${QUAY_TAG},--tag=${tag}) -f ${OUTDIR}/docker/Dockerfile-multi-arch-distroless ${OUTDIR}/docker

## container-multi-arch-all-push-kiali-quay: Pushes the Kiali all multi-arch images to quay.
container-multi-arch-all-push-kiali-quay: container-multi-arch-push-kiali-quay container-multi-arch-distroless-push-kiali-quay
