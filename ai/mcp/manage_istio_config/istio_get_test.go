package manage_istio_config

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	istio_api_v1alpha3 "istio.io/api/networking/v1alpha3"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func TestIstioGet_ReturnsIstioConfigDetails(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	vs := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "reviews",
			Namespace: "bookinfo",
		},
		Spec: istio_api_v1alpha3.VirtualService{
			Hosts: []string{"reviews"},
		},
	}

	ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "bookinfo"}}
	k8s := kubetest.NewFakeK8sClient(ns, vs)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     "networking.istio.io",
		"version":   "v1",
		"kind":      "VirtualService",
		"object":    "reviews",
	}

	res, status := IstioGet(context.Background(), args, businessLayer, conf)
	require.Equal(t, http.StatusOK, status)

	details, ok := res.(models.IstioConfigDetails)
	require.True(t, ok, "expected models.IstioConfigDetails output, got %T", res)

	// Core shape: resource + gvk/namespace wrapper.
	assert.Equal(t, "bookinfo", details.Namespace.Name)
	assert.Equal(t, "networking.istio.io", details.ObjectGVK.Group)
	assert.Equal(t, "v1", details.ObjectGVK.Version)
	assert.Equal(t, "VirtualService", details.ObjectGVK.Kind)

	require.NotNil(t, details.VirtualService)
	assert.Equal(t, "reviews", details.VirtualService.Name)
	assert.Equal(t, "bookinfo", details.VirtualService.Namespace)
	assert.Equal(t, []string{"reviews"}, details.VirtualService.Spec.Hosts)
}

func TestExecuteReadOnly_GetExportedObjectValidation(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	objects := []runtime.Object{
		kubetest.FakeNamespace("bookinfo"), kubetest.FakeNamespace("sleep"), kubetest.FakeNamespace("istio-system"),
		&core_v1.ConfigMap{ObjectMeta: metav1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
		&networking_v1.DestinationRule{
			ObjectMeta: metav1.ObjectMeta{Name: "external-dr", Namespace: "sleep"},
			Spec:       istio_api_v1alpha3.DestinationRule{Host: "external.example.com"},
		},
	}
	// The object is visible only from sleep, where a second ServiceEntry
	// conflicts with it. Its own namespace's pass cannot produce the warning.
	for _, namespace := range []string{"bookinfo", "sleep"} {
		objects = append(objects, &networking_v1.ServiceEntry{
			ObjectMeta: metav1.ObjectMeta{Name: "exported", Namespace: namespace},
			Spec: istio_api_v1alpha3.ServiceEntry{
				ExportTo: []string{"sleep"}, Hosts: []string{"external.example.com"},
				Ports: []*istio_api_v1alpha3.ServicePort{{Name: "http", Number: 80, Protocol: "HTTP"}},
			},
		})
	}
	discovery := &istiotest.FakeDiscovery{MeshReturn: models.Mesh{ControlPlanes: []models.ControlPlane{{
		Cluster:           &models.KubeCluster{IsKialiHome: true},
		IstiodNamespace:   "istio-system",
		ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}, {Name: "sleep"}, {Name: "istio-system"}},
		MeshConfig:        models.NewMeshConfig(),
		RootNamespace:     "istio-system",
	}}}}

	k8s := kubetest.NewFakeK8sClient(objects...)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).WithDiscovery(discovery).Build()
	args := map[string]any{
		"action": "get", "group": "networking.istio.io", "kind": "ServiceEntry",
		"namespace": "bookinfo", "object": "exported", "version": "v1",
	}
	result, status := ExecuteReadOnly(kialiIntf(reqWithAuth(), businessLayer, conf), args)
	require.Equal(t, http.StatusOK, status)
	details, ok := result.(models.IstioConfigDetails)
	require.True(t, ok, "expected config details, got %T: %v", result, result)
	require.NotNil(t, details.IstioValidation, "keep the exported-to namespace's validation")
	assert.Equal(t, "bookinfo", details.IstioValidation.Namespace)
	require.NotEmpty(t, details.IstioValidation.Checks)
	assert.Equal(t, "KIA1211", details.IstioValidation.Checks[0].Code)
	require.NotNil(t, details.IstioReferences)
	assert.Contains(t, details.IstioReferences.ObjectReferences, models.IstioReference{ObjectGVK: kubernetes.DestinationRules, Namespace: "sleep", Name: "external-dr"})
}
