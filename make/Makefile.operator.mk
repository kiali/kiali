#
# Targets to deploy the operator and Kiali in a remote cluster.
#

.ensure-operator-is-running: .ensure-oc-exists
	@${OC} get pods -l app.kubernetes.io/name=kiali-operator -n kiali-operator 2>/dev/null | grep "^kiali-operator.*Running" > /dev/null ;\
	RETVAL=$$?; \
	if [ $$RETVAL -ne 0 ]; then \
	  echo "The Operator is not running. Cannot continue."; exit 1; \
	fi

.ensure-operator-ns-does-not-exist: .ensure-oc-exists
	@_cmd="${OC} get namespace ${OPERATOR_NAMESPACE}"; \
	$$_cmd > /dev/null 2>&1 ; \
	while [ $$? -eq 0 ]; do \
	  echo "Waiting for the operator namespace [${OPERATOR_NAMESPACE}] to terminate" ; \
	  sleep 4 ; \
	  $$_cmd 2> /dev/null; \
	done ; \
	exit 0

## operator-create: Deploy the Kiali operator to the cluster using the install script.
# By default, this target will not deploy Kiali - it will only deploy the operator.
# You can tell it to also install Kiali by setting OPERATOR_INSTALL_KIALI=true.
# The Kiali operator does not create secrets, but this calls the install script
# which can create a Kiali secret for you as a convienence so you don't have
# to remember to do it yourself. It will only do this if it was told to install Kiali.
operator-create: .ensure-operator-repo-exists .ensure-operator-helm-chart-exists .find-helm-exe operator-delete .ensure-operator-ns-does-not-exist .prepare-cluster
	@echo Deploy Operator
	${ROOTDIR}/operator/deploy/deploy-kiali-operator.sh \
    --helm-chart                    "$(shell ls -dt1 ${HELM_CHARTS_REPO}/_output/charts/kiali-operator*.tgz | head -n 1)" \
    --helm-exe                      "${HELM}" \
    --helm-set                      "debug.enableProfiler=${OPERATOR_PROFILER_ENABLED}" \
    --helm-set                      "allowAdHocKialiNamespace=${OPERATOR_ALLOW_AD_HOC_KIALI_NAMESPACE}" \
    --helm-set                      "allowAdHocKialiImage=${OPERATOR_ALLOW_AD_HOC_KIALI_IMAGE}" \
    --operator-cluster-role-creator "true" \
    --operator-image-name           "${CLUSTER_OPERATOR_INTERNAL_NAME}" \
    --operator-image-pull-policy    "${OPERATOR_IMAGE_PULL_POLICY}" \
    --operator-image-version        "${OPERATOR_CONTAINER_VERSION}" \
    --operator-install-kiali        "${OPERATOR_INSTALL_KIALI}" \
    --operator-namespace            "${OPERATOR_NAMESPACE}" \
    --operator-watch-namespace      "${OPERATOR_WATCH_NAMESPACE}" \
    --accessible-namespaces         "${ACCESSIBLE_NAMESPACES}" \
    --auth-strategy                 "${AUTH_STRATEGY}" \
    --kiali-image-name              "${CLUSTER_KIALI_INTERNAL_NAME}" \
    --kiali-image-pull-policy       "${KIALI_IMAGE_PULL_POLICY}" \
    --kiali-image-version           "${CONTAINER_VERSION}" \
    --istio-namespace               "${ISTIO_NAMESPACE}" \
    --namespace                     "${NAMESPACE}" \
    --version                       "${KIALI_CR_SPEC_VERSION}"

## operator-delete: Remove the Kiali operator resources from the cluster along with Kiali itself
operator-delete: .ensure-oc-exists kiali-delete kiali-purge
	@echo Remove Operator
	${OC} delete --ignore-not-found=true all,sa,deployments --selector="app.kubernetes.io/name=kiali-operator" -n "${OPERATOR_NAMESPACE}"
	${OC} delete --ignore-not-found=true clusterroles,clusterrolebindings --selector="app.kubernetes.io/name=kiali-operator"
	${OC} delete --ignore-not-found=true customresourcedefinitions kialis.kiali.io
	${OC} delete --ignore-not-found=true customresourcedefinitions monitoringdashboards.monitoring.kiali.io
	${OC} delete --ignore-not-found=true namespace "${OPERATOR_NAMESPACE}"

## kiali-create: Create a Kiali CR to the cluster, informing the Kiali operator to install Kiali.
kiali-create: .ensure-operator-repo-exists .prepare-cluster
	@echo Deploy Kiali using the settings found in ${KIALI_CR_FILE}
	cat ${KIALI_CR_FILE} | \
