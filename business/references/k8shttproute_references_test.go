package references

import (
	"testing"

	"github.com/stretchr/testify/assert"

	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func prepareTestForK8sHTTPRoute(route *k8s_networking_v1.HTTPRoute) models.IstioReferences {
	routeReferences := K8sHTTPRouteReferences{
		Conf:               config.Get(),
		Namespaces:         []string{"bookinfo", "bookinfo2", "bookinfo3"},
		K8sHTTPRoutes:      []*k8s_networking_v1.HTTPRoute{route},
		K8sReferenceGrants: []*k8s_networking_v1beta1.ReferenceGrant{data.CreateReferenceGrant("rg", route.Namespace, "bookinfo")},
	}
	return *routeReferences.References()[models.IstioReferenceKey{ObjectGVK: kubernetes.K8sHTTPRoutes, Namespace: route.Namespace, Name: route.Name}]
}

func TestK8sHTTPRouteReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForK8sHTTPRoute(data.AddBackendRefToHTTPRoute("reviews2", "bookinfo2", data.AddBackendRefToHTTPRoute("reviews", "bookinfo", data.CreateHTTPRoute("route1", "bookinfo", "gatewayapi", []string{"bookinfo"}))))
	assert.NotEmpty(references.ServiceReferences)

	// Check Service references
	assert.Len(references.ServiceReferences, 2)
	assert.Equal(references.ServiceReferences[0].Name, "reviews")
	assert.Equal(references.ServiceReferences[0].Namespace, "bookinfo")
	assert.Equal(references.ServiceReferences[1].Name, "reviews2")
	assert.Equal(references.ServiceReferences[1].Namespace, "bookinfo2")

	assert.Len(references.ObjectReferences, 2)
	// Check Gateway references
	assert.Equal(references.ObjectReferences[0].Name, "gatewayapi")
	assert.Equal(references.ObjectReferences[0].Namespace, "bookinfo")
	assert.Equal(references.ObjectReferences[0].ObjectGVK.String(), kubernetes.K8sGateways.String())
	// Reference Grant
	assert.Equal(references.ObjectReferences[1].Name, "rg")
	assert.Equal(references.ObjectReferences[1].Namespace, "bookinfo")
	assert.Equal(references.ObjectReferences[1].ObjectGVK.String(), kubernetes.K8sReferenceGrants.String())
}

func TestK8sHTTPRouteNoReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Setup mocks
	references := prepareTestForK8sHTTPRoute(data.CreateEmptyHTTPRoute("route1", "bookinfo", []string{"details"}))
	assert.Empty(references.ServiceReferences)
}
