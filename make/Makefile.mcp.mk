#
# Targets for MCP evaluation and tooling.
#

MCP_SERVER_PORT ?= 8080
MCP_SERVER_CONFIG ?= /tmp/mcp-server-config.toml
MCP_EVAL_CONFIG ?= tests/evals/gemini/eval.yaml
MCP_EVAL_RESULTS ?= tests/evals/results/mcpchecker-gemini-eval-out.json
KIALI_URL ?= $(shell kubectl get svc kiali -n istio-system -o=jsonpath='http://{.status.loadBalancer.ingress[0].ip}/kiali' 2>/dev/null)
KUBERNETES_MCP_SERVER_REPO ?=

## mcp-install-mcpchecker: Download and install the latest mcpchecker binary
mcp-install-mcpchecker:
	@echo "Installing mcpchecker..."
	@mkdir -p "${GOPATH}/bin"
	@MCPCHECKER_URL=$$(curl -sL https://api.github.com/repos/mcpchecker/mcpchecker/releases/latest \
		| jq -r '.assets[] | select(.name == "mcpchecker-linux-amd64.zip") | .browser_download_url'); \
	echo "Downloading mcpchecker from: $${MCPCHECKER_URL}"; \
	curl -sL "$${MCPCHECKER_URL}" -o /tmp/mcpchecker.zip; \
	unzip -o /tmp/mcpchecker.zip -d /tmp/mcpchecker; \
	chmod +x /tmp/mcpchecker/mcpchecker; \
	mv /tmp/mcpchecker/mcpchecker "${GOPATH}/bin/"; \
	rm -rf /tmp/mcpchecker.zip /tmp/mcpchecker; \
	echo "mcpchecker installed to ${GOPATH}/bin/"

## mcp-install-kubernetes-mcp-server: Install kubernetes-mcp-server from release or repo#branch
mcp-install-kubernetes-mcp-server:
	@echo "Installing kubernetes-mcp-server..."
	@mkdir -p "${GOPATH}/bin"
	@if [ -z "${KUBERNETES_MCP_SERVER_REPO}" ]; then \
		RELEASE_URL=$$(curl -sL https://api.github.com/repos/containers/kubernetes-mcp-server/releases/latest \
			| jq -r '.assets[] | select(.name | test("linux.*amd64")) | .browser_download_url'); \
		echo "Downloading kubernetes-mcp-server from: $${RELEASE_URL}"; \
		curl -sL "$${RELEASE_URL}" -o "${GOPATH}/bin/kubernetes-mcp-server"; \
		chmod +x "${GOPATH}/bin/kubernetes-mcp-server"; \
		echo "kubernetes-mcp-server installed to ${GOPATH}/bin/"; \
	else \
		REPO_AND_BRANCH="${KUBERNETES_MCP_SERVER_REPO}"; \
		REPO="$${REPO_AND_BRANCH%%#*}"; \
		BRANCH="$${REPO_AND_BRANCH#*#}"; \
		if [ "$${REPO}" = "$${REPO_AND_BRANCH}" ] || [ -z "$${REPO}" ] || [ -z "$${BRANCH}" ]; then \
			echo "ERROR: KUBERNETES_MCP_SERVER_REPO must use format owner/repo#branch (example: aljesusg/kubernetes-mcp-server#kiali_refactor_reduction)"; \
			exit 1; \
		fi; \
		WORKDIR=$$(mktemp -d /tmp/kubernetes-mcp-server-build.XXXXXX); \
		echo "Building kubernetes-mcp-server from $${REPO} (branch: $${BRANCH})"; \
		git clone "https://github.com/$${REPO}.git" "$${WORKDIR}"; \
		cd "$${WORKDIR}"; \
		git checkout "$${BRANCH}"; \
		make build; \
		if [ ! -f "$${WORKDIR}/kubernetes-mcp-server" ]; then \
			echo "ERROR: build finished but binary '$${WORKDIR}/kubernetes-mcp-server' was not found"; \
			exit 1; \
		fi; \
		mv -f "$${WORKDIR}/kubernetes-mcp-server" "${GOPATH}/bin/kubernetes-mcp-server"; \
		chmod +x "${GOPATH}/bin/kubernetes-mcp-server"; \
		rm -rf "$${WORKDIR}"; \
		echo "kubernetes-mcp-server installed to ${GOPATH}/bin/ from source"; \
	fi

## mcp-install-gemini-cli: Install the Gemini CLI via npm
mcp-install-gemini-cli:
	@echo "Installing Gemini CLI..."
	npm install -g @google/gemini-cli@latest

## mcp-install-tools: Install all MCP evaluation dependencies
mcp-install-tools: mcp-install-mcpchecker mcp-install-kubernetes-mcp-server mcp-install-gemini-cli

