#
# Targets to deploy the operator and Kiali in a remote cluster.
#

# These must match the OSSM Console build.
PLUGIN_CONTAINER_VERSION ?= ${CONTAINER_VERSION}
PLUGIN_CONTAINER_NAME ?= "kiali/ossmconsole"

.ensure-operator-ns-does-not-exist: .ensure-oc-exists
	@_cmd="${OC} get namespace ${OPERATOR_NAMESPACE}"; \
	$$_cmd > /dev/null 2>&1 ; \
	while [ $$? -eq 0 ]; do \
	  echo "Waiting for the operator namespace [${OPERATOR_NAMESPACE}] to terminate" ; \
	  sleep 4 ; \
	  $$_cmd 2> /dev/null; \
	done ; \
	exit 0

.prepare-operator-pull-secret: .prepare-cluster
ifeq ($(CLUSTER_TYPE),openshift)
	@# base64 encode a pull secret (using the logged in user token) that can be used to pull the operator image from the OpenShift internal registry
	@$(eval OPERATOR_IMAGE_PULL_SECRET_JSON = $(shell ${OC} registry login --registry="$(shell ${OC} registry info --internal)" --namespace=${OPERATOR_IMAGE_NAMESPACE} --to=/tmp/json &>/dev/null && cat /tmp/json | base64 -w0))
	@$(eval OPERATOR_IMAGE_PULL_SECRET_NAME ?= kiali-operator-pull-secret)
	@rm /tmp/json
else
	@$(eval OPERATOR_IMAGE_PULL_SECRET_JSON = )
	@$(eval OPERATOR_IMAGE_PULL_SECRET_NAME = )
endif

.create-operator-pull-secret: .prepare-operator-pull-secret
	@if [ -n "${OPERATOR_IMAGE_PULL_SECRET_JSON}" ] && ! (${OC} get secret ${OPERATOR_IMAGE_PULL_SECRET_NAME} --namespace ${OPERATOR_NAMESPACE} &> /dev/null); then \
		echo "${OPERATOR_IMAGE_PULL_SECRET_JSON}" | base64 -d > /tmp/kiali-operator-pull-secret.json; \
		${OC} get namespace ${OPERATOR_NAMESPACE} &> /dev/null || ${OC} create namespace ${OPERATOR_NAMESPACE}; \
		${OC} create secret generic ${OPERATOR_IMAGE_PULL_SECRET_NAME} --from-file=.dockerconfigjson=/tmp/kiali-operator-pull-secret.json --type=kubernetes.io/dockerconfigjson --namespace=${OPERATOR_NAMESPACE}; \
		${OC} label secret ${OPERATOR_IMAGE_PULL_SECRET_NAME} --namespace ${OPERATOR_NAMESPACE} app.kubernetes.io/name=kiali-operator; \
		rm /tmp/kiali-operator-pull-secret.json; \
	fi

.remove-operator-pull-secret: .prepare-operator-pull-secret
	@if [ -n "${OPERATOR_IMAGE_PULL_SECRET_NAME}" ]; then ${OC} delete --ignore-not-found=true secret ${OPERATOR_IMAGE_PULL_SECRET_NAME} --namespace=${OPERATOR_NAMESPACE} ; fi

.prepare-plugin-pull-secret: .prepare-cluster
ifeq ($(CLUSTER_TYPE),openshift)
	@# base64 encode a pull secret (using the logged in user token) that can be used to pull the plugin image from the internal image registry
	@$(eval PLUGIN_IMAGE_PULL_SECRET_JSON = $(shell ${OC} registry login --registry="$(shell ${OC} registry info --internal)" --namespace=${ALL_IMAGES_NAMESPACE} --to=/tmp/json2 &>/dev/null && cat /tmp/json2 | base64 -w0))
	@$(eval PLUGIN_IMAGE_PULL_SECRET_NAME ?= ossmconsole-plugin-pull-secret)
	@rm /tmp/json2
else
	@$(eval PLUGIN_IMAGE_PULL_SECRET_JSON = )
	@$(eval PLUGIN_IMAGE_PULL_SECRET_NAME = )
endif

