#
# Targets for deploying the operator via OLM.
#

# Identifies the bundle and index images that will be built
OLM_IMAGE_ORG ?= ${IMAGE_ORG}
OLM_BUNDLE_NAME ?= ${OLM_IMAGE_ORG}/kiali-operator-bundle
OLM_INDEX_NAME ?= ${OLM_IMAGE_ORG}/kiali-operator-index

# set this package name to kiali if you want to test with the community (if OC=oc) or upstream (if OC=kubectl) metadata
OLM_BUNDLE_PACKAGE ?= kiali-ossm

OLM_INDEX_BASE_IMAGE ?= quay.io/openshift/origin-operator-registry:4.16
OPM_VERSION ?= 1.47.0

# which OLM to install (for olm-install target)
# TODO OLM v0.29.0 has a bug and cannot start. When that bug is fixed, put OLM_VERSION back to "latest"
# see https://github.com/operator-framework/operator-lifecycle-manager/issues/3419
#OLM_VERSION ?= latest
OLM_VERSION ?= v0.28.0

.prepare-olm-cluster-names: .determine-olm-operators-namespace .prepare-cluster
ifeq ($(CLUSTER_TYPE),minikube)
	@$(eval CLUSTER_OLM_BUNDLE_NAME ?= ${CLUSTER_REPO}/${OLM_BUNDLE_NAME})
	@$(eval CLUSTER_OLM_INDEX_NAME ?= ${CLUSTER_REPO}/${OLM_INDEX_NAME})
	@$(eval CLUSTER_INTERNAL_OLM_INDEX_NAME ?= ${CLUSTER_REPO_INTERNAL}/${OLM_INDEX_NAME})
else ifeq ($(CLUSTER_TYPE),openshift)
	@$(eval CLUSTER_OLM_BUNDLE_NAME ?= ${CLUSTER_REPO}/${OLM_BUNDLE_NAME})
	@$(eval CLUSTER_OLM_INDEX_NAME ?= ${CLUSTER_REPO}/${OLM_INDEX_NAME})
	@$(eval CLUSTER_INTERNAL_OLM_INDEX_NAME ?= ${CLUSTER_REPO_INTERNAL}/${OLM_INDEX_NAME})
else ifeq ($(CLUSTER_TYPE),kind)
	@if [ "${DORP}" != "docker" ]; then echo "Today you must use DORP=docker to use the OLM targets with a Kind cluster." && exit 1; fi
	@if [ -z "${CLUSTER_REPO}" ]; then echo "The Kind cluster does not appear to have an externally accessible image registry. You cannot use the OLM targets without this." && exit 1; fi
	@$(eval CLUSTER_OLM_BUNDLE_NAME ?= ${CLUSTER_REPO}/${OLM_BUNDLE_NAME})
	@$(eval CLUSTER_OLM_INDEX_NAME ?= ${CLUSTER_REPO}/${OLM_INDEX_NAME})
	@$(eval CLUSTER_INTERNAL_OLM_INDEX_NAME ?= ${CLUSTER_REPO_INTERNAL}/${OLM_INDEX_NAME})
else
	@echo "ERROR: unknown CLUSTER_TYPE [${CLUSTER_TYPE}] - must be one of: openshift, minikube, kind"
	@exit 1
endif

.download-opm-if-needed:
	@if [ "$(shell which opm 2>/dev/null || echo -n "")" == "" ]; then \
	  mkdir -p "${OUTDIR}/operator-sdk-install" ;\
	  if [ -x "${OUTDIR}/operator-sdk-install/opm" ]; then \
	    echo "You do not have opm installed in your PATH. Will use the one found here: ${OUTDIR}/operator-sdk-install/opm" ;\
	  else \
	    echo "You do not have opm installed in your PATH. The binary will be downloaded to ${OUTDIR}/operator-sdk-install/opm" ;\
	    curl -L https://github.com/operator-framework/operator-registry/releases/download/v${OPM_VERSION}/${OS}-${ARCH}-opm > "${OUTDIR}/operator-sdk-install/opm" ;\
	    chmod +x "${OUTDIR}/operator-sdk-install/opm" ;\
	  fi ;\
	fi

.ensure-opm-exists: .download-opm-if-needed
	@$(eval OPM ?= $(shell which opm 2>/dev/null || echo "${OUTDIR}/operator-sdk-install/opm"))
	@"${OPM}" version

## get-opm: Downloads the OPM operator SDK tool if it is not already in PATH.
get-opm: .ensure-opm-exists
	@echo OPM location: ${OPM}

