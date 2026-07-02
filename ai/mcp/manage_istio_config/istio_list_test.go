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
	"github.com/kiali/kiali/kubernetes"
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

func TestIstioList_ReturnsGroupedOutput(t *testing.T) {
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

	result, ok := res.(IstioListResult)
	require.True(t, ok, "expected IstioListResult output, got %T", res)
	require.Equal(t, "east", result.Cluster)

	// Both resources are in the bookinfo namespace.
	bookinfo, ok := result.Namespaces["bookinfo"]
	require.True(t, ok, "expected bookinfo namespace in result")

	// VirtualService and DestinationRule should each appear under their own GVK key.
	vsKey := "networking.istio.io/v1/VirtualService"
	drKey := "networking.istio.io/v1/DestinationRule"
	require.Contains(t, bookinfo, vsKey)
	require.Contains(t, bookinfo, drKey)

	// Default validation (no validation store in unit tests) → all in valid array, invalid empty.
	assert.Equal(t, []string{"reviews"}, bookinfo[vsKey].Valid)
	assert.Empty(t, bookinfo[vsKey].Invalid)
	assert.Equal(t, []string{"reviews"}, bookinfo[drKey].Valid)
	assert.Empty(t, bookinfo[drKey].Invalid)
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
		"namespace":   "bookinfo",
		"serviceName": "reviews",
	}

	res, status := IstioList(context.Background(), args, businessLayer, conf)
	require.Equal(t, http.StatusOK, status)

	result, ok := res.(IstioListResult)
	require.True(t, ok, "expected IstioListResult output, got %T", res)

	// Collect all names across all namespaces and GVK groups.
	names := map[string]struct{}{}
	for _, kinds := range result.Namespaces {
		for _, kvr := range kinds {
			for _, n := range kvr.Valid {
				names[n] = struct{}{}
			}
			for _, n := range kvr.Invalid {
				names[n] = struct{}{}
			}
		}
	}

	// Should contain reviews-related configs.
	_, hasReviewsVS := names["reviews-vs"]
	_, hasReviewsDR := names["reviews-dr"]
	assert.True(t, hasReviewsVS)
	assert.True(t, hasReviewsDR)

	// Should NOT contain ratings-related configs.
	_, hasRatingsVS := names["ratings-vs"]
	_, hasRatingsDR := names["ratings-dr"]
	assert.False(t, hasRatingsVS)
	assert.False(t, hasRatingsDR)
}

func TestCriteriaForListFilter(t *testing.T) {
	tests := []struct {
		name          string
		group         string
		kind          string
		expectDefault bool
		checkField    func(business.IstioConfigCriteria) bool
	}{
		{
			name:       "TrafficExtension returns targeted criteria",
			group:      "extensions.istio.io",
			kind:       "TrafficExtension",
			checkField: func(c business.IstioConfigCriteria) bool { return c.IncludeTrafficExtensions },
		},
		{
			name:       "WasmPlugin returns targeted criteria",
			group:      "extensions.istio.io",
			kind:       "WasmPlugin",
			checkField: func(c business.IstioConfigCriteria) bool { return c.IncludeWasmPlugins },
		},
		{
			name:       "Telemetry returns targeted criteria",
			group:      "telemetry.istio.io",
			kind:       "Telemetry",
			checkField: func(c business.IstioConfigCriteria) bool { return c.IncludeTelemetry },
		},
		{
			name:       "VirtualService returns targeted criteria",
			group:      "networking.istio.io",
			kind:       "VirtualService",
			checkField: func(c business.IstioConfigCriteria) bool { return c.IncludeVirtualServices },
		},
		{
			name:       "DestinationRule returns targeted criteria",
			group:      "networking.istio.io",
			kind:       "DestinationRule",
			checkField: func(c business.IstioConfigCriteria) bool { return c.IncludeDestinationRules },
		},
		{
			name:          "unknown group/kind returns default (include-all) criteria",
			group:         "unknown.io",
			kind:          "Unknown",
			expectDefault: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := criteriaForListFilter(tt.group, tt.kind)

			if tt.expectDefault {
				assert.True(t, c.IncludeTrafficExtensions)
				assert.True(t, c.IncludeWasmPlugins)
				assert.True(t, c.IncludeVirtualServices)
				assert.True(t, c.IncludeTelemetry)
				return
			}

			assert.True(t, tt.checkField(c), "expected criteria field to be true for %s/%s", tt.group, tt.kind)

			allOthersOff := !c.IncludeGateways &&
				!c.IncludeK8sGateways &&
				!c.IncludeK8sGRPCRoutes &&
				!c.IncludeK8sHTTPRoutes
			assert.True(t, allOthersOff, "non-targeted criteria fields should remain false for %s/%s", tt.group, tt.kind)
		})
	}
}

func TestCriteriaForListFilter_ExtensionsMutualExclusion(t *testing.T) {
	txCriteria := criteriaForListFilter("extensions.istio.io", "TrafficExtension")
	assert.True(t, txCriteria.IncludeTrafficExtensions)
	assert.False(t, txCriteria.IncludeWasmPlugins)

	wpCriteria := criteriaForListFilter("extensions.istio.io", "WasmPlugin")
	assert.True(t, wpCriteria.IncludeWasmPlugins)
	assert.False(t, wpCriteria.IncludeTrafficExtensions)
}

func TestCriteriaForListFilter_UnknownKindInKnownGroup(t *testing.T) {
	c := criteriaForListFilter("extensions.istio.io", "NonExistent")
	assert.True(t, c.IncludeTrafficExtensions, "unknown kind in known group should fall through to default")
	assert.True(t, c.IncludeWasmPlugins)
	assert.True(t, c.IncludeVirtualServices)
}

func TestIstioList_IncludesTrafficExtensions(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "east"
	config.Set(conf)

	ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "bookinfo"}}
	k8s := kubetest.NewFakeK8sClient(ns)
	businessLayer := business.NewLayerBuilder(t, conf).WithClient(k8s).Build()

	args := map[string]interface{}{
		"namespace": "bookinfo",
		"group":     kubernetes.TrafficExtensions.Group,
		"kind":      kubernetes.TrafficExtensions.Kind,
	}

	res, status := IstioList(context.Background(), args, businessLayer, conf)
	require.Equal(t, http.StatusOK, status)

	result, ok := res.(IstioListResult)
	require.True(t, ok)
	assert.Equal(t, "east", result.Cluster)
	assert.Empty(t, result.Namespaces)
}