.create-plugin-pull-secret: .prepare-plugin-pull-secret .create-ossmconsole-namespace
	@if [ -n "${PLUGIN_IMAGE_PULL_SECRET_JSON}" ] && ! (${OC} get secret ${PLUGIN_IMAGE_PULL_SECRET_NAME} --namespace ${OSSMCONSOLE_NAMESPACE} &> /dev/null); then \
		echo "${PLUGIN_IMAGE_PULL_SECRET_JSON}" | base64 -d > /tmp/ossmconsole-plugin-pull-secret.json ;\
		${OC} create secret generic ${PLUGIN_IMAGE_PULL_SECRET_NAME} --from-file=.dockerconfigjson=/tmp/ossmconsole-plugin-pull-secret.json --type=kubernetes.io/dockerconfigjson --namespace=${OSSMCONSOLE_NAMESPACE} ;\
		${OC} label secret ${PLUGIN_IMAGE_PULL_SECRET_NAME} --namespace ${OSSMCONSOLE_NAMESPACE} app.kubernetes.io/name=ossmconsole ;\
		rm /tmp/ossmconsole-plugin-pull-secret.json ;\
	fi

.remove-plugin-pull-secret: .prepare-plugin-pull-secret
	@if [ -n "${PLUGIN_IMAGE_PULL_SECRET_NAME}" ]; then ${OC} delete --ignore-not-found=true secret ${PLUGIN_IMAGE_PULL_SECRET_NAME} --namespace=${OSSMCONSOLE_NAMESPACE}; fi

.create-ossmconsole-namespace: .ensure-oc-login
	${OC} get namespace ${OSSMCONSOLE_NAMESPACE} &> /dev/null || ${OC} create namespace ${OSSMCONSOLE_NAMESPACE}

.delete-ossmconsole-namespace: .ensure-oc-login
	${OC} delete --ignore-not-found=true namespace ${OSSMCONSOLE_NAMESPACE}

## operator-create: Deploy the Kiali operator to the cluster using the install script.
# By default, this target will not deploy Kiali - it will only deploy the operator.
# You can tell it to also install Kiali by setting OPERATOR_INSTALL_KIALI=true.
# The Kiali operator does not create secrets, but this calls the install script
# which can create a Kiali secret for you as a convienence so you don't have
# to remember to do it yourself. It will only do this if it was told to install Kiali.
operator-create: .ensure-operator-repo-exists .ensure-operator-helm-chart-exists .find-helm-exe operator-delete .ensure-operator-ns-does-not-exist .create-operator-pull-secret
	@echo Deploy Operator
	${ROOTDIR}/operator/deploy/deploy-kiali-operator.sh \
    --helm-chart                    "$(shell ls -dt1 ${HELM_CHARTS_REPO}/_output/charts/kiali-operator*.tgz | head -n 1)" \
    --helm-exe                      "${HELM}" \
    --helm-set                      "debug.enableProfiler=${OPERATOR_PROFILER_ENABLED}" \
    --helm-set                      "allowAdHocKialiNamespace=${OPERATOR_ALLOW_AD_HOC_KIALI_NAMESPACE}" \
    --helm-set                      "allowAdHocKialiImage=${OPERATOR_ALLOW_AD_HOC_KIALI_IMAGE}" \
    --helm-set                      "allowAdHocOSSMConsoleImage=${OPERATOR_ALLOW_AD_HOC_OSSMCONSOLE_IMAGE}" \
    --helm-set                      "image.pullSecrets={${OPERATOR_IMAGE_PULL_SECRET_NAME}}" \
    --operator-cluster-role-creator "true" \
    --operator-image-name           "${CLUSTER_OPERATOR_INTERNAL_NAME}" \
    --operator-image-pull-policy    "${OPERATOR_IMAGE_PULL_POLICY}" \
    --operator-image-version        "${OPERATOR_CONTAINER_VERSION}" \
    --operator-install-kiali        "${OPERATOR_INSTALL_KIALI}" \
    --operator-namespace            "${OPERATOR_NAMESPACE}" \
    --operator-watch-namespace      "${OPERATOR_WATCH_NAMESPACE}" \
    --cluster-wide-access           "${CLUSTER_WIDE_ACCESS}" \
    --auth-strategy                 "${AUTH_STRATEGY}" \
    --kiali-image-name              "${CLUSTER_KIALI_INTERNAL_NAME}" \
    --kiali-image-pull-policy       "${KIALI_IMAGE_PULL_POLICY}" \
    --kiali-image-version           "${CONTAINER_VERSION}" \
    --namespace                     "${NAMESPACE}" \
    --version                       "${KIALI_CR_SPEC_VERSION}"

