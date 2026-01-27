package appender

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

const (
	rateDefinition         = "400,10,20,http,inbound"
	rateWorkloadDefinition = "4xx,20,30,http,inbound"
)

func TestServicesHealthConfigPasses(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	trafficMap := buildServiceTrafficMap()
	businessLayer := setupHealthConfig(t, buildFakeServicesHealth(rateDefinition), buildFakeWorkloadDeploymentsHealth(rateWorkloadDefinition), buildFakePodsHealth(rateWorkloadDefinition))

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo("testNamespace")

	a := HealthAppender{}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		srv, ok := node.Metadata[graph.HasHealthConfig].(map[string]string)
		assert.True(t, ok)
		assert.Equal(t, rateDefinition, srv[string(models.RateHealthAnnotation)])
	}
}

func TestServicesHealthNoConfigPasses(t *testing.T) {
	trafficMap := buildServiceTrafficMap()
	businessLayer := setupHealthConfig(t, buildFakeServicesHealth(""), buildFakeWorkloadDeploymentsHealth(""), buildFakePodsHealth(""))

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo("testNamespace")

	a := HealthAppender{}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		srv, ok := node.Metadata[graph.HasHealthConfig].(map[string]string)
		assert.True(t, ok)
		assert.Equal(t, "", srv[string(models.RateHealthAnnotation)])
	}
}

func TestWorkloadHealthConfigPasses(t *testing.T) {
	trafficMap := buildWorkloadTrafficMap()
	businessLayer := setupHealthConfig(t, buildFakeServicesHealth(rateDefinition), buildFakeWorkloadDeploymentsHealth(rateWorkloadDefinition), buildFakePodsHealth(rateWorkloadDefinition))

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo("testNamespace")

	a := HealthAppender{}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		srv, ok := node.Metadata[graph.HasHealthConfig].(map[string]string)
		assert.True(t, ok)
		assert.Equal(t, rateWorkloadDefinition, srv[string(models.RateHealthAnnotation)])
	}
}

func TestWorkloadHealthNoConfigPasses(t *testing.T) {
	trafficMap := buildWorkloadTrafficMap()
	businessLayer := setupHealthConfig(t, buildFakeServicesHealth(""), buildFakeWorkloadDeploymentsHealth(""), buildFakePodsHealth(""))

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo("testNamespace")

	a := HealthAppender{}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		srv, ok := node.Metadata[graph.HasHealthConfig].(map[string]string)
		assert.True(t, ok)
		assert.Equal(t, "", srv[string(models.RateHealthAnnotation)])
	}
}

func TestHealthDataPresent(t *testing.T) {
	assert := assert.New(t)

	svcNodes := buildServiceTrafficMap()
	appNodes := buildAppTrafficMap()
	wkNodes := buildWorkloadTrafficMap()
	trafficMap := make(graph.TrafficMap)
	for k, v := range svcNodes {
		trafficMap[k] = v
	}
	for k, v := range appNodes {
		trafficMap[k] = v
	}
	for k, v := range wkNodes {
		trafficMap[k] = v
	}
	businessLayer := setupHealthConfig(t, buildFakeServicesHealth(rateDefinition), buildFakeWorkloadDeploymentsHealth(rateWorkloadDefinition), buildFakePodsHealth(rateWorkloadDefinition))

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo("testNamespace")

	a := HealthAppender{}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		assert.Contains(node.Metadata, graph.HealthData)
	}
}

