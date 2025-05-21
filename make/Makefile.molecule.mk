#
# Targets to run operator molecule tests.
#

# The test scenario(s) to run - see molecule/ - all directories with a name *-test are scenarios you can run
# Example: MOLECULE_SCENARIO=token-test make molecule-test
# To run multiple scenarios sequentially: MOLECULE_SCENARIO="token-test roles-test" make molecule-test
MOLECULE_SCENARIO ?= default

# Defines what playbook version to test. This is the value to put in the tests' CR spec.version fields.
MOLECULE_KIALI_CR_SPEC_VERSION ?= default
MOLECULE_OSSMCONSOLE_CR_SPEC_VERSION ?= default

# Set MOLECULE_USE_DEV_IMAGES to true to use your local Kiali and OSSMC plugin dev builds (not released images from quay.io).
# To use this, you must have first pushed your local dev builds via the cluster-push target.
#
# If MOLECULE_USE_DEV_IMAGES is not set or set to 'false', that usually means you want to pick up the latest images
# published on quay.io. However, if you want to test the default Kiali server and plugin images that the operator
# will install, you can set MOLECULE_USE_DEFAULT_IMAGES=true. When that is set (in conjunction with MOLECULE_USE_DEV_IMAGES=false),
# the molecule tests will set the spec.deployment.image_version and spec.deployment.image_name override fields to an
# empty string thus causing the Kiali server and plugin images to be the default image installed by the operator.
# This is useful when you are installing Kiali via OLM and you want to test with a specific CR spec.version
# (MOLECULE_KIALI_CR_SPEC_VERSION / MOLECULE_OSSMCONSOLE_CR_SPEC_VERSION)
# and the default server and plugin that is installed by the operator for that spec.version.
#
# Note that you can override everything mentioned above in order to use your own image names/versions. You can do this by
# setting MOLECULE_IMAGE_ENV_ARGS. This is useful if you want to test a specific released version or images found in a different repo.
# If the x_IMAGE_NAME env vars are set to 'dev' then the molecule tests will use the internal OpenShift registry location.
# An example MOLECULE_IMAGE_ENV_ARGS can be:
#
#   MOLECULE_IMAGE_ENV_ARGS = --env MOLECULE_KIALI_OPERATOR_IMAGE_NAME=quay.io/myuser/kiali-operator \
#                             --env MOLECULE_KIALI_OPERATOR_IMAGE_VERSION=test \
#                             --env MOLECULE_KIALI_IMAGE_NAME=quay.io/myuser/kiali \
#                             --env MOLECULE_KIALI_IMAGE_VERSION=test \
#                             --env MOLECULE_PLUGIN_IMAGE_NAME=quay.io/myuser/kiali \
#                             --env MOLECULE_PLUGIN_IMAGE_VERSION=test

