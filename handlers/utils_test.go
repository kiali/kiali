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
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/handlers/queryparams"
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
	assert.Equal("east", queryparams.ClusterName(conf, query))

	query = url.Values{}
	assert.Equal(conf.KubernetesConfig.ClusterName, queryparams.ClusterName(conf, query))

	query = url.Values{"notcluster": []string{"east"}}
	assert.Equal(conf.KubernetesConfig.ClusterName, queryparams.ClusterName(conf, query))
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

func TestCheckNamespaceAccessMultiCluster(t *testing.T) {
	const namespace = "ztunnel"

	cases := map[string]struct {
		expectedCode     int
		expectedClusters []string
		hubClient        kubernetes.UserClientInterface
		spokeClient      kubernetes.UserClientInterface
	}{
		"ignores missing namespace on remote": {
			hubClient:        kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeClient:      kubetest.NewFakeK8sClient(),
			expectedCode:     http.StatusOK,
			expectedClusters: []string{"hub"},
		},
		"ignores missing namespace on hub": {
			hubClient:        kubetest.NewFakeK8sClient(),
			spokeClient:      kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			expectedCode:     http.StatusOK,
			expectedClusters: []string{"spoke"},
		},
		"collects namespace from each cluster that has it": {
			hubClient:        kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeClient:      kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			expectedCode:     http.StatusOK,
			expectedClusters: []string{"hub", "spoke"},
		},
		"returns forbidden when access denied on a cluster": {
			hubClient: kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeClient: &nsForbidden{
				UserClientInterface: kubetest.NewFakeK8sClient(),
				forbiddenNamespace:  namespace,
			},
			expectedCode:     http.StatusForbidden,
			expectedClusters: nil,
		},
		"returns no namespaces when missing on all clusters": {
			hubClient:        kubetest.NewFakeK8sClient(),
			spokeClient:      kubetest.NewFakeK8sClient(),
			expectedCode:     http.StatusOK,
			expectedClusters: nil,
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "hub"
			clients := map[string]kubernetes.UserClientInterface{
				"hub":   tc.hubClient,
				"spoke": tc.spokeClient,
			}
			clientFactory := kubetest.NewFakeClientFactory(conf, clients)
			kialiCache := cache.NewTestingCacheWithClients(t, kubernetes.ConvertFromUserClients(clients), *conf)
			discovery := &istiotest.FakeDiscovery{}

			req := httptest.NewRequest(http.MethodGet, "http://localhost", nil)
			authInfo := map[string]*api.AuthInfo{
				"hub":   {Token: "hub-token"},
				"spoke": {Token: "spoke-token"},
			}
			req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), authInfo))
			w := httptest.NewRecorder()

			namespaces, err := checkNamespaceAccessMultiCluster(w, req, conf, kialiCache, discovery, clientFactory, namespace)

			require.NoError(err)
			require.Equal(tc.expectedCode, w.Code)
			if tc.expectedClusters == nil {
				require.Nil(namespaces)
			} else {
				gotClusters := make([]string, len(namespaces))
				for i, ns := range namespaces {
					gotClusters[i] = ns.Cluster
				}
				require.ElementsMatch(tc.expectedClusters, gotClusters)
			}
		})
	}
}
