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
	GraphType string
	Versioned bool
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

	// query prometheus for the responseTime info in three queries:
	// 1) query for responseTime originating from "unknown" (i.e. the internet)
	groupBy := "le,source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version"
	query := fmt.Sprintf("histogram_quantile(%.2f, sum(rate(%s{reporter=\"destination\",source_workload=\"unknown\",destination_service_namespace=\"%v\",response_code=\"200\"}[%vs])) by (%s))",
		quantile,
		"istio_request_duration_seconds_bucket",
		namespace,
		int(a.Duration.Seconds()), // range duration for the query
		groupBy)
	unkVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API())

	// 2) query for responseTime originating from a workload outside of the namespace
	query = fmt.Sprintf("histogram_quantile(%.2f, sum(rate(%s{reporter=\"source\",source_workload_namespace!=\"%v\",destination_service_namespace=\"%v\",response_code=\"200\"}[%vs])) by (%s))",
		quantile,
		"istio_request_duration_seconds_bucket",
		namespace,
		namespace,
		int(a.Duration.Seconds()), // range duration for the query
		groupBy)
	outVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API())

	// 3) query for responseTime originating from a workload inside of the namespace
	query = fmt.Sprintf("histogram_quantile(%.2f, sum(rate(%s{reporter=\"source\",source_workload_namespace=\"%v\",response_code=\"200\"}[%vs])) by (%s))",
		quantile,
		"istio_request_duration_seconds_bucket",
		namespace,
		int(a.Duration.Seconds()), // range duration for the query
		groupBy)
	inVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API())

	// create map to quickly look up responseTime
	responseTimeMap := make(map[string]float64)
	a.populateResponseTimeMap(responseTimeMap, &unkVector)
	a.populateResponseTimeMap(responseTimeMap, &outVector)
	a.populateResponseTimeMap(responseTimeMap, &inVector)

	applyResponseTime(trafficMap, responseTimeMap)
}

func applyResponseTime(trafficMap graph.TrafficMap, responseTimeMap map[string]float64) {
	for _, s := range trafficMap {
		for _, e := range s.Edges {
			key := fmt.Sprintf("%s %s", e.Source.ID, e.Dest.ID)
			e.Metadata["responseTime"] = responseTimeMap[key]
		}
	}
}

func (a ResponseTimeAppender) populateResponseTimeMap(responseTimeMap map[string]float64, vector *model.Vector) {
	for _, s := range *vector {
		m := s.Metric
		lSourceWlNs, sourceWlNsOk := m["source_workload_namespace"]
		lSourceWl, sourceWlOk := m["source_workload"]
		lSourceApp, sourceAppOk := m["source_app"]
		lSourceVer, sourceVerOk := m["source_version"]
		lDestSvcNs, destSvcNsOk := m["destination_service_namespace"]
		lDestSvcName, destSvcNameOk := m["destination_service_namespace"]
		lDestWl, destWlOk := m["destination_workload"]
		lDestApp, destAppOk := m["destination_app"]
		lDestVer, destVerOk := m["destination_version"]
		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcNameOk || !destWlOk || !destAppOk || !destVerOk {
			log.Warningf("Skipping %v, missing expected labels", m.String())
			continue
		}

		sourceWlNs := string(lSourceWlNs)
		sourceWl := string(lSourceWl)
		sourceApp := string(lSourceApp)
		sourceVer := string(lSourceVer)
		destSvcNs := string(lDestSvcNs)
		destSvcName := string(lDestSvcName)
		destWl := string(lDestWl)
		destApp := string(lDestApp)
		destVer := string(lDestVer)

		// handle any changes to dest field values given telemetry and graph type
		destApp, destWl = graph.DestFields(sourceApp, destApp, destWl, destSvcName, a.GraphType)

		sourceId, _ := graph.Id(sourceWlNs, sourceWl, sourceApp, sourceVer, a.GraphType, a.Versioned)
		destId, _ := graph.Id(destSvcNs, destWl, destApp, destVer, a.GraphType, a.Versioned)
		key := fmt.Sprintf("%s %s", sourceId, destId)
		val := float64(s.Value)
		responseTimeMap[key] += val
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
