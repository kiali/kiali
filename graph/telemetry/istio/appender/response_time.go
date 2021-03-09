package appender

import (
	"fmt"
	"math"
	"regexp"
	"time"

	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/telemetry/istio/util"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

const (
	// ResponseTimeAppenderName uniquely identifies the appender: responseTime
	ResponseTimeAppenderName = "responseTime"
)

var (
	regexpHTTPFailure, _ = regexp.Compile(`^0$|^[4|5]\d\d$`) // include 0, Istio's flag for no response received
)

// ResponseTimeAppender is responsible for adding responseTime information to the graph. ResponseTime
// is represented as a percentile value. The default is 95th percentile, which means that
// 95% of requests executed in no more than the resulting milliseconds. ResponeTime values are
// reported in milliseconds.
// Response Times are reported using destination proxy telemetry, when available, which should remove
// network latency fluctuations.
// TODO: Should we report both source and destination when possible?
// Name: responseTime
type ResponseTimeAppender struct {
	GraphType          string
	InjectServiceNodes bool
	Namespaces         graph.NamespaceInfoMap
	Quantile           float64
	QueryTime          int64 // unix time in seconds
}

// Name implements Appender
func (a ResponseTimeAppender) Name() string {
	return ResponseTimeAppenderName
}

// AppendGraph implements Appender
func (a ResponseTimeAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
	if len(trafficMap) == 0 {
		return
	}

	if globalInfo.PromClient == nil {
		var err error
		globalInfo.PromClient, err = prometheus.NewClient()
		graph.CheckError(err)
	}

	a.appendGraph(trafficMap, namespaceInfo.Namespace, globalInfo.PromClient)
}

func (a ResponseTimeAppender) appendGraph(trafficMap graph.TrafficMap, namespace string, client *prometheus.Client) {
	quantile := a.Quantile
	if a.Quantile <= 0.0 || a.Quantile >= 100.0 {
		log.Warningf("Replacing invalid quantile [%.2f] with default [%.2f]", a.Quantile, defaultQuantile)
		quantile = defaultQuantile
	}
	log.Tracef("Generating responseTime using quantile [%.2f]; namespace = %v", quantile, namespace)

	// create map to quickly look up responseTime
	responseTimeMap := make(map[string]float64)
	duration := a.Namespaces[namespace].Duration

	// query prometheus for the responseTime info in four queries:
	groupBy := "le,source_cluster,source_workload_namespace,source_workload,source_canonical_service,source_canonical_revision,destination_cluster,destination_service_namespace,destination_service,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_canonical_revision,response_code,grpc_response_status"

	// 1) Incoming: query destination telemetry to capture namespace services' incoming traffic
	// note - the query order is important as both queries may have overlapping results for edges within
	//        the namespace.  This query uses destination proxy and so must come first.
	query := fmt.Sprintf(`histogram_quantile(%.2f, sum(rate(%s{reporter="destination",destination_service_namespace="%s"}[%vs])) by (%s)) > 0`,
		quantile,
		"istio_request_duration_milliseconds_bucket",
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	incomingVector := promQuery(query, time.Unix(a.QueryTime, 0), client.GetContext(), client.API(), a)
	a.populateResponseTimeMap(responseTimeMap, &incomingVector)

	// 2) Outgoing: query source telemetry to capture namespace workloads' outgoing traffic
	query = fmt.Sprintf(`histogram_quantile(%.2f, sum(rate(%s{reporter="source",source_workload_namespace="%s"}[%vs])) by (%s)) > 0`,
		quantile,
		"istio_request_duration_milliseconds_bucket",
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	outgoingVector := promQuery(query, time.Unix(a.QueryTime, 0), client.GetContext(), client.API(), a)
	a.populateResponseTimeMap(responseTimeMap, &outgoingVector)

	applyResponseTime(trafficMap, responseTimeMap)
}

func applyResponseTime(trafficMap graph.TrafficMap, responseTimeMap map[string]float64) {
	for _, n := range trafficMap {
		for _, e := range n.Edges {
			key := fmt.Sprintf("%s %s", e.Source.ID, e.Dest.ID)
			if val, ok := responseTimeMap[key]; ok {
				e.Metadata[graph.ResponseTime] = val
			}
		}
	}
}

func (a ResponseTimeAppender) populateResponseTimeMap(responseTimeMap map[string]float64, vector *model.Vector) {
	for _, s := range *vector {
		m := s.Metric
		lSourceCluster, sourceClusterOk := m["source_cluster"]
		lSourceWlNs, sourceWlNsOk := m["source_workload_namespace"]
		lSourceWl, sourceWlOk := m["source_workload"]
		lSourceApp, sourceAppOk := m["source_canonical_service"]
		lSourceVer, sourceVerOk := m["source_canonical_revision"]
		lDestCluster, destClusterOk := m["destination_cluster"]
		lDestSvcNs, destSvcNsOk := m["destination_service_namespace"]
		lDestSvc, destSvcOk := m["destination_service"]
		lDestSvcName, destSvcNameOk := m["destination_service_name"]
		lDestWlNs, destWlNsOk := m["destination_workload_namespace"]
		lDestWl, destWlOk := m["destination_workload"]
		lDestApp, destAppOk := m["destination_canonical_service"]
		lDestVer, destVerOk := m["destination_canonical_revision"]
		lResponseCode, responseCodeOk := m["response_code"]
		lGrpcResponseStatus, grpcReponseStatusOk := m["grpc_response_status"]

		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcNameOk || !destSvcOk || !destWlNsOk || !destWlOk || !destAppOk || !destVerOk || !responseCodeOk {
			log.Warningf("Skipping %v, missing expected labels", m.String())
			continue
		}

		sourceWlNs := string(lSourceWlNs)
		sourceWl := string(lSourceWl)
		sourceApp := string(lSourceApp)
		sourceVer := string(lSourceVer)
		destSvc := string(lDestSvc)
		responseCode := string(lResponseCode)

		// handle clusters
		sourceCluster, destCluster := util.HandleClusters(lSourceCluster, sourceClusterOk, lDestCluster, destClusterOk)

		if util.IsBadSourceTelemetry(sourceCluster, sourceClusterOk, sourceWlNs, sourceWl, sourceApp) {
			continue
		}

		// This was added in istio 1.5, handle in a backward compatible way
		grpcReponseStatus := "0"
		if grpcReponseStatusOk {
			grpcReponseStatus = string(lGrpcResponseStatus)
		}

		// Only valid requests contribute to response time so as not to skew RT when a failed request returns immediately
		// TODO: Maybe we should control this behavior with a queryParam?
		if grpcReponseStatus != "0" || regexpHTTPFailure.MatchString(responseCode) {
			continue
		}

		val := float64(s.Value)

		// handle unusual destinations
		destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, _ := util.HandleDestination(sourceCluster, sourceWlNs, sourceWl, destCluster, string(lDestSvcNs), string(lDestSvc), string(lDestSvcName), string(lDestWlNs), string(lDestWl), string(lDestApp), string(lDestVer))

		if util.IsBadDestTelemetry(destCluster, destClusterOk, destSvcNs, destSvc, destSvcName, destWl) {
			continue
		}

		// It is possible to get a NaN if there is no traffic (or possibly other reasons). Just skip it
		if math.IsNaN(val) {
			continue
		}

		// don't inject a service node if destSvcName is not set or the dest node is already a service node.
		inject := false
		if a.InjectServiceNodes && graph.IsOK(destSvcName) {
			_, destNodeType := graph.Id(destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, a.GraphType)
			inject = (graph.NodeTypeService != destNodeType)
		}

		if inject {
			// Do not set response time on the incoming edge, we can't validly aggregate response times of the outgoing edges (kiali-2297)
			a.addResponseTime(responseTimeMap, val, destCluster, destSvcNs, destSvcName, "", "", "", destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer)
		} else {
			a.addResponseTime(responseTimeMap, val, sourceCluster, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer)
		}
	}
}

func (a ResponseTimeAppender) addResponseTime(responseTimeMap map[string]float64, val float64, sourceCluster, sourceNs, sourceSvc, sourceWl, sourceApp, sourceVer, destCluster, destSvcNs, destSvc, destWlNs, destWl, destApp, destVer string) {
	sourceID, _ := graph.Id(sourceCluster, sourceNs, sourceSvc, sourceNs, sourceWl, sourceApp, sourceVer, a.GraphType)
	destID, _ := graph.Id(destCluster, destSvcNs, destSvc, destWlNs, destWl, destApp, destVer, a.GraphType)
	key := fmt.Sprintf("%s %s", sourceID, destID)

	// For edges within the namespace we may get a responseTime reported from both the incoming and outgoing
	// traffic queries.  We assume here the first reported value is preferred (i.e. defer to query order)
	if _, found := responseTimeMap[key]; !found {
		responseTimeMap[key] = val
	}
}
