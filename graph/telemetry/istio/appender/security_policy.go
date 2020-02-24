package appender

import (
	"fmt"
	"strings"
	"time"

	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/graph/telemetry/istio/util"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

const (
	SecurityPolicyAppenderName = "securityPolicy"
	policyMTLS                 = "mutual_tls"
)

// SecurityPolicyAppender is responsible for adding securityPolicy information to the graph.
// The appender currently reports only mutual_tls security although is written in a generic way.
// Name: securityPolicy
type SecurityPolicyAppender struct {
	GraphType          string
	InjectServiceNodes bool
	Namespaces         map[string]graph.NamespaceInfo
	QueryTime          int64 // unix time in seconds
}

type PolicyRates map[string]float64

// Name implements Appender
func (a SecurityPolicyAppender) Name() string {
	return SecurityPolicyAppenderName
}

// AppendGraph implements Appender
func (a SecurityPolicyAppender) AppendGraph(trafficMap graph.TrafficMap, globalInfo *graph.AppenderGlobalInfo, namespaceInfo *graph.AppenderNamespaceInfo) {
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

func (a SecurityPolicyAppender) appendGraph(trafficMap graph.TrafficMap, namespace string, client *prometheus.Client) {
	log.Tracef("Resolving security policy for namespace = %v", namespace)
	duration := a.Namespaces[namespace].Duration

	// query prometheus for mutual_tls info in two queries (use dest telemetry because it reports the security policy):
	// 1) query for requests originating from a workload outside the namespace. This may include unnecessary istio
	//    but we don't want to miss ingressgateway traffic, even if it's not in a requested namespace.  The excess
	//    traffic will be ignored because it won't map to the trafficMap.
	groupBy := "source_workload_namespace,source_workload,source_canonical_service,source_app,source_version,destination_service_namespace,destination_service_name,destination_workload_namespace,destination_workload,destination_canonical_service,destination_app,destination_version,connection_security_policy"
	httpQuery := fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace!="%v",destination_service_namespace="%v"}[%vs])) by (%s) > 0`,
		"istio_requests_total",
		namespace,
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	tcpQuery := fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace!="%v",destination_service_namespace="%v"}[%vs])) by (%s) > 0`,
		"istio_tcp_sent_bytes_total",
		namespace,
		namespace,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	query := fmt.Sprintf(`(%s) OR (%s)`, httpQuery, tcpQuery)
	outVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API(), a)

	// 2) query for requests originating from a workload inside of the namespace, exclude traffic to non-requested
	//    istio namespaces. (note, do we need to ease this restriction to ensure we don't miss egressgateway traffic?)
	destinationWorkloadNamespaceQuery := ""
	excludedIstioNamespaces := getIstioNamespaces(a.Namespaces)
	if len(excludedIstioNamespaces) > 0 {
		excludedIstioRegex := strings.Join(excludedIstioNamespaces, "|")
		destinationWorkloadNamespaceQuery = fmt.Sprintf(`,destination_service_namespace!~"%s"`, excludedIstioRegex)
	}
	httpQuery = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%v"%s}[%vs])) by (%s) > 0`,
		"istio_requests_total",
		namespace,
		destinationWorkloadNamespaceQuery,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	tcpQuery = fmt.Sprintf(`sum(rate(%s{reporter="destination",source_workload_namespace="%v"%s}[%vs])) by (%s) > 0`,
		"istio_tcp_sent_bytes_total",
		namespace,
		destinationWorkloadNamespaceQuery,
		int(duration.Seconds()), // range duration for the query
		groupBy)
	query = fmt.Sprintf(`(%s) OR (%s)`, httpQuery, tcpQuery)
	inVector := promQuery(query, time.Unix(a.QueryTime, 0), client.API(), a)

	// create map to quickly look up securityPolicy
	securityPolicyMap := make(map[string]PolicyRates)
	a.populateSecurityPolicyMap(securityPolicyMap, &outVector)
	a.populateSecurityPolicyMap(securityPolicyMap, &inVector)

	applySecurityPolicy(trafficMap, securityPolicyMap)
}

func (a SecurityPolicyAppender) populateSecurityPolicyMap(securityPolicyMap map[string]PolicyRates, vector *model.Vector) {
	for _, s := range *vector {
		m := s.Metric
		lSourceWlNs, sourceWlNsOk := m["source_workload_namespace"]
		lSourceWl, sourceWlOk := m["source_workload"]
		lSourceCS, sourceCSOk := m["source_canonical_service"]
		lSourceApp, sourceAppOk := m["source_app"]
		lSourceVer, sourceVerOk := m["source_version"]
		lDestSvcNs, destSvcNsOk := m["destination_service_namespace"]
		lDestSvcName, destSvcNameOk := m["destination_service_name"]
		lDestWlNs, destWlNsOk := m["destination_workload_namespace"]
		lDestWl, destWlOk := m["destination_workload"]
		lDestCS, destCSOk := m["destination_canonical_service"]
		lDestApp, destAppOk := m["destination_app"]
		lDestVer, destVerOk := m["destination_version"]
		lCsp, cspOk := m["connection_security_policy"]

		if !sourceWlNsOk || !sourceWlOk || !sourceAppOk || !sourceVerOk || !destSvcNsOk || !destSvcNameOk || !destWlNsOk || !destWlOk || !destAppOk || !destVerOk || !cspOk {
			log.Warningf("Skipping %v, missing expected labels", m.String())
			continue
		}

		sourceWlNs := string(lSourceWlNs)
		sourceWl := string(lSourceWl)
		sourceVer := string(lSourceVer)
		destSvcNs := string(lDestSvcNs)
		destSvcName := string(lDestSvcName)
		destWlNs := string(lDestWlNs)
		destWl := string(lDestWl)
		destVer := string(lDestVer)
		csp := string(lCsp)

		// set app in a backward compatible way
		sourceApp := util.HandleApp(string(lSourceApp), string(lSourceCS), sourceCSOk)
		destApp := util.HandleApp(string(lDestApp), string(lDestCS), destCSOk)

		val := float64(s.Value)

		// don't inject a service node if destSvcName is not set or the dest node is already a service node.
		inject := false
		if a.InjectServiceNodes && graph.IsOK(destSvcName) {
			_, destNodeType := graph.Id(destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, a.GraphType)
			inject = (graph.NodeTypeService != destNodeType)
		}
		if inject {
			a.addSecurityPolicy(securityPolicyMap, csp, val, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destSvcNs, destSvcName, "", "", "", "")
			a.addSecurityPolicy(securityPolicyMap, csp, val, destSvcNs, destSvcName, "", "", "", destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer)
		} else {
			a.addSecurityPolicy(securityPolicyMap, csp, val, sourceWlNs, "", sourceWl, sourceApp, sourceVer, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer)
		}
	}
}

func (a SecurityPolicyAppender) addSecurityPolicy(securityPolicyMap map[string]PolicyRates, csp string, val float64, sourceNs, sourceSvc, sourceWl, sourceApp, sourceVer, destSvcNs, destSvc, destWlNs, destWl, destApp, destVer string) {
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

func applySecurityPolicy(trafficMap graph.TrafficMap, securityPolicyMap map[string]PolicyRates) {
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