func TestHealthDataPresent200SvcWk(t *testing.T) {
	assert := assert.New(t)

	svcNodes := buildServiceTrafficMap()
	appNodes := buildAppTrafficMap()
	wkNodes := buildWorkloadTrafficMap()
	trafficMap := make(graph.TrafficMap)
	var (
		svc *graph.Node
		wk  *graph.Node
	)
	for k, v := range svcNodes {
		trafficMap[k] = v
		svc = v
	}
	for k, v := range appNodes {
		trafficMap[k] = v
	}
	for k, v := range wkNodes {
		trafficMap[k] = v
		wk = v
	}
	edge := svc.AddEdge(wk)
	/* Example of edge data:
	{
	 	"traffic": {
	 		"protocol": "http",
	 		"rates": {
	 			"http": "1.93",
	 			"httpPercentReq": "100.0"
	 		},
	 		"responses": {
	 			"200": {
	 				"flags": {
	 					"-": "100.0"
	 				},
	 				"hosts": {
	 					"v-server.beta.svc.cluster.local": "100.0"
	 				}
	 			}
	 		}
	 	}
	 }
	*/
	edge.Metadata[graph.ProtocolKey] = "http"
	edge.Metadata[graph.MetadataKey(graph.HTTP.EdgeResponses)] = graph.Responses{
		"200": &graph.ResponseDetail{
			Flags: graph.ResponseFlags{"-": 100.0},
			Hosts: map[string]float64{"v-server.beta.svc.cluster.local": 100.0},
		},
	}
	businessLayer := setupHealthConfig(t, buildFakeServicesHealth(rateDefinition), buildFakeWorkloadDeploymentsHealth(rateWorkloadDefinition), buildFakePodsHealth(rateWorkloadDefinition))

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo("testNamespace")

	a := HealthAppender{}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		assert.Contains(node.Metadata, graph.HealthData)
	}
	source := trafficMap[svc.ID]
	sourceHealth := source.Metadata[graph.HealthData].(*models.ServiceHealth)
	assert.Equal(sourceHealth.Requests.Outbound["http"]["200"], 100.0)

	dest := trafficMap[wk.ID]
	destHealth := dest.Metadata[graph.HealthData].(*models.WorkloadHealth)
	assert.Equal(destHealth.Requests.Inbound["http"]["200"], 100.0)
}

func TestHealthDataPresent200500WkSvc(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	svcNodes := buildServiceTrafficMap()
	appNodes := buildAppTrafficMap()
	wkNodes := buildWorkloadTrafficMap()
	trafficMap := make(graph.TrafficMap)
	var (
		svc *graph.Node
		wk  *graph.Node
	)
	for k, v := range svcNodes {
		trafficMap[k] = v
		svc = v
	}
	for k, v := range appNodes {
		trafficMap[k] = v
	}
	for k, v := range wkNodes {
		trafficMap[k] = v
		wk = v
	}
	edge := wk.AddEdge(svc)
	edge.Metadata[graph.ProtocolKey] = "http"
	edge.Metadata[graph.MetadataKey(graph.HTTP.EdgeResponses)] = graph.Responses{
		"200": &graph.ResponseDetail{
			Flags: graph.ResponseFlags{"-": 100.0},
			Hosts: map[string]float64{"v-server.beta.svc.cluster.local": 100.0},
		},
		"500": &graph.ResponseDetail{
			Flags: graph.ResponseFlags{"-": 10.0},
			Hosts: map[string]float64{"v-server.beta.svc.cluster.local": 10.0},
		},
	}
	businessLayer := setupHealthConfig(t, buildFakeServicesHealth(rateDefinition), buildFakeWorkloadDeploymentsHealth(rateWorkloadDefinition), buildFakePodsHealth(rateWorkloadDefinition))

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo("testNamespace")

	a := HealthAppender{}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		assert.Contains(node.Metadata, graph.HealthData)
	}
	source := trafficMap[wk.ID]
	sourceHealth := source.Metadata[graph.HealthData].(*models.WorkloadHealth)
	assert.Equal(sourceHealth.Requests.Outbound["http"]["200"], 100.0)
	assert.Equal(sourceHealth.Requests.Outbound["http"]["500"], 10.0)

	dest := trafficMap[svc.ID]
	destHealth := dest.Metadata[graph.HealthData].(*models.ServiceHealth)
	assert.Equal(destHealth.Requests.Inbound["http"]["200"], 100.0)
	assert.Equal(destHealth.Requests.Inbound["http"]["500"], 10.0)
}

