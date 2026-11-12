package troubleshooting

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIssueIDs(t *testing.T) {
	assert.Equal(t, "cp-001", idControlPlane)
	assert.Equal(t, "cp-kubernetes-istio-system-istiod", controlPlaneNodeID("Kubernetes", "istio-system", "istiod"))
	assert.Equal(t, "cp-status", idControlPlaneStatus)

	assert.Equal(t, "dp-kubernetes-bookinfo", dataPlaneNamespaceID("Kubernetes", "bookinfo"))
	assert.Equal(t, "dp-kubernetes-bookinfo-ns", dataPlaneNamespaceSubProblemID("Kubernetes", "bookinfo"))
	assert.Equal(t, "dp-kubernetes-bookinfo-service-ratings", dataPlaneResourceID("Kubernetes", "bookinfo", "service", "ratings"))
	assert.Equal(t, "dp-kubernetes-bookinfo-config-service-ratings", dataPlaneConfigID("Kubernetes", "bookinfo", "service", "ratings"))
	assert.Equal(t, "dp-ztunnel", idDataPlaneZtunnel)
	assert.Equal(t, "dp-ztunnel-ds", idDataPlaneZtunnelDS)
	assert.Equal(t, "dp-ztunnel-pod-ztunnel-abc", dataPlaneZtunnelPodID("ztunnel-abc"))

	assert.Equal(t, "mesh-kubernetes-bookinfo-xds-reviews-v1", meshSyncID("Kubernetes", "bookinfo", "reviews-v1"))
	assert.Equal(t, "mesh-kubernetes-bookinfo-sidecar-reviews-v1", meshSidecarInjectionID("Kubernetes", "bookinfo", "reviews-v1"))
	assert.Equal(t, "mesh-kubernetes-bookinfo-version-reviews-v1", meshProxyVersionID("Kubernetes", "bookinfo", "reviews-v1"))

	assert.Equal(t, "k8s-kubernetes-bookinfo-reviews-v1-reviews-v1-pod", k8sPodLifecycleID("Kubernetes", "bookinfo", "reviews-v1", "reviews-v1-pod"))
	assert.Equal(t, "k8s-kubernetes-bookinfo-endpoints-reviews", k8sServiceEndpointsID("Kubernetes", "bookinfo", "reviews"))

	assert.Equal(t, "obs-001", idObservability)
	assert.Equal(t, "obs-grafana", observabilityComponentID("Grafana"))

	assert.Equal(t, "istio-001", idIstioConfig)
	assert.Equal(t, "istio-bookinfo-destinationrule-details", istioObjectID("bookinfo", "DestinationRule", "details"))
	assert.Equal(t, "istio-bookinfo-virtualservice-reviews", istioObjectID("bookinfo", "VirtualService", "reviews"))

	assert.Equal(t, "sec-001", idSecurity)
	assert.Equal(t, "sec-ambient-bookinfo-authorizationpolicy-allow-reviews", securityAmbientPolicyID("bookinfo", "AuthorizationPolicy", "allow-reviews"))
	assert.Equal(t, "sec-mtls-kubernetes-bookinfo", securityNamespaceMTLSID("Kubernetes", "bookinfo"))
	assert.Equal(t, "sec-plaintext-bookinfo-productpage-reviews", securityPlaintextEdgeID("bookinfo", "productpage", "reviews"))

	assert.Equal(t, "traffic-001", idTraffic)
	assert.Equal(t, "traffic-edge-bookinfo-productpage-reviews-v2", trafficEdgeID("bookinfo", "productpage", "reviews (v2)"))
	assert.Equal(t, "traffic-latency-bookinfo-productpage-reviews", trafficLatencyID("bookinfo", "productpage", "reviews"))
	assert.Equal(t, "traffic-egress-bookinfo-ratings-blackholecluster", trafficEgressID("bookinfo", "ratings", "BlackHoleCluster"))

	assert.Equal(t, "conn-001", idConnectivity)
	assert.Equal(t, "conn-istio-system-kiali-istio-system-grafana", connectivityEdgeID("istio-system/kiali", "istio-system/Grafana"))
}