.determine-olm-bundle-version:
	@$(eval BUNDLE_VERSION ?= $(shell echo -n "${VERSION}" | sed 's/-SNAPSHOT//' ))

## build-olm-bundle: Builds the latest bundle version for deploying the operator in OLM
build-olm-bundle: .prepare-olm-cluster-names .determine-olm-bundle-version
	@( \
	  mkdir -p ${OUTDIR}/bundle ;\
	  rm -rf ${OUTDIR}/bundle/* ;\
	  bundle_version_sans_v="$$(echo ${BUNDLE_VERSION} | sed 's/^v//')" ;\
	  if [ "${OLM_BUNDLE_PACKAGE}" == "kiali" ]; then \
	    echo "Will build OLM bundle version [${BUNDLE_VERSION}] - set 'BUNDLE_VERSION' env var if you want a different one" ;\
	    cp -R "${OPERATOR_DIR}/manifests/kiali-$$(if [[ "${OC}" = *"oc" ]]; then echo 'community'; else echo 'upstream'; fi)/$${bundle_version_sans_v}"/* ${OUTDIR}/bundle ;\
	  else \
	    echo "Will build OSSM OLM bundle - unset 'OLM_BUNDLE_PACKAGE' if you want to use upstream bundles" ;\
	    cp -R ${OPERATOR_DIR}/manifests/${OLM_BUNDLE_PACKAGE}/* ${OUTDIR}/bundle ;\
	  fi ;\
	  csv="$$(ls -1 ${OUTDIR}/bundle/manifests/kiali*clusterserviceversion.yaml)" ;\
	  sed -i "s/replaces:.*/#replaces:/g" $${csv} ;\
	  sed -i "s/IfNotPresent/Always/g" $${csv} ;\
	  sed -i "s|image: .*kiali.*operator.*|image: ${CLUSTER_OPERATOR_INTERNAL_NAME}:${OPERATOR_CONTAINER_VERSION}|g" $${csv} ;\
	  sed -i "s|containerImage: .*kiali.*operator.*|containerImage: ${CLUSTER_OPERATOR_INTERNAL_NAME}:${OPERATOR_CONTAINER_VERSION}|g" $${csv} ;\
	  sed -E -i "/.*kiali.*-operator.*/ n; s~(value:)(.*/.*-kiali-.*)~\1 ${CLUSTER_KIALI_INTERNAL_NAME}:${CONTAINER_VERSION}~g" $${csv} ;\
	  sed -i "s/\$${KIALI_OPERATOR_VERSION}/$${bundle_version_sans_v}/g" $${csv} ;\
	  sed -i "s/\$${CREATED_AT}/Created-By-Kiali-Makefile/g" $${csv} ;\
	  sed -i "s|\$${KIALI_OPERATOR_REGISTRY}|${CLUSTER_OPERATOR_INTERNAL_NAME}:${OPERATOR_CONTAINER_VERSION}|g" $${csv} ;\
	)
	${DORP} build ${OUTDIR}/bundle -f ${OUTDIR}/bundle/bundle.Dockerfile -t ${CLUSTER_OLM_BUNDLE_NAME}:${BUNDLE_VERSION}

## cluster-push-olm-bundle: Builds then pushes the OLM bundle container image to a remote cluster
cluster-push-olm-bundle: build-olm-bundle
ifeq ($(CLUSTER_TYPE),kind)
	@echo Pushing OLM bundle to kind cluster: ${CLUSTER_OLM_BUNDLE_NAME}:${BUNDLE_VERSION}
	@rm -f /tmp/kiali-cluster-push-bundle.tar
	${DORP} save -o /tmp/kiali-cluster-push-bundle.tar ${CLUSTER_OLM_BUNDLE_NAME}:${BUNDLE_VERSION}
	${KIND} load image-archive /tmp/kiali-cluster-push-bundle.tar --name ${KIND_NAME}
	@# If there is an external repo used by Kind, push it there, too, so opm render can see it
ifeq ($(DORP),docker)
	@if [ -n "${CLUSTER_REPO}" ]; then docker push ${CLUSTER_OLM_BUNDLE_NAME}:${BUNDLE_VERSION}; fi
else
	@if [ -n "${CLUSTER_REPO}" ]; then podman push --tls-verify=false ${CLUSTER_OLM_BUNDLE_NAME}:${BUNDLE_VERSION}; fi
