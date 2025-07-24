package business

/*
	This file contains helper methods for unit testing with the business package.
	The utilities in this file are not meant to be used outside of unit tests.
*/

import (
	"testing"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/tracing"
)

// layerBuilder is a helper for building a Layer for testing.
// It is used to create a Layer with the necessary dependencies for testing.
// It is not meant to be used outside of unit tests.
// You must call either WithClient or WithClients to set the clients but everything else is optional.
// You can chain the methods to set the dependencies and call Build() at the end to create the Layer.
// Example:
//
//	layer := NewLayerBuilder(t, conf).WithClient(k8s).Build()
//
//	layer := NewLayerBuilder(t, conf).WithClients(clients).WithProm(prom).Build()
type layerBuilder struct {
	t              testing.TB
	userClients    map[string]kubernetes.UserClientInterface
	kialiSAClients map[string]kubernetes.ClientInterface
	prom           prometheus.ClientInterface
	tracingLoader  func() tracing.ClientInterface
	cache          cache.KialiCache
	conf           *config.Config
	grafana        *grafana.Service
	discovery      istio.MeshDiscovery
	cpm            ControlPlaneMonitor
}

// NewLayerBuilder creates a new layerBuilder with the given config.
func NewLayerBuilder(t testing.TB, conf *config.Config) *layerBuilder {
	return &layerBuilder{
		t:             t,
		conf:          conf,
		tracingLoader: func() tracing.ClientInterface { return nil },
	}
}

// WithClient sets the user client for the layer. Use this for single cluster.
func (lb *layerBuilder) WithClient(k8s kubernetes.UserClientInterface) *layerBuilder {
	clients := map[string]kubernetes.UserClientInterface{lb.conf.KubernetesConfig.ClusterName: k8s}
	lb.userClients = clients
	lb.kialiSAClients = kubernetes.ConvertFromUserClients(clients)
	return lb
}

// WithClients sets both user and SA clients for the layer. Use this for multi-cluster.
func (lb *layerBuilder) WithClients(clients map[string]kubernetes.UserClientInterface) *layerBuilder {
	lb.userClients = clients
	lb.kialiSAClients = kubernetes.ConvertFromUserClients(clients)
	return lb
}

// WithCache sets the cache for the layer.
func (lb *layerBuilder) WithCache(cache cache.KialiCache) *layerBuilder {
	lb.cache = cache
	return lb
}

// WithDiscovery sets the discovery for the layer.
func (lb *layerBuilder) WithDiscovery(discovery istio.MeshDiscovery) *layerBuilder {
	lb.discovery = discovery
	return lb
}

// WithTraceLoader sets the trace loader for the layer.
func (lb *layerBuilder) WithTraceLoader(traceLoader func() tracing.ClientInterface) *layerBuilder {
	lb.tracingLoader = traceLoader
	return lb
}

// WithProm sets the prometheus client for the layer.
func (lb *layerBuilder) WithProm(prom prometheus.ClientInterface) *layerBuilder {
	lb.prom = prom
	return lb
}

// Build creates a new Layer with the given dependencies.
// If you did not call WithClient or WithClients, the layerBuilder will fail the test.
func (lb *layerBuilder) Build() *Layer {
	lb.t.Helper()
	if lb.userClients == nil && lb.kialiSAClients == nil {
		lb.t.Fatalf("You must call either WithClient or WithClients to set the clients")
		return nil
	}

	if lb.cache == nil {
		lb.cache = cache.NewTestingCacheWithClients(lb.t, lb.kialiSAClients, *lb.conf)
	}
	if lb.cpm == nil {
		lb.cpm = &FakeControlPlaneMonitor{}
	}
	if lb.discovery == nil {
		lb.discovery = istio.NewDiscovery(lb.kialiSAClients, lb.cache, lb.conf)
	}
	if lb.grafana == nil {
		lb.grafana = grafana.NewService(lb.conf, lb.userClients[lb.conf.KubernetesConfig.ClusterName])
	}
	return newLayer(lb.userClients, lb.kialiSAClients, lb.prom, lb.tracingLoader(), lb.cache, lb.conf, lb.grafana, lb.discovery, lb.cpm)
}
