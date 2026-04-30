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

	"github.com/kiali/kiali/business"
	"github.com/kiali/kiali/config"
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