## operator-delete: Remove the Kiali operator resources from the cluster along with Kiali itself
operator-delete: .ensure-oc-exists kiali-delete kiali-purge ossmconsole-delete ossmconsole-purge crd-delete .remove-operator-pull-secret .delete-ossmconsole-namespace
	@echo Remove Operator
	${OC} delete --ignore-not-found=true all,sa,deployments,secrets --selector="app.kubernetes.io/name=kiali-operator" -n "${OPERATOR_NAMESPACE}"
	${OC} delete --ignore-not-found=true clusterroles,clusterrolebindings --selector="app.kubernetes.io/name=kiali-operator"
	${OC} delete --ignore-not-found=true namespace "${OPERATOR_NAMESPACE}"

## operator-reload-image: Restarts the Kiali Operator pod by deleting it which forces a redeployment
operator-reload-image: .ensure-oc-exists
	@echo Refreshing Kiali Operator pod within namespace ${OPERATOR_NAMESPACE}
	${OC} delete pod --selector=app.kubernetes.io/name=kiali-operator -n ${OPERATOR_NAMESPACE}

## kiali-create: Create a Kiali CR to the cluster, informing the Kiali operator to install Kiali.
kiali-create: .ensure-operator-repo-exists .prepare-cluster
	@# Make sure the namespace exists
	${OC} get namespace ${OPERATOR_INSTALL_KIALI_CR_NAMESPACE} &> /dev/null || ${OC} create namespace ${OPERATOR_INSTALL_KIALI_CR_NAMESPACE}
	@echo Deploy Kiali using the settings found in ${KIALI_CR_FILE}
	cat ${KIALI_CR_FILE} | \
CLUSTER_WIDE_ACCESS="${CLUSTER_WIDE_ACCESS}" \
AUTH_STRATEGY="${AUTH_STRATEGY}" \
KIALI_EXTERNAL_SERVICES_PASSWORD="$(shell ${OC} get secrets htpasswd -n ${NAMESPACE} -o jsonpath='{.data.rawPassword}' 2>/dev/null | base64 --decode)" \
KIALI_IMAGE_NAME="${CLUSTER_KIALI_INTERNAL_NAME}" \
KIALI_IMAGE_PULL_POLICY="${KIALI_IMAGE_PULL_POLICY}" \
KIALI_IMAGE_VERSION="${CONTAINER_VERSION}" \
NAMESPACE="${NAMESPACE}" \
ROUTER_HOSTNAME="$(shell ${OC} get $(shell (${OC} get routes -n ${NAMESPACE} -o name 2>/dev/null || echo 'noroute') | head -n 1) -n ${NAMESPACE} -o jsonpath='{.status.ingress[0].routerCanonicalHostname}' 2>/dev/null)" \
SERVICE_TYPE="${SERVICE_TYPE}" \
KIALI_CR_SPEC_VERSION="${KIALI_CR_SPEC_VERSION}" \
envsubst | ${OC} apply -n "${OPERATOR_INSTALL_KIALI_CR_NAMESPACE}" -f -

## kiali-delete: Remove a Kiali CR from the cluster, informing the Kiali operator to uninstall Kiali.
kiali-delete: .ensure-oc-exists
	@echo Remove Kiali
	${OC} delete --ignore-not-found=true kiali kiali -n "${OPERATOR_INSTALL_KIALI_CR_NAMESPACE}" ; true

