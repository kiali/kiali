package handlers

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	kubefake "k8s.io/client-go/kubernetes/fake"
	kubeclienttesting "k8s.io/client-go/testing"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/util"
)

func fakeService(namespace, name string) *core_v1.Service {
	return &core_v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels: map[string]string{
				"app": name,
			},
		},
		Spec: core_v1.ServiceSpec{
			ClusterIP: "fromservice",
			Type:      "ClusterIP",
			Selector:  map[string]string{"app": name},
			Ports: []core_v1.ServicePort{
				{
					Name:     "http",
					Protocol: "TCP",
					Port:     3001,
				},
				{
					Name:     "http",
					Protocol: "TCP",
					Port:     3000,
				},
			},
		},
	}
}

// TestNamespaceAppHealth is unit test (testing request handling, not the prometheus client behaviour)
func TestClustersHealth(t *testing.T) {
	kubeObjects := []runtime.Object{fakeService("ns", "reviews"), fakeService("ns", "httpbin"), setupMockData()}
	for _, obj := range kubetest.FakePodList() {
		o := obj
		kubeObjects = append(kubeObjects, &o)
	}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts, prom := setupClustersHealthEndpoint(t, k8s)

	url := ts.URL + "/api/clusters/health"
	mockClock()

	conf := config.NewConfig()

	// Test 17s on rate interval to check that rate interval is adjusted correctly.
	prom.On("GetAllRequestRates", mock.Anything, "ns", conf.KubernetesConfig.ClusterName, "17s", util.Clock.Now()).Return(model.Vector{}, nil)

	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	actual, _ := io.ReadAll(resp.Body)

	assert.NotEmpty(t, actual)
	assert.Equal(t, 200, resp.StatusCode, string(actual))
	prom.AssertNumberOfCalls(t, "GetAllRequestRates", 1)
}

func setupClustersHealthEndpoint(t *testing.T, k8s kubernetes.UserClientInterface) (*httptest.Server, *prometheustest.PromClientMock) {
	conf := config.NewConfig()
	prom := new(prometheustest.PromClientMock)

	cf := kubetest.NewFakeClientFactoryWithClient(conf, k8s)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	cpm := &business.FakeControlPlaneMonitor{}
	discovery := istio.NewDiscovery(kubernetes.ConvertFromUserClients(cf.Clients), cache, conf)
	traceLoader := func() tracing.ClientInterface { return nil }
	grafana := grafana.NewService(conf, cf.GetSAHomeClusterClient())

	handler := ClusterHealth(conf, cache, cf, prom, traceLoader, discovery, cpm, grafana)
	mr := mux.NewRouter()
	mr.HandleFunc("/api/clusters/health", WithFakeAuthInfo(conf, handler))

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts, prom
}

func setupMockData() *core_v1.Namespace {
	mockClock()
	return &core_v1.Namespace{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              "ns",
			CreationTimestamp: meta_v1.NewTime(util.Clock.Now().Add(-17 * time.Second)),
		},
	}
}

func setupMockNamespace(name string) *core_v1.Namespace {
	return &core_v1.Namespace{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:              name,
			CreationTimestamp: meta_v1.NewTime(util.Clock.Now().Add(-17 * time.Second)),
		},
	}
}

// restrictedNamespaceClient wraps a fake client and simulates a user without RBAC
// access to one namespace: the namespace LIST is filtered (the fake clientset has
// no RBAC of its own) and the per-namespace get is denied. The ClusterHealth
// handler authorizes explicit namespace requests against the user's LIST-based
// accessible set (GetClusterNamespaces), so the list reactor is what makes the
// 403 tests below exercise the check. The distinct cache key prevents the mock
// factory's SA-identity shortcut (GetSAClients returns the same client instance)
// from serving the SA's unfiltered namespace list for this user, so the cached
// accessible set reflects exactly what this user can see - the same behavior a
// real restricted user gets in production.
type restrictedNamespaceClient struct {
	deniedNamespace string
	kubernetes.UserClientInterface
}

func (c *restrictedNamespaceClient) GetNamespace(namespace string) (*core_v1.Namespace, error) {
	if namespace == c.deniedNamespace {
		return nil, errors.New("namespaces \"" + namespace + "\" is forbidden")
	}
	return c.UserClientInterface.GetNamespace(namespace)
}

// listAuthorizedNamespaceClient wraps a fake client and simulates a user that is
// authorized through namespace LIST only: the namespace appears in list results
// but the per-namespace get is denied (e.g. header auth with the default
// require_namespace_get=false). The ClusterHealth handler must authorize such a
// user consistently, without depending on whether the per-token namespace cache
// is warm.
type listAuthorizedNamespaceClient struct {
	deniedNamespace string
	kubernetes.UserClientInterface
}

func (c *listAuthorizedNamespaceClient) GetNamespace(namespace string) (*core_v1.Namespace, error) {
	if namespace == c.deniedNamespace {
		return nil, errors.New("namespaces \"" + namespace + "\" is forbidden")
	}
	return c.UserClientInterface.GetNamespace(namespace)
}

