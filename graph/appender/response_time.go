package appender

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

const (
	DefaultQuantile = 0.95                  // 95th percentile
	TF              = "2006-01-02 15:04:05" // TF is the TimeFormat for printing timestamp
)

// ResponseTimeAppender is responsible for adding responseTime information to the graph. ResponseTime
// is represented as a percentile value. The default is 95th percentile, which means that
// 95% of requests executed in no more than the resulting milliseconds.
type ResponseTimeAppender struct {
	Duration  time.Duration
	Quantile  float64
	QueryTime int64 // unix time in seconds
}

// AppendGraph implements Appender
func (a ResponseTimeAppender) AppendGraph(trafficMap graph.TrafficMap, namespace string) {
	if len(trafficMap) == 0 {
		return
	}

	client, err := prometheus.NewClient()
	checkError(err)

	a.appendGraph(trafficMap, namespace, client)
}

func (a ResponseTimeAppender) appendGraph(trafficMap graph.TrafficMap, namespace string, client *prometheus.Client) {
	quantile := a.Quantile
	if a.Quantile <= 0.0 || a.Quantile >= 100.0 {
		log.Warningf("Replacing invalid quantile [%.2f] with default [%.2f]", a.Quantile, DefaultQuantile)
		quantile = DefaultQuantile
	}
	log.Warningf("Generating responseTime using quantile [%.2f]", quantile)

	// query prometheus for the responseTime info in two queries. The first query gathers responseTime for
	// requests originating outside of the namespace...
	namespacePattern := fmt.Sprintf(".*\\\\.%v\\\\..*", namespace)
	query := fmt.Sprintf("histogram_quantile(%.2f, sum(rate(%s{source_service!~\"%v\",destination_service=~\"%v\",response_code=\"200\"}[%vs])) by (%s))",
		quantile,
		"istio_request_duration_bucket",
		namespacePattern,          // regex for namespace-constrained service
		namespacePattern,          // regex for namespace-constrained service
		int(a.Duration.Seconds()), // range duration for the query
		"le,source_service,source_version,destination_service,destination_version")
	outVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API())

	// The second query gathers responseTime for requests originating inside of the namespace...
	query = fmt.Sprintf("histogram_quantile(%.2f, sum(rate(%s{source_service=~\"%v\",response_code=\"200\"}[%vs])) by (%s))",
		quantile,
		"istio_request_duration_bucket",
		namespacePattern,          // regex for namespace-constrained service
		int(a.Duration.Seconds()), // range duration for the query
		"le,source_service,source_version,destination_service,destination_version")
	inVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API())

	// create map to quickly look up responseTime
	responseTimeMap := make(map[string]float64)
	populateResponseTimeMap(responseTimeMap, &outVector)
	populateResponseTimeMap(responseTimeMap, &inVector)

	applyResponseTime(trafficMap, responseTimeMap)
}

func applyResponseTime(trafficMap graph.TrafficMap, responseTimeMap map[string]float64) {
	// TODO FIX Name --> Workload to compile
	for _, s := range trafficMap {
		for _, e := range s.Edges {
			key := fmt.Sprintf("%s %s %s %s", e.Source.Workload, e.Source.Version, e.Dest.Workload, e.Dest.Version)
			e.Metadata["responseTime"] = responseTimeMap[key]
		}
	}
}

func populateResponseTimeMap(responseTimeMap map[string]float64, vector *model.Vector) {
	for _, s := range *vector {
		m := s.Metric
		sourceSvc, sourceSvcOk := m["source_service"]
		sourceVer, sourceVerOk := m["source_version"]
		destSvc, destSvcOk := m["destination_service"]
		destVer, destVerOk := m["destination_version"]
		if !sourceSvcOk || !sourceVerOk || !destSvcOk || !destVerOk {
			log.Warningf("Skipping %v, missing expected labels", m.String())
			continue
		}

		key := fmt.Sprintf("%s %s %s %s", sourceSvc, sourceVer, destSvc, destVer)
		val := float64(s.Value)
		responseTimeMap[key] = val
	}
}

func promQuery(query string, queryTime time.Time, api v1.API) model.Vector {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// wrap with a round() to be in line with metrics api
	query = fmt.Sprintf("round(%s,0.001)", query)
	log.Debugf("Executing query %s&time=%v (now=%v, %v)\n", query, queryTime.Format(TF), time.Now().Format(TF), queryTime.Unix())

	value, err := api.Query(ctx, query, queryTime)
	checkError(err)

	switch t := value.Type(); t {
	case model.ValVector: // Instant Vector
		return value.(model.Vector)
	default:
		checkError(errors.New(fmt.Sprintf("No handling for type %v!\n", t)))
	}

	return nil
}