## kiali-purge: Purges all Kiali resources directly without going through the operator or ansible.
kiali-purge: .ensure-oc-exists
	@echo Purge Kiali resources
	@for k in $(shell ${OC} get kiali --ignore-not-found=true --all-namespaces -o custom-columns=NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g') ;\
	  do \
	    cr_namespace="$$(echo $${k} | cut -d: -f1)" ;\
	    cr_name="$$(echo $${k} | cut -d: -f2)" ;\
	    echo "Deleting Kiali CR [$${cr_name}] in namespace [$${cr_namespace}]" ;\
	    ${OC} patch  kiali $${cr_name} -n $${cr_namespace} -p '{"metadata":{"finalizers": []}}' --type=merge ;\
	    ${OC} delete kiali $${cr_name} -n $${cr_namespace} ;\
	  done
	${OC} delete --ignore-not-found=true all,secrets,sa,configmaps,deployments,roles,rolebindings,ingresses,horizontalpodautoscalers --selector="app.kubernetes.io/name=kiali" -n "${NAMESPACE}"
	${OC} delete --ignore-not-found=true clusterroles,clusterrolebindings --selector="app.kubernetes.io/name=kiali"
	${OC} delete --ignore-not-found=true networkpolicies.networking.k8s.io -n ${NAMESPACE} kiali-network-policy-from-make
ifeq ($(CLUSTER_TYPE),openshift)
	${OC} delete --ignore-not-found=true routes --selector="app.kubernetes.io/name=kiali" -n "${NAMESPACE}" ; true
	${OC} delete --ignore-not-found=true consolelinks.console.openshift.io,oauthclients.oauth.openshift.io --selector="app.kubernetes.io/name=kiali" ; true
endif

## ossmconsole-create: Create a OSSMConsole CR to the cluster, informing the Kiali operator to install OSSMC.
ossmconsole-create: .ensure-operator-repo-exists .prepare-cluster .create-plugin-pull-secret
ifeq ($(CLUSTER_TYPE),openshift)
	@while ! (${OC} get pods -l app.kubernetes.io/name=kiali --all-namespaces --no-headers 2>/dev/null | grep -q Running); do echo "Kiali needs to be installed and running before you can install OSSMC. Waiting for Kiali to start..."; sleep 2; done
	@echo Deploy OSSM Console using the settings found in ${OSSMCONSOLE_CR_FILE}
	cat ${OSSMCONSOLE_CR_FILE} | \
DEPLOYMENT_IMAGE_NAME="${CLUSTER_PLUGIN_INTERNAL_NAME}" \
DEPLOYMENT_IMAGE_VERSION="${PLUGIN_CONTAINER_VERSION}" \
PULL_SECRET_NAME="${PLUGIN_IMAGE_PULL_SECRET_NAME}" \
OSSMCONSOLE_CR_SPEC_VERSION="${OSSMCONSOLE_CR_SPEC_VERSION}" \
envsubst | ${OC} apply -n "${OSSMCONSOLE_NAMESPACE}" -f -
else
	@echo "Will not create OSSMConsole CR on non-OpenShift environments."
endif

## ossmconsole-delete: Remove a OSSMConsole CR from the cluster, informing the Kiali operator to uninstall OSSMC.
ossmconsole-delete: .ensure-oc-exists .remove-plugin-pull-secret
ifeq ($(CLUSTER_TYPE),openshift)
	@echo Remove OSSMConsole
	${OC} delete --ignore-not-found=true ossmconsole ossmconsole -n "${OSSMCONSOLE_NAMESPACE}" ; true
else
	@echo "No OSSMConsole CR to delete on non-OpenShift environments."
endif

## ossmconsole-purge: Purges all OSSM Console resources directly without going through the operator or ansible.
ossmconsole-purge: .ensure-oc-exists .remove-plugin-pull-secret
ifeq ($(CLUSTER_TYPE),openshift)
	@echo Purge OSSM Console resources
	@for cr in $(shell ${OC} get ossmconsole --ignore-not-found=true --all-namespaces -o custom-columns=NS:.metadata.namespace,N:.metadata.name --no-headers | sed 's/  */:/g') ;\
	  do \
	    cr_namespace="$$(echo $${cr} | cut -d: -f1)" ;\
	    cr_name="$$(echo $${cr} | cut -d: -f2)" ;\
	    echo "Deleting OSSMConsole CR [$${cr_name}] in namespace [$${cr_namespace}]" ;\
	    ${OC} patch  ossmconsole $${cr_name} -n $${cr_namespace} -p '{"metadata":{"finalizers": []}}' --type=merge ;\
	    ${OC} delete ossmconsole $${cr_name} -n $${cr_namespace} ;\
	  done
	${OC} delete --ignore-not-found=true all,configmaps,deployments,consoleplugins --selector="app.kubernetes.io/name=ossmconsole" -n "${NAMESPACE}"
	index="$$(${OC} get consoles.operator.openshift.io cluster -o json | jq '.spec.plugins | index("ossmconsole")')" && [ "$${index}" != "null" ] && ${OC} patch consoles.operator.openshift.io cluster --type=json -p '[{"op":"remove","path":"/spec/plugins/'$${index}'"}]' || true
else
	@echo "No OSSMConsole resources to delete on non-OpenShift environments."
endif

## kiali-reload-image: Refreshing the Kiali pod by deleting it which forces a redeployment
kiali-reload-image: .ensure-oc-exists
	@echo Refreshing Kiali pod within namespace ${NAMESPACE}
	${OC} delete pod --selector=app.kubernetes.io/name=kiali -n ${NAMESPACE}

.prepare-operator-playbook-kiali:
	@$(eval OPERATOR_PLAYBOOK_KIND ?= kiali)

.prepare-operator-playbook-ossmconsole:
	@$(eval OPERATOR_PLAYBOOK_KIND ?= ossmconsole)

.run-operator-playbook: .ensure-operator-repo-exists .ensure-operator-helm-chart-exists
ifeq ($(OPERATOR_PROFILER_ENABLED),true)
	@$(eval ANSIBLE_CALLBACK_WHITELIST_ARG ?= ANSIBLE_CALLBACK_WHITELIST=profile_tasks)
endif
	@$(eval ANSIBLE_PYTHON_INTERPRETER ?= $(shell if (which python 2>/dev/null 1>&2 && python --version 2>&1 | grep -q " 2\.*"); then echo "-e ansible_python_interpreter=python3"; else echo ""; fi))
	@if [ ! -z "${ANSIBLE_PYTHON_INTERPRETER}" ]; then echo "ANSIBLE_PYTHON_INTERPRETER is [${ANSIBLE_PYTHON_INTERPRETER}]. Make sure that refers to a Python3 installation. If you do not have Python3 in that location, you must ensure you have Python3 and ANSIBLE_PYTHON_INTERPRETER is set to '-e ansible_python_interpreter=<full path to your python3 executable>"; fi
	@echo "Ensure the CRDs exist"; ${OC} apply -f ${HELM_CHARTS_REPO}/kiali-operator/crds/crds.yaml
	@echo "Create a dummy [${OPERATOR_PLAYBOOK_KIND}] CR"; ${OC} apply -f ${ROOTDIR}/operator/dev-playbook-config/${OPERATOR_PLAYBOOK_KIND}/dev-cr.yaml
	ansible-galaxy collection install operator_sdk.util kubernetes.core
	ALLOW_AD_HOC_KIALI_NAMESPACE=true \
	ALLOW_AD_HOC_KIALI_IMAGE=true \
	ALLOW_AD_HOC_OSSMCONSOLE_IMAGE=true \
	ALLOW_ALL_ACCESSIBLE_NAMESPACES=true \
	ANSIBLE_ROLES_PATH=${ROOTDIR}/operator/roles \
	${ANSIBLE_CALLBACK_WHITELIST_ARG} \
	ansible-playbook -vvv ${ANSIBLE_PYTHON_INTERPRETER} \
	  -i ${ROOTDIR}/operator/dev-playbook-config/${OPERATOR_PLAYBOOK_KIND}/dev-hosts.yaml \
	  ${ROOTDIR}/operator/dev-playbook-config/${OPERATOR_PLAYBOOK_KIND}/dev-playbook.yaml
	@echo "Remove the dummy [${OPERATOR_PLAYBOOK_KIND}] CR"; ${OC} delete -f ${ROOTDIR}/operator/dev-playbook-config/${OPERATOR_PLAYBOOK_KIND}/dev-cr.yaml

## run-operator-playbook-kiali: Run the operator dev playbook to run the operator ansible script locally and process a Kiali CR
run-operator-playbook-kiali: .prepare-operator-playbook-kiali .run-operator-playbook

## run-operator-playbook-ossmconsole: Run the operator dev playbook to run the operator ansible script locally and process a OSSMConsole CR
run-operator-playbook-ossmconsole: .prepare-operator-playbook-ossmconsole .run-operator-playbook

# Set an operator environment variable to configure features inside the operator.
# Example values for OPERATOR_ENV_NAME [OPERATOR_ENV_VALUE] are:
#   ALLOW_AD_HOC_KIALI_NAMESPACE [true or false]
#   ALLOW_AD_HOC_KIALI_IMAGE [true or false]
#   ANSIBLE_DEBUG_LOGS [true or false]
#   ANSIBLE_VERBOSITY_KIALI_KIALI_IO [0 thru 7]
#   ANSIBLE_CONFIG [/etc/ansible/ansible.cfg or /opt/ansible/ansible-profiler.cfg]
.operator-set-config: .ensure-oc-exists
	@$(eval EXISTING_OPERATOR_NAMESPACE ?= $(shell ${OC} get deployments --all-namespaces | grep kiali-operator | cut -d ' ' -f 1))
	@if [ -z "${EXISTING_OPERATOR_NAMESPACE}" ]; then echo "Kiali Operator does not appear to be installed yet."; exit 1; fi
	@$(eval EXISTING_OPERATOR_CSV = $(shell ${OC} get csv -n ${EXISTING_OPERATOR_NAMESPACE} -o name | grep kiali))
	@if [ -z "${OPERATOR_ENV_NAME}" ]; then echo "OPERATOR_ENV_NAME is not set."; exit 1; fi
	@if [ -z "${OPERATOR_ENV_VALUE}" ]; then echo "OPERATOR_ENV_VALUE is not set."; exit 1; fi
	@if [ -z "${EXISTING_OPERATOR_CSV}" ]; then ${OC} -n ${EXISTING_OPERATOR_NAMESPACE} set env deploy/kiali-operator "${OPERATOR_ENV_NAME}=${OPERATOR_ENV_VALUE}"; else ${OC} -n ${EXISTING_OPERATOR_NAMESPACE} patch ${EXISTING_OPERATOR_CSV} --type=json -p "[{'op':'replace','path':"/spec/install/spec/deployments/0/spec/template/spec/containers/0/env/$(shell ${OC} -n ${EXISTING_OPERATOR_NAMESPACE} get ${EXISTING_OPERATOR_CSV} -o jsonpath='{.spec.install.spec.deployments[0].spec.template.spec.containers[0].env[*].name}' | tr ' ' '\n' | cat --number | grep ${OPERATOR_ENV_NAME} | cut -f 1 | xargs echo -n | cat - <(echo "-1") | bc)/value",'value':"\"${OPERATOR_ENV_VALUE}\""}]"; fi