func TestHealthDataPresentToApp(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	svcNodes := buildServiceTrafficMap()
	appNodes := buildAppTrafficMap()
	wkNodes := buildWorkloadTrafficMap()
	trafficMap := make(graph.TrafficMap)
	var (
		svc *graph.Node
		app *graph.Node
	)
	for k, v := range svcNodes {
		trafficMap[k] = v
		svc = v
	}
	for k, v := range appNodes {
		trafficMap[k] = v
		app = v
	}
	for k, v := range wkNodes {
		trafficMap[k] = v
	}
	edge := svc.AddEdge(app)
	edge.Metadata[graph.ProtocolKey] = "http"
	edge.Metadata[graph.MetadataKey(graph.HTTP.EdgeResponses)] = graph.Responses{
		"200": &graph.ResponseDetail{
			Flags: graph.ResponseFlags{"-": 100.0},
			Hosts: map[string]float64{"v-server.beta.svc.cluster.local": 100.0},
		},
	}
	businessLayer := setupHealthConfig(t, buildFakeServicesHealth(rateDefinition), buildFakeWorkloadDeploymentsHealth(rateWorkloadDefinition), buildFakePodsHealth(rateWorkloadDefinition))

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo("testNamespace")

	a := HealthAppender{}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		assert.Contains(node.Metadata, graph.HealthData)
	}
	source := trafficMap[svc.ID]
	sourceHealth := source.Metadata[graph.HealthData].(*models.ServiceHealth)
	assert.Equal(sourceHealth.Requests.Outbound["http"]["200"], 100.0)

	dest := trafficMap[app.ID]
	destHealth := dest.Metadata[graph.HealthData].(*models.AppHealth)
	assert.Equal(destHealth.Requests.Inbound["http"]["200"], 100.0)
}

func TestHealthDataPresentFromApp(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	svcNodes := buildServiceTrafficMap()
	appNodes := buildAppTrafficMap()
	wkNodes := buildWorkloadTrafficMap()
	trafficMap := make(graph.TrafficMap)
	var (
		svc *graph.Node
		app *graph.Node
	)
	for k, v := range svcNodes {
		trafficMap[k] = v
		svc = v
	}
	for k, v := range appNodes {
		trafficMap[k] = v
		app = v
	}
	for k, v := range wkNodes {
		trafficMap[k] = v
		app.Workload = v.Workload
	}
	edge := app.AddEdge(svc)
	edge.Metadata[graph.ProtocolKey] = "http"
	edge.Metadata[graph.MetadataKey(graph.HTTP.EdgeResponses)] = graph.Responses{
		"200": &graph.ResponseDetail{
			Flags: graph.ResponseFlags{"-": 100.0},
			Hosts: map[string]float64{"v-server.beta.svc.cluster.local": 100.0},
		},
	}
	businessLayer := setupHealthConfig(t, buildFakeServicesHealth(rateDefinition), buildFakeWorkloadDeploymentsHealth(rateWorkloadDefinition), buildFakePodsHealth(rateWorkloadDefinition))

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo("testNamespace")

	a := HealthAppender{}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		assert.Contains(node.Metadata, graph.HealthData)
	}
	source := trafficMap[app.ID]
	sourceHealth := source.Metadata[graph.HealthData].(*models.AppHealth)
	assert.Equal(sourceHealth.Requests.Outbound["http"]["200"], 100.0)
	assert.Contains(source.Metadata, graph.HealthDataApp)
	sourceAppHealth := source.Metadata[graph.HealthDataApp].(*models.AppHealth)
	assert.Equal(sourceAppHealth.Requests.Outbound["http"]["200"], 100.0)

	dest := trafficMap[svc.ID]
	destHealth := dest.Metadata[graph.HealthData].(*models.ServiceHealth)
	assert.Equal(destHealth.Requests.Inbound["http"]["200"], 100.0)
}

