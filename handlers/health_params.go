package handlers

import (
	"net/http"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/queryparams"
)

type baseHealthParams struct {
	// Cluster name
	ClusterName string `json:"clusterName"`
	// The namespace scope
	//
	// in: path
	Namespace string `json:"namespace"`
	// The time to use for the prometheus query
	QueryTime time.Time
	// The rate interval used for fetching error rate
	//
	// in: query
	// default: 5m (matches health_config.compute.duration)
	RateInterval string `json:"rateInterval"`
}

// baseHealthQueryParams are shared by list/detail endpoints that use rateInterval + queryTime.
var baseHealthQueryParams = []queryparams.Param{
	queryparams.ClusterParam(),
	queryparams.TimestampParam("queryTime"),
	queryparams.PromDurationParam("rateInterval", config.DefaultHealthRateInterval),
}

// clusterHealthQueryParams documents the ClusterHealth query contract.
// queryTime is accepted for UI cache-bust/replay even though ClusterHealth does not use it.
var clusterHealthQueryParams = []queryparams.Param{
	queryparams.ClusterParam(),
	queryparams.StringParam("namespaces", ""),
	queryparams.TimestampParam("queryTime"),
	queryparams.PromDurationParam("rateInterval", config.DefaultHealthRateInterval),
	queryparams.EnumParam("type", "app", "service", "workload"),
}

func (p *baseHealthParams) apply(result queryparams.Result) {
	p.ClusterName = result.Cluster()
	p.QueryTime = result.Time("queryTime")
	p.RateInterval = result.Duration("rateInterval")
}

// parseSchema rejects unknown keys and applies shared health fields from a declarative schema.
func (p *baseHealthParams) parseSchema(conf *config.Config, r *http.Request, extra ...queryparams.Param) (queryparams.Result, error) {
	params := make([]queryparams.Param, 0, len(baseHealthQueryParams)+len(extra))
	params = append(params, baseHealthQueryParams...)
	params = append(params, extra...)

	result, err := queryparams.ParseWithConfig(r.URL.Query(), conf, params)
	if err != nil {
		return queryparams.Result{}, err
	}
	p.apply(result)
	return result, nil
}
