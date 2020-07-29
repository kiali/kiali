package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/config"
)

func TestGatewayAsHost(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("mygateway", "bookinfo", "svc.cluster.local").String())
	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("bookinfo/mygateway", "bookinfo", "svc.cluster.local").String())
	assert.Equal("mygateway.istio-system.svc.cluster.local", ParseGatewayAsHost("istio-system/mygateway", "bookinfo", "svc.cluster.local").String())
	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("mygateway.bookinfo", "bookinfo", "svc.cluster.local").String())
	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("mygateway.bookinfo", "bookinfo", "svc.cluster.local").String())
	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("mygateway.bookinfo.svc.cluster.local", "bookinfo", "svc.cluster.local").String())
}

func TestHasMatchingVirtualServices(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	// Short name service
	assert.True(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []IstioObject{createVirtualService("bookinfo", []string{"reviews"})}))
	assert.False(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []IstioObject{createVirtualService("bogus", []string{"reviews"})}))

	// Half-FQDN
	assert.True(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []IstioObject{createVirtualService("bookinfo", []string{"reviews.bookinfo"})}))
	assert.False(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []IstioObject{createVirtualService("bogus", []string{"reviews.bogus"})}))

	// FQDN
	assert.True(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []IstioObject{createVirtualService("bookinfo", []string{"reviews.bookinfo.svc.cluster.local"})}))
	assert.False(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []IstioObject{createVirtualService("bogus", []string{"reviews.bogus.svc.cluster.local"})}))

	// Wildcard
	assert.True(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []IstioObject{createVirtualService("bookinfo", []string{"*.bookinfo.svc.cluster.local"})}))
	assert.True(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []IstioObject{createVirtualService("bookinfo", []string{"*"})}))
	assert.False(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []IstioObject{createVirtualService("bogus", []string{"*.bogus.svc.cluster.local"})}))

	// External host
	assert.False(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []IstioObject{createVirtualService("bookinfo", []string{"foo.example.com"})}))
	assert.False(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []IstioObject{createVirtualService("bookinfo", []string{"*.foo.example.com"})}))

	assert.True(HasMatchingVirtualServices(Host{Service: "foo.example.com", Namespace: "", Cluster: ""}, []IstioObject{createVirtualService("bookinfo", []string{"foo.example.com"})}))
	assert.True(HasMatchingVirtualServices(Host{Service: "new.foo.example.com", Namespace: "", Cluster: ""}, []IstioObject{createVirtualService("bookinfo", []string{"*.foo.example.com"})}))
	assert.True(HasMatchingVirtualServices(Host{Service: "foo.example.com", Namespace: "", Cluster: ""}, []IstioObject{createVirtualService("bookinfo", []string{"*"})}))
}

func createVirtualService(namespace string, hosts []string) IstioObject {
	return (&GenericIstioObject{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:        "virtual-service",
			Namespace:   namespace,
			ClusterName: "svc.cluster.local",
		},
		Spec: map[string]interface{}{
			"hosts": hosts,
		},
	}).DeepCopyIstioObject()
}
