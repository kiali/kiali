package handlers

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
)

// setupIstioConfigListAllEndpoint wires the cluster-wide Istio config list
// handler (/api/istio/config) with separate SA and user clients: the SA
// clients are unfiltered (they see every namespace), the user client carries
// the restricted LIST reactor. It returns the endpoint's cache so tests can
// seed the SA-populated stores.
func setupIstioConfigListAllEndpoint(t *testing.T, k8s *kubetest.FakeK8sClient, userClient kubernetes.UserClientInterface) (*httptest.Server, cache.KialiCache) {
	t.Helper()
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false

	cf := kubetest.NewFakeClientFactoryWithClient(conf, userClient)
	// The SA must see every namespace even though the user cannot.
	cf.SAClients = kubernetes.ConvertFromUserClients(map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: k8s,
	})
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := istio.NewDiscovery(cf.GetSAClients(), kialiCache, conf)

	xapi := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient(*conf, k8s.GetToken())
	require.NoError(t, err)
	prom.Inject(xapi)

	cpm := &business.FakeControlPlaneMonitor{}
	traceLoader := func() tracing.ClientInterface { return nil }
	grafanaSvc, err := grafana.NewService(conf, kubetest.NewFakeK8sClient())
	require.NoError(t, err)

	handler := WithFakeAuthInfo(conf, IstioConfigList(conf, kialiCache, cf, prom, traceLoader, discovery, cpm, grafanaSvc))
	mr := mux.NewRouter()
	mr.HandleFunc("/api/istio/config", handler)

	ts := httptest.NewServer(mr)
	t.Cleanup(ts.Close)
	return ts, kialiCache
}

// TestIstioConfigListAllValidationsFiltered ensures the cluster-wide Istio
// config list with validate=true does not disclose validations (object
// GVK/name/namespace, check messages, references) for namespaces outside the
// user's accessible set: the validations cache is SA-populated, so the
// Kubernetes API cannot enforce the user's RBAC on it.
func TestIstioConfigListAllValidationsFiltered(t *testing.T) {
	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName

	// Distinct fakes for the SA and the user: the restricted client's LIST
	// reactor is prepended on its fake's clientset, so sharing one fake
	// would filter the SA's namespace listing too. The namespaces exist in
	// both fakes (the SA can see them), but the user's LIST only includes
	// bookinfo.
	sa := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("victim-ns"),
	)
	userFake := kubetest.NewFakeK8sClient(
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("victim-ns"),
	)
	userClient := newRestrictedNamespaceClient(userFake, "victim-ns", []string{"bookinfo"})
	ts, kialiCache := setupIstioConfigListAllEndpoint(t, sa, userClient)

	// Seed the SA-populated validations cache with entries in both
	// namespaces; the bookinfo entry references an object in the victim
	// namespace.
	allowedKey := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "bookinfo", Name: "vs-allowed", Cluster: cluster}
	victimKey := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "victim-ns", Name: "vs-victim", Cluster: cluster}
	allowedRef := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "bookinfo", Name: "ref-allowed", Cluster: cluster}
	victimRef := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "victim-ns", Name: "ref-victim", Cluster: cluster}
	kialiCache.Validations().Replace(map[models.IstioValidationKey]*models.IstioValidation{
		allowedKey: {
			Name: "vs-allowed", Namespace: "bookinfo", Cluster: cluster,
			ObjectGVK:  kubernetes.VirtualServices,
			Valid:      true,
			References: []models.IstioValidationKey{allowedRef, victimRef},
		},
		victimKey: {
			Name: "vs-victim", Namespace: "victim-ns", Cluster: cluster,
			ObjectGVK: kubernetes.VirtualServices,
			Valid:     false,
		},
	})

	resp, err := http.Get(ts.URL + "/api/istio/config?validate=true")
	require.NoError(t, err)
	actual, _ := io.ReadAll(resp.Body)

	assert.Equal(t, http.StatusOK, resp.StatusCode, string(actual))
	assert.Contains(t, string(actual), "vs-allowed", "validations for the accessible namespace must be returned")
	assert.NotContains(t, string(actual), "vs-victim", "validations for the denied namespace must not be returned")
	assert.NotContains(t, string(actual), "ref-victim", "references into the denied namespace must be pruned")
	assert.NotContains(t, string(actual), "victim-ns", "no denied-namespace data may appear in the response")
}