func TestHealthDataBadResponses(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	svcNodes := buildServiceTrafficMap()
	appNodes := buildAppTrafficMap()
	wkNodes := buildWorkloadTrafficMap()
	trafficMap := make(graph.TrafficMap)
	var (
		svc *graph.Node
		wk  *graph.Node
		app *graph.Node
	)
	for k, v := range svcNodes {
		trafficMap[k] = v
		svc = v
	}
	for k, v := range appNodes {
		trafficMap[k] = v
		app = v
	}
	for k, v := range wkNodes {
		trafficMap[k] = v
		wk = v
	}
	edge1 := app.AddEdge(svc)
	edge1.Metadata[graph.ProtocolKey] = "badprotocol"
	edge1.Metadata[graph.MetadataKey("badprotocol")] = graph.Responses{
		"200": &graph.ResponseDetail{
			Flags: graph.ResponseFlags{"-": 100.0},
			Hosts: map[string]float64{"v-server.beta.svc.cluster.local": 100.0},
		},
	}
	edge2 := wk.AddEdge(svc)
	edge2.Metadata[graph.ProtocolKey] = 20000
	businessLayer := setupHealthConfig(t, buildFakeServicesHealth(rateDefinition), buildFakeWorkloadDeploymentsHealth(rateWorkloadDefinition), buildFakePodsHealth(rateWorkloadDefinition))

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo("testNamespace")

	a := HealthAppender{}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	for _, node := range trafficMap {
		assert.Contains(node.Metadata, graph.HealthData)
	}
	source := trafficMap[app.ID]
	sourceHealth := source.Metadata[graph.HealthData].(*models.AppHealth)
	assert.Empty(sourceHealth.Requests.Outbound)

	dest := trafficMap[svc.ID]
	destHealth := dest.Metadata[graph.HealthData].(*models.ServiceHealth)
	assert.Empty(destHealth.Requests.Inbound)
}

func TestIdleNodesHaveHealthData(t *testing.T) {
	assert := assert.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	trafficMap := make(graph.TrafficMap)
	idleNode, _ := graph.NewNode("cluster-default", "testNamespace", "svc", "", "", "", "v1", graph.GraphTypeVersionedApp)
	trafficMap[idleNode.ID] = idleNode
	idleNode.Metadata[graph.IsIdle] = true
	idleNode.Metadata[graph.IsInaccessible] = true
	businessLayer := setupHealthConfig(t, buildFakeServicesHealth(rateDefinition), buildFakeWorkloadDeploymentsHealth(rateWorkloadDefinition), buildFakePodsHealth(rateWorkloadDefinition))

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo("testNamespace")

	a := HealthAppender{}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	assert.NotNil(trafficMap[idleNode.ID].Metadata[graph.HealthData])
}

type cacheWithServicesError struct {
	cache.KialiCache
	kubeCache ctrlclient.Reader
}

func (c *cacheWithServicesError) GetKubeCache(cluster string) (ctrlclient.Reader, error) {
	return c.kubeCache, nil
}

type servicesError struct {
	ctrlclient.Reader
	errorMsg string
}

func (s *servicesError) List(ctx context.Context, l ctrlclient.ObjectList, opts ...ctrlclient.ListOption) error {
	return fmt.Errorf("%s", s.errorMsg)
}

func TestErrorCausesPanic(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	trafficMap := buildAppTrafficMap()
	objects := []runtime.Object{
		kubetest.FakeNamespace("testNamespace"),
	}
	for _, obj := range buildFakeWorkloadDeploymentsHealth(rateDefinition) {
		o := obj
		objects = append(objects, &o)
	}
	for _, obj := range buildFakePodsHealth(rateDefinition) {
		o := obj
		objects = append(objects, &o)
	}
	var k8s kubernetes.UserClientInterface = kubetest.NewFakeK8sClient(objects...)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)
	cache := cache.NewTestingCache(t, k8s, *conf)
	const panicErrMsg = "test error! This should cause a panic"
	kubeCache, err := cache.GetKubeCache(conf.KubernetesConfig.ClusterName)
	require.NoError(err)
	cache = &cacheWithServicesError{KialiCache: cache, kubeCache: &servicesError{Reader: kubeCache, errorMsg: panicErrMsg}}
	discovery := istio.NewDiscovery(map[string]kubernetes.ClientInterface{config.DefaultClusterID: k8s}, cache, conf)

	prom := new(prometheustest.PromClientMock)
	prom.MockNamespaceServicesRequestRates(context.Background(), "testNamespace", conf.KubernetesConfig.ClusterName, "0s", time.Unix(0, 0), model.Vector{})
	prom.MockAllRequestRates(context.Background(), "testNamespace", conf.KubernetesConfig.ClusterName, "0s", time.Unix(0, 0), model.Vector{})
	k8sclients := make(map[string]kubernetes.UserClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	businessLayer, err := business.NewLayerWithSAClients(conf, cache, nil, nil, nil, nil, discovery, k8sclients)
	require.NoError(err)

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo("testNamespace")

	a := HealthAppender{}

	assert.Panics(func() { a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo) })
}

