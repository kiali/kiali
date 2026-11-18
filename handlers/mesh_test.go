package handlers_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	prom_v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/clientcmd/api"
	ctrlclient "sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/handlers"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/perses"
	"github.com/kiali/kiali/prometheus"
	"github.com/kiali/kiali/prometheus/prometheustest"
	"github.com/kiali/kiali/tracing"
	"github.com/kiali/kiali/util/certtest"
)

// Fails if resp status is non-200
func checkStatus(t *testing.T, expectedCode int, resp *http.Response) {
	if resp.StatusCode != expectedCode {
		// Attempt to read body to get more info.
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Logf("Unable to read response body: %s", err)
		}
		t.Fatalf("Expected status code 200, got %d. Body: %s", resp.StatusCode, string(body))
	}
}

func TestGetMeshGraph(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "Kubernetes"
	kubernetes.SetConfig(t, *conf)

	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(
			kubetest.FakeNamespace(config.IstioNamespaceDefault),
			// Ideally we wouldn't need to set all this stuff up here but there's not a good way
			// mock out the business.IstioStatus service since it's a struct.
			&appsv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istiod",
					Namespace: config.IstioNamespaceDefault,
					Labels: map[string]string{
						"app":          "istiod",
						"istio.io/rev": "default",
					},
				},
				Spec: appsv1.DeploymentSpec{
					Template: corev1.PodTemplateSpec{
						ObjectMeta: metav1.ObjectMeta{
							Labels: map[string]string{"app": "istiod", "istio.io/rev": "default"},
						},
					},
				},
			},
			&corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "istio",
					Namespace: config.IstioNamespaceDefault,
					Labels:    map[string]string{"istio.io/rev": "default"},
				},
				Data: map[string]string{"mesh": ""},
			},
			certtest.FakeIstioCertificateConfigMap(config.IstioNamespaceDefault),
		),
	}
	cf := kubetest.NewFakeClientFactory(conf, clients)
	cf.SAClients = kubernetes.ConvertFromUserClients(clients)
	cf.SAClients["spoke"] = kubetest.NewFakeK8sClient(kubetest.FakeNamespace("public"), kubetest.FakeNamespace("private"))
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	grafanaSvc, err := grafana.NewService(conf, clients[conf.KubernetesConfig.ClusterName])
	require.NoError(err)
	discovery := istio.NewDiscovery(cf.SAClients, cache, conf)
	persesSvc, err := perses.NewService(conf, clients[conf.KubernetesConfig.ClusterName])
	require.NoError(err)

	xapi := new(prometheustest.PromAPIMock)
	prom, err := prometheus.NewClient(*conf, clients[conf.KubernetesConfig.ClusterName].GetToken())
	require.NoError(err)
	prom.Inject(xapi)

	// Add mock expectation for Buildinfo to fix the test
	xapi.On("Buildinfo", mock.AnythingOfType("*context.valueCtx")).Return(prom_v1.BuildinfoResult{
		Version:   "2.35.0",
		BuildDate: "2023-01-01T00:00:00Z",
		Revision:  "abcdef123456",
	}, nil)

	cpm := &business.FakeControlPlaneMonitor{}
	traceLoader := func() tracing.ClientInterface { return nil }

	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test"}}
	resolved, err := discovery.Mesh(t.Context())
	require.NoError(err)
	require.Len(resolved.ControlPlanes, 1)
	snapshot := *resolved
	snapshot.ControlPlanes = append([]models.ControlPlane(nil), resolved.ControlPlanes...)
	snapshot.ControlPlanes[0].ManagedClusters = []*models.KubeCluster{snapshot.ControlPlanes[0].Cluster, {Name: "spoke"}}
	snapshot.ControlPlanes[0].ManagedNamespaces = []models.Namespace{
		{Cluster: conf.KubernetesConfig.ClusterName, Name: "istio-system", Annotations: map[string]string{"fixture": "visible-metadata"}},
		{Cluster: "spoke", Name: "public", Annotations: map[string]string{"fixture": "permitted-spoke-metadata"}},
		{Cluster: "spoke", Name: "private", Annotations: map[string]string{"fixture": "private-metadata"}},
	}
	cache.SetMesh(&snapshot)
	handler := handlers.MeshGraph(conf, cf, cache, grafanaSvc, persesSvc, prom, traceLoader, discovery, cpm)
	server := httptest.NewServer(handlers.WithAuthInfo(authInfo, handler))
	t.Cleanup(server.Close)

	readGraph := func() string {
		resp, err := http.Get(server.URL + "/api/mesh/graph")
		require.NoError(err)
		checkStatus(t, http.StatusOK, resp)
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		require.NoError(err)
		return string(body)
	}
	body := readGraph()
	require.Contains(body, "visible-metadata")
	require.NotContains(body, "private-metadata")
	require.NotContains(body, "permitted-spoke-metadata")
	cf.SetClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: clients[conf.KubernetesConfig.ClusterName], "spoke": kubetest.NewNamespaceRestrictedClient(kubetest.NewFakeK8sClient(), "spoke-user", []string{"public"}, "private")})
	body = readGraph()
	require.Equal(2, strings.Count(body, "permitted-spoke-metadata"), "Istiod and data-plane nodes should both contain the authorized spoke namespace")
	require.NotContains(body, "private-metadata")
	require.Len(snapshot.ControlPlanes[0].ManagedNamespaces, 3)
}