ifndef MOLECULE_IMAGE_ENV_ARGS
ifeq ($(MOLECULE_USE_DEV_IMAGES),true)
ifeq ($(CLUSTER_TYPE),openshift)
MOLECULE_IMAGE_ENV_ARGS = --env MOLECULE_KIALI_OPERATOR_IMAGE_NAME=dev --env MOLECULE_KIALI_OPERATOR_IMAGE_VERSION=dev --env MOLECULE_KIALI_IMAGE_NAME=dev --env MOLECULE_KIALI_IMAGE_VERSION=dev --env MOLECULE_PLUGIN_IMAGE_NAME=dev --env MOLECULE_PLUGIN_IMAGE_VERSION=dev
else ifeq ($(CLUSTER_TYPE),minikube)
MOLECULE_IMAGE_ENV_ARGS = --env MOLECULE_KIALI_OPERATOR_IMAGE_NAME=localhost:5000/kiali/kiali-operator --env MOLECULE_KIALI_OPERATOR_IMAGE_VERSION=dev --env MOLECULE_KIALI_IMAGE_NAME=localhost:5000/kiali/kiali --env MOLECULE_KIALI_IMAGE_VERSION=dev
else ifeq ($(CLUSTER_TYPE),kind)
MOLECULE_IMAGE_ENV_ARGS = --env MOLECULE_KIALI_OPERATOR_IMAGE_NAME=localhost/kiali/kiali-operator --env MOLECULE_KIALI_OPERATOR_IMAGE_VERSION=dev --env MOLECULE_KIALI_IMAGE_NAME=localhost/kiali/kiali --env MOLECULE_KIALI_IMAGE_VERSION=dev
MOLECULE_IMAGE_PULL_POLICY="IfNotPresent"
endif
else ifeq ($(MOLECULE_USE_DEFAULT_IMAGES),true)
export MOLECULE_KIALI_IMAGE_NAME =
export MOLECULE_KIALI_IMAGE_VERSION =
export MOLECULE_PLUGIN_IMAGE_NAME =
export MOLECULE_PLUGIN_IMAGE_VERSION =
MOLECULE_IMAGE_ENV_ARGS = --env 'MOLECULE_KIALI_IMAGE_NAME=' --env 'MOLECULE_KIALI_IMAGE_VERSION=' --env 'MOLECULE_PLUGIN_IMAGE_NAME=' --env 'MOLECULE_PLUGIN_IMAGE_VERSION='
endif
endif

# The Molecule tests by default will have the Kiali and Kiali Operator images pulled "Always".
# MOLECULE_IMAGE_PULL_POLICY changes that default behavior - other options are the k8s values "Never" and "IfNotPresent".
ifdef MOLECULE_IMAGE_PULL_POLICY
MOLECULE_IMAGE_PULL_POLICY_ENV_ARGS ?= --env MOLECULE_KIALI_OPERATOR_IMAGE_PULL_POLICY=${MOLECULE_IMAGE_PULL_POLICY} --env MOLECULE_KIALI_IMAGE_PULL_POLICY=${MOLECULE_IMAGE_PULL_POLICY} --env MOLECULE_PLUGIN_IMAGE_PULL_POLICY=${MOLECULE_IMAGE_PULL_POLICY}
endif

ifeq ($(MOLECULE_DEBUG),true)
MOLECULE_DEBUG_ARG = --debug
endif

ifeq ($(MOLECULE_DESTROY_NEVER),true)
MOLECULE_DESTROY_NEVER_ARG = --destroy never
endif

# If turned on, the operator and kiali pod logs are dumped in the molecule logs if a molecule test fails
ifdef MOLECULE_DUMP_LOGS_ON_ERROR
MOLECULE_DUMP_LOGS_ON_ERROR_ENV_VAR ?= --env MOLECULE_DUMP_LOGS_ON_ERROR=${MOLECULE_DUMP_LOGS_ON_ERROR}
else
MOLECULE_DUMP_LOGS_ON_ERROR_ENV_VAR ?= --env MOLECULE_DUMP_LOGS_ON_ERROR=true
endif

# Turns on or off the ansible profiler which dumps profile logs after each operator reconciliation run
ifdef MOLECULE_OPERATOR_PROFILER_ENABLED
MOLECULE_OPERATOR_PROFILER_ENABLED_ENV_VAR ?= --env MOLECULE_OPERATOR_PROFILER_ENABLED=${MOLECULE_OPERATOR_PROFILER_ENABLED}
else
MOLECULE_OPERATOR_PROFILER_ENABLED_ENV_VAR ?= --env MOLECULE_OPERATOR_PROFILER_ENABLED=true
endif

