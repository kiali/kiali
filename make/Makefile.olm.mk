#
# Targets for deploying the operator via OLM.
#

# Identifies the bundle and index images that will be built
OLM_IMAGE_ORG ?= ${IMAGE_ORG}
OLM_BUNDLE_NAME ?= ${OLM_IMAGE_ORG}/kiali-operator-bundle
OLM_INDEX_NAME ?= ${OLM_IMAGE_ORG}/kiali-operator-index

OLM_INDEX_BASE_IMAGE ?= quay.io/openshift/origin-operator-registry:4.10
OPM_VERSION ?= 1.22.1

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
build-olm-bundle: .prepare-cluster .determine-olm-bundle-version
	@echo "Will build OLM bundle version [${BUNDLE_VERSION}] - set 'BUNDLE_VERSION' env var if you want a different one"
	@( \
	  mkdir -p ${OUTDIR}/bundle ;\
	  rm -rf ${OUTDIR}/bundle/* ;\
	  cp -R "${OPERATOR_DIR}/manifests/kiali-$$(if [[ "${OC}" = *"oc" ]]; then echo 'community'; else echo 'upstream'; fi)/$$(echo ${BUNDLE_VERSION} | sed 's/^v//')"/* ${OUTDIR}/bundle ;\
     csv="$$(ls -1 ${OUTDIR}/bundle/manifests/kiali*clusterserviceversion.yaml)" ;\
	  sed -i "s/replaces:.*/#replaces:/g" $${csv} ;\
	  sed -i "s|image: .*kiali.*operator.*|image: ${CLUSTER_OPERATOR_INTERNAL_NAME}:${OPERATOR_CONTAINER_VERSION}|g" $${csv} ;\
	  sed -i "s|containerImage: .*kiali.*operator.*|containerImage: ${CLUSTER_OPERATOR_INTERNAL_NAME}:${OPERATOR_CONTAINER_VERSION}|g" $${csv} ;\
	)
	${DORP} build -f ${OUTDIR}/bundle/bundle.Dockerfile -t ${CLUSTER_REPO}/${OLM_BUNDLE_NAME}:${BUNDLE_VERSION}

## cluster-push-olm-bundle: Builds then pushes the OLM bundle container image to a remote cluster
cluster-push-olm-bundle: build-olm-bundle
ifeq ($(DORP),docker)
	@echo Pushing olm bundle image to remote cluster using docker: ${CLUSTER_REPO}/${OLM_BUNDLE_NAME}:${BUNDLE_VERSION}
	docker push ${CLUSTER_REPO}/${OLM_BUNDLE_NAME}:${BUNDLE_VERSION}
else
	@echo Pushing olm bundle image to remote cluster using podman: ${CLUSTER_REPO}/${OLM_BUNDLE_NAME}:${BUNDLE_VERSION}
	podman push --tls-verify=false ${CLUSTER_REPO}/${OLM_BUNDLE_NAME}:${BUNDLE_VERSION}
endif

## build-olm-index: Pushes the OLM bundle then generates the OLM index
# See https://docs.openshift.com/container-platform/4.10/operators/admin/olm-managing-custom-catalogs.html
build-olm-index: .ensure-opm-exists cluster-push-olm-bundle
	@rm -rf ${OUTDIR}/index
	@mkdir -p ${OUTDIR}/index/kiali-index
	${OPM} init kiali --default-channel=stable --output yaml > ${OUTDIR}/index/kiali-index/index.yaml
	${OPM} render $$(if [[ "${OC}" = *"oc" ]]; then echo '--skip-tls-verify'; else echo '--use-http'; fi) ${CLUSTER_REPO}/${OLM_BUNDLE_NAME}:${BUNDLE_VERSION} --output yaml >> ${OUTDIR}/index/kiali-index/index.yaml
	@# We need OLM to pull the index from the internal registry - change the index to only use the internal registry name
	sed -i 's|${CLUSTER_REPO}|${CLUSTER_REPO_INTERNAL}|g' ${OUTDIR}/index/kiali-index/index.yaml
	@echo "---"                                               >> ${OUTDIR}/index/kiali-index/index.yaml
	@echo "schema: olm.channel"                               >> ${OUTDIR}/index/kiali-index/index.yaml
	@echo "package: kiali"                                    >> ${OUTDIR}/index/kiali-index/index.yaml
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
	cd ${OUTDIR}/index && ${DORP} build . -f kiali-index.Dockerfile -t ${CLUSTER_REPO}/${OLM_INDEX_NAME}:${BUNDLE_VERSION}

