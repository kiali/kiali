#
# Targets for building and pushing images for deployment into a remote cluster.
# Today this supports minikube and OpenShift4.
# If using minikube, you must have the registry addon enabled ("minikube addons enable registry")
# If using OpenShift, you must expose the image registry externally.
#

.prepare-ocp: .ensure-oc-exists
	@$(eval CLUSTER_REPO_INTERNAL ?= $(shell ${OC} get image.config.openshift.io/cluster -o custom-columns=INT:.status.internalRegistryHostname --no-headers 2>/dev/null))
	@$(eval CLUSTER_REPO ?= $(shell ${OC} get image.config.openshift.io/cluster -o custom-columns=EXT:.status.externalRegistryHostnames[0] --no-headers 2>/dev/null))
	@$(eval CLUSTER_KIALI_INTERNAL_NAME ?= ${CLUSTER_REPO_INTERNAL}/${CONTAINER_NAME})
	@$(eval CLUSTER_KIALI_NAME ?= ${CLUSTER_REPO}/${CONTAINER_NAME})
	@$(eval CLUSTER_KIALI_TAG ?= ${CLUSTER_KIALI_NAME}:${CONTAINER_VERSION})
	@$(eval CLUSTER_OPERATOR_INTERNAL_NAME ?= ${CLUSTER_REPO_INTERNAL}/${OPERATOR_CONTAINER_NAME})
	@$(eval CLUSTER_OPERATOR_NAME ?= ${CLUSTER_REPO}/${OPERATOR_CONTAINER_NAME})
	@$(eval CLUSTER_OPERATOR_TAG ?= ${CLUSTER_OPERATOR_NAME}:${OPERATOR_CONTAINER_VERSION})
	@if [ "${CLUSTER_REPO_INTERNAL}" == "" -o "${CLUSTER_REPO_INTERNAL}" == "<none>" ]; then echo "Cannot determine OCP internal registry hostname. Make sure you 'oc login' to your cluster."; exit 1; fi
	@if [ "${CLUSTER_REPO}" == "" -o "${CLUSTER_REPO}" == "<none>" ]; then echo "Cannot determine OCP external registry hostname. The OpenShift image registry has not been made available for external client access"; exit 1; fi
	@echo "OCP repos: external=[${CLUSTER_REPO}] internal=[${CLUSTER_REPO_INTERNAL}]"
	@${OC} get namespace $(shell echo ${CLUSTER_KIALI_NAME} | sed -e 's/.*\/\(.*\)\/.*/\1/') > /dev/null 2>&1 || \
     ${OC} create namespace $(shell echo ${CLUSTER_KIALI_NAME} | sed -e 's/.*\/\(.*\)\/.*/\1/') > /dev/null 2>&1
	@${OC} policy add-role-to-user system:image-puller system:serviceaccount:${NAMESPACE}:kiali-service-account --namespace=$(shell echo ${CLUSTER_KIALI_NAME} | sed -e 's/.*\/\(.*\)\/.*/\1/') > /dev/null 2>&1
	@${OC} get namespace $(shell echo ${CLUSTER_OPERATOR_NAME} | sed -e 's/.*\/\(.*\)\/.*/\1/') > /dev/null 2>&1 || \
     ${OC} create namespace $(shell echo ${CLUSTER_OPERATOR_NAME} | sed -e 's/.*\/\(.*\)\/.*/\1/') > /dev/null 2>&1
	@${OC} policy add-role-to-user system:image-puller system:serviceaccount:${OPERATOR_NAMESPACE}:kiali-operator --namespace=$(shell echo ${CLUSTER_OPERATOR_NAME} | sed -e 's/.*\/\(.*\)\/.*/\1/') > /dev/null 2>&1

.prepare-minikube: .ensure-oc-exists .ensure-minikube-exists
	@$(eval CLUSTER_REPO_INTERNAL ?= localhost:5000)
	@$(eval CLUSTER_REPO ?= $(shell ${MINIKUBE} -p ${MINIKUBE_PROFILE} ip 2>/dev/null):5000)
	@$(eval CLUSTER_KIALI_INTERNAL_NAME ?= ${CLUSTER_REPO_INTERNAL}/${CONTAINER_NAME})
	@$(eval CLUSTER_KIALI_NAME ?= ${CLUSTER_REPO}/${CONTAINER_NAME})
	@$(eval CLUSTER_KIALI_TAG ?= ${CLUSTER_KIALI_NAME}:${CONTAINER_VERSION})
	@$(eval CLUSTER_OPERATOR_INTERNAL_NAME ?= ${CLUSTER_REPO_INTERNAL}/${OPERATOR_CONTAINER_NAME})
	@$(eval CLUSTER_OPERATOR_NAME ?= ${CLUSTER_REPO}/${OPERATOR_CONTAINER_NAME})
	@$(eval CLUSTER_OPERATOR_TAG ?= ${CLUSTER_OPERATOR_NAME}:${OPERATOR_CONTAINER_VERSION})
	@if [ "${CLUSTER_REPO_INTERNAL}" == "" ]; then echo "Cannot determine minikube internal registry hostname."; exit 1; fi
	@if [ "${CLUSTER_REPO}" == "" ]; then echo "Cannot determine minikube external registry hostname. Make sure minikube is running."; exit 1; fi
	@echo "Minikube repos: external=[${CLUSTER_REPO}] internal=[${CLUSTER_REPO_INTERNAL}]"
	@if ! ${MINIKUBE} -p ${MINIKUBE_PROFILE} addons list | grep "registry" | grep "enabled"; then \
	   echo "Minikube does not have the registry addon enabled. Run 'minikube addons enable registry' in order for the make targets to work."; \
		exit 1 ;\
	 fi

