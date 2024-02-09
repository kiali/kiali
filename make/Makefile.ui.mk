#
# Targets for working with the UI from source
#

## yarn-start: Run the UI in a local process that is separate from the backend. Set YARN_START_URL to update package.json.
# If the YARN_START_URL env var is passed, the 'proxy' field will either be created or replaced with the YARN_START_URL.
# If the YARN_START_URL is empty but the 'proxy' field is set, the existing value will be used. Otherwise this cmd fails.
yarn-start:
	@if [ -n "${YARN_START_URL}" ]; then \
		sed -i -e "2 i \ \ \"proxy\": \"${YARN_START_URL}\"," -e "/\"proxy\":/d" ${ROOTDIR}/frontend/package.json; \
	else \
		if ! (cat ${ROOTDIR}/frontend/package.json | grep -q "\"proxy\":"); then \
			echo "${ROOTDIR}/frontend/package.json does not have a 'proxy' setting and you did not set YARN_START_URL. Aborting."; \
			exit 1; \
		fi; \
	fi
	@echo "'yarn start' will use this proxy setting: $$(grep proxy ${ROOTDIR}/frontend/package.json)"
	@cd ${ROOTDIR}/frontend && yarn start

## cypress-run: Runs all the cypress frontend integration tests locally without the GUI (i.e. headless).
cypress-run:
	@cd ${ROOTDIR}/frontend && yarn cypress:run --headless --config numTestsKeptInMemory=0,video=false

## cypress-gui: Opens the cypress GUI letting you pick which frontend integration tests to run locally.
cypress-gui:
	@cd ${ROOTDIR}/frontend && yarn cypress

## perf-tests-run: Runs the frontend perf tests locally without the GUI.
perf-tests-run:
	@cd ${ROOTDIR}/frontend && yarn cypress:run:perf --headless --config numTestsKeptInMemory=0,video=false

## perf-tests-gui: Runs the frontend perf tests locally with the GUI.
perf-tests-gui:
	@cd ${ROOTDIR}/frontend && yarn cypress:perf
