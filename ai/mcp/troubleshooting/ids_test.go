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
	assert.Equal(t, "dp-ztunnel", idDataPlaneZtunnel)
	assert.Equal(t, "dp-ztunnel-ds", idDataPlaneZtunnelDS)

	assert.Equal(t, "obs-001", idObservability)
	assert.Equal(t, "obs-grafana", observabilityComponentID("Grafana"))

	assert.Equal(t, "istio-001", idIstioConfig)
	assert.Equal(t, "istio-bookinfo-destinationrule-details", istioObjectID("bookinfo", "DestinationRule", "details"))
	assert.Equal(t, "istio-bookinfo-virtualservice-reviews", istioObjectID("bookinfo", "VirtualService", "reviews"))

	assert.Equal(t, "conn-001", idConnectivity)
	assert.Equal(t, "conn-istio-system-kiali-istio-system-grafana", connectivityEdgeID("istio-system/kiali", "istio-system/Grafana"))
}
