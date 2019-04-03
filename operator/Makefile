# Details about the Kiali operator image.
OPERATOR_IMAGE_NAME ?= kiali/kiali-operator
OPERATOR_IMAGE_VERSION ?= dev
OPERATOR_NAMESPACE = kiali-operator

# When deploying the Kiali operator, this setting will indicate if it should install Kiali also.
OPERATOR_INSTALL_KIALI ?= true

# When installing Kiali, here are some configuration settings for it.
AUTH_STRATEGY ?= openshift
CREDENTIALS_USERNAME ?= admin
CREDENTIALS_PASSPHRASE ?= admin
IMAGE_VERSION ?= dev
NAMESPACE ?= istio-system

# Build the Kiali operator container image
operator-build:
	@echo Build operator
	operator-sdk build ${OPERATOR_IMAGE_NAME}:${OPERATOR_IMAGE_VERSION}

# Push the Kiali operator container image to a remote repo
operator-push:
	@echo Push operator image to image repo
	docker push ${OPERATOR_IMAGE_NAME}:${OPERATOR_IMAGE_VERSION}

# Deploy the Kiali operator to the cluster using the install script.
# The Kiali Operator does not create secrets, but this calls the install
# script which creates a Kiali secret for you as a convienence
# so you don't have to remember to do it yourself.
operator-deploy: operator-remove
	@echo Deploy Operator
	OPERATOR_IMAGE_NAME="${OPERATOR_IMAGE_NAME}" \
OPERATOR_IMAGE_VERSION="${OPERATOR_IMAGE_VERSION}" \
OPERATOR_NAMESPACE="${OPERATOR_NAMESPACE}" \
OPERATOR_INSTALL_KIALI="${OPERATOR_INSTALL_KIALI}" \
AUTH_STRATEGY="${AUTH_STRATEGY}" \
CREDENTIALS_USERNAME="${CREDENTIALS_USERNAME}" \
CREDENTIALS_PASSPHRASE="${CREDENTIALS_PASSPHRASE}" \
IMAGE_VERSION="${IMAGE_VERSION}" \
NAMESPACE="${NAMESPACE}" \
deploy/deploy-kiali-operator.sh

# Remove the Kiali operator resources from the cluster along with Kiali itself
operator-remove: purge-kiali
	@echo Remove Operator
	oc delete --ignore-not-found=true all,sa,deployments,clusterroles,clusterrolebindings,customresourcedefinitions --selector=app=kiali-operator -n ${OPERATOR_NAMESPACE}
	oc delete --ignore-not-found=true namespace ${OPERATOR_NAMESPACE}

# Create a Kiali CR to the cluster, informing the Kiali operator to install it.
deploy-kiali:
	@echo Deploy Kiali
	oc apply -n ${OPERATOR_NAMESPACE} -f deploy/kiali/kiali_cr_dev.yaml

# Remove a Kiali CR from the cluster, informing the Kiali operator to uninstall it.
remove-kiali:
	@echo Remove Kiali
	oc delete --ignore-not-found=true -n ${OPERATOR_NAMESPACE} -f deploy/kiali/kiali_cr_dev.yaml
	# Since Kiali Operator does not manage any secrets, delete the secret here
	oc delete --ignore-if-not-exist=true secret kiali -n ${NAMESPACE}

# Purges all Kiali resources via direct "oc delete".
purge-kiali:
	@echo Purge Kiali resources
	oc patch kiali kiali -n ${OPERATOR_NAMESPACE} -p '{"metadata":{"finalizers": []}}' --type=merge ; true
	oc delete all,secrets,sa,templates,configmaps,deployments,clusterroles,clusterrolebindings,ingresses,customresourcedefinitions,oauthclients.oauth.openshift.io --selector=app=kiali -n ${NAMESPACE}

# Run the dev playbook to run the Ansible script locally.
run-playbook:
	ansible-playbook -vvv -i dev-hosts dev-playbook.yml

# Run a tagged set of tasks via dev playbook to run parts of the Ansible script locally.
# To use this, add "tags: test" to one or more tasks - those are the tasks that will be run.
run-playbook-tag:
	ansible-playbook -vvv -i dev-hosts dev-playbook.yml --tags test