.prepare-local: .ensure-oc-exists
	@$(eval CLUSTER_KIALI_INTERNAL_NAME ?= ${CONTAINER_NAME})
	@$(eval CLUSTER_KIALI_TAG ?= ${CONTAINER_NAME}:${CONTAINER_VERSION})
	@$(eval CLUSTER_OPERATOR_INTERNAL_NAME ?= ${OPERATOR_CONTAINER_NAME})
	@$(eval CLUSTER_OPERATOR_TAG ?= ${OPERATOR_CONTAINER_NAME}:${OPERATOR_CONTAINER_VERSION})

ifeq ($(CLUSTER_TYPE),minikube)
.prepare-cluster: .prepare-minikube
else ifeq ($(CLUSTER_TYPE),openshift)
.prepare-cluster: .prepare-ocp
else ifeq ($(CLUSTER_TYPE),local)
.prepare-cluster: .prepare-local
else
.prepare-cluster:
	@echo "ERROR: unknown CLUSTER_TYPE [${CLUSTER_TYPE}] - must be one of: openshift, minikube, local"
	@exit 1
endif

## cluster-status: Outputs details of the client and server for the cluster
cluster-status: .prepare-cluster
	@echo "==============="
	@echo "CLUSTER DETAILS"
	@echo "==============="
	@echo "Client executable: ${OC}"
	@echo "==============="
	${OC} version
	@echo "==============="
	${OC} cluster-info
	@echo "==============="
	@if [[ "${OC}" = *"oc" ]]; then echo "${OC} whoami -c"; ${OC} whoami -c; echo "==============="; fi
	@echo "Kiali image as seen from inside the cluster:       ${CLUSTER_KIALI_INTERNAL_NAME}"
	@echo "Kiali image that will be pushed to the cluster:    ${CLUSTER_KIALI_TAG}"
	@echo "Operator image as seen from inside the cluster:    ${CLUSTER_OPERATOR_INTERNAL_NAME}"
	@echo "Operator image that will be pushed to the cluster: ${CLUSTER_OPERATOR_TAG}"

## cluster-build-operator: Builds the operator image for development with a remote cluster
cluster-build-operator: .ensure-operator-repo-exists .prepare-cluster container-build-operator
	@echo Building container image for Kiali operator using operator-sdk tagged for a remote cluster
	cd "${ROOTDIR}/operator" && "${OP_SDK}" build --image-builder ${DORP} --image-build-args "--pull" "${CLUSTER_OPERATOR_TAG}"

## cluster-build-kiali: Builds the Kiali image for development with a remote cluster
cluster-build-kiali: .prepare-cluster container-build-kiali
ifeq ($(DORP),docker)
	@echo Re-tag the already built Kiali container image for a remote cluster using docker
	docker tag ${QUAY_TAG} ${CLUSTER_KIALI_TAG}
else
	@echo Re-tag the already built Kiali container image for a remote cluster using podman
	podman tag ${QUAY_TAG} ${CLUSTER_KIALI_TAG}
endif

## cluster-build: Builds the images for development with a remote cluster
cluster-build: cluster-build-operator cluster-build-kiali

## cluster-push-operator: Pushes Kiali operator container image to a remote cluster
cluster-push-operator: cluster-build-operator
ifeq ($(DORP),docker)
	@echo Pushing Kiali operator image to remote cluster using docker: ${CLUSTER_OPERATOR_TAG}
	docker push ${CLUSTER_OPERATOR_TAG}
else
	@echo Pushing Kiali operator image to remote cluster using podman: ${CLUSTER_OPERATOR_TAG}
	podman push --tls-verify=false ${CLUSTER_OPERATOR_TAG}
endif

## cluster-push-kiali: Pushes Kiali image to a remote cluster
cluster-push-kiali: cluster-build-kiali
ifeq ($(DORP),docker)
	@echo Pushing Kiali image to remote cluster using docker: ${CLUSTER_KIALI_TAG}
	docker push ${CLUSTER_KIALI_TAG}
else
	@echo Pushing Kiali image to remote cluster using podman: ${CLUSTER_KIALI_TAG}
	podman push --tls-verify=false ${CLUSTER_KIALI_TAG}
endif

## cluster-push: Pushes container images to a remote cluster
cluster-push: cluster-push-operator cluster-push-kiali
