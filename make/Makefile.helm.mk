#
# Targets related to the operator and server helm charts.
#
# This will attempt to find the Kiali helm-charts git repo by looking
# for a directory named "helm-charts" that is a peer directory next to
# the "operator" directory. If "operator" is a symlink, the helm-charts can be
# a peer to the physical location.
# If not found, these targets abort. In this case, pass HELM_CHARTS_REPO environment
# variable to tell these targets where your helm-charts repo is located.
#

# Sets HELM_CHARTS_REPO env var to the helm-charts git repo directory. Aborts if the git repo is not found.
.ensure-helm-charts-repo-exists:
	@$(eval HELM_CHARTS_REPO ?= $(shell \
	if [ -L "${ROOTDIR}/operator" -a -d "${ROOTDIR}/operator" ]; then \
	  REPO="$$(cd "$$(cd "${ROOTDIR}/operator" && pwd -P)/.." && pwd -P)/helm-charts"; \
	else \
	  REPO="$$(cd "${ROOTDIR}" && pwd -P)/helm-charts"; \
	fi; \
	if [ ! -d "$${REPO}" -o ! -f "$${REPO}/kiali-operator/Chart.yaml" ]; then \
	  echo "git clone git@github.com:kiali/helm-charts.git" $${REPO}; \
	  exit 1; \
	fi; \
	echo "$${REPO}" ))
	@if echo ${HELM_CHARTS_REPO} | grep -q "git clone"; then \
	  echo; echo "ERROR! You need to git clone the helm-chart repo:"; echo " ${HELM_CHARTS_REPO}"; echo; \
	  exit 1; \
	elif [ ! -d "${HELM_CHARTS_REPO}" -o ! -f "${HELM_CHARTS_REPO}/kiali-operator/Chart.yaml" ]; then \
	  echo; echo "ERROR! You specified an invalid helm-charts repo: ${HELM_CHARTS_REPO}"; echo; \
	  exit 1; \
	fi
ifeq ($(HELM_CHARTS_REPO_PULL),true)
	@echo "Pulling down latest helm-charts from remote repo to here: ${HELM_CHARTS_REPO}"; cd ${HELM_CHARTS_REPO}; git pull > /dev/null || (printf "==========\nFailed to update your local helm chart repo.\nYou can either attempt to correct the error mentioned above,\nor set 'HELM_CHARTS_REPO_PULL=false' and try again.\n==========\n"; exit 1)
else
	@echo "Using local helm-charts repo found here: ${HELM_CHARTS_REPO}"
endif

.ensure-operator-helm-chart-exists: .ensure-helm-charts-repo-exists
	@echo "Git repo for the helm charts is found here: ${HELM_CHARTS_REPO}"
	@$(MAKE) -C ${HELM_CHARTS_REPO} .build-helm-chart-operator

# Finds a suitable helm executable and sets HELM env var to point to it.
.find-helm-exe: .ensure-helm-charts-repo-exists
	@$(eval HELM ?= $(shell if (which helm 2>/dev/null 1>&2 && helm version --short 2>/dev/null | grep -q "v3.[^01]"); then echo "helm"; else echo "${HELM_CHARTS_REPO}/_output/helm-install/helm"; fi))
	@if [ "${HELM}" == "${HELM_CHARTS_REPO}/_output/helm-install/helm" -a ! -x "${HELM}" ]; then \
	  $(MAKE) -C ${HELM_CHARTS_REPO} .download-helm-if-needed; \
	fi
	@echo "Found helm executable: ${HELM}"

