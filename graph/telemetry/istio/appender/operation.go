package appender

import (
	"fmt"
	"time"

	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

const (
	OperationAppenderName = "operation"
)

// OperationAppender is responsible for injecting request operation nodes into the graph to gain
// visibility into operation aggregates.
// Name: operation
type OperationAppender struct {
	GraphType  string
	Namespaces map[string]graph.NamespaceInfo
	QueryTime  int64 // unix time in seconds
}

type PolicyRates map[string]float64

// Name implements Appender
func (a OperationAppender) Name() string {
	return OperationAppenderName
}

// AppendGraph implements Appender
func (a OperationAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
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

func (a OperationAppender) appendGraph(trafficMap graph.TrafficMap, namespace string, client *prometheus.Client) {
	log.Tracef("Resolving request operations for namespace = %v", namespace)
	duration := a.Namespaces[namespace].Duration

	// query prometheus for request_operation info in two queries (only dest telemetry reports op info):
	// 1) query for requests originating from a workload outside the namespace.
	groupBy := fmt.Sprintf("source_workload_namespace,source_workload,source_%s,source_%s,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_%s,destination_%s,request_operation", appLabel, verLabel, appLabel, verLabel)
	httpQuery := fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace!="%v",destination_service_namespace="%v",request_operation!="unknown"}[%vs])) by (%s) > 0`,
		"istio_requests_total",
		namespace,
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	tcpQuery := fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace!="%v",destination_service_namespace="%v",request_operation!="unknown"}[%vs])) by (%s) > 0`,
		"istio_tcp_sent_bytes_total",
		namespace,
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	query := fmt.Sprintf(`(%s) OR (%s)`, httpQuery, tcpQuery)
	outVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API(), a)

	// 2) query for requests originating from a workload inside of the namespace
	httpQuery = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%v",request_operation!="unknown"}[%vs])) by (%s) > 0`,
		"istio_requests_total",
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	tcpQuery = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%v",request_operation!="unknown"}[%vs])) by (%s) > 0`,
		"istio_tcp_sent_bytes_total",
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	query = fmt.Sprintf(`(%s) OR (%s)`, httpQuery, tcpQuery)
	inVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API(), a)

	// create map to quickly look up securityPolicy
	// securityPolicyMap := make(map[string]PolicyRates)
	a.injectOperations(trafficMap, &outVector)
	a.injectOperations(trafficMap, &inVector)
}

func (a OperationAppender) injectOperations(trafficMap TrafficMap, vector *model.Vector) {
	for _, s := range *vector {
		m := s.Metric
		lSourceWlNs, sourceWlNsOk := m["source_workload_namespace"]
		lSourceWl, sourceWlOk := m["source_workload"]
		lSourceApp, sourceAppOk := m[model.LabelName("source_"+appLabel)]
		lSourceVer, sourceVerOk := m[model.LabelName("source_"+verLabel)]
		lDestSvcNs, destSvcNsOk := m["destination_service_namespace"]
		lDestSvcName, destSvcNameOk := m["destination_service_name"]
		lDestWlNs, destWlNsOk := m["destination_workload_namespace"]
		lDestWl, destWlOk := m["destination_workload"]
		lDestApp, destAppOk := m[model.LabelName("destination_"+appLabel)]
		lDestVer, destVerOk := m[model.LabelName("destination_"+verLabel)]
		lOperation, operationOk := m["request_operation"]

		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcNameOk || !destWlNsOk || !destWlOk || !destAppOk || !destVerOk || !operationOk {
			log.Warningf("Skipping %v, missing expected labels", m.String())
			continue
		}

		sourceWlNs := string(lSourceWlNs)
		sourceWl := string(lSourceWl)
		sourceApp := string(lSourceApp)
		sourceVer := string(lSourceVer)
		destSvcNs := string(lDestSvcNs)
		destSvcName := string(lDestSvcName)
		destWlNs := string(lDestWlNs)
		destWl := string(lDestWl)
		destApp := string(lDestApp)
		destVer := string(lDestVer)
		operation := string(lOperation)

		val := float64(s.Value)

		// inject operation node between source and destination
		a.addOperation(securityPolicyMap, csp, val, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destSvcNs, destSvcName, "", "", "", "")
		a.addOperation(securityPolicyMap, csp, val, destSvcNs, destSvcName, "", "", "", destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer)
	}
}

func (a OperationAppender) addOperation(securityPolicyMap map[string]PolicyRates, csp string, val float64, sourceNs, sourceSvc, sourceWl, sourceApp, sourceVer, destSvcNs, destSvc, destWlNs, destWl, destApp, destVer string) {
	sourceId, _ := graph.Id(sourceNs, sourceSvc, sourceNs, sourceWl, sourceApp, sourceVer, a.GraphType)
	destId, _ := graph.Id(destSvcNs, destSvc, destWlNs, destWl, destApp, destVer, a.GraphType)
	key := fmt.Sprintf("%s %s", sourceId, destId)
	var policyRates PolicyRates
	var ok bool
	if policyRates, ok = securityPolicyMap[key]; !ok {
		policyRates = make(PolicyRates)
		securityPolicyMap[key] = policyRates
	}
	policyRates[csp] = val
}

func applyOperation(trafficMap graph.TrafficMap, securityPolicyMap map[string]PolicyRates) {
	for _, s := range trafficMap {
		for _, e := range s.Edges {
			key := fmt.Sprintf("%s %s", e.Source.ID, e.Dest.ID)
			if policyRates, ok := securityPolicyMap[key]; ok {
				mtls := 0.0
				other := 0.0
				for policy, rate := range policyRates {
					if policy == policyMTLS {
						mtls = rate
					} else {
						other += rate
					}
				}
				if mtls > 0 {
					e.Metadata[graph.IsMTLS] = mtls / (mtls + other) * 100
				}
			}
		}
	}
}