type unavailableNamespaceClient struct {
	kubernetes.UserClientInterface
	lists int
}

func (c *unavailableNamespaceClient) GetCacheKey() string { return "unavailable-user" }
func (c *unavailableNamespaceClient) GetNamespaces(context.Context, string) ([]corev1.Namespace, error) {
	c.lists++
	return nil, context.DeadlineExceeded
}

func TestControlPlanes(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	conf.KialiInternal.KubernetesClient.NamespaceComputeBackoff = 0
	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system")),
	}
	cf := kubetest.NewFakeClientFactory(conf, clients)
	spoke := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("public"), kubetest.FakeNamespace("private"))
	cf.SAClients = map[string]kubernetes.ClientInterface{conf.KubernetesConfig.ClusterName: clients[conf.KubernetesConfig.ClusterName], "spoke": spoke}
	access := cache.NewClusterAccess(func(_ context.Context, _, _, resource string) (cache.DeniedAccess, error) {
		if resource == "pods" {
			return cache.DeniedAccess{Cluster: true}, nil
		}
		return cache.DeniedAccess{Namespaces: []string{"public"}}, nil
	})
	readers := map[string]ctrlclient.Reader{conf.KubernetesConfig.ClusterName: clients[conf.KubernetesConfig.ClusterName], "spoke": spoke}
	cache, err := cache.NewKialiCache(t.Context(), cf.SAClients, readers, *conf, cache.WithClusterAccess(access))
	require.NoError(err)
	mesh := models.Mesh{
		ControlPlanes: []models.ControlPlane{
			{
				Cluster:           &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
				IstiodNamespace:   "istio-system",
				ManagedClusters:   []*models.KubeCluster{{Name: conf.KubernetesConfig.ClusterName}},
				ManagedNamespaces: []models.Namespace{{Name: "istio-system", Cluster: conf.KubernetesConfig.ClusterName}, {Name: "private", Cluster: "spoke"}, {Name: "public", Cluster: "spoke"}},
			},
		},
	}
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: mesh,
	}
	cpm := &business.FakeControlPlaneMonitor{}
	prom, err := prometheus.NewClient(*conf, clients[conf.KubernetesConfig.ClusterName].GetToken())
	require.NoError(err)
	traceLoader := func() tracing.ClientInterface { return nil }
	grafanaSvc, err := grafana.NewService(conf, clients[conf.KubernetesConfig.ClusterName])
	require.NoError(err)

	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test"}}
	handler := handlers.WithAuthInfo(authInfo, handlers.ControlPlanes(cache, cf, conf, discovery, cpm, prom, traceLoader, grafanaSvc))
	r := httptest.NewRequest("GET", "/api/mesh/controlplanes", nil)
	w := httptest.NewRecorder()

	handler(w, r)

	resp := w.Result()
	body, err := io.ReadAll(resp.Body)
	require.NoError(err)
	require.Equal(200, resp.StatusCode)

	var controlPlaneResponse []models.ControlPlane
	require.NoError(json.Unmarshal(body, &controlPlaneResponse))

	require.Len(controlPlaneResponse, 1)
	require.Len(controlPlaneResponse[0].ManagedNamespaces, 1)
	require.Equal("istio-system", controlPlaneResponse[0].ManagedNamespaces[0].Name)
	require.Len(discovery.MeshReturn.ControlPlanes[0].ManagedNamespaces, 3)
	limitedClients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: clients[conf.KubernetesConfig.ClusterName],
		"spoke":                           kubetest.NewNamespaceRestrictedClient(kubetest.NewFakeK8sClient(), "second-user", []string{"public"}, "private"),
	}
	cf.SetClients(limitedClients)
	w = httptest.NewRecorder()
	handler(w, r)
	require.Equal(http.StatusOK, w.Code, w.Body.String())
	require.NoError(json.Unmarshal(w.Body.Bytes(), &controlPlaneResponse))
	require.Equal([]models.Namespace{{Name: "istio-system", Cluster: conf.KubernetesConfig.ClusterName}, {Name: "public", Cluster: "spoke"}}, controlPlaneResponse[0].ManagedNamespaces)
	require.Len(discovery.MeshReturn.ControlPlanes[0].ManagedNamespaces, 3)
	stalled := &unavailableNamespaceClient{UserClientInterface: spoke}
	cf.SetClients(map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: clients[conf.KubernetesConfig.ClusterName], "spoke": stalled})
	w = httptest.NewRecorder()
	handler(w, r)
	require.Equal(http.StatusOK, w.Code)
	require.Equal(1, stalled.lists, "a failing cluster should be checked at most once per response")
	cf.SetClients(limitedClients)

	for _, resource := range []string{"deployments", "pods"} {
		access.ConfirmRevoked(t.Context(), "spoke", "", resource)
		w = httptest.NewRecorder()
		handler(w, r)
		require.Equal(http.StatusOK, w.Code)
		require.NoError(json.Unmarshal(w.Body.Bytes(), &controlPlaneResponse))
		require.Equal([]models.Namespace{{Name: "istio-system", Cluster: conf.KubernetesConfig.ClusterName}}, controlPlaneResponse[0].ManagedNamespaces)
	}
}

