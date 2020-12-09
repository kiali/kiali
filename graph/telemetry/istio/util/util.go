package util

import (
	"fmt"
	"regexp"

	"github.com/prometheus/common/model"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/log"
)

// badServiceMatcher looks for a physical IP address with optional port (e.g. 10.11.12.13:80)
var badServiceMatcher = regexp.MustCompile(`^\d+\.\d+\.\d+\.\d+(:\d+)?$`)
var egressHost string

// HandleClusters just sets source an dest cluster to unknown if it is not supplied on the telemetry
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
func HandleDestination(sourceWlNs, sourceWl, destSvcNs, destSvc, destSvcName, destWlNs, destWl, destApp, destVer string) (string, string, string, string, string, string, bool) {
	if destSvcNs, destSvcName, isUpdated := handleMultiClusterRequest(sourceWlNs, sourceWl, destSvcNs, destSvcName); isUpdated {
		return destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, true
	}

	// Handle egressgateway (kiali#2999)
	if egressHost == "" {
		egressHost = fmt.Sprintf("istio-egressgateway.%s.svc.cluster.local", config.Get().IstioNamespace)
	}

	if destSvc == egressHost && destSvc == destSvcName {
		istioNs := config.Get().IstioNamespace
		return istioNs, "istio-egressgateway", istioNs, "istio-egressgateway", "istio-egressgateway", "latest", true
	}

	return destSvcNs, destSvcName, destWlNs, destWl, destApp, destVer, false
}

// handleMultiClusterRequest ensures the proper destination service namespace and name
// for requests forwarded from another cluster (via a ServiceEntry).
//
// Given a request from clusterA to clusterB, clusterA will generate source telemetry
// (from the source workload to the service entry) and clusterB will generate destination
// telemetry (from unknown to the destination workload). If this is the destination
// telemetry the destination_service_name label will be set to the service entry host,
// which is required to have the form <name>.<namespace>.global where name and namespace
// correspond to the remote service’s name and namespace respectively. In this situation
// we alter the request in two ways:
//
// First, we reset destSvcName to <name> in order to unify remote and local requests to the
// service. By doing this the graph will show only one <service> node instead of having a
// node for both <service> and <name>.<namespace>.global which in practice, are the same.
//
// Second, we reset destSvcNs to <namespace>. We want destSvcNs to be set to the namespace
// of the remote service's namespace.  But in practice it will be set to the namespace
// (on clusterA) where the servieEntry is defined. This is not useful for the visualization,
// and so we replace it here. Note that <namespace> should be equivalent to the value set for
// destination_workload_namespace, we just use <namespace> for convenience, we have it here.
//
// All of this is only done if source workload is "unknown", which is what indicates that
// this represents the destination telemetry on clusterB, and if the destSvcName is in
// the MC format. When the source workload IS known the traffic it should be representing
// the clusterA traffic to the ServiceEntry and being routed out of the cluster. That use
// case is handled in the service_entry.go file.
//
// Returns destSvcNs, destSvcName, isUpdated
func handleMultiClusterRequest(sourceWlNs, sourceWl, destSvcNs, destSvcName string) (string, string, bool) {
	// *** TODO *** commenting this logic out as part of the 1.8 MC work, on the assumption that Istio should be
	// improving the MC reporting starting with 1.8.  We'll see whether we need any of this logic as we move
	// forward...  If not this function should be deleted.
	/*
		if sourceWlNs == graph.Unknown && sourceWl == graph.Unknown {
			destSvcNameEntries := strings.Split(destSvcName, ".")

			if len(destSvcNameEntries) == 3 && destSvcNameEntries[2] == config.IstioMultiClusterHostSuffix {
				return destSvcNameEntries[1], destSvcNameEntries[0], true
			}
		}
	*/

	return destSvcNs, destSvcName, false
}

// HandleResponseCode determines the proper response code based on how istio has set the response_code and
// grpc_response_status attributes. grpc_response_status was added upstream in Istio 1.5 and downstream
// in OSSM 1.1.  We support it here in a backward compatible way.
// return "-" for requests that did not receive a response, regardless of protocol
// return HTTP response code when:
//   - protocol is not GRPC
//   - the version running does not supply the GRPC status
//   - the protocol is GRPC but the HTTP transport fails (i.e. an HTTP error is reported, rare).
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
func IsBadSourceTelemetry(lCluster model.LabelValue, clusterOK bool, ns, wl, app string) bool {
	// case1
	if graph.IsOK(ns) && !graph.IsOK(wl) && !graph.IsOK(app) {
		log.Debugf("Skipping bad source telemetry [case 1] [%s] [%s] [%s]", ns, wl, app)
		return true
	}
	// case2
	if graph.IsOK(ns) && clusterOK && !graph.IsOK(string(lCluster)) {
		log.Debugf("Skipping bad source telemetry [case 2] [%s] [%s] [%s] [%s]", ns, wl, app, string(lCluster))
		return true
	}

	return false
}

// IsBadDestTelemetry tests for known issues in generated telemetry given indicative label values.
// 1) During pod lifecycle changes incomplete telemetry may be generated that results in
//    destSvc == destSvcName and no dest workload, where destSvc[Name] is in the form of an IP address.
// 2) destSvc is ok and destCluster is provided but not ok
// 3) no more conditions known
func IsBadDestTelemetry(lCluster model.LabelValue, clusterOK bool, svc, svcName, wl string) bool {
	// case1
	failsEqualsTest := (!graph.IsOK(wl) && graph.IsOK(svc) && graph.IsOK(svcName) && (svc == svcName))
	if failsEqualsTest && badServiceMatcher.MatchString(svcName) {
		log.Debugf("Skipping bad dest telemetry [case 1] [%s] [%s] [%s]", svc, svcName, wl)
		return true
	}
	// case2
	if graph.IsOK(svc) && clusterOK && !graph.IsOK(string(lCluster)) {
		log.Debugf("Skipping bad dest telemetry [case 2] [%s] [%s]", svc, string(lCluster))
		return true
	}
	return false
}
