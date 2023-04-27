package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/util"
)

const defaultHealthRateInterval = "10m"

// NamespaceHealth is the API handler to get app-based health of every services in the given namespace
func NamespaceHealth(w http.ResponseWriter, r *http.Request) {
	// Get business layer
	businessLayer, err := getBusiness(r)
	if err != nil {
		RespondWithError(w, http.StatusInternalServerError, "Services initialization error: "+err.Error())
		return
	}

	p := namespaceHealthParams{}
	if ok, err := p.extract(r); !ok {
		// Bad request
		RespondWithError(w, http.StatusBadRequest, err)
		return
	}

	// Adjust rate interval
	rateInterval, err := adjustRateInterval(r.Context(), businessLayer, p.Namespace, p.RateInterval, p.QueryTime)
	if err != nil {
		handleErrorResponse(w, err, "Adjust rate interval error: "+err.Error())
		return
	}

	healthCriteria := business.NamespaceHealthCriteria{Namespace: p.Namespace, Cluster: p.Cluster, RateInterval: rateInterval, QueryTime: p.QueryTime, IncludeMetrics: true}
	switch p.Type {
	case "app":
		health, err := businessLayer.Health.GetNamespaceAppHealth(r.Context(), healthCriteria)
		if err != nil {
			handleErrorResponse(w, err, "Error while fetching app health: "+err.Error())
			return
		}
		RespondWithJSON(w, http.StatusOK, health)
	case "service":
		health, err := businessLayer.Health.GetNamespaceServiceHealth(r.Context(), healthCriteria)
		if err != nil {
			handleErrorResponse(w, err, "Error while fetching service health: "+err.Error())
			return
		}
		RespondWithJSON(w, http.StatusOK, health)
	case "workload":
		health, err := businessLayer.Health.GetNamespaceWorkloadHealth(r.Context(), healthCriteria)
		if err != nil {
			handleErrorResponse(w, err, "Error while fetching workload health: "+err.Error())
			return
		}
		RespondWithJSON(w, http.StatusOK, health)
	}
}

type baseHealthParams struct {
	// Cluster name
	Cluster string `json:"cluster"`
	// The namespace scope
	//
	// in: path
	Namespace string `json:"namespace"`
	// The rate interval used for fetching error rate
	//
	// in: query
	// default: 10m
	RateInterval string `json:"rateInterval"`
	// The time to use for the prometheus query
	QueryTime time.Time
}

func (p *baseHealthParams) baseExtract(r *http.Request, vars map[string]string) {
	queryParams := r.URL.Query()
	p.RateInterval = defaultHealthRateInterval
	p.QueryTime = util.Clock.Now()
	if rateInterval := queryParams.Get("rateInterval"); rateInterval != "" {
		p.RateInterval = rateInterval
	}
	p.Cluster = clusterNameFromQuery(queryParams)
	if queryTime := queryParams.Get("queryTime"); queryTime != "" {
		unix, err := strconv.ParseInt(queryTime, 10, 64)
		if err == nil {
			p.QueryTime = time.Unix(unix, 0)
		}
	}
	p.Namespace = vars["namespace"]
}

// namespaceHealthParams holds the path and query parameters for NamespaceHealth
//
// swagger:parameters namespaceHealth
type namespaceHealthParams struct {
	baseHealthParams
	// The type of health, "app", "service" or "workload".
	//
	// in: query
	// pattern: ^(app|service|workload)$
	// default: app
	Type string `json:"type"`
}

func (p *namespaceHealthParams) extract(r *http.Request) (bool, string) {
	vars := mux.Vars(r)
	p.baseExtract(r, vars)
	p.Type = "app"
	queryParams := r.URL.Query()
	if healthType := queryParams.Get("type"); healthType != "" {
		if healthType != "app" && healthType != "service" && healthType != "workload" {
			return false, "Bad request, query parameter 'type' must be one of ['app','service','workload']"
		}
		p.Type = healthType
	}
	return true, ""
}

func adjustRateInterval(ctx context.Context, business *business.Layer, namespace, rateInterval string, queryTime time.Time) (string, error) {
	namespaceInfo, err := business.Namespace.GetNamespace(ctx, namespace)
	if err != nil {
		return "", err
	}
	interval, err := util.AdjustRateInterval(namespaceInfo.CreationTimestamp, queryTime, rateInterval)
	if err != nil {
		return "", err
	}

	if interval != rateInterval {
		log.Debugf("Rate interval for namespace %v was adjusted to %v (original = %v, query time = %v, namespace created = %v)",
			namespace, interval, rateInterval, queryTime, namespaceInfo.CreationTimestamp)
	}

	return interval, nil
}