## mcp-resolve-kiali-url: Resolve the Kiali URL from the cluster ingress
mcp-resolve-kiali-url:
	@kubectl wait --for=jsonpath='{.status.loadBalancer.ingress}' -n istio-system service/kiali --timeout=120s
	@$(eval KIALI_URL := $(shell kubectl get svc kiali -n istio-system -o=jsonpath='http://{.status.loadBalancer.ingress[0].ip}/kiali'))
	@echo "Resolved Kiali URL: ${KIALI_URL}"

## mcp-start-server: Start the kubernetes-mcp-server in the background
mcp-start-server: mcp-resolve-kiali-url
	@echo "Starting kubernetes-mcp-server on port ${MCP_SERVER_PORT}..."
	@cat > ${MCP_SERVER_CONFIG} <<< $$'toolsets = ["kiali"]\nlog_level = 0\nport = "${MCP_SERVER_PORT}"\n[toolset_configs.kiali]\nurl = "${KIALI_URL}"\ninsecure = true'
	@echo "MCP server config:"; cat ${MCP_SERVER_CONFIG}
	@${GOPATH}/bin/kubernetes-mcp-server --config ${MCP_SERVER_CONFIG} & \
	MCP_PID=$$!; \
	echo "$$MCP_PID" > /tmp/mcp-server.pid; \
	echo "Waiting for kubernetes-mcp-server (pid $$MCP_PID) to be ready..."; \
	for i in $$(seq 1 30); do \
		if curl -s http://localhost:${MCP_SERVER_PORT}/mcp >/dev/null 2>&1; then \
			echo "kubernetes-mcp-server is ready"; \
			break; \
		fi; \
		sleep 2; \
	done

## mcp-stop-server: Stop the kubernetes-mcp-server background process
mcp-stop-server:
	@if [ -f /tmp/mcp-server.pid ]; then \
		MCP_PID=$$(cat /tmp/mcp-server.pid); \
		echo "Stopping kubernetes-mcp-server (pid $$MCP_PID)..."; \
		kill "$$MCP_PID" 2>/dev/null || true; \
		rm -f /tmp/mcp-server.pid; \
	else \
		echo "No MCP server PID file found"; \
	fi

## mcp-run-eval: Run the mcpchecker evaluation
mcp-run-eval:
	@echo "Running mcpchecker evaluation..."
	${GOPATH}/bin/mcpchecker check ${MCP_EVAL_CONFIG} ${MCP_EVAL_ARGS}
	@if [ -f mcpchecker-gemini-eval-out.json ]; then \
		mkdir -p $(dir ${MCP_EVAL_RESULTS}); \
		mv -f mcpchecker-gemini-eval-out.json ${MCP_EVAL_RESULTS}; \
	fi

## mcp-eval-summary: Text summary of the evaluation (for logs and GITHUB_STEP_SUMMARY)
mcp-eval-summary:
	@if [ ! -f ${MCP_EVAL_RESULTS} ]; then \
		echo "No results file found at ${MCP_EVAL_RESULTS}. Run 'make mcp-run-eval' first."; \
		exit 1; \
	fi
	@${GOPATH}/bin/mcpchecker result summary ${MCP_EVAL_RESULTS} --output text

## mcp-eval-summary-json: Print summary JSON to stdout (same as: mcpchecker summary <eval.json> -o json)
mcp-eval-summary-json:
	@if [ ! -f ${MCP_EVAL_RESULTS} ]; then \
		echo "No results file found at ${MCP_EVAL_RESULTS}. Run 'make mcp-run-eval' first."; \
		exit 1; \
	fi
	@${GOPATH}/bin/mcpchecker summary ${MCP_EVAL_RESULTS} --output json

## mcp-eval-diff: Compare two check outputs in markdown. Usage: make mcp-eval-diff MCP_DIFF_BASE=main.json MCP_DIFF_CURRENT=pr.json
mcp-eval-diff:
	@test -n "$${MCP_DIFF_BASE}" && test -n "$${MCP_DIFF_CURRENT}" || (echo "Usage: make mcp-eval-diff MCP_DIFF_BASE=<path> MCP_DIFF_CURRENT=<path>" >&2; exit 1)
	@${GOPATH}/bin/mcpchecker diff --base "$${MCP_DIFF_BASE}" --current "$${MCP_DIFF_CURRENT}" --output markdown

## mcp-clean-eval-results: Remove local mcpchecker evaluation outputs
mcp-clean-eval-results:
	@rm -rf mcpchecker-results
	@rm -f mcpchecker-gemini-eval-out.json
	@rm -f tests/evals/results/mcpchecker-gemini-eval-out.json

## mcp-update-token-readme: Update the token consumption section in ai/mcp/README.md from mcpchecker summary of MCP_EVAL_RESULTS
mcp-update-token-readme:
	@${ROOTDIR}/hack/mcp/update-token-readme.sh
