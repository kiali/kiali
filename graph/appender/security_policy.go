package appender

import (
	"fmt"
	"time"

	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

// SecurityPolicyAppender is responsible for adding securityPolicy information to the graph.
// The appender currently reports only mutual_tls security although is written in a generic way.
type SecurityPolicyAppender struct {
	Duration     time.Duration
	GraphType    string
	IncludeIstio bool
	QueryTime    int64 // unix time in seconds
}

// AppendGraph implements Appender
func (a SecurityPolicyAppender) AppendGraph(trafficMap graph.TrafficMap, namespace string) {
	if len(trafficMap) == 0 {
		return
	}

	client, err := prometheus.NewClient()
	checkError(err)

	a.appendGraph(trafficMap, namespace, client)
}

func (a SecurityPolicyAppender) appendGraph(trafficMap graph.TrafficMap, namespace string, client *prometheus.Client) {
	// query prometheus for mutual_tls info in two queries:
	// 1) query for active security originating from a workload outside the namespace
	groupBy := "source_workload_namespace,source_workload,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload,destination_app,destination_version,connection_security_policy"
	query := fmt.Sprintf("sum(rate(%s{reporter=\"destination\",source_workload_namespace!=\"%v\",destination_service_namespace=\"%v\",connection_security_policy!=\"none\",response_code=~\"%v\"}[%vs]) > 0) by (%s)",
		"istio_requests_total",
		namespace,
		namespace,
		"[2345][0-9][0-9]",        // regex for valid response_codes
		int(a.Duration.Seconds()), // range duration for the query
		groupBy)
	outVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API())

	// 2) query for active_security originating from a workload inside of the namespace
	istioCondition := ""
	if !a.IncludeIstio {
		istioCondition = fmt.Sprintf(",destination_service_namespace!=\"%s\"", config.Get().IstioNamespace)
	}
	query = fmt.Sprintf("sum(rate(%s{reporter=\"destination\",source_workload_namespace=\"%v\"%s,connection_security_policy!=\"none\",response_code=~\"%v\"}[%vs]) > 0) by (%s)",
		"istio_requests_total",
		namespace,
		istioCondition,
		"[2345][0-9][0-9]",        // regex for valid response_codes
		int(a.Duration.Seconds()), // range duration for the query
		groupBy)
	inVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API())

	// create map to quickly look up responseTime
	securityPolicyMap := make(map[string]string)
	a.populateSecurityPolicyMap(securityPolicyMap, &outVector)
	a.populateSecurityPolicyMap(securityPolicyMap, &inVector)

	applySecurityPolicy(trafficMap, securityPolicyMap)
}

func applySecurityPolicy(trafficMap graph.TrafficMap, securityPolicyMap map[string]string) {
	for _, s := range trafficMap {
		for _, e := range s.Edges {
			key := fmt.Sprintf("%s %s", e.Source.ID, e.Dest.ID)
			if securityPolicy, ok := securityPolicyMap[key]; ok {
				switch securityPolicy {
				case "mutual_tls":
					e.Metadata["isMTLS"] = true
				default:
					log.Debugf("Skipping unhandled security policy [%s]", securityPolicy)
				}
			}
		}
	}
}

func (a SecurityPolicyAppender) populateSecurityPolicyMap(securityPolicyMap map[string]string, vector *model.Vector) {
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
		lCsp, cspOk := m["connection_security_policy"]
		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcNameOk || !destWlOk || !destAppOk || !destVerOk || !cspOk {
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
		csp := string(lCsp)

		sourceId, _ := graph.Id(sourceWlNs, sourceWl, sourceApp, sourceVer, "", a.GraphType)
		destId, _ := graph.Id(destSvcNs, destWl, destApp, destVer, destSvcName, a.GraphType)
		key := fmt.Sprintf("%s %s", sourceId, destId)
		securityPolicyMap[key] = csp
	}
}