## operator-set-config-allow-ad-hoc-kiali-namespace: Tells the operator if it should allow Kiali CRs in an ad hoc namespace. Default OPERATOR_ENV_VALUE=true
operator-set-config-allow-ad-hoc-kiali-namespace: .operator-set-env-allow-ad-hoc-kiali-namespace .operator-set-config
.operator-set-env-allow-ad-hoc-kiali-namespace:
	@$(eval OPERATOR_ENV_NAME = ALLOW_AD_HOC_KIALI_NAMESPACE)
	@$(eval OPERATOR_ENV_VALUE ?= true)

## operator-set-config-allow-ad-hoc-kiali-image: Tells the operator if it should allow ad hoc images. Default OPERATOR_ENV_VALUE=true
operator-set-config-allow-ad-hoc-kiali-image: .operator-set-env-allow-ad-hoc-kiali-image .operator-set-config
.operator-set-env-allow-ad-hoc-kiali-image:
	@$(eval OPERATOR_ENV_NAME = ALLOW_AD_HOC_KIALI_IMAGE)
	@$(eval OPERATOR_ENV_VALUE ?= true)

## operator-set-config-ansible-debug-logs: Configures the logger within the operator. Default OPERATOR_ENV_VALUE=true
operator-set-config-ansible-debug-logs: .operator-set-env-ansible-debug-logs .operator-set-config
.operator-set-env-ansible-debug-logs:
	@$(eval OPERATOR_ENV_NAME = ANSIBLE_DEBUG_LOGS)
	@$(eval OPERATOR_ENV_VALUE ?= true)

