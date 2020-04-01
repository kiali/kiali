#
# These targets build the containers without any cluster environment in mind.
# Instead, the containers built are tagged for publishing to quay.io and/or docker.io.
#

.prepare-kiali-image-files:
	@CONSOLE_VERSION=${CONSOLE_VERSION} CONSOLE_LOCAL_DIR=${CONSOLE_LOCAL_DIR} deploy/get-console.sh
	@echo Preparing container image files
	@mkdir -p ${OUTDIR}/docker
	@cp -r deploy/docker/* ${OUTDIR}/docker
	@cp ${GOPATH}/bin/kiali ${OUTDIR}/docker

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
	docker build --pull -t ${DOCKER_TAG} -f ${OUTDIR}/docker/${KIALI_DOCKER_FILE} ${OUTDIR}/docker
	docker tag ${DOCKER_TAG} ${QUAY_TAG}
else
	@echo Building container image for Kiali using podman
	podman build --pull -t ${DOCKER_TAG} -f ${OUTDIR}/docker/${KIALI_DOCKER_FILE} ${OUTDIR}/docker
	podman tag ${DOCKER_TAG} ${QUAY_TAG}
endif

## container-build-operator: Build Kiali operator container image.
container-build-operator: .ensure-operator-sdk-exists
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

## container-push-kiali-docker: Pushes the Kiali image to docker hub.
# TODO when can we stop publishing to docker.io?
container-push-kiali-docker:
ifeq ($(DORP),docker)
	@echo Pushing current image to ${DOCKER_TAG} using docker
	docker push ${DOCKER_TAG}
else
	@echo Pushing current image to ${DOCKER_TAG} using podman
	podman push ${DOCKER_TAG}
endif

## container-push-operator: Pushes the operator image to quay.
container-push-operator-quay:
ifeq ($(DORP),docker)
	@echo Pushing Kiali operator image using docker
	docker push ${OPERATOR_QUAY_TAG}
else
	@echo Pushing Kiali operator image using podman
	podman push ${OPERATOR_QUAY_TAG}
endif

## container-push: Pushes all container images to quay and docker hub.
# On x86_64 machine, push both kiali and operator images.
ifeq ($(GOARCH),amd64)
container-push: container-push-kiali-quay container-push-kiali-docker container-push-operator-quay
# On other achitectures, only push kiali image.
else
container-push: container-push-kiali-quay container-push-kiali-docker
endif
