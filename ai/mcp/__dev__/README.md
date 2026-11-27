# Kiali MCP Inspector (dev)

**Dev-only.** Thin MCP stdio server that loads tool YAMLs from `../tools` and proxies every `tools/call` to a **running Kiali** via:

```http
POST {KIALI_URL}/api/chat/mcp/{tool_name}
```

This lets you use [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) against **this repo’s** tools without [kubernetes-mcp-server](https://github.com/containers/kubernetes-mcp-server).

```text
MCP Inspector  --stdio-->  go run . (this package)
                              |
                              |  Authorization: Bearer <token>
                              |  POST /api/chat/mcp/{tool}
                              v
                           Running Kiali
```

Not shipped in production images. Not a substitute for unit/integration tests under `ai/mcp/` and `tests/integration/mcp_tools/`.

---

## Prerequisites

1. **Kiali running** and reachable (local binary, Kind, CRC, or port-forward).
2. **Go** (same major as the main Kiali module is fine) and **Node.js / npx** (Inspector needs a current Node; 22+ recommended).
3. Auth to call Kiali APIs:
   - Default: OpenShift token from `oc whoami -t` (script does this for you).
   - Or export `KIALI_TOKEN` / `KIALI_COOKIE` yourself (anonymous clusters may omit both).

Example port-forward if Kiali is in-cluster:

```bash
kubectl -n istio-system port-forward svc/kiali 20001:20001
# or: oc -n istio-system port-forward svc/kiali 20001:20001
```

---

## Quick start

From this directory:

```bash
./run.sh
```

What `run.sh` does:

| Step | Behavior |
|------|----------|
| `KIALI_URL` | Defaults to `http://localhost:20001` if unset |
| `KIALI_TOKEN` | If unset, runs `oc whoami -t` |
| Deps | `go mod tidy`, then `npx @modelcontextprotocol/inspector go run .` |

Overrides (env always wins):

```bash
KIALI_URL=http://localhost:20001/kiali \
KIALI_TOKEN="$(oc whoami -t)" \
./run.sh
```

Inspector opens in the browser. Use **Tools** → list / call. Schema comes from `ai/mcp/tools/*.yaml`; execution hits your live Kiali.

### CLI smoke (no browser)

```bash
./run.sh --cli --method tools/list
./run.sh --cli --method tools/call --tool-name list_clusters --tool-arg '{}'
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KIALI_URL` | `http://localhost:20001` | Kiali base URL **including web root** if any (e.g. `.../kiali`). Trailing slash stripped. API path is `{KIALI_URL}/api/chat/mcp/{tool}`. |
| `KIALI_TOKEN` | from `oc whoami -t` via `run.sh` | Bearer token (`Authorization: Bearer …`). |
| `KIALI_COOKIE` | unset | Optional raw `Cookie` header (session cookie auth). |
| `KIALI_INSECURE` | `false` | Set `true` / `1` to skip TLS verify (self-signed routes). |
| `KIALI_UI` | unset | Set `true` / `1` to send `Kiali-UI` header → chatbot `default` tool handlers. |
| `KIALI_MCP_TOOLSET` | `mcp` | Which YAML `toolset` to expose: `mcp`, `default`, or `all`. |
| `KIALI_MCP_TOOLS_DIR` | `../tools` | Override path to YAML definitions. |
| `KIALI_TIMEOUT` | `90s` | HTTP client timeout (`time.ParseDuration` syntax). |

---

## Auth notes

- **OpenShift / token strategy:** `./run.sh` (or `KIALI_TOKEN="$(oc whoami -t)"`) is the usual path.
- **Anonymous:** `run.sh` always resolves a token via `oc whoami -t` when `KIALI_TOKEN` is unset. For anonymous Kiali, skip the script and run `KIALI_URL=http://localhost:20001 go run .` (no token), then point Inspector at that process or use `npx @modelcontextprotocol/inspector go run .`.
- **Cookie session:** log in via the UI, copy the session cookie, export `KIALI_COOKIE='kiali-token-…=…'` (name depends on strategy/cluster).

To run the shim alone (Inspector or another MCP client attaching separately):

```bash
export KIALI_URL=http://localhost:20001
export KIALI_TOKEN="$(oc whoami -t)"
go run .
```

---

## Toolset filter

YAML tools declare `toolset: [default, mcp]` (or one of them).

- Default Inspector view (`KIALI_MCP_TOOLSET=mcp`): tools intended for the full MCP surface.
- Chatbot-only experiments: `KIALI_MCP_TOOLSET=default` and optionally `KIALI_UI=true`.
- Everything: `KIALI_MCP_TOOLSET=all`.

---

## Workflow for tool authors

1. Edit or add `ai/mcp/tools/<name>.yaml` and the Go `Execute` under `ai/mcp/<name>/`.
2. Rebuild/restart **Kiali** so handler changes are live (YAML list is re-read when this shim starts; handler code lives in the Kiali process).
3. Restart Inspector / `./run.sh` if you changed YAML schemas or toolset membership.
4. Call the tool in Inspector and confirm the HTTP response from Kiali.
5. Add/update unit + `tests/integration/mcp_tools/<name>_test.go` before merging.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `KIALI_URL is required` | Export `KIALI_URL` or use `./run.sh` |
| `oc whoami -t` failed | `oc login …`, or set `KIALI_TOKEN` yourself |
| HTTP 401 / 403 | Token expired, wrong user, or web root mismatch (`/kiali` vs `/`) |
| HTTP 404 tool | Tool not in selected toolset; Prometheus/tracing/ambient gate; or Kiali build without that tool |
| Connection refused | Port-forward / local Kiali not listening on 20001 |
| Empty tool list | Wrong `KIALI_MCP_TOOLS_DIR` or filter; run from `ai/mcp/__dev__` |

Logs from the shim go to **stderr** (stdout is MCP stdio).

---

## Layout

```text
ai/mcp/__dev__/
  README.md     # this file
  run.sh        # defaults + Inspector launcher
  main.go       # MCP stdio ↔ Kiali HTTP proxy
  go.mod        # separate module (mcp-go); not linked into Kiali server
```
