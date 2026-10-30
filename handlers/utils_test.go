package handlers

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	kubefake "k8s.io/client-go/kubernetes/fake"
	kubeclienttesting "k8s.io/client-go/testing"
	"k8s.io/client-go/tools/clientcmd/api"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/handlers/authentication"
	"github.com/kiali/kiali/handlers/queryparams"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
)

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

// newInternalErrorListClient wraps the fake client so namespace LIST calls
// fail with a non-Forbidden (internal) error.
func newInternalErrorListClient(k8s *kubetest.FakeK8sClient) *kubetest.FakeK8sClient {
	if cs, ok := k8s.KubeClientset.(*kubefake.Clientset); ok {
		cs.PrependReactor("list", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
			return true, nil, k8serrors.NewInternalError(fmt.Errorf("apiserver down"))
		})
	}
	return k8s
}

func TestCheckNamespaceAccessAllSAClusters(t *testing.T) {
	const namespace = "ztunnel"

	// The shared rule iterates the SA cluster list: the SA clients say where
	// the namespace exists, and the user must then be able to see it in
	// every such cluster. The SA and user clients are deliberately separate
	// fakes so a cluster can model "the SA sees it, the user does not".
	cases := map[string]struct {
		expectedCode     int
		expectedClusters []string
		hubUser          kubernetes.UserClientInterface
		spokeUser        kubernetes.UserClientInterface
		hubSA            kubernetes.UserClientInterface
		spokeSA          kubernetes.UserClientInterface
	}{
		"ignores missing namespace on remote": {
			hubUser:          kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeUser:        kubetest.NewFakeK8sClient(),
			hubSA:            kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeSA:          kubetest.NewFakeK8sClient(),
			expectedCode:     http.StatusOK,
			expectedClusters: []string{"hub"},
		},
		"ignores missing namespace on hub": {
			hubUser:          kubetest.NewFakeK8sClient(),
			spokeUser:        kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			hubSA:            kubetest.NewFakeK8sClient(),
			spokeSA:          kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			expectedCode:     http.StatusOK,
			expectedClusters: []string{"spoke"},
		},
		"collects namespace from each cluster that has it": {
			hubUser:          kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeUser:        kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			hubSA:            kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeSA:          kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			expectedCode:     http.StatusOK,
			expectedClusters: []string{"hub", "spoke"},
		},
		"returns forbidden when access denied on a cluster": {
			// The SA sees the namespace on both clusters; the user's spoke
			// LIST excludes it, so the user is denied on spoke.
			hubUser: kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeUser: newRestrictedNamespaceClient(
				kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
				namespace,
				[]string{"bookinfo"},
			),
			hubSA:            kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeSA:          kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			expectedCode:     http.StatusForbidden,
			expectedClusters: nil,
		},
		"returns forbidden when user has no client for a cluster where the SA sees the namespace": {
			// No spoke user client at all (e.g. per-cluster login not done):
			// counts as denied for an unscoped query.
			hubUser:          kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeUser:        nil,
			hubSA:            kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeSA:          kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			expectedCode:     http.StatusForbidden,
			expectedClusters: nil,
		},
		"returns not found when missing on all clusters": {
			hubUser:          kubetest.NewFakeK8sClient(),
			spokeUser:        kubetest.NewFakeK8sClient(),
			hubSA:            kubetest.NewFakeK8sClient(),
			spokeSA:          kubetest.NewFakeK8sClient(),
			expectedCode:     http.StatusNotFound,
			expectedClusters: nil,
		},
		"returns 500 when the home cluster SA set cannot be computed": {
			// The home cluster's namespace LIST fails with a non-Forbidden
			// error: an honest 500, not a denial.
			hubUser:          kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeUser:        kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			hubSA:            newInternalErrorListClient(kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace))),
			spokeSA:          kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			expectedCode:     http.StatusInternalServerError,
			expectedClusters: nil,
		},
		"returns forbidden when a remote cluster SA set cannot be computed": {
			// An unscoped query cannot skip a remote cluster it cannot
			// evaluate: that would be fail-open, so it is treated as denied.
			hubUser:          kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeUser:        kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			hubSA:            kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace)),
			spokeSA:          newInternalErrorListClient(kubetest.NewFakeK8sClient(kubetest.FakeNamespace(namespace))),
			expectedCode:     http.StatusForbidden,
			expectedClusters: nil,
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "hub"
			userClients := map[string]kubernetes.UserClientInterface{
				"hub": tc.hubUser,
			}
			if tc.spokeUser != nil {
				userClients["spoke"] = tc.spokeUser
			}
			saUserClients := map[string]kubernetes.UserClientInterface{
				"hub":   tc.hubSA,
				"spoke": tc.spokeSA,
			}
			saClients := kubernetes.ConvertFromUserClients(saUserClients)

			clientFactory := kubetest.NewFakeClientFactory(conf, userClients)
			clientFactory.SAClients = saClients
			kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
			discovery := &istiotest.FakeDiscovery{}

			req := httptest.NewRequest(http.MethodGet, "http://localhost", nil)
			authInfo := map[string]*api.AuthInfo{
				"hub": {Token: "hub-token"},
			}
			if tc.spokeUser != nil {
				authInfo["spoke"] = &api.AuthInfo{Token: "spoke-token"}
			}
			req = req.WithContext(authentication.SetAuthInfoContext(req.Context(), authInfo))
			w := httptest.NewRecorder()

			namespaces, err := checkNamespaceAccessAllSAClusters(w, req, conf, kialiCache, discovery, clientFactory, namespace, true)

			// Denials return the error alongside the written response; a
			// miss-everywhere 404 does not.
			if tc.expectedCode == http.StatusForbidden || tc.expectedCode >= http.StatusInternalServerError {
				require.Error(err)
			} else {
				require.NoError(err)
			}
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
