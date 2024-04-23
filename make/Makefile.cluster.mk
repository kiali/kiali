#
# Targets for building and pushing images for deployment into a remote cluster.
# Today this supports kind, minikube and OpenShift4.
# If using minikube, you must have the registry addon enabled ("minikube addons enable registry")
# If using OpenShift, you must expose the image registry externally.
#

.prepare-ocp-image-registry: .ensure-oc-login
	@if [ "$(shell ${OC} get config.imageregistry.operator.openshift.io/cluster -o jsonpath='{.spec.managementState}')" != "Managed" ]; then echo "Manually patching image registry operator to ensure it is managed"; ${OC} patch configs.imageregistry.operator.openshift.io cluster --type merge --patch '{"spec":{"managementState":"Managed"}}'; sleep 3; fi
	@if [ "$(shell ${OC} get config.imageregistry.operator.openshift.io/cluster -o jsonpath='{.spec.defaultRoute}')" != "true" ]; then echo "Manually patching image registry operator to expose the cluster internal image registry"; ${OC} patch config.imageregistry.operator.openshift.io/cluster --patch '{"spec":{"defaultRoute":true}}' --type=merge; sleep 3; routehost="$$(${OC} get image.config.openshift.io/cluster -o custom-columns=EXT:.status.externalRegistryHostnames[0] --no-headers 2>/dev/null)"; while [ "$${routehost}" == "<none>" -o "$${routehost}" == "" ]; do echo "Waiting for image registry route to start..."; sleep 3; routehost="$$(${OC} get image.config.openshift.io/cluster -o custom-columns=EXT:.status.externalRegistryHostnames[0] --no-headers 2>/dev/null)"; done; fi

.prepare-ocp: .prepare-ocp-image-registry
	@$(eval CLUSTER_REPO_INTERNAL ?= $(shell ${OC} get image.config.openshift.io/cluster -o custom-columns=INT:.status.internalRegistryHostname --no-headers 2>/dev/null))
	@$(eval CLUSTER_REPO ?= $(shell ${OC} get image.config.openshift.io/cluster -o custom-columns=EXT:.status.externalRegistryHostnames[0] --no-headers 2>/dev/null))
	@$(eval CLUSTER_KIALI_INTERNAL_NAME ?= ${CLUSTER_REPO_INTERNAL}/${CONTAINER_NAME})
	@$(eval CLUSTER_KIALI_NAME ?= ${CLUSTER_REPO}/${CONTAINER_NAME})
	@$(eval CLUSTER_KIALI_TAG ?= ${CLUSTER_KIALI_NAME}:${CONTAINER_VERSION})
	@$(eval CLUSTER_KIALI_TAG_INTERNAL ?= ${CLUSTER_KIALI_INTERNAL_NAME}:${CONTAINER_VERSION})
	@$(eval CLUSTER_OPERATOR_INTERNAL_NAME ?= ${CLUSTER_REPO_INTERNAL}/${OPERATOR_CONTAINER_NAME})
	@$(eval CLUSTER_OPERATOR_NAME ?= ${CLUSTER_REPO}/${OPERATOR_CONTAINER_NAME})
	@$(eval CLUSTER_OPERATOR_TAG ?= ${CLUSTER_OPERATOR_NAME}:${OPERATOR_CONTAINER_VERSION})
	@$(eval ALL_IMAGES_NAMESPACE ?= $(shell echo ${CLUSTER_KIALI_NAME} | sed -e 's/.*\/\(.*\)\/.*/\1/'))
	@$(eval CLUSTER_PLUGIN_INTERNAL_NAME ?= ${CLUSTER_REPO_INTERNAL}/${PLUGIN_CONTAINER_NAME})
	@if [ "${CLUSTER_REPO_INTERNAL}" == "" -o "${CLUSTER_REPO_INTERNAL}" == "<none>" ]; then echo "Cannot determine OCP internal registry hostname. Make sure you 'oc login' to your cluster."; exit 1; fi
	@if [ "${CLUSTER_REPO}" == "" -o "${CLUSTER_REPO}" == "<none>" ]; then echo "Cannot determine OCP external registry hostname. The OpenShift image registry has not been made available for external client access"; exit 1; fi
	@echo "OCP repos: external=[${CLUSTER_REPO}] internal=[${CLUSTER_REPO_INTERNAL}]"
	@# Make sure the image namespace exists - the image registry will get images from here
	@${OC} get namespace ${ALL_IMAGES_NAMESPACE} &> /dev/null || \
	  ${OC} create namespace ${ALL_IMAGES_NAMESPACE} &> /dev/null
	@# Add image-puller role so the pods can pull the images from the internal image registry
	@${OC} policy add-role-to-group system:image-puller system:serviceaccounts:${NAMESPACE} --namespace=${ALL_IMAGES_NAMESPACE} &> /dev/null
	@${OC} policy add-role-to-group system:image-puller system:serviceaccounts:${OPERATOR_NAMESPACE} --namespace=${ALL_IMAGES_NAMESPACE} &> /dev/null
	@${OC} policy add-role-to-group system:image-puller system:serviceaccounts:${OSSMCONSOLE_NAMESPACE} --namespace=${ALL_IMAGES_NAMESPACE} &> /dev/null
	@# We need to make sure the 'default' service account is created - we'll need it later for the pull secret
	@for i in {1..5}; do ${OC} get sa default -n ${ALL_IMAGES_NAMESPACE} &> /dev/null && break || echo -n "." && sleep 1; done; echo

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