## operator-set-config-ansible-verbosity: Sets the logging verbosity within the operator. Default OPERATOR_ENV_VALUE=7
operator-set-config-ansible-verbosity: .operator-set-env-ansible-verbosity .operator-set-config
.operator-set-env-ansible-verbosity:
	@$(eval OPERATOR_ENV_NAME = ANSIBLE_VERBOSITY_KIALI_KIALI_IO)
	@$(eval OPERATOR_ENV_VALUE ?= 7)

## operator-set-config-ansible-profiler-on: Turns on the profiler within the operator.
operator-set-config-ansible-profiler-on: .operator-set-env-ansible-profiler-on .operator-set-config
.operator-set-env-ansible-profiler-on:
	@$(eval OPERATOR_ENV_NAME = ANSIBLE_CONFIG)
	@$(eval OPERATOR_ENV_VALUE ?= /opt/ansible/ansible-profiler.cfg)

## operator-set-config-ansible-profiler-off: Turns off the profiler within the operator.
operator-set-config-ansible-profiler-off: .operator-set-env-ansible-profiler-off .operator-set-config
.operator-set-env-ansible-profiler-off:
	@$(eval OPERATOR_ENV_NAME = ANSIBLE_CONFIG)
	@$(eval OPERATOR_ENV_VALUE ?= /etc/ansible/ansible.cfg)