# You can ask the molecule tests to install the Kiali operator via the Kiali operator helm chart,
# or you can tell the tests to not install the operator - in this case, the tests will assume the
# Kiali operator is already installed. The valid values for this env var is therefore: "helm" or "skip".
ifdef MOLECULE_OPERATOR_INSTALLER
MOLECULE_OPERATOR_INSTALLER_ENV_VAR ?= --env MOLECULE_OPERATOR_INSTALLER=${MOLECULE_OPERATOR_INSTALLER}
else
MOLECULE_OPERATOR_INSTALLER_ENV_VAR ?= --env MOLECULE_OPERATOR_INSTALLER=helm
endif

MOLECULE_KUBECONFIG ?= ${HOME}/.kube/config

# Set up some additional things needed in order to run the molecule tests against a minikube installation
ifeq ($(CLUSTER_TYPE),minikube)
MOLECULE_MINIKUBE_DIR ?= ${HOME}/.minikube
ifeq ($(DORP),podman)
# Mounting each file under .minikube individually. podman 3 has more restrictive volume permissions and the :Z label is required
# but there are two files which are owned by the qemu user and these cannot be labeled since the current user doesn't own them.
MOLECULE_MINIKUBE_VOL_ARG ?= $(shell MYVAR=""; while read -r file ; do MYVAR="$${MYVAR} -v $${file}:$${file}:Z" ; done <<< $$(find ${MOLECULE_MINIKUBE_DIR} -type f | grep -v ".iso" | grep -v ".rawdisk") && echo $$MYVAR)
else
MOLECULE_MINIKUBE_VOL_ARG ?= -v ${MOLECULE_MINIKUBE_DIR}:${MOLECULE_MINIKUBE_DIR}
endif
MOLECULE_MINIKUBE_IP ?= $(shell ${MINIKUBE} ip -p ${MINIKUBE_PROFILE})
MOLECULE_MINIKUBE_ENV_ARGS ?= --env MOLECULE_MINIKUBE_IP=$(shell echo -n ${MOLECULE_MINIKUBE_IP})
# if there are no hosts the user wants, explicitly set this to empty string to avoid errors later
ifndef MOLECULE_ADD_HOST_ARGS
MOLECULE_ADD_HOST_ARGS =
endif
endif

# Set up some additional things needed in order to run the molecule tests against a kind installation
ifeq ($(CLUSTER_TYPE),kind)
MOLECULE_KIND_IP ?= $(shell ${DORP} inspect ${KIND_NAME}-control-plane --format "{{ .NetworkSettings.Networks.kind.IPAddress }}")
MOLECULE_KIND_ENV_ARGS ?= --env MOLECULE_KIND_IP=$(shell echo -n ${MOLECULE_KIND_IP})
# if there are no hosts the user wants, explicitly set this to empty string to avoid errors later
ifndef MOLECULE_ADD_HOST_ARGS
MOLECULE_ADD_HOST_ARGS =
endif
endif

# Only allocate a pseudo-TTY if there is a terminal attached - this enables more readable colored text in ansible output.
# But do not set this option if there is not TERM (i.e. when run within a cron job) to avoid a runtime failure.
ifdef TERM
MOLECULE_DOCKER_TERM_ARGS=-t
endif

# We need to perform more retries when on OpenShift particularly when running on slower machines
ifneq ($(CLUSTER_TYPE),openshift)
MOLECULE_WAIT_RETRIES ?= 120
else
MOLECULE_WAIT_RETRIES ?= 360
endif
MOLECULE_WAIT_RETRIES_ARG ?= --env MOLECULE_WAIT_RETRIES=${MOLECULE_WAIT_RETRIES}

.prepare-force-molecule-build:
ifeq ($(DORP),docker)
	@$(eval FORCE_MOLECULE_BUILD ?= $(shell docker inspect kiali-molecule:latest > /dev/null 2>&1 || echo "true"))
else
	@$(eval FORCE_MOLECULE_BUILD ?= $(shell podman inspect kiali-molecule:latest > /dev/null 2>&1 || echo "true"))
endif