func TestMultiClusterHealthConfig(t *testing.T) {
	assert := assert.New(t)

	trafficMap := graph.NewTrafficMap()
	eastNode, _ := graph.NewNode("east", "testNamespace", "", "testNamespace", graph.Unknown, "myTest", graph.Unknown, graph.GraphTypeVersionedApp)
	trafficMap[eastNode.ID] = eastNode
	westNode, _ := graph.NewNode("west", "testNamespace", "", "testNamespace", graph.Unknown, "myTest", graph.Unknown, graph.GraphTypeVersionedApp)
	trafficMap[westNode.ID] = westNode
	objects := []runtime.Object{
		kubetest.FakeNamespace("testNamespace"),
	}
	westClient := kubetest.NewFakeK8sClient(objects...)
	for _, obj := range buildFakeWorkloadDeploymentsHealth(rateDefinition) {
		o := obj
		objects = append(objects, &o)
	}
	for _, obj := range buildFakePodsHealth(rateDefinition) {
		o := obj
		objects = append(objects, &o)
	}
	for _, obj := range buildFakeServicesHealth(rateDefinition) {
		o := obj
		objects = append(objects, &o)
	}

	clients := map[string]kubernetes.UserClientInterface{
		"east": kubetest.NewFakeK8sClient(objects...),
		"west": westClient,
	}

	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	prom := new(prometheustest.PromClientMock)
	prom.MockNamespaceServicesRequestRates(context.Background(), "testNamespace", conf.KubernetesConfig.ClusterName, "0s", time.Unix(0, 0), model.Vector{})
	prom.MockAllRequestRates(context.Background(), "testNamespace", conf.KubernetesConfig.ClusterName, "0s", time.Unix(0, 0), model.Vector{})
	businessLayer := business.NewLayerBuilder(t, conf).WithClients(clients).WithProm(prom).Build()

	globalInfo := graph.NewGlobalInfo(businessLayer, nil, config.Get(), []models.KubeCluster{}, NewGlobalIstioInfo())
	namespaceInfo := NewAppenderNamespaceInfo("testNamespace")

	a := HealthAppender{}
	a.AppendGraph(context.Background(), trafficMap, globalInfo, namespaceInfo)

	assert.Contains(eastNode.Metadata, graph.HealthData)
	assert.Contains(westNode.Metadata, graph.HealthData)
	assert.NotEmpty(eastNode.Metadata[graph.HealthData].(*models.AppHealth).WorkloadStatuses)
	assert.Empty(westNode.Metadata[graph.HealthData].(*models.AppHealth).WorkloadStatuses)
}

func buildFakeServicesHealth(rate string) []core_v1.Service {
	annotationMap := map[string]string{}
	if rate != "" {
		annotationMap[string(models.RateHealthAnnotation)] = rate
	}
	return []core_v1.Service{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Name:        "svc",
				Namespace:   "testNamespace",
				Annotations: annotationMap,
			},
		},
	}
}

func buildFakeWorkloadDeploymentsHealth(rate string) []apps_v1.Deployment {
	apps := buildFakeWorkloadDeployments()
	if rate != "" {
		apps[0].Annotations = map[string]string{string(models.RateHealthAnnotation): rate}
	}
	return apps
}

func buildFakePodsHealth(rate string) []core_v1.Pod {
	pods := buildFakeWorkloadPods()
	if rate != "" {
		pods[0].Annotations[string(models.RateHealthAnnotation)] = rate
	}
	return pods
}

