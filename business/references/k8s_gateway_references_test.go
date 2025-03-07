package references

import (
	"testing"

	"github.com/stretchr/testify/assert"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestK8sGatewayReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	gw := data.CreateEmptyK8sGateway("bookinfo", "bookinfo")

	r1 := data.CreateHTTPRoute("details", "bookinfo", gw.Name, []string{})
	r2 := data.CreateEmptyHTTPRoute("httpbin", "default", []string{})
	r3 := data.CreateGRPCRoute("details", "bookinfo", gw.Name, []string{})
	r4 := data.CreateEmptyGRPCRoute("grpcbin", "default", []string{})

	gatewayReferences := K8sGatewayReferences{
		K8sGateways:   []*k8s_networking_v1.Gateway{gw},
		K8sHTTPRoutes: []*k8s_networking_v1.HTTPRoute{r1, r2},
		K8sGRPCRoutes: []*k8s_networking_v1.GRPCRoute{r3, r4},
		WorkloadsPerNamespace: map[string]models.Workloads{
			"bookinfo": {
				data.CreateWorkload("bookinfo", map[string]string{conf.IstioLabels.AmbientWaypointGatewayLabel: "bookinfo"}),
			},
			"test": {
				data.CreateWorkload("test", map[string]string{conf.IstioLabels.AmbientWaypointGatewayLabel: "bookinfo"}),
			}},
	}

	references := gatewayReferences.References()
	gateway := references[models.IstioReferenceKey{ObjectGVK: kubernetes.K8sGateways, Namespace: "bookinfo", Name: "bookinfo"}]

	assert.Len(gateway.WorkloadReferences, 1)
	assert.Equal(gateway.WorkloadReferences[0].Name, "bookinfo")
	assert.Equal(gateway.WorkloadReferences[0].Namespace, "bookinfo")

	assert.Len(gateway.ObjectReferences, 2)
	assert.Equal(gateway.ObjectReferences[0].Name, "details")
	assert.Equal(gateway.ObjectReferences[0].Namespace, "bookinfo")
	assert.Equal(gateway.ObjectReferences[1].Name, "details")
	assert.Equal(gateway.ObjectReferences[1].Namespace, "bookinfo")
}

func TestK8sGatewayNoReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	gw := data.CreateEmptyK8sGateway("bookinfo", "bookinfo")

	r := data.CreateEmptyHTTPRoute("httpbin", "default", []string{})
	r2 := data.CreateEmptyGRPCRoute("grpcbin", "default", []string{})

	gatewayReferences := K8sGatewayReferences{
		K8sGateways:   []*k8s_networking_v1.Gateway{gw},
		K8sHTTPRoutes: []*k8s_networking_v1.HTTPRoute{r},
		K8sGRPCRoutes: []*k8s_networking_v1.GRPCRoute{r2},
	}

	references := gatewayReferences.References()
	gateway := references[models.IstioReferenceKey{ObjectGVK: kubernetes.K8sGateways, Namespace: "bookinfo", Name: "bookinfo"}]

	assert.Empty(gateway.WorkloadReferences)
	assert.Empty(gateway.ObjectReferences)
}
