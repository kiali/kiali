# This Makefile is used to automate Kaili releases.
# Please, see documentation in RELEASING.adoc

CONSOLE_LOCAL_DIR ?= ../kiali-ui

BACKEND_VERSION ?= $(shell sed -rn 's/^VERSION \?= v(.*)/\1/p' Makefile)
BACKEND_BUMPED_VERSION ?= $(shell semver bump minor $(BACKEND_VERSION))
BACKEND_VERSION_BRANCH ?= $(shell echo "$(BACKEND_VERSION)" | sed 's/-SNAPSHOT//' | sed 's/\.0$$//')

BACKEND_GITHUB_URI ?= git@github.com:kiali/kiali.git
BACKEND_FORK_URI ?= $(shell git config --get remote.origin.url)
BACKEND_PULL_URI ?= https://api.github.com/repos/kiali/kiali/pulls

BUILD_TAG ?= prepare-next-version
BUMP_BRANCH_ID ?= $(BUILD_TAG)

DOCKER_NAME ?= docker.io/kiali/kiali

RELEASE_TYPE ?= 'minor'
ifeq ($(findstring snapshot, $(RELEASE_TYPE)),snapshot)
  IS_SNAPSHOT ?= y
  OMIT_VERSION_BRANCH ?= y
else
  IS_SNAPSHOT ?= n
endif

# JENKINS_URL is an environment variable that is set when this
# Makefile is run under a Jenkins Pipeline. If we are in Jenkins, let's
# set CONSOLE_VERSION to "local"; else, use "latest"
ifdef JENKINS_URL
  CONSOLE_VERSION ?= local
else
  CONSOLE_VERSION ?= latest
endif

.PHONY: backend-build-release backend-test backend-push-docker
.PHONY: backend-push-version-tag backend-create-pr-next-version
.PHONY: all release

# Swagger not yet ready
# backend-swagger:
#	$(MAKE) make swagger-install"

all:
	$(error You must explicitly specify a target)

backend-build-release:
ifneq ($(IS_SNAPSHOT),y)
	sed -i -r 's/^VERSION \?= (.*)-SNAPSHOT/VERSION \?= \1/' Makefile
else
	sed -i -r 's/^VERSION \?= (.*)-SNAPSHOT/VERSION \?= \1-$(RELEASE_TYPE)/' Makefile
endif
	$(MAKE) clean build

backend-test:
	$(MAKE) test-race

backend-push-docker:
ifdef DOCKER_USER
ifdef DOCKER_PASSWORD
	@echo "Logging in to DockerHub..."
	@docker login -u "$(DOCKER_USER)" -p "$(DOCKER_PASSWORD)" docker.io
endif
endif
	DOCKER_VERSION="v$(BACKEND_VERSION)" \
	  CONSOLE_VERSION="$(CONSOLE_VERSION)" \
	  CONSOLE_LOCAL_DIR="$(CONSOLE_LOCAL_DIR)" \
	  make docker-build docker-push
	docker rmi "$(DOCKER_NAME):v$(BACKEND_VERSION)"

backend-push-version-tag:
	sed -i "s/^CONSOLE_VERSION ?=.*/CONSOLE_VERSION ?= $$(cat _output/docker/console/version.txt)/" Makefile
	git add Makefile
	git commit -m "Release $(BACKEND_VERSION)"
	git push $(BACKEND_GITHUB_URI) $$(git rev-parse HEAD):refs/tags/v$(BACKEND_VERSION)
ifndef OMIT_VERSION_BRANCH
	git push $(BACKEND_GITHUB_URI) $$(git rev-parse HEAD):refs/heads/v$(BACKEND_VERSION_BRANCH)
endif

backend-create-pr-next-version:
ifneq ($(IS_SNAPSHOT),y)
	sed -i "s/^CONSOLE_VERSION ?=.*/CONSOLE_VERSION ?= latest/" Makefile
	sed -i -r "s/^VERSION \?= (.*)/VERSION \?= v$(BACKEND_BUMPED_VERSION)-SNAPSHOT/" Makefile
	git add Makefile
	git commit -m "Prepare for next version"
	git push $(BACKEND_FORK_URI) $$(git rev-parse HEAD):refs/heads/$(BUMP_BRANCH_ID)
ifdef GH_TOKEN
	@echo "Creating PR to prepare for next version..."
	@curl -H "Authorization: token $(GH_TOKEN)" \
	  -H "Content-Type: application/json" \
	  -d '{"title": "Prepare for next version", "head": "kiali-bot:$(BUMP_BRANCH_ID)", "base": "master"}' \
	  -X POST $(BACKEND_PULL_URI)
endif
else
	@echo "Skipping creating PR, because snapshot release was done."
endif

release: backend-build-release backend-test backend-push-docker \
  backend-push-version-tag backend-create-pr-next-version
