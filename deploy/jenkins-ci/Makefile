# This Makefile is used to automate Kaili releases.
# Please, see documentation in RELEASING.adoc

RELEASE_TYPE ?= 'minor'
CONSOLE_LOCAL_DIR ?= ./frontend

BACKEND_VERSION ?= $(shell sed -rn 's/^VERSION \?= v(.*)/\1/p' Makefile)

# Take the version as-is without filtering out the 'v' (if it exists)
# This will take 'latest' as is or vX.Y.Z-type.
VERSION_TAG ?= $(shell sed -rn 's/^VERSION \?= (.*)/\1/p' Makefile)

# Determine what's the version to release, according to the RELEASE_TYPE
# NOTE: BACKEND_VERSION_TO_RELEASE variable will only be used to update the main Makefile
# with the version string to publish. Once the main Makefile is updated, all other parts
# of this ci-Makefile should use BACKEND_VERSION since, then, it will contain the right
# version string and the value of BACKEND_VERSION_TO_RELEASE will be invalid.
ifeq ($(RELEASE_TYPE),patch)
  # For patch, bump the version that is present in Makefile. This will be the
  # version string to use for the release.
  BACKEND_VERSION_TO_RELEASE ?= v$(shell semver bump $(RELEASE_TYPE) $(BACKEND_VERSION))
endif
ifeq ($(findstring $(RELEASE_TYPE),major minor),$(RELEASE_TYPE))
  # For major and minor, remove the -SNAPSHOT suffix from the Makefile
  BACKEND_VERSION_TO_RELEASE ?= v$(shell semver bump release $(BACKEND_VERSION))
endif

ifeq ($(findstring snapshot,$(RELEASE_TYPE)),snapshot)
  RELEASE_TYPE_IS_SNAPSHOT_OR_EDGE = y
else ifeq ($(RELEASE_TYPE),edge)
  RELEASE_TYPE_IS_SNAPSHOT_OR_EDGE = y
else
  RELEASE_TYPE_IS_SNAPSHOT_OR_EDGE = n
endif

ifeq ($(findstring snapshot,$(RELEASE_TYPE)),snapshot)
  # For end-of-week snapshot release, substitute the -SNAPSHOT prefix in the Makefile with
  # the value of $(RELEASE_TYPE) -- assuming value will be snapshot.{X}
  BACKEND_VERSION_TO_RELEASE ?= v$(shell semver bump prerel $(RELEASE_TYPE) $(BACKEND_VERSION))
else ifeq ($(RELEASE_TYPE),edge)
  # Use 'latest' for edge releases
  BACKEND_VERSION_TO_RELEASE ?= latest
endif

ifeq ($(RELEASE_TYPE),edge)
  # Avoid semver error, as BACKEND_VERSION will return empty string when using 'latest' as the version
  # By not setting these variable, we avoid a semver error when expanding a rule that uses $(BACKEND_BUMPED_VERSION)
else
  # NOTE: The value fo BACKEND_BUMPED_VERSION and BACKEND_VERSION_BRANCH will only be valid
  # after the main Makefile has been modified with the version being released.
  BACKEND_BUMPED_VERSION ?= $(shell semver bump minor $(BACKEND_VERSION))
  BACKEND_VERSION_BRANCH ?= $(shell semver bump release $(BACKEND_VERSION) | sed 's/\.[[:digit:]]\+$$//')
endif

BACKEND_GITHUB_URI ?= git@github.com:kiali/kiali.git
BACKEND_PULL_URI ?= https://api.github.com/repos/kiali/kiali/pulls
BACKEND_RELEASE_URI = $(subst pulls,releases,$(BACKEND_PULL_URI))
BACKEND_MAIN_BRANCH ?= master

KIALI_BOT_USER ?= kiali-bot
BACKEND_FORK_URI ?= $(shell git config --get remote.origin.url)

