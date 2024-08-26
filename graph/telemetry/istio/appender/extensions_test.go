package appender

import (
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

const (
	extName       = "extension-name"
	extUrl        = "http://extension.test"
	rootCluster   = "root-cluster"
	rootNamespace = "root-namespace"
	rootName      = "root-name"
)

func TestExtension(t *testing.T) {
	assert := assert.New(t)

	// start with traffic map containing only the extension's root service
	trafficMap := graph.NewTrafficMap()
	root, _ := graph.NewNode(rootCluster, rootNamespace, rootName, "", "", "", "", graph.GraphTypeVersionedApp)
	trafficMap[root.ID] = root

	root, ok := trafficMap[root.ID]
	assert.Equal(true, ok)
	assert.Equal(graph.NodeTypeService, root.NodeType)
	assert.Equal(rootCluster, root.Cluster)
	assert.Equal(rootNamespace, root.Namespace)
	assert.Equal(rootName, root.Service)
	assert.Equal(0, len(root.Edges))

	// Set config
	extConfig := config.ExtensionConfig{
		Enabled: true,
		Name:    extName,
	}

	// setup mocks
	client, _, businessLayer, err := setupExtensionMock(t)
	if err != nil {
		t.Error(err)
		return
	}

	duration, _ := time.ParseDuration("60s")
	globalInfo := graph.NewAppenderGlobalInfo()
	globalInfo.Business = businessLayer
	globalInfo.PromClient = client

	appender := ExtensionsAppender{
		Duration:         duration,
		globalInfo:       globalInfo,
		GraphType:        graph.GraphTypeVersionedApp,
		IncludeIdleEdges: false,
		QueryTime:        time.Now().Unix(),
		Rates: graph.RequestedRates{
			Http: graph.RateRequests,
			Grpc: graph.RateNone,
			Tcp:  graph.RateSent,
		},
		ShowUnrooted: true,
		urls:         map[string]string{},
	}

	// run appender
	appender.appendGraph(extConfig, trafficMap)

	root, ok = trafficMap[root.ID]
	assert.Equal(true, ok)
	assert.Equal(graph.NodeTypeService, root.NodeType)
	assert.Equal(rootCluster, root.Cluster)
	assert.Equal(rootNamespace, root.Namespace)
	assert.Equal(rootName, root.Service)
	assert.Equal(2, len(root.Edges))
	protocol0 := root.Edges[0].Metadata[graph.ProtocolKey]
	assert.Contains([]string{"http", "tcp"}, protocol0)
	protocol1 := root.Edges[1].Metadata[graph.ProtocolKey]
	assert.Contains([]string{"http", "tcp"}, protocol1)
	assert.True(protocol0 != protocol1)
	ext, ok := root.Metadata[graph.IsExtension]
	assert.True(ok)
	assert.Equal(extName, ext.(*graph.ExtInfo).Name)
	assert.Equal(extUrl, ext.(*graph.ExtInfo).URL)
}

func setupExtensionMock(t *testing.T) (*prometheus.Client, *prometheustest.PromAPIMock, *business.Layer, error) {
	q0 := `round(sum(rate(kiali_ext_requests_total{extension="extension-name"} [60s])) by (dest_cluster, dest_namespace, dest_name, flags, protocol, secure, source_cluster, source_is_root, source_namespace, source_name, status_code) > 0,0.001)`
	q0m0 := model.Metric{
		"source_cluster":   model.LabelValue(rootCluster),
		"source_namespace": model.LabelValue(rootNamespace),
		"source_name":      model.LabelValue(rootName),
		"source_is_root":   model.LabelValue("true"),
		"dest_cluster":     "remote-cluster",
		"dest_namespace":   "remote-namespace",
		"dest_name":        "remote-service",
		"protocol":         "http",
		"status_code":      "200",
		"flags":            "-",
		"secure":           model.LabelValue("true"),
	}
	v0 := model.Vector{
		&model.Sample{
			Metric: q0m0,
			Value:  100,
		},
	}

	q1 := `round(sum(rate(kiali_ext_tcp_sent_total{extension="extension-name"} [60s])) by (dest_cluster, dest_namespace, dest_name, flags, secure, source_cluster, source_is_root, source_namespace, source_name) > 0,0.001)`
	q1m0 := model.Metric{
		"source_cluster":   model.LabelValue(rootCluster),
		"source_namespace": model.LabelValue(rootNamespace),
		"source_name":      model.LabelValue(rootName),
		"source_is_root":   model.LabelValue("true"),
		"dest_cluster":     "remote-cluster",
		"dest_namespace":   "remote-namespace",
		"dest_name":        "remote-tcp-service",
		"flags":            "-",
		"secure":           model.LabelValue("true"),
	}
	v1 := model.Vector{
		&model.Sample{
			Metric: q1m0,
			Value:  10000,
		},
	}

	client, api, businessLayer := setupMockedExt(t)

	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)

	return client, api, businessLayer, nil
}

func setupMockedExt(t *testing.T) (*prometheus.Client, *prometheustest.PromAPIMock, *business.Layer) {
	t.Helper()

	conf := config.NewConfig()
	conf.Extensions = []config.ExtensionConfig{
		{
			Enabled: true,
			Name:    "extension-name",
		},
	}
	conf.KubernetesConfig.ClusterName = rootCluster
	config.Set(conf)

	promApi := new(prometheustest.PromAPIMock)
	promClient, err := prometheus.NewClient()
	if err != nil {
		t.Fatal(err)
	}
	promClient.Inject(promApi)

	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: rootNamespace}},
		&core_v1.Service{ObjectMeta: meta_v1.ObjectMeta{Name: extName, Namespace: rootNamespace, Annotations: map[string]string{"extension.kiali.io/ui-url": extUrl}}},
	)
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test"}}

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, nil)
	cache := cache.NewTestingCache(t, k8s, *conf)
	business.WithKialiCache(cache)
	discovery := istio.NewDiscovery(mockClientFactory.Clients, cache, conf)
	business.WithDiscovery(discovery)

	businessLayer, err := business.NewLayer(conf, cache, mockClientFactory, promClient, nil, nil, nil, discovery, authInfo)
	require.NoError(t, err)

	return promClient, promApi, businessLayer
}
