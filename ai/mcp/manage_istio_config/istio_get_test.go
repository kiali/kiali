package manage_istio_config

import (
	"context"
	"net/http"
	"strings"
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
)

func TestIstioGet_ReturnsCompactYAML(t *testing.T) {
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

	out, ok := res.(string)
	require.True(t, ok, "expected string output, got %T", res)

	assert.True(t, strings.HasPrefix(out, "~~~\n"), "expected output wrapped in code block")
	assert.Contains(t, out, "apiVersion: networking.istio.io/v1")
	assert.Contains(t, out, "kind: VirtualService")
	assert.Contains(t, out, "metadata:")
	assert.Contains(t, out, "name: reviews")
	assert.Contains(t, out, "namespace: bookinfo")
	assert.Contains(t, out, "spec:")

	// Ensure it is not verbose (no extra sections from IstioConfigDetails wrapper).
	assert.NotContains(t, out, "\"validation\"")
	assert.NotContains(t, out, "\"references\"")
	assert.NotContains(t, out, "resourceVersion:")
	assert.NotContains(t, out, "managedFields:")
	assert.NotContains(t, out, "status:")
}
