#
# Targets for MCP evaluation and tooling.
#

MCP_SERVER_PORT ?= 8080
MCP_SERVER_CONFIG ?= /tmp/mcp-server-config.toml
MCP_EVAL_CONFIG ?= tests/evals/gemini/eval.yaml
MCP_EVAL_RESULTS ?= mcpchecker-gemini-eval-out.json
MCP_TOKEN_RESULTS ?= ai/mcp/TOKEN_RESULTS.json
KIALI_URL ?= $(shell kubectl get svc kiali -n istio-system -o=jsonpath='http://{.status.loadBalancer.ingress[0].ip}/kiali' 2>/dev/null)

## mcp-install-mcpchecker: Download and install the latest mcpchecker binary
mcp-install-mcpchecker:
	@echo "Installing mcpchecker..."
	@MCPCHECKER_URL=$$(curl -sL https://api.github.com/repos/mcpchecker/mcpchecker/releases/latest \
		| jq -r '.assets[] | select(.name == "mcpchecker-linux-amd64.zip") | .browser_download_url'); \
	echo "Downloading mcpchecker from: $${MCPCHECKER_URL}"; \
	curl -sL "$${MCPCHECKER_URL}" -o /tmp/mcpchecker.zip; \
	unzip -o /tmp/mcpchecker.zip -d /tmp/mcpchecker; \
	chmod +x /tmp/mcpchecker/mcpchecker; \
	sudo mv /tmp/mcpchecker/mcpchecker /usr/local/bin/; \
	rm -rf /tmp/mcpchecker.zip /tmp/mcpchecker; \
	echo "mcpchecker installed: $$(mcpchecker --version 2>/dev/null || echo 'ok')"

## mcp-install-server: Download and install the latest kubernetes-mcp-server binary
mcp-install-server:
	@echo "Installing kubernetes-mcp-server..."
	@RELEASE_URL=$$(curl -sL https://api.github.com/repos/containers/kubernetes-mcp-server/releases/latest \
		| jq -r '.assets[] | select(.name | test("linux.*amd64")) | .browser_download_url'); \
	echo "Downloading kubernetes-mcp-server from: $${RELEASE_URL}"; \
	curl -sL "$${RELEASE_URL}" -o /usr/local/bin/kubernetes-mcp-server; \
	chmod +x /usr/local/bin/kubernetes-mcp-server; \
	echo "kubernetes-mcp-server installed"

## mcp-install-gemini-cli: Install the Gemini CLI via npm
mcp-install-gemini-cli:
	@echo "Installing Gemini CLI..."
	npm install -g @google/gemini-cli@latest

## mcp-install-tools: Install all MCP evaluation dependencies
mcp-install-tools: mcp-install-mcpchecker mcp-install-server mcp-install-gemini-cli

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
	@kubernetes-mcp-server --config ${MCP_SERVER_CONFIG} & \
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
	mcpchecker check ${MCP_EVAL_CONFIG} ${MCP_EVAL_ARGS}

## mcp-eval-summary: Show a pretty summary of the evaluation results
mcp-eval-summary:
	@if [ ! -f ${MCP_EVAL_RESULTS} ]; then \
		echo "No results file found at ${MCP_EVAL_RESULTS}. Run 'make mcp-run-eval' first."; \
		exit 1; \
	fi
	@mcpchecker summary ${MCP_EVAL_RESULTS} --github-output

## mcp-eval-save-tokens: Generate and save the token results JSON baseline
mcp-eval-save-tokens:
	@if [ ! -f ${MCP_EVAL_RESULTS} ]; then \
		echo "No results file found at ${MCP_EVAL_RESULTS}. Run 'make mcp-run-eval' first."; \
		exit 1; \
	fi
	@echo "Saving token results to ${MCP_TOKEN_RESULTS}..."
	@mcpchecker summary ${MCP_EVAL_RESULTS} --output json > ${MCP_TOKEN_RESULTS}
	@echo "Token baseline saved:"
	@cat ${MCP_TOKEN_RESULTS}

## mcp-update-token-readme: Update the token consumption section in ai/mcp/README.md from TOKEN_RESULTS.json
mcp-update-token-readme:
	@${ROOTDIR}/hack/mcp/update-token-readme.sh
