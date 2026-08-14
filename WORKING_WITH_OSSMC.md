# OpenShift Service Mesh Console (OSSM Console)

The OpenShift Service Mesh Console is a Webpack plugin that extends the OpenShift Console. The official title is "OpenShift Service Mesh Console"; you may also see it abbreviated as "OSSMC", "ossmconsole", or "OSSM Console".

OSSMC is based on the OpenShift Console [dynamic plugins](https://docs.openshift.com/container-platform/latest/web_console/dynamic-plugin/dynamic-plugin-overview.html) framework. Installing the plugin adds a **Service Mesh** navigation category to the OpenShift Console. OSSMC may work with upstream Istio as well as OpenShift Service Mesh.

The main installation mechanism is the Kiali Operator.

## How it works

OSSMC provides two layers of functionality:

1. **Navigating multiple meshes** — The **Istio control planes** and **Kiali instances** pages list every Istio and Kiali CR on the cluster. They talk to the Kubernetes API directly, so they work even when no Kiali server is connected to the plugin. From **Kiali instances**, admins can **Connect** or **Disconnect** which Kiali server OSSMC uses for observability.

2. **Kiali-powered observability** — When a Kiali instance is connected and reachable, OSSMC adds Overview, Traffic Graph, Mesh, Namespaces, Applications, Services, Workloads, Istio Config, and **Service Mesh** tabs on OpenShift resource detail pages. These pages proxy through the connected Kiali server configured on the OSSMConsole CR.

When a Kiali server is connected, **Istio control planes** and **Kiali instances** appear at the bottom of the Service Mesh menu (below a separator). When no Kiali server is connected, those two pages are the Service Mesh menu.

See the official documentation for details:

- [OSSM Console integration overview](https://kiali.io/docs/integrations/ossm-console/)
- [Navigating Multiple Meshes](https://kiali.io/docs/ossmc/navigating-multiple-meshes/)
- [OSSMC User Guide](https://kiali.io/docs/ossmc/users-guide/) (Kiali-powered pages)
- [The OSSMConsole CR](https://kiali.io/docs/installation/installation-guide/creating-updating-ossmconsole-cr/)

## Platform Setup

These are the things you need before developers can start working with OSSMC:

1. OpenShift cluster with OpenShift Service Mesh or Istio installed
2. `oc` client available in the path
3. `podman` or `docker` client available in the path

A Kiali Server is optional. You need one to develop or test Kiali-powered observability pages, but not to develop or test **Istio control planes** and **Kiali instances**.

## Operator (kiali repo make targets)

OSSMC is installed by end users through the Kiali Operator. Developers working in this repo can use the make targets below. The operator source lives in the [kiali-operator](https://github.com/kiali/kiali-operator) repo; the plugin source lives in [openshift-servicemesh-plugin](https://github.com/kiali/openshift-servicemesh-plugin).

### Quick install summary

1. Run `make cluster-status` to expose the internal image registry and get the `podman` or `docker` login command.
2. Log into the internal image registry.
3. Build and push the OSSMC plugin image from your local [openshift-servicemesh-plugin](https://github.com/kiali/openshift-servicemesh-plugin) clone: `make cluster-push`.
4. Build, push, and deploy the operator, Kiali, and plugin from this repo: `make cluster-push operator-create kiali-create ossmconsole-create`.

To uninstall the operator, Kiali, and plugin: `make operator-delete`.

### OSSMConsole CR targets

| Target | Description |
|--------|-------------|
| `ossmconsole-create` | Create an OSSMConsole CR (uses `operator/deploy/ossmconsole/ossmconsole_cr_dev.yaml` by default) |
| `ossmconsole-delete` | Delete the OSSMConsole CR |
| `ossmconsole-purge` | Remove OSSMC resources directly, without going through the operator |

Environment variables for `ossmconsole-create`:

- `OSSMCONSOLE_CR_FILE` — path to the CR template (default: `operator/deploy/ossmconsole/ossmconsole_cr_dev.yaml`)
- `OSSMCONSOLE_CR_SPEC_VERSION` — `spec.version` value (default: `default`)
- `OSSMCONSOLE_CR_AUTO_DISCOVER` — `spec.kiali.autoDiscover` value (default: `true`)
- `OSSMCONSOLE_NAMESPACE` — namespace for the OSSMConsole CR (default: `ossmconsole`)

### Other useful targets

| Target | Description |
|--------|-------------|
| `run-operator-playbook-ossmconsole` | Run the operator ansible playbook locally against an OSSMConsole CR |
| `run-operator` | Run the operator locally (watches Kiali and OSSMConsole CRs) |
| `crd-create` / `crd-delete` | Install or remove the Kiali and OSSMConsole CRDs |

### Molecule tests

OSSMC operator behavior is covered by molecule tests under `kiali-operator/molecule/`. Relevant tests include `ossmconsole-config-values-test` and `ossmconsole-lite-test` (installing OSSMC without a connected Kiali server).

Run molecule tests from this repo using `hack/run-molecule-tests.sh`. See the molecule testing instructions in the repo rules or `hack/run-molecule-tests.sh --help`.

## Plugin development (openshift-servicemesh-plugin repo)

Plugin UI work happens in [openshift-servicemesh-plugin](https://github.com/kiali/openshift-servicemesh-plugin). Common make targets there:

| Target | Description |
|--------|-------------|
| `make cluster-push` | Build and push the plugin image to the cluster registry |
| `make cluster-deploy` | Build, push, and deploy without the operator |
| `make restart-plugin` | Restart the plugin pod after pushing a new image |
| `make deploy-plugin` / `make enable-plugin` | Deploy and enable the `latest` image from quay.io (quick testing) |
| `make start` | Start the webpack dev server for the plugin (run in one terminal) |
| `make start-console` | Start a local OpenShift Console for plugin development (run in a second terminal; requires `make start`) |
| `make lint` | Run eslint |
| `make typecheck` | Run TypeScript type checking |
| `make test` | Run all unit tests |

See the [plugin README](https://github.com/kiali/openshift-servicemesh-plugin/blob/main/README.md) for full development setup (Node.js, corepack, Yarn 4).
