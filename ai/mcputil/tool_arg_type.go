package mcputil

import (
	"net/http"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
)

type KialiInterface struct {
	Request       *http.Request
	BusinessLayer *business.Layer
	Prom          prometheus.ClientInterface
	ClientFactory kubernetes.ClientFactory
	KialiCache    cache.KialiCache
	Conf          *config.Config
	Graphana      *grafana.Service
	Perses        *perses.Service
	Discovery     *istio.Discovery
}