## molecule-build: Builds an image to run Molecule without requiring the host to have python/pip installed. If it already exists, and you want to build it again, set env var FORCE_MOLECULE_BUILD to "true".
molecule-build: .ensure-operator-repo-exists .prepare-force-molecule-build
ifeq ($(DORP),docker)
	@if [ "${FORCE_MOLECULE_BUILD}" == "true" ]; then docker build --no-cache -t kiali-molecule:latest ${ROOTDIR}/operator/molecule/docker; else echo "Will not rebuild kiali-molecule image."; fi
else
	@if [ "${FORCE_MOLECULE_BUILD}" == "true" ]; then podman build --no-cache -t kiali-molecule:latest ${ROOTDIR}/operator/molecule/docker; else echo "Will not rebuild kiali-molecule image."; fi
endif

ifndef MOLECULE_ADD_HOST_ARGS
.prepare-add-host-args: .prepare-cluster
ifeq ($(CLUSTER_TYPE),openshift)
	@echo "Will auto-detect hosts to add based on the CLUSTER_REPO: ${CLUSTER_REPO}"
	@$(eval MOLECULE_ADD_HOST_ARGS ?= $(shell basehost="$(shell echo ${CLUSTER_REPO} | sed 's/^.*\.apps[\.-]\(.*\)/\1/')"; appsbasehost="$(shell echo ${CLUSTER_REPO} | sed 's/^.*\.\(apps[\.-].*\)/\1/')"; kialihost="kiali-istio-system.$${appsbasehost}"; kialiip="$$(getent hosts $${kialihost} | head -n 1 | awk '{ print $$1 }')"; prometheushost="prometheus-istio-system.$${appsbasehost}"; prometheusip="$$(getent hosts $${prometheushost} | head -n 1 | awk '{ print $$1 }')" apihost="api.$${basehost}"; apiip="$$(getent hosts $${apihost} | head -n 1 | awk '{ print $$1 }')"; oauthoshost="oauth-openshift.$${appsbasehost}"; oauthosip="$$(getent hosts $${oauthoshost} | head -n 1 | awk '{ print $$1 }')"; echo "--add-host=$$kialihost:$$kialiip --add-host=$$prometheushost:$$prometheusip --add-host=$$apihost:$$apiip --add-host=$$oauthoshost:$$oauthosip"))
	@echo "Auto-detected add host args: ${MOLECULE_ADD_HOST_ARGS}"
else
	@echo "Will not auto-detect any hosts for non-OpenShift clusters."
endif
else
.prepare-add-host-args:
	@echo "Will use the given add host args: ${MOLECULE_ADD_HOST_ARGS}"
endif

.prepare-molecule-data-volume:
ifeq ($(DORP),docker)
	@echo "Docker is not supported for running the molecule tests. Ignoring 'dorp=docker' and using podman."
endif

	podman volume exists molecule-tests-volume && echo "Podman volume already exists; deleting it" && podman volume rm molecule-tests-volume || true
	podman volume create molecule-tests-volume
	podman create -v molecule-tests-volume:/data --name molecule-volume-helper quay.io/fedora/fedora-minimal:latest sleep infinity
	podman start molecule-volume-helper
	podman run --rm -v molecule-tests-volume:/data -v "${HELM_CHARTS_REPO}":/source:ro,Z quay.io/fedora/fedora-minimal cp -r /source /data/helm-charts-repo
	podman run --rm -v molecule-tests-volume:/data -v "$$(realpath ${ROOTDIR}/operator)":/source:ro,Z quay.io/fedora/fedora-minimal cp -r /source /data/operator
	podman run --rm -v molecule-tests-volume:/data -v "${MOLECULE_KUBECONFIG}":/source:ro,Z quay.io/fedora/fedora-minimal cp -r /source /data/kubeconfig
	podman stop molecule-volume-helper
	podman rm molecule-volume-helper