func setupHealthConfig(t *testing.T, services []core_v1.Service, deployments []apps_v1.Deployment, pods []core_v1.Pod) *business.Layer {
	objects := []runtime.Object{
		kubetest.FakeNamespace("testNamespace"),
	}
	for _, obj := range services {
		o := obj
		objects = append(objects, &o)
	}
	for _, obj := range deployments {
		o := obj
		objects = append(objects, &o)
	}
	for _, obj := range pods {
		o := obj
		objects = append(objects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(objects...)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = config.DefaultClusterID
	config.Set(conf)
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)
	prom := new(prometheustest.PromClientMock)
	prom.MockNamespaceServicesRequestRates(context.Background(), "testNamespace", conf.KubernetesConfig.ClusterName, "0s", time.Unix(0, 0), model.Vector{})
	prom.MockAllRequestRates(context.Background(), "testNamespace", conf.KubernetesConfig.ClusterName, "0s", time.Unix(0, 0), model.Vector{})
	return business.NewLayerBuilder(t, conf).WithClient(k8s).Build()
}

// Tests for edge health calculation

func TestMatchesCodePattern(t *testing.T) {
	testCases := []struct {
		name     string
		pattern  string
		code     string
		expected bool
	}{
		{"5XX matches 500", "5XX", "500", true},
		{"5XX matches 503", "5XX", "503", true},
		{"5XX does not match 400", "5XX", "400", false},
		{"5xx matches 500 (lowercase)", "5xx", "500", true},
		{"4XX matches 404", "4XX", "404", true},
		{"4XX matches 400", "4XX", "400", true},
		{"4XX does not match 500", "4XX", "500", false},
		{"empty pattern matches all", "", "500", true},
		{"wildcard matches all", ".*", "500", true},
		{"exact match 200", "200", "200", true},
		{"exact match 200 does not match 201", "200", "201", false},
		{"regex pattern [45]XX", "[45]XX", "500", true},
		{"regex pattern [45]XX matches 400", "[45]XX", "400", true},
		{"regex pattern [45]XX does not match 200", "[45]XX", "200", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := matchesCodePattern(tc.pattern, tc.code)
			assert.Equal(t, tc.expected, result, "matchesCodePattern(%q, %q)", tc.pattern, tc.code)
		})
	}
}

func TestMatchesPattern(t *testing.T) {
	testCases := []struct {
		name     string
		pattern  string
		value    string
		expected bool
	}{
		{"empty pattern matches all", "", "anything", true},
		{"wildcard matches all", ".*", "anything", true},
		{"exact match", "http", "http", true},
		{"exact match fails", "http", "grpc", false},
		{"regex inbound", "inbound", "inbound", true},
		{"regex outbound", "outbound", "outbound", true},
		{"regex .* direction matches inbound", ".*", "inbound", true},
		{"partial match fails (full string required)", "in", "inbound", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := matchesPattern(tc.pattern, tc.value)
			assert.Equal(t, tc.expected, result, "matchesPattern(%q, %q)", tc.pattern, tc.value)
		})
	}
}