// TestControlPlanesInaccessibleNamespace guards the fail-closed control plane
// filter: a control plane whose istiod namespace is not in the user's
// accessible set must not be returned (previously any non-Forbidden error —
// including an inaccessible namespace — kept the control plane).
func TestControlPlanesInaccessibleNamespace(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	// The istio-system namespace exists, but the user's LIST excludes it.
	k8s := kubetest.NewFakeK8sClient(kubetest.FakeNamespace("istio-system"))
	clients := map[string]kubernetes.UserClientInterface{
		conf.KubernetesConfig.ClusterName: kubetest.NewNamespaceRestrictedClient(k8s, "restricted-user", []string{"bookinfo"}, "istio-system"),
	}
	cf := kubetest.NewFakeClientFactory(conf, clients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	mesh := models.Mesh{
		ControlPlanes: []models.ControlPlane{
			{
				Cluster:         &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName},
				IstiodNamespace: "istio-system",
				ManagedClusters: []*models.KubeCluster{{Name: conf.KubernetesConfig.ClusterName}},
			},
		},
	}
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: mesh,
	}
	cpm := &business.FakeControlPlaneMonitor{}
	prom, err := prometheus.NewClient(*conf, clients[conf.KubernetesConfig.ClusterName].GetToken())
	require.NoError(err)
	traceLoader := func() tracing.ClientInterface { return nil }
	grafanaSvc, err := grafana.NewService(conf, clients[conf.KubernetesConfig.ClusterName])
	require.NoError(err)

	authInfo := map[string]*api.AuthInfo{conf.KubernetesConfig.ClusterName: {Token: "test"}}
	handler := handlers.WithAuthInfo(authInfo, handlers.ControlPlanes(cache, cf, conf, discovery, cpm, prom, traceLoader, grafanaSvc))
	r := httptest.NewRequest("GET", "/api/mesh/controlplanes", nil)
	w := httptest.NewRecorder()

	handler(w, r)

	resp := w.Result()
	body, err := io.ReadAll(resp.Body)
	require.NoError(err)
	require.Equal(200, resp.StatusCode)

	var controlPlaneResponse []models.ControlPlane
	require.NoError(json.Unmarshal(body, &controlPlaneResponse))
	require.Empty(controlPlaneResponse)
}

func TestControlPlanesUnauthorized(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	clients := map[string]kubernetes.UserClientInterface{conf.KubernetesConfig.ClusterName: kubetest.NewFakeK8sClient()}
	cf := kubetest.NewFakeClientFactory(conf, clients)
	cache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	mesh := models.Mesh{
		ControlPlanes: []models.ControlPlane{
			{
				Cluster:         &models.KubeCluster{Name: "east"},
				ManagedClusters: []*models.KubeCluster{{Name: "east"}},
			},
		},
	}
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: mesh,
	}
	cpm := &business.FakeControlPlaneMonitor{}
	prom, err := prometheus.NewClient(*conf, clients[conf.KubernetesConfig.ClusterName].GetToken())
	require.NoError(err)
	traceLoader := func() tracing.ClientInterface { return nil }
	grafanaSvc, err := grafana.NewService(conf, clients[conf.KubernetesConfig.ClusterName])
	require.NoError(err)

	handler := handlers.ControlPlanes(cache, cf, conf, discovery, cpm, prom, traceLoader, grafanaSvc)
	r := httptest.NewRequest("GET", "/api/mesh/controlplanes", nil)
	w := httptest.NewRecorder()

	handler(w, r)

	resp := w.Result()
	require.Equal(500, resp.StatusCode)
}
