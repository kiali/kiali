#
# These targets build the containers without any cluster environment in mind.
# Instead, the containers built are tagged for publishing to quay.io and/or docker.io.
#

.prepare-kiali-image-files:
	@CONSOLE_VERSION=${CONSOLE_VERSION} CONSOLE_LOCAL_DIR=${CONSOLE_LOCAL_DIR} deploy/get-console.sh
	@echo Preparing container image files
	@mkdir -p ${OUTDIR}/docker
	@cp -r deploy/docker/* ${OUTDIR}/docker
	@cp ${GOPATH}/bin/kiali* ${OUTDIR}/docker

.download-operator-sdk-if-needed:
	@if [ "$(shell which operator-sdk 2>/dev/null || echo -n "")" == "" ]; then \
	  mkdir -p "${OUTDIR}/operator-sdk-install" ;\
	  if [ -x "${OUTDIR}/operator-sdk-install/operator-sdk" ]; then \
	    echo "You do not have operator-sdk installed in your PATH. Will use the one found here: ${OUTDIR}/operator-sdk-install/operator-sdk" ;\
	  else \
	    echo "You do not have operator-sdk installed in your PATH. The binary will be downloaded to ${OUTDIR}/operator-sdk-install/operator-sdk" ;\
	    curl -L https://github.com/operator-framework/operator-sdk/releases/download/v0.16.0/operator-sdk-v0.16.0-x86_64-linux-gnu > "${OUTDIR}/operator-sdk-install/operator-sdk" ;\
	    chmod +x "${OUTDIR}/operator-sdk-install/operator-sdk" ;\
	  fi ;\
	fi

.ensure-operator-sdk-exists: .download-operator-sdk-if-needed
	@$(eval OP_SDK ?= $(shell which operator-sdk 2>/dev/null || echo "${OUTDIR}/operator-sdk-install/operator-sdk"))
	@"${OP_SDK}" version

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
container-build-operator: .ensure-operator-repo-exists .ensure-operator-sdk-exists
	@echo Building container image for Kiali operator using operator-sdk
	cd "${ROOTDIR}/operator" && "${OP_SDK}" build --image-builder ${DORP} --image-build-args "--pull" "${OPERATOR_QUAY_TAG}"

## container-build: Build Kiali and Kiali operator container images
# On x86_64 machine, build both kiali and operator images.
ifeq ($(GOARCH),amd64)
container-build: container-build-kiali container-build-operator
# On other achitectures, only build kiali image.
else
container-build: container-build-kiali
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

## container-push: Pushes all container images to quay
container-push: container-push-kiali-quay

# Ensure "docker buildx" is available and enabled. For more details, see: https://github.com/docker/buildx/blob/master/README.md
.ensure-docker-buildx:
	@if docker buildx version > /dev/null 2>&1 || DOCKER_CLI_EXPERIMENTAL="${DOCKER_CLI_EXPERIMENTAL}" docker buildx version > /dev/null 2>&1 ; then \
	  echo "'docker buildx' is available and enabled."; \
	else \
	  echo "installing docker buildx"; \
	  mkdir -p ~/.docker/cli-plugins; \
	  curl -L --output ~/.docker/cli-plugins/docker-buildx https://github.com/docker/buildx/releases/download/v0.4.2/buildx-v0.4.2.$$(go env GOOS)-$$(go env GOARCH); \
	  chmod a+x ~/.docker/cli-plugins/docker-buildx; \
	  docker buildx version; \
	  echo "'docker buildx' is available and enabled. Set DOCKER_CLI_EXPERIMENTAL=enabled if you want to use it."; \
	fi

# Ensure a local builder for multi-arch build. For more details, see: https://github.com/docker/buildx/blob/master/README.md#building-multi-platform-images
.ensure-buildx-builder:
	@if [[  ! -f ~/.docker/buildx/instances/kiali-builder ]]; then \
  		echo "builder 'kiali-builder' not exists. creating 'kiali-builder'"; \
  		DOCKER_CLI_EXPERIMENTAL="enabled" docker buildx create --name=kiali-builder; \
  	fi; \
	if [[ $$(uname -s) == "Linux" ]]; then \
	  	echo "setup qemu for Linux"; \
		docker run --privileged --rm tonistiigi/binfmt --install all; \
	fi; \
	echo "buildx use 'kiali-builder'"; \
	DOCKER_CLI_EXPERIMENTAL="enabled" docker buildx use kiali-builder

## container-multi-arch-push-kiali-quay: Pushes the Kiali multi-arch image to quay.
container-multi-arch-push-kiali-quay: .ensure-docker-buildx .ensure-buildx-builder .prepare-kiali-image-files
	@echo Pushing Kiali multi-arch image to ${QUAY_TAG} using docker buildx
	DOCKER_CLI_EXPERIMENTAL="enabled" docker buildx build --push $(foreach arch,${TARGET_ARCHS},--platform=linux/${arch}) $(foreach tag,${QUAY_TAG},--tag=${tag}) -f ${OUTDIR}/docker/Dockerfile-multi-arch ${OUTDIR}/docker
