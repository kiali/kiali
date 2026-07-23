package handlers

import (
	"net/http"
	"net/url"
	"time"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/queryparams"
	"github.com/kiali/kiali/util"
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

func (p *baseHealthParams) parse(conf *config.Config, queryParams url.Values) error {
	p.RateInterval = config.DefaultHealthRateInterval
	p.QueryTime = util.Clock.Now()
	if rateInterval := queryParams.Get("rateInterval"); rateInterval != "" {
		if err := queryparams.ValidatePromDuration(rateInterval, "rateInterval"); err != nil {
			return err
		}
		p.RateInterval = rateInterval
	}
	p.ClusterName = queryparams.ClusterName(conf, queryParams)
	if queryTime := queryParams.Get("queryTime"); queryTime != "" {
		parsed, err := queryparams.ParseQueryTime(queryTime)
		if err != nil {
			return err
		}
		p.QueryTime = parsed
	}
	return nil
}

// baseExtract parses common health-related query parameters after validating the allowed set.
func (p *baseHealthParams) baseExtract(conf *config.Config, r *http.Request, allowed ...string) error {
	queryParams := r.URL.Query()
	if err := queryparams.RejectUnknown(queryParams, allowed...); err != nil {
		return err
	}
	return p.parse(conf, queryParams)
}
