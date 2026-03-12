## check-mcp-query-file: Check if the mcp query file exists
HACK_DIR ?= hack/ai
MCP_TOKENS_FILE ?= $(ROOTDIR)/ai/mcp/tokens.json
MCP_QUERY_FILE ?= $(ROOTDIR)/ai/mcp/token_query.json
MCP_README_FILE ?= $(ROOTDIR)/ai/mcp/README.md

check-mcp-query:
	@if [ ! -f ${ROOTDIR}/ai/mcp/token_query.json ]; then \
		echo "The token query file does not exist in ai/mcp/token_query.json"; \
		exit 1; \
	fi

check-mcp-tokens:
	@if [ ! -f ${MCP_TOKENS_FILE} ]; then \
		echo "The tokens file does not exist in ai/mcp/tokens.json"; \
		exit 1; \
	fi

require-python:
	@if [ ! -x ${PYTHON} ]; then \
		echo "Python is not installed. Please install Python and re-run this command."; \
		exit 1; \
	fi

LIBS ?= tiktoken requests

install-libs: require-python
	@echo "Installing required Python libraries..."
	@python -m pip install $(LIBS)

## count-mcp-tokens: Count the tokens in the mcp query file
count-mcp-tokens: check-mcp-query install-libs
	@python $(HACK_DIR)/tokenaizer.py $(MCP_QUERY_FILE) $(MCP_TOKENS_FILE)

## render-mcp-readme: Render the tokens JSON to the MCP README
render-mcp-readme: check-mcp-tokens
	@python $(HACK_DIR)/render_mcp_readme.py $(MCP_TOKENS_FILE) $(MCP_README_FILE)

compare-mcp-tokens: check-mcp-query install-libs
	@mkdir -p _output
	@python $(HACK_DIR)/tokenaizer.py $(MCP_QUERY_FILE) _output/tokens_pr.json
	@python $(HACK_DIR)/compare_mcp_tokens.py $(MCP_TOKENS_FILE) _output/tokens_pr.json > _output/mcp_tokens_diff.md
	@cat _output/mcp_tokens_diff.md