endif
else
ifeq ($(DORP),docker)
	@echo Pushing OLM bundle image to remote cluster using docker: ${CLUSTER_OLM_BUNDLE_NAME}:${BUNDLE_VERSION}
	docker push ${CLUSTER_OLM_BUNDLE_NAME}:${BUNDLE_VERSION}
else
	@echo Pushing OLM bundle image to remote cluster using podman: ${CLUSTER_OLM_BUNDLE_NAME}:${BUNDLE_VERSION}
	podman push --tls-verify=false ${CLUSTER_OLM_BUNDLE_NAME}:${BUNDLE_VERSION}
endif
endif

## build-olm-index: Pushes the OLM bundle then generates the OLM index
# See https://docs.openshift.com/container-platform/4.10/operators/admin/olm-managing-custom-catalogs.html
build-olm-index: .ensure-opm-exists cluster-push-olm-bundle
	@rm -rf ${OUTDIR}/index
	@mkdir -p ${OUTDIR}/index/kiali-index
	${OPM} init ${OLM_BUNDLE_PACKAGE} --default-channel=stable --output yaml > ${OUTDIR}/index/kiali-index/index.yaml
	@if [ "${DORP}" == "podman" -a -n "$${XDG_RUNTIME_DIR}" -a -f "$${XDG_RUNTIME_DIR}/containers/auth.json" ]; then cp "$${XDG_RUNTIME_DIR}/containers/auth.json" "${OUTDIR}/index/kiali-index/config.json"; fi
	@if [ -f "${OUTDIR}/index/kiali-index/config.json" ]; then export DOCKER_CONFIG="${OUTDIR}/index/kiali-index"; fi ; ${OPM} render $$(if [[ "${OC}" = *"oc" ]]; then echo '--skip-tls-verify'; else echo '--use-http'; fi) ${CLUSTER_OLM_BUNDLE_NAME}:${BUNDLE_VERSION} --output yaml >> ${OUTDIR}/index/kiali-index/index.yaml
	@rm -f ${OUTDIR}/index/kiali-index/config.json
	@# We need OLM to pull the index from the internal registry - change the index to only use the internal registry name
	sed -i 's|${CLUSTER_REPO}|${CLUSTER_REPO_INTERNAL}|g' ${OUTDIR}/index/kiali-index/index.yaml
	@echo "---"                                               >> ${OUTDIR}/index/kiali-index/index.yaml
	@echo "schema: olm.channel"                               >> ${OUTDIR}/index/kiali-index/index.yaml
	@echo "package: ${OLM_BUNDLE_PACKAGE}"                    >> ${OUTDIR}/index/kiali-index/index.yaml
	@echo "name: stable"                                      >> ${OUTDIR}/index/kiali-index/index.yaml
	@echo "entries:"                                          >> ${OUTDIR}/index/kiali-index/index.yaml
	@echo "- name: kiali-operator.${BUNDLE_VERSION}"          >> ${OUTDIR}/index/kiali-index/index.yaml
	${OPM} validate ${OUTDIR}/index/kiali-index
	@# Now generate the Dockerfile
	@echo "FROM ${OLM_INDEX_BASE_IMAGE}"                                   >  ${OUTDIR}/index/kiali-index.Dockerfile
	@echo 'ENTRYPOINT ["/bin/opm"]'                                        >> ${OUTDIR}/index/kiali-index.Dockerfile
	@echo 'CMD ["serve", "/configs"]'                                      >> ${OUTDIR}/index/kiali-index.Dockerfile
	@echo "ADD kiali-index /configs"                                       >> ${OUTDIR}/index/kiali-index.Dockerfile
	@echo "LABEL operators.operatorframework.io.index.configs.v1=/configs" >> ${OUTDIR}/index/kiali-index.Dockerfile
	cd ${OUTDIR}/index && ${DORP} build . -f kiali-index.Dockerfile -t ${CLUSTER_OLM_INDEX_NAME}:${BUNDLE_VERSION}

## cluster-push-olm-index: Pushes the OLM bundle and then builds and pushes the OLM index to the cluster
cluster-push-olm-index: build-olm-index
ifeq ($(CLUSTER_TYPE),kind)
	@echo Pushing olm index to kind cluster: ${CLUSTER_OLM_INDEX_NAME}:${BUNDLE_VERSION}
	@rm -f /tmp/kiali-cluster-push-index.tar
	${DORP} save -o /tmp/kiali-cluster-push-index.tar ${CLUSTER_OLM_INDEX_NAME}:${BUNDLE_VERSION}
	${KIND} load image-archive /tmp/kiali-cluster-push-index.tar --name ${KIND_NAME}
	@# If there is an external repo used by Kind, push it there, too
