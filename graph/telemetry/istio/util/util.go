package util

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/prometheus"
)

// badServiceMatcher looks for a physical IP address with optional port (e.g. 10.11.12.13:80)
var badServiceMatcher = regexp.MustCompile(`^\d+\.\d+\.\d+\.\d+(:\d+)?$`)
var egressHost string

// HandleClusters just sets source an dest cluster to unknown if it is not supplied on the telemetry
// TODO: Starting in Istio 1.9 source_cluster and destination_cluster are always reported.  So, this
// function can be removed when the Kiali version can assume Istio 1.9 or later.
func HandleClusters(lSourceCluster model.LabelValue, sourceClusterOk bool, lDestCluster model.LabelValue, destClusterOk bool) (sourceCluster, destCluster string) {
	if sourceClusterOk {
		sourceCluster = string(lSourceCluster)
	} else {
		sourceCluster = graph.Unknown
	}
	if destClusterOk {
		destCluster = string(lDestCluster)
	} else {
		destCluster = graph.Unknown
	}
	return sourceCluster, destCluster
}

// HandleDestination modifies the destination information, when necessary, for various corner
// cases.  It should be called after source validation and before destination processing.
// Returns destSvcNs, destSvcName, destWlNs, destWl, destApp, destVersion, isupdated
func HandleDestination(sourceCluster, sourceWlNs, sourceWl, destCluster, destSvcNs, destSvc, destSvcName, destWlNs, destWl, destApp, destVer string) (string, string, string, string, string, string, string, bool) {
	// Handle egressgateway (kiali#2999)
	if egressHost == "" {
		egressHost = fmt.Sprintf("istio-egressgateway.%s.svc.cluster.local", config.Get().IstioNamespace)
	}

	if destSvc == egressHost && destSvc == destSvcName {
		istioNs := config.Get().IstioNamespace
		log.Debugf("HandleDestination: destCluster=%s, destSvcNs=%s", sourceCluster, istioNs)
		return sourceCluster, istioNs, "istio-egressgateway", istioNs, "istio-egressgateway", "istio-egressgateway", "latest", true
	}

	// TODO: Below we are adding best-effort handling for https://github.com/istio/istio/issues/29373. That
	//       bug can cause destination_cluster to be incorrectly reported as "unknown".  In that situation
	//       we are ASSUMING the destination_cluster is the same as the source_cluster.  This is invalid
	//       if the request is for a different cluster AND the reporting is wrong, but leaving it as "unknown"
	//       causes strange graph behavior in the more typical, same-cluster, case.  The bug is scheduled to
	//       be fixed in Istio 1.10.0. Remove handling when bug s resolved for all supported Istio versions.
	if !graph.IsOK(destCluster) && graph.IsOK(sourceCluster) && graph.IsOK(destSvcNs) {
		log.Debugf("Handling Istio#29373, resetting destination_cluster from [%s] to [%s]", destCluster, sourceCluster)
		destCluster = sourceCluster
	}

	return destCluster, destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, false
}

// HandleResponseCode determines the proper response code based on how istio has set the response_code and
// grpc_response_status attributes. grpc_response_status was added upstream in Istio 1.5 and downstream
// in OSSM 1.1.  We support it here in a backward compatible way.
// return "-" for requests that did not receive a response, regardless of protocol
// return HTTP response code when:
//   - protocol is not GRPC
//   - the version running does not supply the GRPC status
//   - the protocol is GRPC but the HTTP transport fails (i.e. an HTTP error is reported, rare).
//
// return the GRPC status, otherwise.
func HandleResponseCode(protocol, responseCode string, grpcResponseStatusOk bool, grpcResponseStatus string) string {
	// Istio sets response_code to 0 to indicate "no response" regardless of protocol.
	if responseCode == "0" {
		return "-"
	}

	// when not "0" responseCode holds the HTTP response status code for HTTP or GRPC requests
	if protocol != graph.GRPC.Name || graph.IsHTTPErr(responseCode) || !grpcResponseStatusOk {
		return responseCode
	}

	return grpcResponseStatus
}

// IsBadSourceTelemetry tests for known issues in generated telemetry given indicative label values.
// 1) source namespace is ok but neither workload nor app are set
// 2) source namespace is ok and source_cluster is provided but not ok.
// 3) no more conditions known
func IsBadSourceTelemetry(cluster string, clusterOK bool, ns, wl, app string) bool {
	// case1
	if graph.IsOK(ns) && !graph.IsOK(wl) && !graph.IsOK(app) {
		log.Debugf("Skipping bad source telemetry [case 1] [%s] [%s] [%s]", ns, wl, app)
		return true
	}
	// case2
	if graph.IsOK(ns) && clusterOK && !graph.IsOK(cluster) {
		log.Debugf("Skipping bad source telemetry [case 2] [%s] [%s] [%s] [%s]", ns, wl, app, cluster)
		return true
	}

	return false
}

// IsBadDestTelemetry tests for known issues in generated telemetry given indicative label values.
//  1. During pod lifecycle changes incomplete telemetry may be generated that results in
//     destSvc == destSvcName and no dest workload, where destSvc[Name] is in the form of an IP address.
//  2. destSvcNs is ok and destCluster is provided but not ok
//  3. no more conditions known
func IsBadDestTelemetry(cluster string, clusterOK bool, svcNs, svc, svcName, wl string) bool {
	// case1
	failsEqualsTest := (!graph.IsOK(wl) && graph.IsOK(svc) && graph.IsOK(svcName) && (svc == svcName))
	if failsEqualsTest && badServiceMatcher.MatchString(svcName) {
		log.Debugf("Skipping bad dest telemetry [case 1] [%s] [%s] [%s]", svc, svcName, wl)
		return true
	}
	// case2
	if graph.IsOK(svcNs) && clusterOK && !graph.IsOK(cluster) {
		log.Debugf("Skipping bad dest telemetry [case 2] [%s] [%s]", svcNs, cluster)
		return true
	}
	return false
}

// AddQueryScope returns the prom query unchanged if there is no configured queryScope, otherwise
// it returns the query with the queryScope injected after each occurrence of a leading '{'.
func AddQueryScope(query string) string {
	queryScope := config.Get().ExternalServices.Prometheus.QueryScope
	if len(queryScope) == 0 {
		return query
	}

	scope := "{"
	for labelName, labelValue := range queryScope {
		scope = fmt.Sprintf("%s%s=\"%s\",", scope, prometheus.SanitizeLabelName(labelName), labelValue)
	}

	return strings.ReplaceAll(query, "{", scope)
}

// GetReporter returns the "reporter=" prom query fragment based on whether the reporter must include waypoint traffic
func GetReporter(reporter string, rates graph.RequestedRates) string {
	if rates.Ambient == graph.AmbientTrafficWaypoint || rates.Ambient == graph.AmbientTrafficTotal {
		return fmt.Sprintf(`reporter=~"%s|waypoint"`, reporter)
	}
	return fmt.Sprintf(`reporter="%s"`, reporter)
}

// GetApp returns the "app=" prom query fragment based on whether the reporter must exclude ztunnel data
func GetApp(rates graph.RequestedRates) string {
	if rates.Ambient == graph.AmbientTrafficWaypoint || rates.Ambient == graph.AmbientTrafficNone {
		return "app!=\"ztunnel\","
	}
	return ""
}
