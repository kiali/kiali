#
# Targets to run operator molecule tests.
#

# The test scenario to run - see molecule/ - all directories with a name *-test are scenarios you can run
# Example: MOLECULE_SCENARIO=token-test make molecule-test
MOLECULE_SCENARIO ?= default

ifeq ($(MOLECULE_DEBUG),true)
MOLECULE_DEBUG_ARG = --debug
endif

ifeq ($(MOLECULE_DESTROY_NEVER),true)
MOLECULE_DESTROY_NEVER_ARG = --destroy never
endif

MOLECULE_KUBECONFIG ?= ${HOME}/.kube/config

## molecule-build: Builds an image to run Molecule without requiring the host to have python/pip installed
molecule-build:
ifeq ($(DORP),docker)
	docker build -t kiali-molecule:latest ${ROOTDIR}/operator/molecule/docker
else
	podman build -t kiali-molecule:latest ${ROOTDIR}/operator/molecule/docker
endif

## molecule-test: Runs Molecule tests using the Molecule docker image
molecule-test:
ifeq ($(DORP),docker)
	docker run --rm -it -v "${PWD}":/tmp/$(basename "${PWD}"):ro -v "${MOLECULE_KUBECONFIG}":/root/.kube/config:ro -v /var/run/docker.sock:/var/run/docker.sock -w /tmp/$(basename "${PWD}") --network="host" --add-host="api.crc.testing:192.168.130.11" kiali-molecule:latest molecule ${MOLECULE_DEBUG_ARG} test ${MOLECULE_DESTROY_NEVER_ARG} --scenario-name ${MOLECULE_SCENARIO}
else
	podman run --rm -it -v "${PWD}":/tmp/$(basename "${PWD}"):ro -v "${MOLECULE_KUBECONFIG}":/root/.kube/config:ro -v /var/run/docker.sock:/var/run/docker.sock -w /tmp/$(basename "${PWD}") --network="host" --add-host="api.crc.testing:192.168.130.11" kiali-molecule:latest molecule ${MOLECULE_DEBUG_ARG} test ${MOLECULE_DESTROY_NEVER_ARG} --scenario-name ${MOLECULE_SCENARIO}
endif

## molecule-test-all: Runs all Molecule tests using the Molecule docker image
molecule-test-all:
ifeq ($(DORP),docker)
	docker run --rm -it -v "${PWD}":/tmp/$(basename "${PWD}"):ro -v "${MOLECULE_KUBECONFIG}":/root/.kube/config:ro -v /var/run/docker.sock:/var/run/docker.sock -w /tmp/$(basename "${PWD}") --network="host" --add-host="api.crc.testing:192.168.130.11" kiali-molecule:latest molecule ${MOLECULE_DEBUG_ARG} test ${MOLECULE_DESTROY_NEVER_ARG} --all
else
	podman run --rm -it -v "${PWD}":/tmp/$(basename "${PWD}"):ro -v "${MOLECULE_KUBECONFIG}":/root/.kube/config:ro -v /var/run/docker.sock:/var/run/docker.sock -w /tmp/$(basename "${PWD}") --network="host" --add-host="api.crc.testing:192.168.130.11" kiali-molecule:latest molecule ${MOLECULE_DEBUG_ARG} test ${MOLECULE_DESTROY_NEVER_ARG} --all
endif
