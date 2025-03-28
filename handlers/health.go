package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/util"
)

const defaultHealthRateInterval = "10m"

// ClustersHealth is the API handler to get app-based health of every services from namespaces in the given cluster
func ClustersHealth(w http.ResponseWriter, r *http.Request) {
	params := r.URL.Query()
	namespaces := params.Get("namespaces") // csl of namespaces
	nss := []string{}
	if len(namespaces) > 0 {
		nss = strings.Split(namespaces, ",")
	}
	cluster := clusterNameFromQuery(config.Get(), params)

	businessLayer, err := getBusiness(r)
	if err != nil {
		log.Error(err)
		RespondWithError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if len(nss) == 0 {
		loadedNamespaces, _ := businessLayer.Namespace.GetClusterNamespaces(r.Context(), cluster)
		for _, ns := range loadedNamespaces {
			nss = append(nss, ns.Name)
		}
	}
	result := models.ClustersNamespaceHealth{
		AppHealth:      map[string]*models.NamespaceAppHealth{},
		WorkloadHealth: map[string]*models.NamespaceWorkloadHealth{},
		ServiceHealth:  map[string]*models.NamespaceServiceHealth{},
	}
	for _, ns := range nss {
		p := namespaceHealthParams{}
		if ok, err := p.extract(r, ns); !ok {
			// Bad request
			RespondWithError(w, http.StatusBadRequest, err)
			return
		}

		// Adjust rate interval
		rateInterval, err := adjustRateInterval(r.Context(), businessLayer, p.Namespace, p.RateInterval, p.QueryTime, p.ClusterName)
		if err != nil {
			handleErrorResponse(w, err, "Adjust rate interval error: "+err.Error())
			return
		}

		healthCriteria := business.NamespaceHealthCriteria{Namespace: p.Namespace, Cluster: p.ClusterName, RateInterval: rateInterval, QueryTime: p.QueryTime, IncludeMetrics: true}
		switch p.Type {
		case "app":
			health, err := businessLayer.Health.GetNamespaceAppHealth(r.Context(), healthCriteria)
			if err != nil {
				handleErrorResponse(w, err, "Error while fetching app health: "+err.Error())
				return
			}
			result.AppHealth[ns] = &health
		case "service":
			health, err := businessLayer.Health.GetNamespaceServiceHealth(r.Context(), healthCriteria)
			if err != nil {
				handleErrorResponse(w, err, "Error while fetching service health: "+err.Error())
				return
			}
			result.ServiceHealth[ns] = &health
		case "workload":
			health, err := businessLayer.Health.GetNamespaceWorkloadHealth(r.Context(), healthCriteria)
			if err != nil {
				handleErrorResponse(w, err, "Error while fetching workload health: "+err.Error())
				return
			}
			result.WorkloadHealth[ns] = &health
		}
	}
	RespondWithJSON(w, http.StatusOK, result)
}

type baseHealthParams struct {
	// Cluster name
	ClusterName string `json:"clusterName"`
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
	p.ClusterName = clusterNameFromQuery(config.Get(), queryParams)
	if queryTime := queryParams.Get("queryTime"); queryTime != "" {
		unix, err := strconv.ParseInt(queryTime, 10, 64)
		if err == nil {
			p.QueryTime = time.Unix(unix, 0)
		}
	}
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

func (p *namespaceHealthParams) extract(r *http.Request, namespace string) (bool, string) {
	vars := mux.Vars(r)
	p.baseExtract(r, vars)
	p.Type = "app"
	p.Namespace = namespace
	queryParams := r.URL.Query()
	if healthType := queryParams.Get("type"); healthType != "" {
		if healthType != "app" && healthType != "service" && healthType != "workload" {
			return false, "Bad request, query parameter 'type' must be one of ['app','service','workload']"
		}
		p.Type = healthType
	}
	return true, ""
}

func adjustRateInterval(ctx context.Context, business *business.Layer, namespace, rateInterval string, queryTime time.Time, cluster string) (string, error) {
	namespaceInfo, err := business.Namespace.GetClusterNamespace(ctx, namespace, cluster)
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