ifeq ($(DORP),docker)
	@if [ -n "${CLUSTER_REPO}" ]; then docker push ${CLUSTER_OLM_INDEX_NAME}:${BUNDLE_VERSION}; fi
else
	@if [ -n "${CLUSTER_REPO}" ]; then podman push --tls-verify=false ${CLUSTER_OLM_INDEX_NAME}:${BUNDLE_VERSION}; fi
endif
else
ifeq ($(DORP),docker)
	@echo Pushing OLM index image to remote cluster using docker: ${CLUSTER_OLM_INDEX_NAME}:${BUNDLE_VERSION}
	docker push ${CLUSTER_OLM_INDEX_NAME}:${BUNDLE_VERSION}
else
	@echo Pushing OLM index image to remote cluster using podman: ${CLUSTER_OLM_INDEX_NAME}:${BUNDLE_VERSION}
	podman push --tls-verify=false ${CLUSTER_OLM_INDEX_NAME}:${BUNDLE_VERSION}
endif
endif

.determine-olm-operators-namespace:
	@$(eval OLM_OPERATORS_NAMESPACE ?= $(shell if [[ "${OC}" = *"oc" ]]; then echo 'openshift-operators'; else echo 'operators'; fi))
	@$(eval OPERATOR_NAMESPACE = ${OLM_OPERATORS_NAMESPACE})
	@echo "Using OLM requires that the OPERATOR_NAMESPACE be set to [${OPERATOR_NAMESPACE}]"

.generate-catalog-source: .prepare-olm-cluster-names .determine-olm-bundle-version .determine-olm-operators-namespace .prepare-operator-pull-secret
	@mkdir -p "${OUTDIR}"
	@echo "apiVersion: operators.coreos.com/v1alpha1" >  ${OUTDIR}/kiali-catalogsource.yaml
	@echo "kind: CatalogSource"                       >> ${OUTDIR}/kiali-catalogsource.yaml
	@echo "metadata:"                                 >> ${OUTDIR}/kiali-catalogsource.yaml
	@echo "  name: kiali-catalog"                     >> ${OUTDIR}/kiali-catalogsource.yaml
	@echo "  namespace: ${OLM_OPERATORS_NAMESPACE}"   >> ${OUTDIR}/kiali-catalogsource.yaml
	@echo "spec:"                                     >> ${OUTDIR}/kiali-catalogsource.yaml
	@echo "  displayName: Test Kiali Operator"        >> ${OUTDIR}/kiali-catalogsource.yaml
	@echo "  publisher: Local Developer"              >> ${OUTDIR}/kiali-catalogsource.yaml
	@if [ -n "${OPERATOR_IMAGE_PULL_SECRET_NAME}" ]; then \
	 echo "  secrets:"                                >> ${OUTDIR}/kiali-catalogsource.yaml ;\
	 echo "  - ${OPERATOR_IMAGE_PULL_SECRET_NAME}"    >> ${OUTDIR}/kiali-catalogsource.yaml ;\
	fi
	@echo "  sourceType: grpc"                        >> ${OUTDIR}/kiali-catalogsource.yaml
	@echo "  image: ${CLUSTER_INTERNAL_OLM_INDEX_NAME}:${BUNDLE_VERSION}" >> ${OUTDIR}/kiali-catalogsource.yaml

## catalog-source-create: Creates the OLM CatalogSource on the remote cluster
catalog-source-create: .generate-catalog-source cluster-push-olm-index .create-operator-pull-secret
	${OC} apply -f "${OUTDIR}/kiali-catalogsource.yaml"

## catalog-source-delete: Deletes the OLM CatalogSource from the remote cluster
catalog-source-delete: .generate-catalog-source .remove-operator-pull-secret
	${OC} delete --ignore-not-found=true -f "${OUTDIR}/kiali-catalogsource.yaml"