## molecule-test: Runs Molecule tests using the Molecule docker image
molecule-test: .ensure-operator-repo-exists .ensure-operator-helm-chart-exists .prepare-add-host-args molecule-build .prepare-molecule-data-volume .create-operator-pull-secret
ifeq ($(DORP),docker)
	@echo "Docker is not supported for running the molecule tests. Ignoring 'dorp=docker' and using podman."
endif

	@for msn in ${MOLECULE_SCENARIO}; do \
	  attempt=1; \
	  theCmd="podman run \
	      --rm \
	      ${MOLECULE_DOCKER_TERM_ARGS} \
	      --env KUBECONFIG="/tmp/molecule/kubeconfig" \
	      --env K8S_AUTH_KUBECONFIG="/tmp/molecule/kubeconfig" \
	      --env MOLECULE_CLUSTER_TYPE="${CLUSTER_TYPE}" \
	      --env MOLECULE_HELM_CHARTS_REPO=/tmp/molecule/helm-charts-repo \
	      -v molecule-tests-volume:/tmp/molecule \
	      ${MOLECULE_MINIKUBE_VOL_ARG} \
	      ${MOLECULE_MINIKUBE_ENV_ARGS} \
	      ${MOLECULE_KIND_ENV_ARGS} \
	      -w /tmp/molecule/operator \
	      --network="host" \
	      ${MOLECULE_ADD_HOST_ARGS} \
	      --env DORP=podman \
	      --env OPERATOR_IMAGE_PULL_SECRET_NAME=${OPERATOR_IMAGE_PULL_SECRET_NAME} \
	      --env MOLECULE_KIALI_CR_SPEC_VERSION=${MOLECULE_KIALI_CR_SPEC_VERSION} \
	      --env PLUGIN_IMAGE_PULL_SECRET_JSON="${PLUGIN_IMAGE_PULL_SECRET_JSON}" \
	      --env MOLECULE_OSSMCONSOLE_CR_SPEC_VERSION="${MOLECULE_OSSMCONSOLE_CR_SPEC_VERSION}" \
	      ${MOLECULE_IMAGE_ENV_ARGS} \
	      ${MOLECULE_OPERATOR_PROFILER_ENABLED_ENV_VAR} \
	      ${MOLECULE_OPERATOR_INSTALLER_ENV_VAR} \
	      ${MOLECULE_DUMP_LOGS_ON_ERROR_ENV_VAR} \
	      ${MOLECULE_IMAGE_PULL_POLICY_ENV_ARGS} \
	      ${MOLECULE_WAIT_RETRIES_ARG} \
	      localhost/kiali-molecule:latest molecule \
	      ${MOLECULE_DEBUG_ARG} \
	      test \
	      ${MOLECULE_DESTROY_NEVER_ARG} \
	      --scenario-name $${msn}"; \
	  echo "$$theCmd"; \
	  while [ $$attempt -le 60 ]; do \
	    echo "Running molecule test: scenario=$$msn (attempt=$$attempt)"; \
	    tmpfile=$$(mktemp); \
	    $$theCmd 2>&1 | tee "$$tmpfile"; \
	    exitcode="$${PIPESTATUS[0]}"; \
	    if [ "$$exitcode" -eq 0 ]; then \
	      echo "Molecule test passed: $$msn"; \
	      success="true"; \
	      rm -f $$tmpfile; \
	      break; \
	    elif grep -iq "Skipping Galaxy server" "$$tmpfile"; then \
	      echo "Molecule test failed but will retry after 60s: $$msn"; \
	      attempt=$$((attempt + 1)); \
	      sleep 60; \
	    else \
	      echo "Molecule test failed, will not retry: $$msn"; \
	      rm -f $$tmpfile; \
	      break; \
	    fi; \
	  done; \
	  echo "$$output"; \
	  podman volume rm molecule-tests-volume; \
	  if [ "$$success" != "true" ]; then \
	    echo "MOLECULE TEST HAS FAILED! test=$$msn"; \
	    exit 1; \
	  fi; \
	done
