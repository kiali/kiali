package appender

import (
	"testing"
	"time"

	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/graph"
	"github.com/kiali/kiali/kubernetes/cache"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
)

func TestExtension(t *testing.T) {
	assert := assert.New(t)

	// Set config
	extConfig := config.ExtensionConfig{
		Enabled:       true,
		Name:          "extension-name",
		RootCluster:   "root-cluster",
		RootNamespace: "root-namespace",
		RootService:   "root-service",
		RootVersion:   "root-version",
	}

	client, _, err := setupExtensionMock(t, extConfig)
	if err != nil {
		t.Error(err)
		return
	}

	// start with traffic map containing only the extension's root service
	trafficMap := graph.NewTrafficMap()
	root, _ := graph.NewNode(extConfig.RootCluster, extConfig.RootNamespace, extConfig.RootService, "", "", "", extConfig.RootVersion, graph.GraphTypeVersionedApp)
	trafficMap[root.ID] = root

	root, ok := trafficMap[root.ID]
	assert.Equal(true, ok)
	assert.Equal(graph.NodeTypeService, root.NodeType)
	assert.Equal(extConfig.RootCluster, root.Cluster)
	assert.Equal(extConfig.RootNamespace, root.Namespace)
	assert.Equal(extConfig.RootService, root.Service)
	assert.Equal(0, len(root.Edges))

	duration, _ := time.ParseDuration("60s")
	appender := ExtensionsAppender{
		Duration:         duration,
		GraphType:        graph.GraphTypeVersionedApp,
		IncludeIdleEdges: false,
		QueryTime:        time.Now().Unix(),
		Rates: graph.RequestedRates{
			Http: graph.RateRequests,
			Grpc: graph.RateNone,
			Tcp:  graph.RateSent,
		},
	}
	appender.appendGraph(trafficMap, extConfig, client)

	root, ok = trafficMap[root.ID]
	assert.Equal(true, ok)
	assert.Equal(graph.NodeTypeService, root.NodeType)
	assert.Equal(extConfig.RootCluster, root.Cluster)
	assert.Equal(extConfig.RootNamespace, root.Namespace)
	assert.Equal(extConfig.RootService, root.Service)
	assert.Equal(2, len(root.Edges))
	protocol0 := root.Edges[0].Metadata[graph.ProtocolKey]
	assert.Contains([]string{"http", "tcp"}, protocol0)
	protocol1 := root.Edges[1].Metadata[graph.ProtocolKey]
	assert.Contains([]string{"http", "tcp"}, protocol1)
	assert.True(protocol0 != protocol1)
}

func setupExtensionMock(t *testing.T, extConfig config.ExtensionConfig) (*prometheus.Client, *prometheustest.PromAPIMock, error) {
	q0 := `round(sum(rate(kiali_ext_requests_total{extension="extension-name"} [60s])) by (dest_cluster, dest_namespace, dest_service, dest_version, flags, protocol, security, source_cluster, source_namespace, source_service, source_version, status_code) > 0,0.001)`
	q0m0 := model.Metric{
		"source_cluster":   model.LabelValue(extConfig.RootCluster),
		"source_namespace": model.LabelValue(extConfig.RootNamespace),
		"source_service":   model.LabelValue(extConfig.RootService),
		"source_version":   model.LabelValue(extConfig.RootVersion),
		"dest_cluster":     "remote-cluster",
		"dest_namespace":   "remote-namespace",
		"dest_service":     "remote-service",
		"dest_version":     "latest",
		"protocol":         "http",
		"status_code":      "200",
		"flags":            "-",
	}
	v0 := model.Vector{
		&model.Sample{
			Metric: q0m0,
			Value:  100,
		},
	}

	q1 := `round(sum(rate(kiali_ext_tcp_sent_total{extension="extension-name"} [60s])) by (dest_cluster, dest_namespace, dest_service, dest_version, flags, security, source_cluster, source_namespace, source_service, source_version) > 0,0.001)`
	q1m0 := model.Metric{
		"source_cluster":   model.LabelValue(extConfig.RootCluster),
		"source_namespace": model.LabelValue(extConfig.RootNamespace),
		"source_service":   model.LabelValue(extConfig.RootService),
		"source_version":   model.LabelValue(extConfig.RootVersion),
		"dest_cluster":     "remote-cluster",
		"dest_namespace":   "remote-namespace",
		"dest_service":     "remote-tcp-service",
		"dest_version":     "latest",
		"flags":            "-",
	}
	v1 := model.Vector{
		&model.Sample{
			Metric: q1m0,
			Value:  10000,
		},
	}

	client, api := setupMockedExt(t)

	mockQuery(api, q0, &v0)
	mockQuery(api, q1, &v1)

	return client, api, nil
}

func setupMockedExt(t *testing.T) (*prometheus.Client, *prometheustest.PromAPIMock) {
	conf := config.NewConfig()
	conf.Extensions = []config.ExtensionConfig{
		{
			Enabled:       true,
			Name:          "extension-name",
			RootCluster:   "root-cluster",
			RootNamespace: "root-namespace",
			RootService:   "root-service",
		},
	}
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(
		&core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: "bookinfo"}},
	)

	api := new(prometheustest.PromAPIMock)
	client, err := prometheus.NewClient()
	if err != nil {
		t.Fatal(err)
	}
	client.Inject(api)

	mockClientFactory := kubetest.NewK8SClientFactoryMock(k8s)
	business.SetWithBackends(mockClientFactory, nil)
	cache := cache.NewTestingCache(t, k8s, *conf)
	business.WithKialiCache(cache)

	return client, api
}