#
# The following targets will allow you to run the operator external to the cluster in the same manner it runs in the cluster
#

.download-ansible-operator-if-needed:
	@if [ "$(shell which ansible-operator 2>/dev/null || echo -n "")" == "" ]; then \
	  sdk_version="$$(sed -rn 's/^OPERATOR_SDK_VERSION *\?= *(.*)/\1/p' ${OPERATOR_DIR}/Makefile)" ;\
	  mkdir -p "${OUTDIR}/ansible-operator-install" ;\
	  if [ -x "${OUTDIR}/ansible-operator-install/ansible-operator" ]; then \
	    echo "You do not have ansible-operator installed in your PATH. Will use the one found here: ${OUTDIR}/ansible-operator-install/ansible-operator" ;\
	  else \
	    echo "You do not have ansible-operator installed in your PATH. The binary will be downloaded to ${OUTDIR}/ansible-operator-install/ansible-operator" ;\
	    curl -L https://github.com/operator-framework/operator-sdk/releases/download/v$${sdk_version}/ansible-operator_${OS}_${ARCH} > "${OUTDIR}/ansible-operator-install/ansible-operator" ;\
	    chmod +x "${OUTDIR}/ansible-operator-install/ansible-operator" ;\
	  fi ;\
	fi

.ensure-ansible-operator-exists: .download-ansible-operator-if-needed
	@$(eval ANSIBLE_OPERATOR_BIN ?= $(shell which ansible-operator 2>/dev/null || echo "${OUTDIR}/ansible-operator-install/ansible-operator"))
	@"${ANSIBLE_OPERATOR_BIN}" version

.download-ansible-runner-if-needed:
	@if [ "$(shell which ansible-runner 2>/dev/null || echo -n "")" == "" ]; then \
	  mkdir -p "${OUTDIR}/ansible-operator-install" ;\
	  if [ -x "${OUTDIR}/ansible-operator-install/ansible-runner" ]; then \
	    echo "You do not have ansible-runner installed in your PATH.  Will use the one found here: ${OUTDIR}/ansible-operator-install/ansible-runner" ;\
	  else \
	    echo "You do not have ansible-runner installed in your PATH. An attempt to install it will be made and a softlink to its binary placed at ${OUTDIR}/ansible-operator-install/ansible-runner" ;\
	    echo "If the installation fails, you must install it manually. See: https://ansible-runner.readthedocs.io/en/latest/install/" ;\
	    python3 -m pip install ansible-runner ansible-runner-http openshift ;\
	    ln --force -s "${HOME}/.local/bin/ansible-runner" "${OUTDIR}/ansible-operator-install/ansible-runner" ;\
	  fi ;\
	fi

.ensure-ansible-runner-exists: .download-ansible-runner-if-needed
	@$(eval ANSIBLE_RUNNER_BIN ?= $(shell which ansible-runner 2>/dev/null || echo "${OUTDIR}/ansible-operator-install/ansible-runner"))
	@"${ANSIBLE_RUNNER_BIN}" --version