.generate-subscription: .determine-olm-operators-namespace
	@mkdir -p "${OUTDIR}"
	@echo "apiVersion: operators.coreos.com/v1alpha1" >  ${OUTDIR}/kiali-subscription.yaml
	@echo "kind: Subscription"                        >> ${OUTDIR}/kiali-subscription.yaml
	@echo "metadata:"                                 >> ${OUTDIR}/kiali-subscription.yaml
	@echo "  name: kiali-subscription"                >> ${OUTDIR}/kiali-subscription.yaml
	@echo "  namespace: ${OLM_OPERATORS_NAMESPACE}"   >> ${OUTDIR}/kiali-subscription.yaml
	@echo "spec:"                                     >> ${OUTDIR}/kiali-subscription.yaml
	@echo "  channel: stable"                         >> ${OUTDIR}/kiali-subscription.yaml
	@echo "  installPlanApproval: Automatic"          >> ${OUTDIR}/kiali-subscription.yaml
	@echo "  name: ${OLM_BUNDLE_PACKAGE}"             >> ${OUTDIR}/kiali-subscription.yaml
	@echo "  source: kiali-catalog"                   >> ${OUTDIR}/kiali-subscription.yaml
	@echo "  sourceNamespace: ${OLM_OPERATORS_NAMESPACE}"  >> ${OUTDIR}/kiali-subscription.yaml
	@echo "  config:"                                 >> ${OUTDIR}/kiali-subscription.yaml
	@echo "    env:"                                  >> ${OUTDIR}/kiali-subscription.yaml
	@echo "    - name: ALLOW_AD_HOC_KIALI_NAMESPACE"  >> ${OUTDIR}/kiali-subscription.yaml
	@echo '      value: "true"'                       >> ${OUTDIR}/kiali-subscription.yaml
	@echo "    - name: ALLOW_AD_HOC_KIALI_IMAGE"      >> ${OUTDIR}/kiali-subscription.yaml
	@echo '      value: "true"'                       >> ${OUTDIR}/kiali-subscription.yaml
	@echo "    - name: ALLOW_AD_HOC_OSSMCONSOLE_IMAGE" >> ${OUTDIR}/kiali-subscription.yaml
	@echo '      value: "true"'                       >> ${OUTDIR}/kiali-subscription.yaml

## subscription-create: Creates the OLM Subscription on the remote cluster which installs the operator
subscription-create: .ensure-oc-login .generate-subscription
	${OC} apply -f ${OUTDIR}/kiali-subscription.yaml

## subscription-delete: Deletes the OLM Subscription from the remote cluster which uninstalls the operator
subscription-delete: .ensure-oc-login .generate-subscription
	${OC} delete --ignore-not-found=true -f ${OUTDIR}/kiali-subscription.yaml

## olm-operator-create: Installs everything needed to get the Kiali operator installed via OLM.
olm-operator-create: catalog-source-create subscription-create .wait-for-kiali-crd .wait-for-ossmconsole-crd
	@echo "You can now create a Kiali CR to install Kiali."

## olm-operator-delete: Deletes the Kiali CR, undeploys the OLM subscription and catalog source and purges the operator
olm-operator-delete: kiali-delete ossmconsole-delete subscription-delete catalog-source-delete crd-delete
	@echo "Deleting OLM CSVs to fully uninstall Kiali operator and its related resources"
	@for csv in $$(${OC} get csv --all-namespaces --no-headers -o custom-columns=NS:.metadata.namespace,N:.metadata.name | sed 's/  */:/g' | grep kiali-operator) ;\
	do \
	  ${OC} delete --ignore-not-found=true csv -n $$(echo -n $${csv} | cut -d: -f1) $$(echo -n $${csv} | cut -d: -f2) ;\
	done

## olm-install: Installs the OLM infrastructure into the cluster. This is a no-op for OpenShift since it already has OLM installed.
ifeq ($(CLUSTER_TYPE),openshift)
olm-install:
	@echo "OpenShift already has OLM installed - nothing to do."
else
olm-install:
	@( \
	  echo "Installing OLM..." ;\
	  version_we_want="${OLM_VERSION}" ;\
	  if [ "$${version_we_want}" == "latest" ]; then \
	    version_we_want="$$(curl -s https://api.github.com/repos/operator-framework/operator-lifecycle-manager/releases 2> /dev/null | grep "tag_name" | sed -e 's/.*://' -e 's/ *"//' -e 's/",//' | grep -v "snapshot" | sort -t "." -k 1.2g,1 -k 2g,2 -k 3g | tail -n 1)" ;\
	    if [ -z "$${version_we_want}" ]; then \
	      echo "Failed to obtain the latest OLM version from Github. You will need to specify an explicit version via OLM_VERSION." ;\
	      exit 1 ;\
	    else \
	      echo "Github reports the latest OLM version is: $${version_we_want}" ;\
	    fi ;\
	  fi ;\
	  if ! curl -sL https://github.com/operator-framework/operator-lifecycle-manager/releases/download/$${version_we_want}/install.sh | bash -s $${version_we_want}; then echo "ERROR: Failed to install OLM" && exit 1; fi ;\
	  echo "OLM $${version_we_want} is installed." ;\
	)
endif
