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
  kconf "github.com/kiali/k-charted/config"
	kxconf "github.com/kiali/k-charted/config/extconfig"
	klog "github.com/kiali/k-charted/log"
  khttp "github.com/kiali/k-charted/http"
  // ...
)

var cfg = kconf.Config{
  GlobalNamespace:  "default",
  Prometheus: kxconf.PrometheusConfig{
    URL: "http://prometheus",
  },
}
var logger = klog.LogAdapter{
  Errorf: log.Errorf,
  Tracef: log.Tracef,
}

func getDashboard(w http.ResponseWriter, r *http.Request) {
	khttp.DashboardHandler(r.URL.Query(), mux.Vars(r), w, cfg, logger)
}

func SetRoute() {
  r := mux.NewRouter()
  r.HandleFunc("/api/namespaces/{namespace}/dashboards/{dashboard}", getDashboard)
}
```

Or alternatively, calling the dashboards service instead:

```go
import (
	kbus "github.com/kiali/k-charted/business"
	kconf "github.com/kiali/k-charted/config"
	kxconf "github.com/kiali/k-charted/config/extconfig"
	klog "github.com/kiali/k-charted/log"
)

var cfg = kconf.Config{
  GlobalNamespace:  "default",
  Prometheus: kxconf.PrometheusConfig{
    URL: "http://prometheus",
  },
}
var logger = klog.LogAdapter{
  Errorf: log.Errorf,
  Tracef: log.Tracef,
}

// ...

  dashboardsService := kbus.NewDashboardsService(cfg, logger)
  dashboard, err := dashboardsService.GetDashboard(model.DashboardQuery{Namespace: "my-namespace"}, "my-dashboard-name")
```

#### Config

- **GlobalNamespace**: namespace that holds default dashboards. When a dashboard is looked for in a given namespace, when not found and if GlobalNamespace is defined, it will be searched then in that GlobalNamespace. Undefined by default.

- **Prometheus**: Prometheus configuration.
  - **URL**: URL of the Prometheus server, accessible from server-side.
  - **Auth**: Authentication options, if any (see https://github.com/kiali/k-charted/blob/master/config/extconfig/extconfig.go).

- **Grafana**: Grafana configuration. This is optional, only needed if external links to Grafana dashboards have been defined within the MonitoringDashboards custom resources in use.
  - **URL**: URL of the Grafana server, accessible from client-side / browser.
  - **InClusterURL**: URL of the Grafana server, accessible from server-side.
  - **Auth**: Authentication options, if any (see https://github.com/kiali/k-charted/blob/master/config/extconfig/extconfig.go).

- **PodsLoader**: optional pods supplier function, it enables reading dashboard names from pods annotations.

#### LogAdapter

It binds any logging function to be used in K-Charted. It can be omitted, in which case nothing will be logged.

- **Errorf**
- **Warningf**
- **Infof**
- **Tracef**

### React (Javascript / TypeScript)

You can use the one of the PatternFly implementations by importing `@kiali/k-charted-pf3` or `@kiali/k-charted-pf4`. Example with `axios`:

```javascript
  axios.get(`/namespaces/${this.state.namespace}/dashboards/${this.state.dashboardName}`).then(rs => {
    this.setState({ dashboard: rs.data });
  });

  render() {
    if (this.state.dashboard) {
      return (<Dashboard dashboard={this.state.dashboard} />)
    }
    return (<>Empty</>);
  }
```

Check out [`MetricsOption.ts`](https://github.com/kiali/k-charted/blob/master/web/common/types/MetricsOptions.ts) file to see how the dashboard can be tuned (filtering by labels, aggregations, etc.)

## First build preparation

Go vendors are commited so you don't need to pull them first (unless you want to update them, in which case you can run `make godep`).

Install [*golangci-lint*](https://github.com/golangci/golangci-lint), example with v1.16.0:

```bash
curl -sfL https://install.goreleaser.com/github.com/golangci/golangci-lint.sh | sh -s -- -b $(go env GOPATH)/bin v1.16.0
```

## Build

To build/lint/test the backend, run:

```bash
make go
```

For the frontend, run:

```bash
make pf3

# and/or

make pf4
```

## Development setup (e.g. with Kiali)

One solution to easily work and test with Kiali is to setup Glide mirroring, and npm linking.

First, commit your changes in k-charted and update `glide.yaml` in Kiali with the commit SHA.
Then, assuming the repos are located within your $GOPATH, run:

```bash
cd ${GOPATH}/src/github.com/kiali/kiali
glide mirror set https://github.com/kiali/k-charted file://${GOPATH}/src/github.com/kiali/k-charted

# Edit Kiali glide.yaml to point k-charted to your commit SHA
# Then, update your dependencies. In Kiali:
make dep-update
```

!! Do not commit the vendor directory of Kiali with mirror setup !!

Similarly, you can use `yarn link` for the web UI side. Assuming your kiali-ui is in `/work/kiali-ui`:

```bash
cd ${GOPATH}/src/github.com/kiali/k-charted/web/pf4
yarn link

cd /work/kiali-ui
yarn link @kiali/k-charted-pf4
```

After testing, you should remove the mirror and link:

```bash
cd ${GOPATH}/src/github.com/kiali/kiali
glide mirror remove https://github.com/kiali/k-charted

cd /work/kiali-ui
yarn unlink @kiali/k-charted-pf4
```

## Contribute

You're welcome!

If you want to chat, come to the #kiali channel on IRC/Freenode.
