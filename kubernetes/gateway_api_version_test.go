package kubernetes

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	discoveryfake "k8s.io/client-go/discovery/fake"
	"k8s.io/client-go/kubernetes/fake"
	gatewayapifake "sigs.k8s.io/gateway-api/pkg/client/clientset/versioned/fake"
)

func newTestK8SClientWithGatewayAPIResourceLists(resourceLists ...*metav1.APIResourceList) *K8SClient {
	cs := fake.NewSimpleClientset()
	fd := cs.Discovery().(*discoveryfake.FakeDiscovery)
	if len(resourceLists) > 0 {
		fd.Resources = resourceLists
	}
	return &K8SClient{
		ctx:        context.Background(),
		gatewayapi: gatewayapifake.NewSimpleClientset(),
		k8s:        cs,
	}
}

func newTestK8SClientWithGatewayAPIResources(apiResources []metav1.APIResource) *K8SClient {
	if len(apiResources) == 0 {
		return newTestK8SClientWithGatewayAPIResourceLists()
	}
	return newTestK8SClientWithGatewayAPIResourceLists(&metav1.APIResourceList{
		GroupVersion: K8sNetworkingGroupVersionV1.String(),
		APIResources: apiResources,
	})
}

func TestCheckGatewayAPIs(t *testing.T) {
	t.Run("returns false when group version is not registered", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResourceLists()
		assert.False(t, checkGatewayAPIs(client, K8sNetworkingGroupVersionV1.String(), map[string]string{
			K8sTCPRouteType: PluralNames[K8sTCPRouteType],
		}, true))
	})

	t.Run("returns false when kind matches but plural name does not", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResources([]metav1.APIResource{
			{Kind: K8sTCPRouteType, Name: "tcproute"},
		})
		assert.False(t, checkGatewayAPIs(client, K8sNetworkingGroupVersionV1.String(), map[string]string{
			K8sTCPRouteType: PluralNames[K8sTCPRouteType],
		}, true))
	})

	t.Run("returns false when only some required types are present", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResources([]metav1.APIResource{
			{Kind: K8sGatewayType, Name: PluralNames[K8sGatewayType]},
		})
		v1Types := map[string]string{
			K8sGatewayType:   PluralNames[K8sGatewayType],
			K8sHTTPRouteType: PluralNames[K8sHTTPRouteType],
		}
		assert.False(t, checkGatewayAPIs(client, K8sNetworkingGroupVersionV1.String(), v1Types, false))
	})

	t.Run("returns true when all required types are present", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResources([]metav1.APIResource{
			{Kind: K8sGatewayType, Name: PluralNames[K8sGatewayType]},
			{Kind: K8sHTTPRouteType, Name: PluralNames[K8sHTTPRouteType]},
		})
		v1Types := map[string]string{
			K8sGatewayType:   PluralNames[K8sGatewayType],
			K8sHTTPRouteType: PluralNames[K8sHTTPRouteType],
		}
		assert.True(t, checkGatewayAPIs(client, K8sNetworkingGroupVersionV1.String(), v1Types, false))
	})
}

func TestHasTCPRouteInV1(t *testing.T) {
	t.Run("returns false when Gateway API client is nil", func(t *testing.T) {
		client := &K8SClient{ctx: context.Background()}
		assert.False(t, client.HasTCPRouteInV1())
	})

	t.Run("returns false when discovery has no gateway.networking.k8s.io/v1 resources", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResourceLists()
		assert.False(t, client.HasTCPRouteInV1())
	})

	t.Run("returns false when TCPRoute CRD is not registered in v1", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResources([]metav1.APIResource{
			{Kind: K8sHTTPRouteType, Name: PluralNames[K8sHTTPRouteType]},
		})
		assert.False(t, client.HasTCPRouteInV1())
	})

	t.Run("returns false when TCPRoute plural name does not match", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResources([]metav1.APIResource{
			{Kind: K8sTCPRouteType, Name: "tcproute"},
		})
		assert.False(t, client.HasTCPRouteInV1())
	})

	t.Run("returns true when TCPRoute exists in gateway.networking.k8s.io/v1", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResources([]metav1.APIResource{
			{Kind: K8sTCPRouteType, Name: PluralNames[K8sTCPRouteType]},
		})
		assert.True(t, client.HasTCPRouteInV1())
		assert.True(t, client.HasTCPRouteInV1(), "result should be cached on subsequent calls")
	})
}

func TestHasUDPRouteInV1(t *testing.T) {
	t.Run("returns false when Gateway API client is nil", func(t *testing.T) {
		client := &K8SClient{ctx: context.Background()}
		assert.False(t, client.HasUDPRouteInV1())
	})

	t.Run("returns false when discovery has no gateway.networking.k8s.io/v1 resources", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResourceLists()
		assert.False(t, client.HasUDPRouteInV1())
	})

	t.Run("returns false when UDPRoute CRD is not registered in v1", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResources([]metav1.APIResource{
			{Kind: K8sTCPRouteType, Name: PluralNames[K8sTCPRouteType]},
		})
		assert.False(t, client.HasUDPRouteInV1())
	})

	t.Run("returns false when UDPRoute plural name does not match", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResources([]metav1.APIResource{
			{Kind: K8sUDPRouteType, Name: "udproute"},
		})
		assert.False(t, client.HasUDPRouteInV1())
	})

	t.Run("returns true when UDPRoute exists in gateway.networking.k8s.io/v1", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResources([]metav1.APIResource{
			{Kind: K8sUDPRouteType, Name: PluralNames[K8sUDPRouteType]},
		})
		assert.True(t, client.HasUDPRouteInV1())
		assert.True(t, client.HasUDPRouteInV1(), "result should be cached on subsequent calls")
	})
}

func TestHasTCPRouteInV1_and_HasUDPRouteInV1_areIndependent(t *testing.T) {
	t.Run("only TCPRoute present", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResources([]metav1.APIResource{
			{Kind: K8sTCPRouteType, Name: PluralNames[K8sTCPRouteType]},
		})
		assert.True(t, client.HasTCPRouteInV1())
		assert.False(t, client.HasUDPRouteInV1())
	})

	t.Run("only UDPRoute present", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResources([]metav1.APIResource{
			{Kind: K8sUDPRouteType, Name: PluralNames[K8sUDPRouteType]},
		})
		assert.False(t, client.HasTCPRouteInV1())
		assert.True(t, client.HasUDPRouteInV1())
	})

	t.Run("both TCPRoute and UDPRoute present", func(t *testing.T) {
		client := newTestK8SClientWithGatewayAPIResources([]metav1.APIResource{
			{Kind: K8sTCPRouteType, Name: PluralNames[K8sTCPRouteType]},
			{Kind: K8sUDPRouteType, Name: PluralNames[K8sUDPRouteType]},
		})
		assert.True(t, client.HasTCPRouteInV1())
		assert.True(t, client.HasUDPRouteInV1())
	})
}