ACCESSIBLE_NAMESPACES="${ACCESSIBLE_NAMESPACES}" \
AUTH_STRATEGY="${AUTH_STRATEGY}" \
KIALI_EXTERNAL_SERVICES_PASSWORD="$(shell ${OC} get secrets htpasswd -n ${NAMESPACE} -o jsonpath='{.data.rawPassword}' 2>/dev/null | base64 --decode)" \
KIALI_IMAGE_NAME="${CLUSTER_KIALI_INTERNAL_NAME}" \
KIALI_IMAGE_PULL_POLICY="${KIALI_IMAGE_PULL_POLICY}" \
KIALI_IMAGE_VERSION="${CONTAINER_VERSION}" \
ISTIO_NAMESPACE="${ISTIO_NAMESPACE}" \
NAMESPACE="${NAMESPACE}" \
ROUTER_HOSTNAME="$(shell ${OC} get $(shell (${OC} get routes -n ${NAMESPACE} -o name 2>/dev/null || echo 'noroute') | head -n 1) -n ${NAMESPACE} -o jsonpath='{.status.ingress[0].routerCanonicalHostname}' 2>/dev/null)" \
SERVICE_TYPE="${SERVICE_TYPE}" \
KIALI_CR_SPEC_VERSION="${KIALI_CR_SPEC_VERSION}" \
envsubst | ${OC} apply -n "${OPERATOR_INSTALL_KIALI_CR_NAMESPACE}" -f -
ifeq ($(IS_MAISTRA),true)
	@echo "Deploying within a Maistra environment - create network policy to enable access to the Kiali UI"
	@echo '{"apiVersion":"networking.k8s.io/v1","kind":"NetworkPolicy","metadata":{"labels":{"app.kubernetes.io/name":"kiali"},"name":"kiali-network-policy-from-make"},"spec":{"ingress":[{}],"podSelector":{"matchLabels":{"app":"kiali"}},"policyTypes":["Ingress"]}}' | ${OC} apply -n ${NAMESPACE} -f -
endif

## kiali-delete: Remove a Kiali CR from the cluster, informing the Kiali operator to uninstall Kiali.
kiali-delete: .ensure-oc-exists
	@echo Remove Kiali
	${OC} delete --ignore-not-found=true kiali kiali -n "${OPERATOR_INSTALL_KIALI_CR_NAMESPACE}" ; true
	@echo "Remove NetworkPolicy if it exists (was only created within Maistra environment)"
	${OC} delete --ignore-not-found=true networkpolicies.networking.k8s.io -n ${NAMESPACE} kiali-network-policy-from-make

## kiali-purge: Purges all Kiali resources directly without going through the operator or ansible.
kiali-purge: .ensure-oc-exists
	@echo Purge Kiali resources
	${OC} patch kiali kiali -n "${OPERATOR_INSTALL_KIALI_CR_NAMESPACE}" -p '{"metadata":{"finalizers": []}}' --type=merge ; true
	${OC} delete --ignore-not-found=true all,secrets,sa,configmaps,deployments,roles,rolebindings,ingresses,horizontalpodautoscalers --selector="app.kubernetes.io/name=kiali" -n "${NAMESPACE}"
	${OC} delete --ignore-not-found=true clusterroles,clusterrolebindings --selector="app.kubernetes.io/name=kiali"
	${OC} delete --ignore-not-found=true networkpolicies.networking.k8s.io -n ${NAMESPACE} kiali-network-policy-from-make
ifeq ($(CLUSTER_TYPE),openshift)
	${OC} delete --ignore-not-found=true routes --selector="app.kubernetes.io/name=kiali" -n "${NAMESPACE}" ; true
	${OC} delete --ignore-not-found=true consolelinks.console.openshift.io,oauthclients.oauth.openshift.io --selector="app.kubernetes.io/name=kiali" ; true
endif

## kiali-reload-image: Refreshing the Kiali pod by deleting it which forces a redeployment
kiali-reload-image: .ensure-oc-exists
	@echo Refreshing Kiali pod within namespace ${NAMESPACE}
	${OC} delete pod --selector=app.kubernetes.io/name=kiali -n ${NAMESPACE}

## run-operator-playbook: Run the operator dev playbook to run the operator ansible script locally.
run-operator-playbook: .ensure-operator-repo-exists .ensure-operator-helm-chart-exists
ifeq ($(OPERATOR_PROFILER_ENABLED),true)
	@$(eval ANSIBLE_CALLBACK_WHITELIST_ARG ?= ANSIBLE_CALLBACK_WHITELIST=profile_tasks)
endif
	@$(eval ANSIBLE_PYTHON_INTERPRETER ?= $(shell if (which python 2>/dev/null 1>&2 && python --version 2>&1 | grep -q " 2\.*"); then echo "-e ansible_python_interpreter=python3"; else echo ""; fi))
	@if [ ! -z "${ANSIBLE_PYTHON_INTERPRETER}" ]; then echo "ANSIBLE_PYTHON_INTERPRETER is [${ANSIBLE_PYTHON_INTERPRETER}]. Make sure that refers to a Python3 installation. If you do not have Python3 in that location, you must ensure you have Python3 and ANSIBLE_PYTHON_INTERPRETER is set to '-e ansible_python_interpreter=<full path to your python3 executable>"; fi
	@echo "Ensure the CRDs exist"; ${OC} apply -f ${HELM_CHARTS_REPO}/kiali-operator/crds/crds.yaml
	@echo "Create a dummy Kiali CR"; ${OC} apply -f ${ROOTDIR}/operator/dev-playbook-config/dev-kiali-cr.yaml
	ansible-galaxy collection install operator_sdk.util community.kubernetes
	ALLOW_AD_HOC_KIALI_NAMESPACE=true ALLOW_AD_HOC_KIALI_IMAGE=true ANSIBLE_ROLES_PATH=${ROOTDIR}/operator/roles ${ANSIBLE_CALLBACK_WHITELIST_ARG} ansible-playbook -vvv ${ANSIBLE_PYTHON_INTERPRETER} -i ${ROOTDIR}/operator/dev-playbook-config/dev-hosts.yaml ${ROOTDIR}/operator/dev-playbook-config/dev-playbook.yaml
	@echo "Remove the dummy Kiali CR"; ${OC} delete -f ${ROOTDIR}/operator/dev-playbook-config/dev-kiali-cr.yaml
