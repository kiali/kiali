package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apinetworkingv1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tracing"
)

func TestIstioConfigDetailsExportedObjectValidation(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	objects := []runtime.Object{
		kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("sleep"), kubetest.FakeNamespace("istio-system"),
		&core_v1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
		&networking_v1.DestinationRule{
			ObjectMeta: metav1.ObjectMeta{Name: "external-dr", Namespace: "sleep"},
			Spec:       apinetworkingv1.DestinationRule{Host: "external.example.com"},
		},
	}
	// The object is visible only from sleep, where a second ServiceEntry
	// conflicts with it. Its own namespace's pass cannot produce the warning.
	for _, namespace := range []string{"bookinfo", "sleep"} {
		objects = append(objects, &networking_v1.ServiceEntry{
			ObjectMeta: metav1.ObjectMeta{Name: "exported", Namespace: namespace},
			Spec: apinetworkingv1.ServiceEntry{
				ExportTo: []string{"sleep"}, Hosts: []string{"external.example.com"},
				Ports: []*apinetworkingv1.ServicePort{{Name: "http", Number: 80, Protocol: "HTTP"}},
			},
		})
	}
	sa := kubetest.NewFakeK8sClient(objects...)
	sa.Token = "sa-token"
	user := kubetest.NewNamespaceRestrictedClient(kubetest.NewFakeK8sClient(objects...), "user-token", []string{"bookinfo", "sleep"})
	cf := kubetest.NewFakeClientFactoryWithClient(conf, user)
	cf.SAClients = map[string]kubernetes.ClientInterface{cluster: sa}
	kialiCache := cache.NewTestingCacheWithFactory(t, cf, *conf)
	discovery := &istiotest.FakeDiscovery{MeshReturn: models.Mesh{ControlPlanes: []models.ControlPlane{{
		Cluster:           &models.KubeCluster{IsKialiHome: true},
		IstiodNamespace:   "istio-system",
		ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}, {Name: "sleep"}, {Name: "istio-system"}},
		MeshConfig:        models.NewMeshConfig(),
		RootNamespace:     "istio-system",
	}}}}
	grafanaSvc, err := grafana.NewService(conf, user)
	require.NoError(t, err)
	handler := WithFakeAuthInfo(conf, IstioConfigDetails(conf, kialiCache, cf, nil, func() tracing.ClientInterface { return nil }, discovery, &business.FakeControlPlaneMonitor{}, grafanaSvc))
	request := mux.SetURLVars(httptest.NewRequest(http.MethodGet, "/api/namespaces/bookinfo/istio/networking.istio.io/v1/ServiceEntry/exported?validate=true", nil), map[string]string{
		"group": "networking.istio.io", "kind": "ServiceEntry", "namespace": "bookinfo", "object": "exported", "version": "v1",
	})
	response := httptest.NewRecorder()
	handler(response, request)
	require.Equal(t, http.StatusOK, response.Code, response.Body.String())
	var details models.IstioConfigDetails
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &details))
	require.NotNil(t, details.IstioValidation, "keep the exported-to namespace's validation")
	assert.Equal(t, "bookinfo", details.IstioValidation.Namespace)
	require.NotEmpty(t, details.IstioValidation.Checks)
	assert.Equal(t, "KIA1211", details.IstioValidation.Checks[0].Code)
	require.NotNil(t, details.IstioReferences)
	assert.Contains(t, details.IstioReferences.ObjectReferences, models.IstioReference{ObjectGVK: kubernetes.DestinationRules, Namespace: "sleep", Name: "external-dr"})
}