# BUILD_TAG is an environment variable from Jenkins
BUILD_TAG ?= prepare-next-version
BUMP_BRANCH_ID ?= $(BUILD_TAG)

QUAY_NAME ?= quay.io/kiali/kiali

ifeq ($(RELEASE_TYPE_IS_SNAPSHOT_OR_EDGE),y)
  IS_SNAPSHOT ?= y
  OMIT_VERSION_BRANCH ?= y
else
  IS_SNAPSHOT ?= n
endif

# Block edge releases on github
ifneq ($(RELEASE_TYPE),edge)
  PUSH_GITHUB_TAG = y
endif

# JENKINS_URL is an environment variable that is set when this
# Makefile is run under a Jenkins Pipeline.
ifdef JENKINS_URL

# There is the chance that the UI won't be
# released, because only the back-end suffered changes.
# If UI is not being released, use the CONSOLE_VERSION present in
# the main Makefile (or use the received one)
ifeq ($(SKIP_UI_RELEASE),y)
ifneq ($(UI_VERSION),)
  CONSOLE_VERSION = $(UI_VERSION)
else
  CONSOLE_VERSION ?= $(shell sed -rn 's/^CONSOLE_VERSION \?= (.*)/\1/p' Makefile)
endif
else
  # Let's set CONSOLE_VERSION to "local", since the UI will also be
  # built an released.
  CONSOLE_VERSION ?= local
endif # if skip_ui_release

else # if Jenkins
  # If this Makefile is not being run in Jenkins, assume that
  # the back-end and the UI are being released separately.
  # So, set CONSOLE_VERSION to "latest" (the default of the Makefile)
  # to fetch the console from NPM.
  CONSOLE_VERSION ?= latest
endif # If Jenkins

.PHONY: backend-build-release backend-test backend-push-docker
.PHONY: backend-push-version-tag backend-prepare-next-version
.PHONY: backend-prepare-next-patch-version backend-prepare-master-next-version
.PHONY: all release

all:
	$(error You must explicitly specify a target)

backend-build-release:
	@echo "Will build version: $(BACKEND_VERSION_TO_RELEASE)"
	sed -i -r 's/^VERSION \?= v.*/VERSION \?= $(BACKEND_VERSION_TO_RELEASE)/' Makefile
	$(MAKE) clean build

backend-test:
	$(MAKE) test-race

# prepare backend tags
QUAY_TAG = $(QUAY_NAME):$(VERSION_TAG)
ifneq ($(IS_SNAPSHOT),y)
   # Create or update vX.Y tags (without the patch number)
   # quay.io/kiali
   QUAY_TAG := $(QUAY_TAG) $(QUAY_NAME):v$(BACKEND_VERSION_BRANCH)
endif

backend-push-docker:
ifdef QUAY_USER
ifdef QUAY_PASSWORD
	@echo "Logging in to Quay.io..."
	@docker login -u "$(QUAY_USER)" -p "$(QUAY_PASSWORD)" quay.io
endif
endif
	QUAY_TAG="$(QUAY_TAG)" \
	  CONSOLE_VERSION="$(CONSOLE_VERSION)" \
	  CONSOLE_LOCAL_DIR="$(CONSOLE_LOCAL_DIR)" \
	  $(MAKE) -e DOCKER_CLI_EXPERIMENTAL=enabled build-linux-multi-arch container-multi-arch-push-kiali-quay

backend-push-version-tag:
ifeq ($(PUSH_GITHUB_TAG),y)
	sed -i "s/^CONSOLE_VERSION ?=.*/CONSOLE_VERSION ?= $$(cat _output/docker/console/version.txt)/" Makefile
	git add Makefile
	git commit -m "Release $(BACKEND_VERSION)"
	git push $(BACKEND_GITHUB_URI) $$(git rev-parse HEAD):refs/tags/$(VERSION_TAG)
ifdef GH_TOKEN
	@echo "Creating GitHub release..."
