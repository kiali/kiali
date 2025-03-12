package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	"k8s.io/apimachinery/pkg/util/yaml"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/log"
)

func TestGatewayAsHost(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("mygateway", "bookinfo", conf).String())
	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("bookinfo/mygateway", "bookinfo", conf).String())
	assert.Equal("mygateway.istio-system.svc.cluster.local", ParseGatewayAsHost("istio-system/mygateway", "bookinfo", conf).String())
	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("mygateway.bookinfo", "bookinfo", conf).String())
	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("mygateway.bookinfo", "bookinfo", conf).String())
	assert.Equal("mygateway.bookinfo.svc.cluster.local", ParseGatewayAsHost("mygateway.bookinfo.svc.cluster.local", "bookinfo", conf).String())
}

func TestHasMatchingVirtualServices(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	// Short name service
	assert.True(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []*networking_v1.VirtualService{createVirtualService("bookinfo", []string{"reviews"})}, conf))
	assert.False(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []*networking_v1.VirtualService{createVirtualService("bogus", []string{"reviews"})}, conf))

	// Half-FQDN
	assert.True(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []*networking_v1.VirtualService{createVirtualService("bookinfo", []string{"reviews.bookinfo"})}, conf))
	assert.False(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []*networking_v1.VirtualService{createVirtualService("bogus", []string{"reviews.bogus"})}, conf))

	// FQDN
	assert.True(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []*networking_v1.VirtualService{createVirtualService("bookinfo", []string{"reviews.bookinfo.svc.cluster.local"})}, conf))
	assert.False(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []*networking_v1.VirtualService{createVirtualService("bogus", []string{"reviews.bogus.svc.cluster.local"})}, conf))

	// Wildcard
	assert.True(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []*networking_v1.VirtualService{createVirtualService("bookinfo", []string{"*.bookinfo.svc.cluster.local"})}, conf))
	assert.True(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []*networking_v1.VirtualService{createVirtualService("bookinfo", []string{"*"})}, conf))
	assert.False(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []*networking_v1.VirtualService{createVirtualService("bogus", []string{"*.bogus.svc.cluster.local"})}, conf))

	// External host
	assert.False(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []*networking_v1.VirtualService{createVirtualService("bookinfo", []string{"foo.example.com"})}, conf))
	assert.False(HasMatchingVirtualServices(Host{Service: "reviews", Namespace: "bookinfo", Cluster: "svc.cluster.local"}, []*networking_v1.VirtualService{createVirtualService("bookinfo", []string{"*.foo.example.com"})}, conf))

	assert.True(HasMatchingVirtualServices(Host{Service: "foo.example.com", Namespace: "", Cluster: ""}, []*networking_v1.VirtualService{createVirtualService("bookinfo", []string{"foo.example.com"})}, conf))
	assert.True(HasMatchingVirtualServices(Host{Service: "new.foo.example.com", Namespace: "", Cluster: ""}, []*networking_v1.VirtualService{createVirtualService("bookinfo", []string{"*.foo.example.com"})}, conf))
	assert.True(HasMatchingVirtualServices(Host{Service: "foo.example.com", Namespace: "", Cluster: ""}, []*networking_v1.VirtualService{createVirtualService("bookinfo", []string{"*"})}, conf))
}

func TestHasMatchingReferenceGrant(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	config.Set(conf)

	assert.True(HasMatchingReferenceGrant("bookinfo", "default", K8sHTTPRouteType, ServiceType, []*k8s_networking_v1beta1.ReferenceGrant{createReferenceGrant("test", "default", "bookinfo"), createReferenceGrant("test", "bookinfo2", "bookinfo")}))
	assert.False(HasMatchingReferenceGrant("bookinfo", "test", K8sHTTPRouteType, ServiceType, []*k8s_networking_v1beta1.ReferenceGrant{createReferenceGrant("test", "default", "bookinfo"), createReferenceGrant("test", "bookinfo2", "bookinfo")}))
	assert.False(HasMatchingReferenceGrant("default", "bookinfo", K8sHTTPRouteType, ServiceType, []*k8s_networking_v1beta1.ReferenceGrant{createReferenceGrant("test", "default", "bookinfo"), createReferenceGrant("test", "bookinfo2", "bookinfo")}))
}

func createVirtualService(namespace string, hosts []string) *networking_v1.VirtualService {
	vsYaml := []byte(`
apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: virtual-service 
spec:
  hosts:
  - reviews
  http:
  - route:
    - destination:
        host: reviews
        subset: v2
    timeout: 0.5s
`)
	var vs networking_v1.VirtualService
	err := yaml.Unmarshal(vsYaml, &vs)
	if err != nil {
		log.Error(err)
	}
	vs.Namespace = namespace
	vs.Spec.Hosts = hosts
	return &vs
}

func createReferenceGrant(name string, namespace string, fromNamespace string) *k8s_networking_v1beta1.ReferenceGrant {
	rg := k8s_networking_v1beta1.ReferenceGrant{}
	rg.Name = name
	rg.Namespace = namespace
	rg.Spec.From = append(rg.Spec.From, k8s_networking_v1beta1.ReferenceGrantFrom{Kind: k8s_networking_v1beta1.Kind(K8sHTTPRoutes.Kind), Group: k8s_networking_v1beta1.GroupName, Namespace: k8s_networking_v1.Namespace(fromNamespace)})
	rg.Spec.To = append(rg.Spec.To, k8s_networking_v1beta1.ReferenceGrantTo{Kind: ServiceType})
	return &rg
}