func TestCalculateEdgeStatusWithTolerances(t *testing.T) {
	a := HealthAppender{}

	testCases := []struct {
		name           string
		responses      graph.Responses
		protocol       string
		totalRequests  float64
		tolerances     []config.Tolerance
		expectedStatus models.HealthStatus
	}{
		{
			name:           "No tolerances with traffic returns healthy",
			responses:      graph.Responses{"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 100}}},
			protocol:       "http",
			totalRequests:  100,
			tolerances:     []config.Tolerance{},
			expectedStatus: models.HealthStatusHealthy,
		},
		{
			name:           "No traffic returns NA",
			responses:      graph.Responses{},
			protocol:       "http",
			totalRequests:  0,
			tolerances:     []config.Tolerance{},
			expectedStatus: models.HealthStatusNA,
		},
		{
			name: "All success returns healthy",
			responses: graph.Responses{
				"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 100}},
			},
			protocol:      "http",
			totalRequests: 100,
			tolerances: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 1, Failure: 5},
			},
			expectedStatus: models.HealthStatusHealthy,
		},
		{
			name: "Error rate below degraded threshold is healthy",
			responses: graph.Responses{
				"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 99}},
				"500": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 1}}, // 1% error
			},
			protocol:      "http",
			totalRequests: 100,
			tolerances: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 5, Failure: 10},
			},
			expectedStatus: models.HealthStatusHealthy,
		},
		{
			name: "Error rate at degraded threshold is degraded",
			responses: graph.Responses{
				"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 95}},
				"500": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 5}}, // 5% error
			},
			protocol:      "http",
			totalRequests: 100,
			tolerances: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 5, Failure: 10},
			},
			expectedStatus: models.HealthStatusDegraded,
		},
		{
			name: "Error rate above degraded but below failure is degraded",
			responses: graph.Responses{
				"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 92}},
				"500": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 8}}, // 8% error
			},
			protocol:      "http",
			totalRequests: 100,
			tolerances: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 5, Failure: 10},
			},
			expectedStatus: models.HealthStatusDegraded,
		},
		{
			name: "Error rate at failure threshold is failure",
			responses: graph.Responses{
				"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 90}},
				"500": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 10}}, // 10% error
			},
			protocol:      "http",
			totalRequests: 100,
			tolerances: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 5, Failure: 10},
			},
			expectedStatus: models.HealthStatusFailure,
		},
		{
			name: "Error rate above failure threshold is failure",
			responses: graph.Responses{
				"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 80}},
				"500": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 20}}, // 20% error
			},
			protocol:      "http",
			totalRequests: 100,
			tolerances: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 5, Failure: 10},
			},
			expectedStatus: models.HealthStatusFailure,
		},
		{
			name: "4XX errors with 4XX tolerance",
			responses: graph.Responses{
				"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 85}},
				"404": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 15}}, // 15% 4xx error
			},
			protocol:      "http",
			totalRequests: 100,
			tolerances: []config.Tolerance{
				{Code: "4XX", Protocol: "http", Direction: ".*", Degraded: 10, Failure: 20},
			},
			expectedStatus: models.HealthStatusDegraded,
		},
		{
			name: "Protocol mismatch - tolerance not applied",
			responses: graph.Responses{
				"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 50}},
				"500": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 50}}, // 50% error but grpc tolerance
			},
			protocol:      "http",
			totalRequests: 100,
			tolerances: []config.Tolerance{
				{Code: "5XX", Protocol: "grpc", Direction: ".*", Degraded: 5, Failure: 10},
			},
			expectedStatus: models.HealthStatusHealthy, // No matching tolerance, so healthy
		},
		{
			name: "Multiple tolerances - worst status wins",
			responses: graph.Responses{
				"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 80}},
				"400": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 8}},  // 8% 4xx (degraded)
				"500": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 12}}, // 12% 5xx (failure)
			},
			protocol:      "http",
			totalRequests: 100,
			tolerances: []config.Tolerance{
				{Code: "4XX", Protocol: "http", Direction: ".*", Degraded: 5, Failure: 20},
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 5, Failure: 10},
			},
			expectedStatus: models.HealthStatusFailure, // 5xx at 12% > 10% failure threshold
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			status := a.calculateEdgeStatusWithTolerances(tc.responses, tc.protocol, tc.totalRequests, tc.tolerances)
			assert.Equal(t, tc.expectedStatus, status)
		})
	}
}

