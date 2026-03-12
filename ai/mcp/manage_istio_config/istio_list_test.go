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
)

func TestMatchesServiceHost(t *testing.T) {
	tests := []struct {
		name        string
		host        string
		serviceName string
		want        bool
	}{
		{"exact match", "reviews", "reviews", true},
		{"FQDN match", "reviews.bookinfo.svc.cluster.local", "reviews", true},
		{"partial FQDN", "reviews.bookinfo", "reviews", true},
		{"no match", "ratings", "reviews", false},
		{"wildcard no match", "*.bookinfo.svc.cluster.local", "reviews", false},
		{"empty host", "", "reviews", false},
		{"empty service", "reviews", "", false},
		{"different service", "productpage", "reviews", false},
		{"FQDN different service", "productpage.bookinfo.svc.cluster.local", "reviews", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := matchesServiceHost(tt.host, tt.serviceName)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestIstioList_ReturnsCompactYAML(t *testing.T) {
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

	dr := &networking_v1.DestinationRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "reviews",
			Namespace: "bookinfo",
		},
		Spec: istio_api_v1alpha3.DestinationRule{
			Host: "reviews",
		},
	}

	ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "bookinfo"}}
	k8s := kubetest.NewFakeK8sClient(ns, vs, dr)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()

	args := map[string]interface{}{
		"namespace": "bookinfo",
	}

	res, status := IstioList(context.Background(), args, businessLayer, conf)
	require.Equal(t, http.StatusOK, status)

	out, ok := res.([]IstioListItem)
	require.True(t, ok, "expected []IstioListItem output, got %T", res)
	require.Len(t, out, 2)

	// Validate items are present and compact
	assert.Equal(t, "bookinfo", out[0].Namespace)
	assert.NotEmpty(t, out[0].Name)
	assert.NotEmpty(t, out[0].Group)
	assert.NotEmpty(t, out[0].Version)
	assert.NotEmpty(t, out[0].Kind)

	// Default validation when validations cannot be found (e.g., in unit tests)
	for _, item := range out {
		assert.True(t, item.Validation.Valid)
	}
}

func TestIstioList_FilterByService(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	vs1 := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{Name: "reviews-vs", Namespace: "bookinfo"},
		Spec: istio_api_v1alpha3.VirtualService{
			Hosts: []string{"reviews"},
			Http: []*istio_api_v1alpha3.HTTPRoute{
				{
					Route: []*istio_api_v1alpha3.HTTPRouteDestination{
						{Destination: &istio_api_v1alpha3.Destination{Host: "reviews"}},
					},
				},
			},
		},
	}

	vs2 := &networking_v1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{Name: "ratings-vs", Namespace: "bookinfo"},
		Spec: istio_api_v1alpha3.VirtualService{
			Hosts: []string{"ratings"},
		},
	}

	dr1 := &networking_v1.DestinationRule{
		ObjectMeta: metav1.ObjectMeta{Name: "reviews-dr", Namespace: "bookinfo"},
		Spec:       istio_api_v1alpha3.DestinationRule{Host: "reviews"},
	}

	dr2 := &networking_v1.DestinationRule{
		ObjectMeta: metav1.ObjectMeta{Name: "ratings-dr", Namespace: "bookinfo"},
		Spec:       istio_api_v1alpha3.DestinationRule{Host: "ratings"},
	}

	ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "bookinfo"}}
	k8s := kubetest.NewFakeK8sClient(ns, vs1, vs2, dr1, dr2)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()

	args := map[string]interface{}{
		"namespace":    "bookinfo",
		"service_name": "reviews",
	}

	res, status := IstioList(context.Background(), args, businessLayer, conf)
	require.Equal(t, http.StatusOK, status)

	out, ok := res.([]IstioListItem)
	require.True(t, ok, "expected []IstioListItem output, got %T", res)

	names := map[string]struct{}{}
	for _, item := range out {
		names[item.Name] = struct{}{}
	}

	// Should contain reviews-related configs
	_, hasReviewsVS := names["reviews-vs"]
	_, hasReviewsDR := names["reviews-dr"]
	assert.True(t, hasReviewsVS)
	assert.True(t, hasReviewsDR)

	// Should NOT contain ratings-related configs
	_, hasRatingsVS := names["ratings-vs"]
	_, hasRatingsDR := names["ratings-dr"]
	assert.False(t, hasRatingsVS)
	assert.False(t, hasRatingsDR)
}