## get-ansible-operator: Downloads the Ansible Operator binary if it is not already in PATH.
get-ansible-operator: .ensure-ansible-operator-exists .ensure-ansible-runner-exists
	@echo "Ansible Operator location: ${ANSIBLE_OPERATOR_BIN} (ansible-runner: ${ANSIBLE_RUNNER_BIN})"

## crd-create: Installs the Kiali CRD and OSSMConsole CRD. Useful if running the operator outside of OLM or Helm.
crd-create: .ensure-oc-login
	${OC} apply -f "${OPERATOR_DIR}/manifests/kiali-ossm/manifests/kiali.crd.yaml"
ifeq ($(CLUSTER_TYPE),openshift)
	${OC} apply -f "${OPERATOR_DIR}/manifests/kiali-ossm/manifests/ossmconsole.crd.yaml"
endif

## crd-delete: Uninstalls the Kiali CRD and OSSMConsole CRD and all CRs. Useful if running the operator outside of OLM or Helm.
crd-delete: .ensure-oc-login
	@echo "Deleting CRDs"
	${OC} delete --ignore-not-found=true crd kialis.kiali.io
ifeq ($(CLUSTER_TYPE),openshift)
	${OC} delete --ignore-not-found=true crd ossmconsoles.kiali.io
endif

.wait-for-kiali-crd:
	@echo -n "Waiting for the Kiali CRD to be established"
	@i=0 ;\
	until [ $${i} -eq 60 ] || ${OC} get crd kialis.kiali.io &> /dev/null; do \
	    echo -n '.' ; sleep 2 ; (( i++ )) ;\
	done ;\
	echo ;\
	[ $${i} -lt 60 ] || (echo "The Kiali CRD does not exist. You should install the operator." && exit 1)
	${OC} wait --for condition=established --timeout=60s crd kialis.kiali.io

.wait-for-ossmconsole-crd:
ifeq ($(CLUSTER_TYPE),openshift)
	@echo -n "Waiting for the OSSMConsole CRD to be established"
	@i=0 ;\
	until [ $${i} -eq 60 ] || ${OC} get crd ossmconsoles.kiali.io &> /dev/null; do \
	    echo -n '.' ; sleep 2 ; (( i++ )) ;\
	done ;\
	echo ;\
	[ $${i} -lt 60 ] || (echo "The OSSMConsole CRD does not exist. You should install the operator." && exit 1)
	${OC} wait --for condition=established --timeout=60s crd ossmconsoles.kiali.io
else
	@echo "No OSSMConsole CRD expected on non-OpenShift environments."
endif

## run-operator: Runs the Kiali Operator via the ansible-operator locally.
run-operator: get-ansible-operator crd-create .wait-for-kiali-crd .wait-for-ossmconsole-crd
ifeq ($(CLUSTER_TYPE),openshift)
	@$(eval WATCHES_FILE ?= watches-os.yaml)
else
	@$(eval WATCHES_FILE ?= watches-k8s.yaml)
endif
	@# Make sure we have the collections we need
	ansible-galaxy collection install -r ${OPERATOR_DIR}/requirements.yml --force-with-deps
	@# Run the operator directly
	cd ${OPERATOR_DIR} && \
	ANSIBLE_ROLES_PATH="${OPERATOR_DIR}/roles" \
	ALLOW_AD_HOC_KIALI_NAMESPACE="true" \
	ALLOW_AD_HOC_KIALI_IMAGE="true" \
	ALLOW_AD_HOC_OSSMCONSOLE_IMAGE="true" \
	ALLOW_ALL_ACCESSIBLE_NAMESPACES="true" \
	ANSIBLE_VERBOSITY_KIALI_KIALI_IO="1" \
	ANSIBLE_VERBOSITY_OSSMCONSOLE_KIALI_IO="1" \
	ANSIBLE_DEBUG_LOGS="True" \
	ANSIBLE_CALLBACK_WHITELIST="profile_tasks" \
	ANSIBLE_CALLBACKS_ENABLED="profile_tasks" \
	PROFILE_TASKS_TASK_OUTPUT_LIMIT="100" \
	POD_NAMESPACE="does-not-exist" \
	WATCH_NAMESPACE="" \
	PATH="${PATH}:${OUTDIR}/ansible-operator-install" \
	ansible-operator run --zap-log-level=debug --leader-election-id=kiali-operator --watches-file=${WATCHES_FILE}
