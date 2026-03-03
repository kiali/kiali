# Deploying MCP and OpenShift LightSpeed

This document describes how to deploy the **MCP (Model Context Protocol) server** and **OpenShift LightSpeed (OLS)** so that Kiali’s AI Chat can use them. The steps are tailored for a **CRC (CodeReady Containers)** environment (local OpenShift).

## Script overview

Deployment is done by a single script that:

1. Deploys the MCP server (Kubernetes or OpenShift variant) in a dedicated namespace.
2. Creates the OpenShift LightSpeed namespace, credentials secret, operator subscription, and OLS config.
3. Waits for the LightSpeed operator to be ready, then applies the OLS config and route.

**Script path (from repository root):** `hack/install-mcp-lightspeed.sh`

The script uses `oc` and expects a valid OpenShift/CRC login and an API token for the LLM provider (e.g. Gemini) configured in the OLS config.

---

## Prerequisites

- **CRC (CodeReady Containers)** installed and a local OpenShift cluster, or any OpenShift cluster you can access with `oc`.
- **`oc`** in your `PATH`, logged in with sufficient privileges (e.g. cluster-admin on CRC).
- **API token** for the LLM provider used by OLS (e.g. Gemini). This is passed as `API_TOKEN` and stored in a secret in the `openshift-lightspeed` namespace.
- **`envsubst`** available (usually provided by `gettext`).

---

## Deploying in a CRC environment

### 1. Start CRC and log in

From the Kiali repo root:

```bash
# Start the CRC cluster (downloads CRC if needed)
./hack/crc-openshift.sh start

# Check status and get the kubeadmin password
./hack/crc-openshift.sh status
```

Log in with `oc` using the URL and kubeadmin password from the status output:

```bash
oc login -u kubeadmin -p <password-from-status> https://api.crc.testing:6443
```

### 2. Get an API token for the LLM provider

The OLS config used by the script (e.g. `hack/ai/lightspeed/osl_config.yaml`) may reference a provider that needs an API key (e.g. Gemini). Obtain that token and keep it for the next step.

### 3. Run the install script (OpenShift / CRC)

From the **repository root** (so that `hack/install-mcp-lightspeed.sh` resolves correctly):

```bash
./hack/install-mcp-lightspeed.sh MCP=openshift API_TOKEN=<your_llm_api_token>
```

- **`MCP=openshift`** – Use the OpenShift MCP server image and config; required for CRC/OpenShift.
- **`API_TOKEN=...`** – Token stored in the `openshift-lightspeed` credentials secret for the LLM provider.

Optional:

- **`MCP_IMAGE=<image>`** – Override the MCP server image (defaults are set for `kubernetes` and `openshift` inside the script).

The script will:

- Create namespace `openshift-mcp` and deploy the OpenShift MCP server (Deployment, Service, Route, ServiceAccount, RBAC).
- Create namespace `openshift-lightspeed`, create the credentials secret, install the LightSpeed operator (OperatorGroup + Subscription), wait until the operator CSV is Succeeded, then apply the OLS config and route.

### 4. Verify

- **MCP server:**  
  `oc get pods -n openshift-mcp`  
  You should see the `openshift-mcp-server` pod running.

- **LightSpeed operator:**  
  `oc get csv -n openshift-lightspeed`  
  The `lightspeed-operator` CSV should be in phase **Succeeded**.

- **OLS route:**  
  `oc get route -n openshift-lightspeed`  
  Use the OLS route host to reach the LightSpeed API (e.g. for Kiali’s AI endpoint configuration).

---

## What the script does (step by step)

| Section | Action |
|--------|--------|
| **MCP server** | Creates namespace `openshift-mcp` (or `kubernetes-mcp` if `MCP=kubernetes`). |
| | Creates ConfigMap from `hack/ai/mcp/openshift_config.toml` (or `config.toml` for Kubernetes). |
| | Deploys the MCP server Deployment (with `command` for OpenShift; no override for Kubernetes). |
| | Applies ServiceAccount and RBAC from `hack/ai/mcp/service_account.yaml`. |
| | Applies Service and exposes it via `oc expose service`. |
| **OpenShift LightSpeed** | Creates namespace `openshift-lightspeed`. |
| | Creates/updates secret `credentials` with `apitoken=$API_TOKEN`. |
| | Applies OperatorGroup and Subscription from `hack/ai/lightspeed/`. |
| | Waits until CSV `lightspeed-operator` is Succeeded (poll every 10s). |
| | Applies OLS config from `hack/ai/lightspeed/osl_config.yaml` (with `MCP` and `MCP_NAMESPACE` substituted). |
| | Applies route from `hack/ai/lightspeed/route.yaml`. |

---

## Parameters summary

| Parameter | Required | Description |
|----------|----------|-------------|
| `MCP=openshift` or `MCP=kubernetes` | Yes (for this flow use `openshift` on CRC) | Platform: selects MCP image and config (openshift vs kubernetes). |
| `API_TOKEN=<token>` | Yes | Stored in `openshift-lightspeed` secret; used by OLS as the LLM provider API key. |
| `MCP_IMAGE=<image>` | No | Override MCP server image; script defaults for `openshift` and `kubernetes` otherwise. |

All parameters are passed as `KEY=value` and can be exported as environment variables instead.

---

## Files used by the script

- **Script:** `hack/install-mcp-lightspeed.sh`
- **MCP:** `hack/ai/mcp/openshift_config.toml`, `deployment.yaml`, `service_account.yaml`, `mcp_service.yaml`
- **LightSpeed:** `hack/ai/lightspeed/operator_lightspeed_group.yaml`, `subscription_lightspeed.yaml`, `osl_config.yaml`, `route.yaml`

The script runs from the repo root and uses `SCRIPT_DIR` so that these paths resolve correctly.

---

## Troubleshooting (CRC)

- **Script fails with “API_TOKEN is required”**  
  Pass `API_TOKEN=your_token` on the command line.

- **`oc create ns` or `oc apply` permission errors**  
  Ensure you are logged in with a user that has enough rights (e.g. `kubeadmin` on CRC).

- **LightSpeed operator never reaches Succeeded**  
  Check `oc get csv -n openshift-lightspeed` and `oc get pods -n openshift-lightspeed`. Resolve any operator or operand errors shown there.

- **MCP server not reachable from OLS**  
  The OLS config points at `http://openshift-mcp-server.openshift-mcp:8080/mcp`. Ensure the MCP service and deployment are running in `openshift-mcp` and that the cluster DNS can resolve that service name from the `openshift-lightspeed` namespace.

For more on the LightSpeed provider and API contract, see [DEVELOPMENT.md](./DEVELOPMENT.md).
