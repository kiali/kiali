package handlers

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

type nsForbidden struct {
	kubernetes.UserClientInterface
	forbiddenNamespace string
}

func (n *nsForbidden) GetNamespace(name string) (*core_v1.Namespace, error) {
	if name == n.forbiddenNamespace {
		return nil, errors.New("no privileges")
	}
	return n.UserClientInterface.GetNamespace(name)
}

func TestClusterNameFromQuery(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()

	query := url.Values{"clusterName": []string{"east"}}
	assert.Equal("east", clusterNameFromQuery(conf, query))

	query = url.Values{}
	assert.Equal(conf.KubernetesConfig.ClusterName, clusterNameFromQuery(conf, query))

	query = url.Values{"notcluster": []string{"east"}}
	assert.Equal(conf.KubernetesConfig.ClusterName, clusterNameFromQuery(conf, query))
}

func TestCheckNamespaceAccessWithService(t *testing.T) {
	cases := map[string]struct {
		client       kubernetes.ClientInterface
		expectedCode int
		expectErr    bool
	}{
		"No errors returned with access": {
			client: kubetest.NewFakeK8sClient(&core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "test"}}),
		},
		"No access returns 403": {
			client: &nsForbidden{
				forbiddenNamespace:  "test",
				UserClientInterface: kubetest.NewFakeK8sClient(&core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "test"}}),
			},
			expectedCode: 403,
			expectErr:    true,
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			w := httptest.NewRecorder()
			r := httptest.NewRequest(http.MethodGet, "http://localhost", nil)

			conf := config.NewConfig()
			cache := cache.NewTestingCache(t, tc.client, *conf)
			discovery := &istiotest.FakeDiscovery{}
			clients := map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: tc.client}
			userClients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: tc.client.(kubernetes.UserClientInterface)}
			service := business.NewNamespaceService(cache, conf, discovery, clients, userClients)

			_, err := checkNamespaceAccessWithService(w, r, &service, "test", conf.KubernetesConfig.ClusterName)
			if tc.expectErr {
				require.Error(err)
			} else {
				require.NoError(err)
			}

			if tc.expectedCode > 0 {
				require.Equal(tc.expectedCode, w.Code)
			}
		})
	}
}
