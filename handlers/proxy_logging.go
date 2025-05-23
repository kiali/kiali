package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
)

func LoggingUpdate(
	conf *config.Config,
	kialiCache cache.KialiCache,
	clientFactory kubernetes.ClientFactory,
	cpm business.ControlPlaneMonitor,
	prom prometheus.ClientInterface,
	traceClientLoader func() tracing.ClientInterface,
	grafana *grafana.Service,
	discovery istio.MeshDiscovery,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		params := mux.Vars(r)

		if conf.Deployment.ViewOnlyMode {
			RespondWithError(w, http.StatusForbidden, "Log level cannot be changed in view-only mode")
			return
		}

		businessLayer, err := getLayer(r, conf, kialiCache, clientFactory, cpm, prom, traceClientLoader, grafana, discovery)
		if err != nil {
			RespondWithError(w, http.StatusInternalServerError, "Apps initialization error: "+err.Error())
			return
		}

		namespace := params["namespace"]
		pod := params["pod"]
		query := r.URL.Query()
		level := query.Get("level")
		switch {
		case level == "":
			RespondWithError(w, 400, "level query param is not set")
			return
		case !business.IsValidProxyLogLevel(level):
			msg := fmt.Sprintf("%s is an invalid log level. Valid log levels are: %s", level, strings.Join(business.ValidProxyLogLevels, ", "))
			RespondWithError(w, 400, msg)
			return
		}

		cluster := clusterNameFromQuery(conf, query)

		if err := businessLayer.ProxyLogging.SetLogLevel(cluster, namespace, pod, level); err != nil {
			handleErrorResponse(w, err)
			return
		}
		audit(r, "UPDATE", namespace, "n/a", "Envoy Log Level. Cluster: ["+cluster+"], Pod: ["+pod+"], Log Level: ["+level+"]")
		RespondWithCode(w, 200)
	}
}
