# Perses dashboards for Kiali CI

Kiali integration tests install Perses with dashboards provisioned from
[`community-dashboards`](https://github.com/perses/community-dashboards).

The source of truth for dashboard definitions is **community-dashboards**.
This directory only contains the generated artifact used by CI:

- `dashboard.yaml` — ConfigMap with embedded Perses dashboard JSON
- `project.yaml` — Perses project `istio`
- `datasource.yaml` — Prometheus datasource for Perses
- `values.yaml` — Helm values for the Perses deployment

## When to regenerate

Update `dashboard.yaml` when community-dashboards changes Istio dashboards, for
example:

- new panels or queries
- new Istio dashboards (service, workload, ztunnel, extension, etc.)
- renamed dashboard IDs (`metadata.name`)

## Prerequisites

- Go (same version used by community-dashboards)
- Python 3
- A local clone of [community-dashboards](https://github.com/perses/community-dashboards)

## Regenerate `dashboard.yaml`

From this directory:

```bash
# If community-dashboards is a sibling of the Kiali repo:
./sync-dashboards.sh

# Or with an explicit path:
COMMUNITY_DASHBOARDS_DIR=~/dev/community-dashboards ./sync-dashboards.sh
```

Preview the output without writing the file:

```bash
./sync-dashboards.sh --dry-run > /tmp/dashboard.yaml
```

### What the script does

1. Runs `go run main.go` in community-dashboards with:
   - `--project=istio`
   - `--datasource=prometheus`
   - `--output=json`
2. Reads JSON dashboards from `<build-dir>/istio/`
3. Writes `dashboard.yaml` as a Kubernetes ConfigMap

### Dashboard ID mapping

community-dashboards `metadata.name` → ConfigMap key:

| Dashboard ID | ConfigMap key |
|---|---|
| `istio-control-plane` | `dashboard-control-plane.json` |
| `istio-mesh` | `dashboard-mesh.json` |
| `istio-performance` | `dashboard-performance.json` |
| `istio-service-dashboard` | `dashboard-service.json` |
| `istio-workload-dashboard` | `dashboard-workload.json` |
| `istio-ztunnel-dashboard` | `dashboard-ztunnel.json` |
| `istio-extension-dashboard` | `dashboard-extension.json` |

Kiali links use the **display name** (for example `Istio Mesh Dashboard`), but
Perses URLs use the **dashboard ID** (for example `istio-mesh`).

If community-dashboards adds a new Istio dashboard, update `DASHBOARD_KEYS` in
`sync-dashboards.sh`.

## Perses URL format (upstream vs OpenShift)

Kiali supports two Perses link formats, controlled by
`external_services.perses.url_format`:

| `url_format` | Link base path | Used in |
|---|---|---|
| *(empty, default)* | `/projects/{project}/dashboards/{dashboard-id}` | **CI / upstream** (`setup-kind-in-ci.sh`) |
| `openshift` | `/monitoring/v2/dashboards/view?dashboard=...` | OpenShift console proxy only |

**CI and local Kind testing must use the default (upstream) format.** Do not set
`url_format: openshift` in `setup-kind-in-ci.sh`.

Example workload link (upstream):

```text
http://localhost:4000/projects/istio/dashboards/istio-workload-dashboard?var-workload=productpage-v1&var-namespace=bookinfo&...
```

Not the OpenShift path:

```text
http://localhost:4000/monitoring/v2/dashboards/view?dashboard=istio-workload-dashboard&...
```

Kiali builds the base URL in `perses/perses.go` (`checkDashboard`). The UI adds
dashboard variables in `frontend/src/components/Metrics/PersesLinks.tsx`.
Cypress tests in `frontend-core-optional` assert the upstream `/projects/...`
path.

On OpenShift deployments, set `url_format: openshift` only when Perses is
accessed through the OpenShift monitoring console proxy.

## Apply to a running cluster

After regenerating the file:

```bash
kubectl apply -f hack/istio/perses/project.yaml
kubectl apply -f hack/istio/perses/datasource.yaml
kubectl apply -f hack/istio/perses/dashboard.yaml
```

Perses reloads provisioning every minute (`values.yaml`). To force a reload:

```bash
kubectl rollout restart deployment/perses -n istio-system
```

## Test in Kiali CI

Perses is installed when `setup-kind-in-ci.sh` is called with
`--install-perses true`.

```bash
hack/setup-kind-in-ci.sh --auth-strategy token --sail true --install-perses true
```

Cypress tests tagged `@perses` run in the `frontend-core-optional` suite:

```bash
hack/run-integration-tests.sh --test-suite frontend-core-optional
```

Port-forward Perses locally:

```bash
kubectl port-forward -n istio-system svc/perses 4000:8080
```

Then open, for example:

`http://localhost:4000/projects/istio/dashboards/istio-mesh`

## Suggested workflow

1. Change dashboards in **community-dashboards** and merge there.
2. Run `./sync-dashboards.sh` in this directory.
3. Commit the updated `dashboard.yaml` (and Cypress test changes if dashboard IDs changed).
4. Run `@perses` tests locally or in CI.