.prepare-kind: .ensure-oc-exists .ensure-kind-exists
	@# If there is a docker process running with the name "kind-registry" assume it is used for the Kind cluster image registry.
	@# "kind-registry" is the name start-kind.sh uses.
	@# If no registry is found, the repo is just "" (it isn't accessible outside of KinD) - you must load the archive directly into Kind.
	@$(eval CLUSTER_REPO ?= $(shell hostport="$$(${DORP} ps -f name=kind-registry --format '{{.Ports}}' 2>/dev/null | sed -E 's/(.*)->.*/\1/' | sed -E 's/127.0.0.1/localhost/')"; echo "$${hostport:-}"))
	@$(eval CLUSTER_REPO_INTERNAL ?= ${CLUSTER_REPO})
	@$(eval CLUSTER_KIALI_INTERNAL_NAME ?= $(shell if [ -z "${CLUSTER_REPO}" ]; then echo "localhost/${CONTAINER_NAME}"; else echo "${CLUSTER_REPO}/${CONTAINER_NAME}"; fi))
	@$(eval CLUSTER_KIALI_TAG ?= ${CLUSTER_KIALI_INTERNAL_NAME}:${CONTAINER_VERSION})
	@$(eval CLUSTER_OPERATOR_INTERNAL_NAME ?= $(shell if [ -z "${CLUSTER_REPO}" ]; then echo "localhost/${OPERATOR_CONTAINER_NAME}"; else echo "${CLUSTER_REPO}/${OPERATOR_CONTAINER_NAME}"; fi))
	@$(eval CLUSTER_OPERATOR_TAG ?= ${CLUSTER_OPERATOR_INTERNAL_NAME}:${OPERATOR_CONTAINER_VERSION})

.prepare-local: .ensure-oc-exists
	@$(eval CLUSTER_KIALI_INTERNAL_NAME ?= ${CONTAINER_NAME})
	@$(eval CLUSTER_KIALI_TAG ?= ${CONTAINER_NAME}:${CONTAINER_VERSION})
	@$(eval CLUSTER_OPERATOR_INTERNAL_NAME ?= ${OPERATOR_CONTAINER_NAME})
	@$(eval CLUSTER_OPERATOR_TAG ?= ${OPERATOR_CONTAINER_NAME}:${OPERATOR_CONTAINER_VERSION})

ifeq ($(CLUSTER_TYPE),minikube)
.prepare-cluster: .prepare-minikube
else ifeq ($(CLUSTER_TYPE),kind)
.prepare-cluster: .prepare-kind
else ifeq ($(CLUSTER_TYPE),openshift)
.prepare-cluster: .prepare-ocp
else ifeq ($(CLUSTER_TYPE),local)
.prepare-cluster: .prepare-local
else
.prepare-cluster:
	@echo "ERROR: unknown CLUSTER_TYPE [${CLUSTER_TYPE}] - must be one of: openshift, minikube, kind, local"
	@exit 1
endif

