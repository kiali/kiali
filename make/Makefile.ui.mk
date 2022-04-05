#
# Targets for working with the UI from source
#

## yarn-start: Run the UI in a local process that is separate from the backend. Set YARN_START_URL to update package.json.
yarn-start:
	@if ! (cat ${ROOTDIR}/frontend/package.json | grep -q "\"proxy\":"); then \
	  if [ -z "${YARN_START_URL}" ]; then \
	    echo "${ROOTDIR}/frontend/package.json does not have a 'proxy' setting and you did not set YARN_START_URL. Aborting."; \
	    exit 1; \
	  else \
	    sed -i "2 i \ \ \"proxy\": \"${YARN_START_URL}\"," ${ROOTDIR}/frontend/package.json; \
	  fi; \
	fi
	@echo "'yarn start' will use this proxy setting: $$(grep proxy ${ROOTDIR}/frontend/package.json)"
	@cd ${ROOTDIR}/frontend && yarn start

## cypress: Runs the cypress frontend integration tests locally.
cypress:
	@cd ${ROOTDIR}/frontend && yarn cypress