func TestCalculateSingleEdgeHealth(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Rate = []config.Rate{
		{
			Tolerance: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 5, Failure: 10},
			},
		},
	}
	config.Set(conf)

	calculator := business.NewHealthCalculator(conf)
	a := HealthAppender{}

	// Create source and dest nodes
	sourceNode := &graph.Node{
		ID:        "source-id",
		NodeType:  graph.NodeTypeWorkload,
		Namespace: "testNamespace",
		Workload:  "source-workload",
		Metadata:  graph.NewMetadata(),
	}
	destNode := &graph.Node{
		ID:        "dest-id",
		NodeType:  graph.NodeTypeService,
		Namespace: "testNamespace",
		Service:   "dest-service",
		Metadata:  graph.NewMetadata(),
	}

	t.Run("Healthy edge - all 200s", func(t *testing.T) {
		edge := &graph.Edge{
			Source:   sourceNode,
			Dest:     destNode,
			Metadata: graph.NewMetadata(),
		}
		edge.Metadata[graph.ProtocolKey] = "http"
		edge.Metadata["httpResponses"] = graph.Responses{
			"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 100}},
		}

		status := a.calculateSingleEdgeHealth(edge, calculator)
		assert.Equal(t, models.HealthStatusHealthy, status)
	})

	t.Run("Degraded edge - 7% 5xx errors", func(t *testing.T) {
		edge := &graph.Edge{
			Source:   sourceNode,
			Dest:     destNode,
			Metadata: graph.NewMetadata(),
		}
		edge.Metadata[graph.ProtocolKey] = "http"
		edge.Metadata["httpResponses"] = graph.Responses{
			"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 93}},
			"500": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 7}},
		}

		status := a.calculateSingleEdgeHealth(edge, calculator)
		assert.Equal(t, models.HealthStatusDegraded, status)
	})

	t.Run("Failure edge - 15% 5xx errors", func(t *testing.T) {
		edge := &graph.Edge{
			Source:   sourceNode,
			Dest:     destNode,
			Metadata: graph.NewMetadata(),
		}
		edge.Metadata[graph.ProtocolKey] = "http"
		edge.Metadata["httpResponses"] = graph.Responses{
			"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 85}},
			"500": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 15}},
		}

		status := a.calculateSingleEdgeHealth(edge, calculator)
		assert.Equal(t, models.HealthStatusFailure, status)
	})

	t.Run("No protocol returns NA", func(t *testing.T) {
		edge := &graph.Edge{
			Source:   sourceNode,
			Dest:     destNode,
			Metadata: graph.NewMetadata(),
		}
		// No protocol set

		status := a.calculateSingleEdgeHealth(edge, calculator)
		assert.Equal(t, models.HealthStatusNA, status)
	})

	t.Run("No responses returns NA", func(t *testing.T) {
		edge := &graph.Edge{
			Source:   sourceNode,
			Dest:     destNode,
			Metadata: graph.NewMetadata(),
		}
		edge.Metadata[graph.ProtocolKey] = "http"
		// No responses set

		status := a.calculateSingleEdgeHealth(edge, calculator)
		assert.Equal(t, models.HealthStatusNA, status)
	})
}

func TestCalculateEdgeHealthStatus(t *testing.T) {
	conf := config.NewConfig()
	conf.HealthConfig.Rate = []config.Rate{
		{
			Tolerance: []config.Tolerance{
				{Code: "5XX", Protocol: "http", Direction: ".*", Degraded: 5, Failure: 10},
			},
		},
	}
	config.Set(conf)

	calculator := business.NewHealthCalculator(conf)
	a := HealthAppender{}

	// Build a simple traffic map with edges
	sourceNode, _ := graph.NewNode(config.DefaultClusterID, "testNamespace", "source-app", "", "", "", "", graph.GraphTypeVersionedApp)
	destNode, _ := graph.NewNode(config.DefaultClusterID, "testNamespace", "dest-app", "", "", "", "", graph.GraphTypeVersionedApp)

	edge := sourceNode.AddEdge(destNode)
	edge.Metadata[graph.ProtocolKey] = "http"
	edge.Metadata["httpResponses"] = graph.Responses{
		"200": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 85}},
		"500": &graph.ResponseDetail{Flags: graph.ResponseFlags{"-": 15}}, // 15% errors = Failure
	}

	trafficMap := graph.TrafficMap{
		sourceNode.ID: sourceNode,
		destNode.ID:   destNode,
	}

	// Calculate edge health
	a.calculateEdgeHealthStatus(trafficMap, calculator)

	// Verify edge has health status set
	healthStatus, ok := edge.Metadata[graph.HealthStatus].(string)
	assert.True(t, ok, "edge should have HealthStatus metadata")
	assert.Equal(t, string(models.HealthStatusFailure), healthStatus)
}