.get-cluster-istio-version:
	@$(eval CLUSTER_ISTIO_VERSION ?= $(shell ${OC} exec $$(${OC} get pods -n ${ISTIO_NAMESPACE} -l app=istiod -o name 2>/dev/null) -n ${ISTIO_NAMESPACE} -- curl -s http://localhost:15014/version 2>/dev/null | grep . || echo "N/A"))

## cluster-status: Outputs details of the client and server for the cluster
cluster-status: .prepare-cluster .get-cluster-istio-version
	@echo "================================================================="
	@echo "CLUSTER DETAILS"
	@echo "================================================================="
	@echo "Client executable: ${OC}"
	@echo "================================================================="
	${OC} version
	@echo "================================================================="
	${OC} cluster-info
	@echo "================================================================="
	@echo "Age of cluster: $(shell ${OC} get namespace kube-system --no-headers | tr -s ' ' | cut -d ' ' -f3)"
	@echo "================================================================="
	@echo "Cluster nodes:"
	@for n in $(shell ${OC} get nodes -o name); do echo "Node=[$${n}]" "CPUs=[$$(${OC} get $${n} -o jsonpath='{.status.capacity.cpu}')] Memory=[$$(${OC} get $${n} -o jsonpath='{.status.capacity.memory}')]"; done
	@echo "================================================================="
ifeq ($(CLUSTER_TYPE),openshift)
	@echo "Console URL: $(shell ${OC} get console cluster -o jsonpath='{.status.consoleURL}' 2>/dev/null)"
	@echo "API Server:  $(shell ${OC} whoami --show-server 2>/dev/null)"
	@echo "================================================================="
else ifeq ($(CLUSTER_TYPE),minikube)
	@echo "Console URL: Run 'minikube dashboard' to access the UI console"
	@echo "================================================================="
endif
	@echo "Istio Version (if installed): ${CLUSTER_ISTIO_VERSION}"
	@echo "================================================================="
	@echo "Kiali image as seen from inside the cluster:       ${CLUSTER_KIALI_INTERNAL_NAME}"
	@echo "Kiali image that will be pushed to the cluster:    ${CLUSTER_KIALI_TAG}"
	@echo "Operator image as seen from inside the cluster:    ${CLUSTER_OPERATOR_INTERNAL_NAME}"
	@echo "Operator image that will be pushed to the cluster: ${CLUSTER_OPERATOR_TAG}"
	@echo "================================================================="
ifeq ($(CLUSTER_TYPE),openshift)
	@echo "oc whoami -c: $(shell ${OC} whoami -c 2>/dev/null)"
	@echo "================================================================="
ifeq ($(DORP),docker)
	@echo "Image Registry login: docker login -u $(shell ${OC} whoami | tr -d ':')" '-p $$(${OC} whoami -t)' "${CLUSTER_REPO}"
	@echo "================================================================="
else
	@echo "Image Registry login: podman login --tls-verify=false -u $(shell ${OC} whoami | tr -d ':')" '-p $$(${OC} whoami -t)' "${CLUSTER_REPO}"
	@echo "================================================================="
endif
endif

## cluster-add-users: Add two users to an OpenShift cluster - kiali (cluster admin) and johndoe (no additional permissions)
ifeq ($(CLUSTER_TYPE),openshift)
define HTPASSWD
---
# Secret containing two htpasswd credentials:
#   kiali:kiali
#   johndoe:johndoe
apiVersion: v1
metadata:
  name: htpasswd
  namespace: openshift-config
data:
  htpasswd: a2lhbGk6JDJ5JDA1JHhrV1NNY0ZIUXkwZ2RDMUltLnJDZnVsV2NuYkhDQ2w2bDhEdjFETWEwV1hLRzc4U2tVcHQ2CmpvaG5kb2U6JGFwcjEkRzhhL2x1My4kRnc5RjJUczFKNUFKRUNJc05KN1RWLgo=
kind: Secret
type: Opaque
---
apiVersion: config.openshift.io/v1
kind: OAuth
metadata:
  name: cluster
spec:
  identityProviders:
  - name: htpasswd
    type: HTPasswd
    mappingMethod: claim
    htpasswd:
      fileData:
        name: htpasswd
endef
export HTPASSWD

cluster-add-users: .ensure-oc-exists
	@echo "Creating users 'kiali' and 'johndoe'"
	@echo "$${HTPASSWD}" | ${OC} apply -f -
	@admintoken="$$(${OC} whoami -t)" ;\
   for i in {1..100} ; do \
     echo "Waiting for kiali user to be created before attempting to assign it cluster-admin role..." ;\
     sleep 10 ;\
     if ${OC} login -u kiali -p kiali > /dev/null 2>&1 ; then \
       ${OC} login --token=$${admintoken} > /dev/null 2>&1 ;\
       if ${OC} get user kiali > /dev/null 2>&1 ; then \
         echo "Will assign the cluster-admin role to the kiali user." ;\
         ${OC} adm policy add-cluster-role-to-user cluster-admin kiali ;\
         break ;\
       fi \
     fi \
   done
else
cluster-add-users:
	@echo "This target is only available when working with OpenShift (i.e. CLUSTER_TYPE=openshift)"
endif

## cluster-build-operator: Builds the operator image for development with a remote cluster
cluster-build-operator: .ensure-operator-repo-exists .prepare-cluster container-build-operator
ifeq ($(DORP),docker)
	@echo Re-tag the already built Kiali operator container image for a remote cluster using docker
	docker tag ${OPERATOR_QUAY_TAG} ${CLUSTER_OPERATOR_TAG}
else
	@echo Re-tag the already built Kiali operator container image for a remote cluster using podman
	podman tag ${OPERATOR_QUAY_TAG} ${CLUSTER_OPERATOR_TAG}
endif

## cluster-build-kiali: Builds the Kiali image for development with a remote cluster
cluster-build-kiali: .prepare-cluster container-build-kiali
ifeq ($(DORP),docker)
	@echo Re-tag the already built Kiali container image for a remote cluster using docker
	docker tag ${QUAY_TAG} ${CLUSTER_KIALI_TAG} ${CLUSTER_KIALI_TAG_INTERNAL}
else
	@echo Re-tag the already built Kiali container image for a remote cluster using podman
	podman tag ${QUAY_TAG} ${CLUSTER_KIALI_TAG} ${CLUSTER_KIALI_TAG_INTERNAL}
endif

## cluster-build: Builds the images for development with a remote cluster
cluster-build: cluster-build-operator cluster-build-kiali

## cluster-push-operator: Pushes Kiali operator container image to a remote cluster
cluster-push-operator: cluster-build-operator
ifeq ($(CLUSTER_TYPE),kind)
	@echo Pushing Kiali operator image to kind cluster: ${CLUSTER_OPERATOR_TAG}
	@rm -f /tmp/kiali-cluster-push-operator.tar
	${DORP} save -o /tmp/kiali-cluster-push-operator.tar ${CLUSTER_OPERATOR_TAG}
	${KIND} load image-archive /tmp/kiali-cluster-push-operator.tar --name ${KIND_NAME}
	@# If there is an external repo used by Kind, push it there, too, so it can be loaded from there
ifeq ($(DORP),docker)
	@if [ -n "${CLUSTER_REPO}" ]; then docker push ${CLUSTER_OPERATOR_TAG}; fi
else
	@if [ -n "${CLUSTER_REPO}" ]; then podman push --tls-verify=false ${CLUSTER_OPERATOR_TAG}; fi
endif
else
ifeq ($(DORP),docker)
	@echo Pushing Kiali operator image to remote cluster using docker: ${CLUSTER_OPERATOR_TAG}
	docker push ${CLUSTER_OPERATOR_TAG}
else
	@echo Pushing Kiali operator image to remote cluster using podman: ${CLUSTER_OPERATOR_TAG}
	podman push --tls-verify=false ${CLUSTER_OPERATOR_TAG}
endif
endif

## cluster-push-kiali: Pushes Kiali image to a remote cluster
cluster-push-kiali: cluster-build-kiali
ifeq ($(CLUSTER_TYPE),kind)
	@echo Pushing Kiali image to kind cluster: ${CLUSTER_KIALI_TAG}
	@rm -f /tmp/kiali-cluster-push-kiali.tar
	${DORP} save -o /tmp/kiali-cluster-push-kiali.tar ${CLUSTER_KIALI_TAG}
	${KIND} load image-archive /tmp/kiali-cluster-push-kiali.tar --name ${KIND_NAME}
	@# If there is an external repo used by Kind, push it there, too, so it can be loaded from there
ifeq ($(DORP),docker)
	@if [ -n "${CLUSTER_REPO}" ]; then docker push ${CLUSTER_KIALI_TAG}; fi
else
	@if [ -n "${CLUSTER_REPO}" ]; then podman push --tls-verify=false ${CLUSTER_KIALI_TAG}; fi
endif
else
ifeq ($(DORP),docker)
	@echo Pushing Kiali image to remote cluster using docker: ${CLUSTER_KIALI_TAG}
	docker push ${CLUSTER_KIALI_TAG}
else
	@echo Pushing Kiali image to remote cluster using podman: ${CLUSTER_KIALI_TAG}
	podman push --tls-verify=false ${CLUSTER_KIALI_TAG}
endif
endif

## cluster-push: Pushes container images to a remote cluster
cluster-push: cluster-push-operator cluster-push-kiali
