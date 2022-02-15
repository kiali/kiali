package references

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func prepareTestForGateway(gw *networking_v1alpha3.Gateway) models.IstioReferences {
	gwReferences := GatewayReferences{
		Gateways: []networking_v1alpha3.Gateway{*gw},
		WorkloadsPerNamespace: map[string]models.WorkloadList{
			"test": data.CreateWorkloadList("istio-system",
				data.CreateWorkloadListItem("istio-ingressgateway", map[string]string{"istio": "ingressgateway"})),
		},
	}
	return *gwReferences.References()[models.IstioReferenceKey{ObjectType: "gateway", Namespace: gw.Namespace, Name: gw.Name}]
}

func TestGatewayReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForGateway(fakeGateway(t))

	// Check Workload references
	assert.Len(references.WorkloadReferences, 1)
	assert.Equal(references.WorkloadReferences[0].Name, "istio-ingressgateway")
	assert.Equal(references.WorkloadReferences[0].Namespace, "istio-system")
}

func TestGatewayNoWorkloadReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForGateway(data.CreateEmptyGateway("reviews", "bookinfo", map[string]string{"wrong": "selector"}))
	assert.Empty(references.WorkloadReferences)
}

func fakeGateway(t *testing.T) *networking_v1alpha3.Gateway {
	gwObject := data.CreateEmptyGateway("gateway", "istio-system", map[string]string{
		"istio": "ingressgateway",
	})

	return gwObject
}