## cluster-push-olm-index: Pushes the OLM bundle and then builds and pushes the OLM index to the cluster
cluster-push-olm-index: build-olm-index
ifeq ($(DORP),docker)
	@echo Pushing OLM index image to remote cluster using docker: ${CLUSTER_REPO}/${OLM_INDEX_NAME}:${BUNDLE_VERSION}
	docker push ${CLUSTER_REPO}/${OLM_INDEX_NAME}:${BUNDLE_VERSION}
else
	@echo Pushing OLM index image to remote cluster using podman: ${CLUSTER_REPO}/${OLM_INDEX_NAME}:${BUNDLE_VERSION}
	podman push --tls-verify=false ${CLUSTER_REPO}/${OLM_INDEX_NAME}:${BUNDLE_VERSION}
endif

.determine-olm-operators-namespace:
	@$(eval OLM_OPERATORS_NAMESPACE ?= $(shell if [[ "${OC}" = *"oc" ]]; then echo 'openshift-operators'; else echo 'operators'; fi))

.generate-catalog-source: .prepare-cluster .determine-olm-bundle-version .prepare-operator-pull-secret .determine-olm-operators-namespace
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
	@echo "  image: ${CLUSTER_REPO_INTERNAL}/${OLM_INDEX_NAME}:${BUNDLE_VERSION}" >> ${OUTDIR}/kiali-catalogsource.yaml

## deploy-catalog-source: Creates the OLM CatalogSource on the remote cluster
deploy-catalog-source: .generate-catalog-source cluster-push-olm-index .create-operator-pull-secret
	${OC} apply -f "${OUTDIR}/kiali-catalogsource.yaml"

## undeploy-catalog-source: Deletes the OLM CatalogSource from the remote cluster
undeploy-catalog-source: .generate-catalog-source .remove-operator-pull-secret
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
	@echo "  name: kiali"                             >> ${OUTDIR}/kiali-subscription.yaml
	@echo "  source: kiali-catalog"                   >> ${OUTDIR}/kiali-subscription.yaml
	@echo "  sourceNamespace: ${OLM_OPERATORS_NAMESPACE}"  >> ${OUTDIR}/kiali-subscription.yaml
	@echo "  config:"                                 >> ${OUTDIR}/kiali-subscription.yaml
	@echo "    env:"                                  >> ${OUTDIR}/kiali-subscription.yaml
	@echo "    - name: ALLOW_AD_HOC_KIALI_NAMESPACE"  >> ${OUTDIR}/kiali-subscription.yaml
	@echo '      value: "true"'                       >> ${OUTDIR}/kiali-subscription.yaml
	@echo "    - name: ALLOW_AD_HOC_KIALI_IMAGE"      >> ${OUTDIR}/kiali-subscription.yaml
	@echo '      value: "true"'                       >> ${OUTDIR}/kiali-subscription.yaml

## deploy-subscription: Creates the OLM Subscription on the remote cluster which installs the operator
deploy-subscription: .ensure-oc-login .generate-subscription
	${OC} apply -f ${OUTDIR}/kiali-subscription.yaml

## undeploy-subscription: Deletes the OLM Subscription from the remote cluster which uninstalls the operator
undeploy-subscription: .ensure-oc-login .generate-subscription
	${OC} delete --ignore-not-found=true -f ${OUTDIR}/kiali-subscription.yaml