ifeq ($(IS_SNAPSHOT),y)
	@curl -H "Authorization: token $(GH_TOKEN)" \
	  -H "Content-Type: application/json" \
	  -d '{"name": "Kiali $(BACKEND_VERSION)", "tag_name": "$(VERSION_TAG)", "prerelease": true}' \
	  -X POST $(BACKEND_RELEASE_URI)
else
	@curl -H "Authorization: token $(GH_TOKEN)" \
	  -H "Content-Type: application/json" \
	  -d '{"name": "Kiali $(BACKEND_VERSION)", "tag_name": "$(VERSION_TAG)"}' \
	  -X POST $(BACKEND_RELEASE_URI)
endif
endif
else
	@echo "Skipped push version tag"
endif

backend-prepare-next-patch-version:
ifndef OMIT_VERSION_BRANCH
	# First, try to push directly to the vX.Y branch
	git push $(BACKEND_GITHUB_URI) $$(git rev-parse HEAD):refs/heads/v$(BACKEND_VERSION_BRANCH) || touch pr_needed.txt
	# If push to vX.Y branch fails, create a PR
	[ ! -f pr_needed.txt ] || git push $(BACKEND_FORK_URI) $$(git rev-parse HEAD):refs/heads/$(BUMP_BRANCH_ID)-patch
ifdef GH_TOKEN
	@[ ! -f pr_needed.txt ] || echo "Creating PR to prepare for next version..."
	@[ ! -f pr_needed.txt ] || curl -H "Authorization: token $(GH_TOKEN)" \
	  -H "Content-Type: application/json" \
	  -d '{"title": "Prepare for next version", "body": "I could not update v$(BACKEND_VERSION_BRANCH) branch. Please, merge.", "head": "$(KIALI_BOT_USER):$(BUMP_BRANCH_ID)-patch", "base": "v$(BACKEND_VERSION_BRANCH)"}' \
	  -X POST $(BACKEND_PULL_URI)
endif
	# Clean-up
	rm -f pr_needed.txt
else
	@echo "Creation or update of the version branch $(BACKEND_VERSION_BRANCH) is omitted."
endif

backend-prepare-master-next-version:
	# Only minor releases require to prepare the master branch for the next release
ifeq ($(RELEASE_TYPE),minor)
	sed -i "s/^CONSOLE_VERSION ?=.*/CONSOLE_VERSION ?= latest/" Makefile
	sed -i -r "s/^VERSION \?= (.*)/VERSION \?= v$(BACKEND_BUMPED_VERSION)-SNAPSHOT/" Makefile
	git add Makefile
	git commit -m "Prepare for next version"
	# First, try to push directly to master
	git push $(BACKEND_GITHUB_URI) $$(git rev-parse HEAD):refs/heads/$(BACKEND_MAIN_BRANCH) || touch pr_needed.txt
	# If push to master fails, create a PR
	[ ! -f pr_needed.txt ] || git push $(BACKEND_FORK_URI) $$(git rev-parse HEAD):refs/heads/$(BUMP_BRANCH_ID)-main
ifdef GH_TOKEN
	@[ ! -f pr_needed.txt ] || echo "Creating PR to prepare for next version..."
	@[ ! -f pr_needed.txt ] || curl -H "Authorization: token $(GH_TOKEN)" \
	  -H "Content-Type: application/json" \
	  -d '{"title": "Prepare for next version", "body": "I could not update $(BACKEND_MAIN_BRANCH) branch. Please, merge.", "head": "$(KIALI_BOT_USER):$(BUMP_BRANCH_ID)-main", "base": "$(BACKEND_MAIN_BRANCH)"}' \
	  -X POST $(BACKEND_PULL_URI)
endif
	# Clean-up
	rm -f pr_needed.txt
else
	@echo "Skipping preparing repository for next version..."
endif

backend-prepare-next-version: backend-prepare-next-patch-version backend-prepare-master-next-version

release: backend-build-release backend-test backend-push-docker \
  backend-push-version-tag backend-prepare-next-version