// newListAuthorizedNamespaceClient wraps the given fake client: the denied
// namespace stays in list results but its per-namespace get fails.
func newListAuthorizedNamespaceClient(k8s *kubetest.FakeK8sClient, deniedNamespace string, listedNamespaces []string) *listAuthorizedNamespaceClient {
	k8s.Token = "list-authorized-user"
	listed := make([]core_v1.Namespace, 0, len(listedNamespaces))
	for _, name := range listedNamespaces {
		listed = append(listed, core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: name}})
	}
	if fakeClientset, ok := k8s.KubeClientset.(*kubefake.Clientset); ok {
		fakeClientset.PrependReactor("list", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
			return true, &core_v1.NamespaceList{Items: listed}, nil
		})
	}
	return &listAuthorizedNamespaceClient{deniedNamespace: deniedNamespace, UserClientInterface: k8s}
}

// newRestrictedNamespaceClient wraps the given fake client, denying the given
// namespace. allNamespaces is the set of namespaces the fake holds; the wrapper's
// list reactor returns all of them except the denied one.
func newRestrictedNamespaceClient(k8s *kubetest.FakeK8sClient, deniedNamespace string, allNamespaces []string) *restrictedNamespaceClient {
	k8s.Token = "restricted-user"
	allowed := make([]core_v1.Namespace, 0, len(allNamespaces))
	for _, name := range allNamespaces {
		if name == deniedNamespace {
			continue
		}
		allowed = append(allowed, core_v1.Namespace{ObjectMeta: meta_v1.ObjectMeta{Name: name}})
	}
	if fakeClientset, ok := k8s.KubeClientset.(*kubefake.Clientset); ok {
		fakeClientset.PrependReactor("list", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
			return true, &core_v1.NamespaceList{Items: allowed}, nil
		})
	}
	return &restrictedNamespaceClient{deniedNamespace: deniedNamespace, UserClientInterface: k8s}
}

// TestClusterHealthNamespacesParamInaccessible ensures the user-supplied namespaces
// parameter is authorized: a user without access to the namespace gets a 403 even
// when the namespace's health is present in the (ServiceAccount-populated) cache.

// TestClusterHealthNamespacesParamInaccessible ensures the user-supplied namespaces
// parameter is authorized: a user without access to the namespace gets a 403,
// fail closed, before any health data is computed or returned.
func TestClusterHealthNamespacesParamInaccessible(t *testing.T) {
	kubeObjects := []runtime.Object{fakeService("ns-victim", "victim-app"), setupMockData(), setupMockNamespace("ns-victim")}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts, _ := setupClustersHealthEndpoint(t, newRestrictedNamespaceClient(k8s, "ns-victim", []string{"ns", "ns-victim"}))

	mockClock()

	resp, err := http.Get(ts.URL + "/api/clusters/health?namespaces=ns-victim")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestClusterHealthNamespacesParamMixed ensures a multi-namespace request that
// includes a single inaccessible namespace is rejected wholesale instead of
// silently dropping it: partial data would make the UI show wrong aggregates.
func TestClusterHealthNamespacesParamMixed(t *testing.T) {
	kubeObjects := []runtime.Object{fakeService("ns", "reviews"), setupMockData(), setupMockNamespace("ns-victim")}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	ts, _ := setupClustersHealthEndpoint(t, newRestrictedNamespaceClient(k8s, "ns-victim", []string{"ns", "ns-victim"}))

	mockClock()

	resp, err := http.Get(ts.URL + "/api/clusters/health?namespaces=ns,ns-victim")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusForbidden, resp.StatusCode, string(actual))
}

// TestClusterHealthNamespacesParamListAuthorized ensures the authorization is
// LIST-based: a user that sees the namespace in their namespace LIST but is
// denied the per-namespace GET (e.g. header auth with the default
// require_namespace_get=false) is served health consistently, without depending
// on whether the per-token namespace cache is warm.
func TestClusterHealthNamespacesParamListAuthorized(t *testing.T) {
	kubeObjects := []runtime.Object{fakeService("ns-victim", "victim-app"), setupMockData(), setupMockNamespace("ns-victim")}
	k8s := kubetest.NewFakeK8sClient(kubeObjects...)
	k8s.OpenShift = true
	// The LIST includes both namespaces; only the per-namespace GET of
	// ns-victim is denied.
	ts, prom := setupClustersHealthEndpoint(t, newListAuthorizedNamespaceClient(k8s, "ns-victim", []string{"ns", "ns-victim"}))

	mockClock()
	conf := config.NewConfig()

	// v2.17 computes health on demand with the user's credentials; stub the
	// rates query the computation issues for the namespace.
	prom.On("GetAllRequestRates", mock.Anything, "ns-victim", conf.KubernetesConfig.ClusterName, mock.Anything, mock.Anything).Return(model.Vector{}, nil)

	resp, err := http.Get(ts.URL + "/api/clusters/health?namespaces=ns-victim")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusOK, resp.StatusCode, string(actual))
}
