#
# Targets for working with the UI from source
#

## run-frontend: Run the frontend UI in a local development server. Set KIALI_PROXY_URL to update package.json.
# The 'proxy' field will be set to the KIALI_PROXY_URL value (or empty if not provided).
# The proxy field will be automatically cleaned up when yarn start exits.
run-frontend: .ensure-yarn-version
ifdef YARN_START_URL
	@echo "ERROR: YARN_START_URL has been renamed to KIALI_PROXY_URL. Please unset YARN_START_URL and use KIALI_PROXY_URL instead." && exit 1
endif
	sed -i -e "2 i \ \ \"proxy\": \"${KIALI_PROXY_URL}\"," -e "/\"proxy\":/d" ${ROOTDIR}/frontend/package.json
	@echo "'yarn start' will use this proxy setting: $$(grep proxy ${ROOTDIR}/frontend/package.json || echo 'No proxy configured')"
	@cleanup() { \
		if [ "$$cleanup_done" != "true" ]; then \
			echo "Cleaning up: removing proxy field from package.json"; \
			sed -i -e "/\"proxy\":/d" ${ROOTDIR}/frontend/package.json; \
			cleanup_done=true; \
		fi; \
	}; \
	trap cleanup EXIT INT TERM; \
	cd ${ROOTDIR}/frontend && yarn start

## yarn-start: Alias for run-frontend
yarn-start: run-frontend

## cypress-run: Runs all the cypress frontend integration tests locally without the GUI (i.e. headless).
cypress-run: .ensure-yarn-version
	@cd ${ROOTDIR}/frontend && yarn cypress:run --headless --config numTestsKeptInMemory=0,video=false

cypress-selected: .ensure-yarn-version
	@cd ${ROOTDIR}/frontend && yarn cypress:run:selected --headless --config numTestsKeptInMemory=0,video=false

## cypress-gui: Opens the cypress GUI letting you pick which frontend integration tests to run locally.
cypress-gui: .ensure-yarn-version
	@cd ${ROOTDIR}/frontend && yarn cypress

## perf-tests-run: Runs the frontend perf tests locally without the GUI.
perf-tests-run: .ensure-yarn-version
	@cd ${ROOTDIR}/frontend && yarn cypress:run:perf --headless --config numTestsKeptInMemory=0,video=false

## perf-tests-gui: Runs the frontend perf tests locally with the GUI.
perf-tests-gui: .ensure-yarn-version
	@cd ${ROOTDIR}/frontend && yarn cypress:perf
