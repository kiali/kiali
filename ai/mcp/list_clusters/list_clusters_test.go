package list_clusters

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/ai/mcputil"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

func reqWithAuth(req *http.Request, conf *config.Config, token string) *http.Request {
	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: token}}
	ctx := authentication.SetAuthInfoContext(req.Context(), authInfo)
	return req.WithContext(ctx)
}

func TestExecute_ReturnsClusters(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("default"))
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: k8s,
	})
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/list_clusters", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())

	res, code := Execute(&mcputil.KialiInterface{
		Request:   req,
		Conf:      conf,
		Discovery: discovery,
	}, map[string]interface{}{})

	require.Equal(t, http.StatusOK, code)
	clusters, ok := res.([]ClusterInfo)
	require.True(t, ok)
	require.NotEmpty(t, clusters)

	found := false
	for _, c := range clusters {
		if c.Name == "east" {
			found = true
			assert.True(t, c.IsHome)
		}
	}
	assert.True(t, found, "expected home cluster 'east' in results")
}

func TestExecute_ReturnsOKWithEmptyArgs(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	config.Set(conf)

	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("default"))
	saClients := kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: k8s,
	})
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)

	req := httptest.NewRequest(http.MethodPost, "http://kiali/api/chat/mcp/list_clusters", nil)
	req = reqWithAuth(req, conf, k8s.GetToken())

	_, code := Execute(&mcputil.KialiInterface{
		Request:   req,
		Conf:      conf,
		Discovery: discovery,
	}, nil)

	assert.Equal(t, http.StatusOK, code)
}
