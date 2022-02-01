package references

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1alpha3 "istio.io/client-go/pkg/apis/networking/v1alpha3"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func prepareTestForVirtualService(vs *networking_v1alpha3.VirtualService) models.IstioReferences {
	virtualServiceReferences := VirtualServiceReferences{
		Namespace: "bookinfo",
		Namespaces: models.Namespaces{
			{Name: "bookinfo"},
			{Name: "bookinfo2"},
			{Name: "bookinfo3"},
		},
		VirtualService: *vs,
	}
	return virtualServiceReferences.References()
}

func TestVirtualServiceReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForVirtualService(fakeVirtualServices())
	assert.NotEmpty(references.ServiceReferences)

	// Check Service references
	assert.Len(references.ServiceReferences, 2)
	assert.Equal(references.ServiceReferences[1].Name, "reviews")
	assert.Equal(references.ServiceReferences[1].Namespace, "bookinfo")
	assert.Equal(references.ServiceReferences[0].Name, "reviews2")
	assert.Equal(references.ServiceReferences[0].Namespace, "bookinfo")
}

func TestVirtualServiceNoReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForVirtualService(data.CreateEmptyVirtualService("reviews-well", "bookinfo", []string{"reviews.prod.svc.cluster.local"}))
	assert.Empty(references.ServiceReferences)
}

func TestVirtualServiceMultipleReferences(t *testing.T) {
	assert := assert.New(t)

	// Setup mocks
	references := prepareTestForVirtualService(fakeVirtualServicesMultipleExported())
	assert.NotEmpty(references.ServiceReferences)

	// Check Service references
	assert.Len(references.ServiceReferences, 3)
	assert.Equal(references.ServiceReferences[0].Name, "reviews")
	assert.Equal(references.ServiceReferences[0].Namespace, "bookinfo")
	assert.Equal(references.ServiceReferences[1].Name, "reviews2")
	assert.Equal(references.ServiceReferences[1].Namespace, "bookinfo2")
	assert.Equal(references.ServiceReferences[2].Name, "reviews3")
	assert.Equal(references.ServiceReferences[2].Namespace, "bookinfo3")
}

func fakeVirtualServices() *networking_v1alpha3.VirtualService {
	validVirtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews.bookinfo.svc.cluster.local", "v1", 55),
		data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews2.bookinfo.svc.cluster.local", "v2", 45),
			data.CreateEmptyVirtualService("reviews-well", "bookinfo", []string{"reviews.prod.svc.cluster.local"}),
		),
	)

	return validVirtualService
}

func fakeVirtualServicesMultipleExported() *networking_v1alpha3.VirtualService {
	virtualService := data.CreateEmptyVirtualService("reviews-multiple", "bookinfo", []string{})
	validVirtualService := data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("reviews.bookinfo.svc.cluster.local", "v1", 33), virtualService)
	validVirtualService = data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("reviews2.bookinfo2.svc.cluster.local", "v2", 33),
		validVirtualService)
	validVirtualService = data.AddTlsRoutesToVirtualService(data.CreateTlsRoute("reviews3.bookinfo3.svc.cluster.local", "v2", 34),
		validVirtualService)

	return validVirtualService
}
