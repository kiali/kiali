# K-Charted

Dashboards and Charts library for Kubernetes, to use with `MonitoringDashboard` custom resources as [documented in Kiali](https://www.kiali.io/documentation/runtimes-monitoring/#_create_new_dashboards).

![K-Charted in Kiali](https://i.imgur.com/za2jMS2.png)
*K-Charted is used in Kiali to fetch Prometheus metrics and display them in a dashboard*

It consists in a Go library and a TypeScript / React library.
The Go code:

- Provides a service that loads dashboards from custom Kubernetes resources and fill them up with timeseries data fetched from Prometheus.
- Includes some helpers to use as an HTTP endpoint handler

The TypeScript code:

- Provides Dashboards as React components, with two available implementations: one using Patternfly 3 (ie. C3 charts), the other Patternfly 4 (ie. Victory charts).
- Of course, the data model used for these components is exactly what is returned from Go. So no extra manipulation is required.

## Usage

Full-minimal working example: https://github.com/jotak/k-charted-server

### Go

This code must run in-cluster.

Using the provided HTTP handler:

```go
import (
  "github.com/kiali/k-charted/config"
  khttp "github.com/kiali/k-charted/http"
  // ...
)

var cfg = config.Config{
  GlobalNamespace:  "default",
  PrometheusURL:    "http://prometheus",
  Errorf:           log.Errorf,
  Tracef:           log.Tracef,
}

func getDashboard(w http.ResponseWriter, r *http.Request) {
	khttp.DashboardHandler(r.URL.Query(), mux.Vars(r), w, cfg)
}

func SetRoute() {
  r := mux.NewRouter()
  r.HandleFunc("/api/namespaces/{namespace}/dashboards/{dashboard}", getDashboard)
}
```

Or alternatively, calling the dashboards service instead:

```go
import (
  dashboards "github.com/kiali/k-charted/business"
  "github.com/kiali/k-charted/config"
  "github.com/kiali/k-charted/model"
)

// ...

  cfg := config.Config{
    GlobalNamespace:  "default",
    PrometheusURL:    "http://prometheus",
    Errorf:           log.Errorf,
    Tracef:           log.Tracef,
  }

  dashboardsService := dashboards.NewDashboardsService(cfg)
  dashboard, err := dashboardsService.GetDashboard(model.DashboardQuery{Namespace: "my-namespace"}, "my-dashboard-name")
```

#### Config

- **GlobalNamespace**: namespace that holds default dashboards. When a dashboard is looked for in a given namespace, when not found and if GlobalNamespace is defined, it will be searched then in that GlobalNamespace. Undefined by default.

- **PrometheusURL**: URL where the Prometheus server can be reached.

- **Errorf**: optional handler to an error logging function.

- **Tracef**: optional handler to a tracing logging function.

- **PodsLoader**: optional pods supplier function, it enables reading dashboard names from pods annotations.

### React (Javascript / TypeScript)

You can use the react components from `k-charted-react`. Example with `axios`:

```javascript
  axios.get(`/namespaces/${this.state.namespace}/dashboards/${this.state.dashboardName}`).then(rs => {
    this.setState({ dashboard: rs.data });
  });

  render() {
    if (this.state.dashboard) {
      return (<PF3Dashboard dashboard={this.state.dashboard} />)
    }
    return (<>Empty</>);
  }
```

Check out [`MetricsOption.ts`](https://github.com/kiali/k-charted/blob/master/web/react/src/types/MetricsOptions.ts) file to see how the dashboard can be tuned (filtering by labels, aggregations, etc.)

## First build

Go vendors are commited so you don't need to pull them first (unless you want to update them, in which case you can run `make godep`).

For a first run, init the JS dependencies:

```bash
make reactdep
```

Install [*golangci-lint*](https://github.com/golangci/golangci-lint), example with v1.16.0:

```bash
curl -sfL https://install.goreleaser.com/github.com/golangci/golangci-lint.sh | sh -s -- -b $(go env GOPATH)/bin v1.16.0
```

## Build

To build/lint/test everything:

```bash
make build lint test
```

You can also build/lint/test only the Go code, or only the React code:

```bash
make gobuild golint gotest
make reactbuild reactlint reacttest
```

## Development setup (e.g. with Kiali)

One solution to easily work and test with Kiali is to setup Glide mirroring, and npm linking.

Supposing your Kiali sources are in `/go/src/github.com/kiali/kiali`, and k-charted in `/go/src/github.com/kiali/k-charted`:

```bash
cd /go/src/github.com/kiali/kiali
glide mirror set https://github.com/kiali/k-charted file:///go/src/github.com/kiali/k-charted

# Then, update your dependencies. In Kiali:
make dep-update
```

!! Do not commit the vendor directory of Kiali with mirror setup !!

Similarly, you can use `yarn link` for the web UI side. Assuming your kiali-ui is in `/work/kiali-ui`:

```bash
cd /go/src/github.com/kiali/k-charted/web/react
yarn link

cd /work/kiali-ui
yarn link k-charted-react
```

After testing, you should remove the mirror and link:

```bash
cd /go/src/github.com/kiali/kiali
glide mirror remove https://github.com/kiali/k-charted

cd /work/kiali-ui
yarn unlink k-charted-react
```

## Contribute

You're welcome!

If you want to chat, come to the #kiali channel on IRC/Freenode.
