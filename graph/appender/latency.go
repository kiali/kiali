package appender

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/graph/tree"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

const (
	DefaultQuantile = 0.95                  // 95th percentile
	TF              = "2006-01-02 15:04:05" // TF is the TimeFormat for printing timestamp
)

// LatencyAppender is responsible for adding latency information to the graph. Latency
// is represented as a percentile value. The default is 95th percentile, which means that
// 95% of requests executed in no more than the resulting milliseconds.
type LatencyAppender struct {
	Duration  time.Duration
	Quantile  float64
	QueryTime int64 // unix time in seconds
}

func (a LatencyAppender) AppendGraph(trees *[]tree.ServiceNode, namespace string) {
	client, err := prometheus.NewClient()
	checkError(err)

	a.appendGraph(trees, namespace, client)
}

func (a LatencyAppender) appendGraph(trees *[]tree.ServiceNode, namespace string, client *prometheus.Client) {
	quantile := a.Quantile
	if a.Quantile <= 0.0 || a.Quantile >= 100.0 {
		log.Warningf("Replacing invalid quantile [%.2f] with default [%.2f]", a.Quantile, DefaultQuantile)
		quantile = DefaultQuantile
	}
	log.Warningf("Generating latency using quantile [%.2f]", quantile)

	// query prometheus for the latency info in two queries. The first query gathers latency for
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

	// The second query gathers latency for requests originating inside of the namespace...
	query = fmt.Sprintf("histogram_quantile(%.2f, sum(rate(%s{source_service=~\"%v\",response_code=\"200\"}[%vs])) by (%s))",
		quantile,
		"istio_request_duration_bucket",
		namespacePattern,          // regex for namespace-constrained service
		int(a.Duration.Seconds()), // range duration for the query
		"le,source_service,source_version,destination_service,destination_version")
	inVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API())

	// create map to quickly look up latency
	latencyMap := make(map[string]float64)
	populateLatencyMap(latencyMap, &outVector)
	populateLatencyMap(latencyMap, &inVector)

	for _, tree := range *trees {
		applyLatency(&tree, latencyMap)
	}
}

func applyLatency(n *tree.ServiceNode, latencyMap map[string]float64) {
	for _, c := range n.Children {
		sourceSvc := n.Name
		sourceVer := n.Version
		destSvc := c.Name
		destVer := c.Version
		key := fmt.Sprintf("%s %s %s %s", sourceSvc, sourceVer, destSvc, destVer)
		c.Metadata["latency"] = latencyMap[key]

		applyLatency(c, latencyMap)
	}
}

func populateLatencyMap(latencyMap map[string]float64, vector *model.Vector) {
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
		latencyMap[key] = val
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
