package business

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func TestServicePartialCanaryOverrides(t *testing.T) {
	for _, tc := range []struct {
		annotations          map[string]string
		labels               map[string]string
		name                 string
		namespacePrimaryOnly bool
		wantCanary           string
		wantWeight           int
	}{
		{annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "25"}, labels: map[string]string{config.WaypointCanaryUseLabel: "service-canary"}, name: "Service canary with inherited primary only", namespacePrimaryOnly: true, wantCanary: "service-canary", wantWeight: 25},
		{annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "80"}, name: "inherited primary with weight-only override", wantCanary: "canary", wantWeight: 80},
		{annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "0"}, name: "inherited primary with zero weight override", wantCanary: "canary", wantWeight: 0},
		{annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "100"}, name: "inherited primary with full promotion", wantCanary: "canary", wantWeight: 100},
		{labels: map[string]string{config.WaypointCanaryUseLabel: "service-canary"}, name: "inherited primary with canary name override", wantCanary: "service-canary", wantWeight: 30},
		{labels: map[string]string{config.WaypointCanaryUseLabel: "none"}, name: "inherited primary with canary optout", wantCanary: "", wantWeight: 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "cluster-default"
			conf.ExternalServices.Istio.IstioAPIEnabled = false
			config.Set(conf)
			ns := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "30"}, Labels: map[string]string{config.WaypointUseLabel: "primary", config.WaypointCanaryUseLabel: "canary", config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue}, Name: "bookinfo"}}
			if tc.namespacePrimaryOnly {
				delete(ns.Labels, config.WaypointCanaryUseLabel)
				ns.Annotations = nil
			}
			svc := &corev1.Service{ObjectMeta: metav1.ObjectMeta{Annotations: tc.annotations, Labels: tc.labels, Name: "reviews", Namespace: ns.Name}}
			layer := NewLayerBuilder(t, conf).WithClient(kubetest.NewFakeK8sClient(ns, svc)).Build()
			ctx := context.Background()
			nsm := models.CastNamespace(*ns, conf.KubernetesConfig.ClusterName)
			split := waypointTrafficSplitForService(&models.Service{Annotations: svc.Annotations, Cluster: conf.KubernetesConfig.ClusterName, Labels: svc.Labels, Name: svc.Name, Namespace: svc.Namespace}, &nsm)
			require.NotNil(t, split)
			gotName := ""
			if split.Canary != nil {
				gotName = split.Canary.Name
			}
			t.Logf("details resolver: primary=%s canary=%s weight=%d; want canary=%s weight=%d", split.Primary.Name, gotName, split.CanaryWeight, tc.wantCanary, tc.wantWeight)
			assert.Equal(t, tc.wantCanary, gotName)
			assert.Equal(t, tc.wantWeight, split.CanaryWeight)
			assert.Equal(t, "service", split.ConfigLevel)
			primary := layer.Svc.ListWaypointCapturedServices(ctx, "primary", ns.Name, conf.KubernetesConfig.ClusterName)
			require.Len(t, primary, 1)
			workload := models.Workload{
				Services: []models.ServiceOverview{{
					Annotations: svc.Annotations,
					Labels:      svc.Labels,
					Name:        svc.Name,
					Namespace:   svc.Namespace,
				}},
				WorkloadListItem: models.WorkloadListItem{
					Cluster:   conf.KubernetesConfig.ClusterName,
					Namespace: ns.Name,
				},
			}
			assert.Equal(t, split, waypointTrafficSplitForWorkload(ctx, &layer.Workload, workload), "attached Services retain partial overrides on workload details")
			primaryConfigs := layer.Svc.GatewayTrafficSplitConfigsFromEnrolledServices(ctx, "primary", ns.Name, conf.KubernetesConfig.ClusterName)
			if tc.wantCanary != "" {
				require.Len(t, primaryConfigs, 1)
				assert.Equal(t, tc.wantWeight, primaryConfigs[0].Split.CanaryWeight)
			} else {
				assert.Empty(t, primaryConfigs)
			}
			if tc.wantCanary != "" {
				if assert.NotNil(t, primary[0].RoleWeight) {
					assert.Equal(t, 100-tc.wantWeight, *primary[0].RoleWeight)
				}
			} else {
				assert.Nil(t, primary[0].RoleWeight)
			}
			for _, gateway := range []string{"canary", "service-canary"} {
				refs := layer.Svc.ListWaypointCapturedServices(ctx, gateway, ns.Name, conf.KubernetesConfig.ClusterName)
				t.Logf("gateway %s public enrollment: %+v", gateway, refs)
				configs := layer.Svc.GatewayTrafficSplitConfigsFromEnrolledServices(ctx, gateway, ns.Name, conf.KubernetesConfig.ClusterName)
				if gateway == tc.wantCanary {
					require.Len(t, configs, 1)
					assert.Equal(t, svc.Name, configs[0].ServiceName)
					assert.Equal(t, tc.wantWeight, configs[0].Split.CanaryWeight)
				} else {
					assert.Empty(t, configs)
				}
				if gateway == tc.wantCanary {
					if assert.Len(t, refs, 1) {
						assert.Equal(t, tc.wantWeight, refs[0].CanaryWeight)
					}
				} else {
					assert.Empty(t, refs)
				}
			}
		})
	}
}

func TestServiceSplitDiscoveryReusesEnrollmentCandidates(t *testing.T) {
	conf := config.NewConfig()
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)
	ns := &corev1.Namespace{ObjectMeta: metav1.ObjectMeta{
		Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "30"},
		Labels:      map[string]string{config.WaypointUseLabel: "primary", config.WaypointUseNamespaceLabel: "infra", config.WaypointCanaryUseLabel: "canary", config.WaypointCanaryNamespaceLabel: "infra"},
		Name:        "bookinfo",
	}}
	other := ns.DeepCopy()
	other.Name = "other"
	delete(other.Labels, config.WaypointUseNamespaceLabel)
	delete(other.Labels, config.WaypointCanaryNamespaceLabel)
	objects := []runtime.Object{ns, other, kubetest.FakeNamespace("infra")}
	for _, namespace := range []string{ns.Name, other.Name} {
		for i := 0; i < 20; i++ {
			objects = append(objects, &corev1.Service{ObjectMeta: metav1.ObjectMeta{Name: fmt.Sprintf("svc-%d", i), Namespace: namespace}})
		}
		objects = append(objects, &corev1.Service{ObjectMeta: metav1.ObjectMeta{Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "80"}, Name: "override", Namespace: namespace}})
	}
	layer, reader := newWaypointEnrollmentTestLayer(t, conf, objects...)
	ctx := ContextWithGatewayWaypointSplitCache(context.Background())
	for _, gateway := range []string{"primary", "canary"} {
		refs := layer.Svc.ListWaypointCapturedServices(ctx, gateway, "infra", conf.KubernetesConfig.ClusterName)
		require.Len(t, refs, 21)
		assert.Equal(t, int64(21), reader.serviceItemsRead.Load(), "share the inherited candidate list across both gateways; do not copy other namespace Services")
		configs := layer.Svc.GatewayTrafficSplitConfigsFromEnrolledServices(ctx, gateway, "infra", conf.KubernetesConfig.ClusterName)
		require.Len(t, configs, 1)
		assert.Equal(t, "override", configs[0].ServiceName)
		assert.Equal(t, 80, configs[0].Split.CanaryWeight)
		assert.Equal(t, int64(21), reader.serviceItemsRead.Load(), "split discovery must reuse enrollment's full namespace list")
	}
	configsForGateway := gatewayWaypointTrafficSplitConfigs(ctx, &layer.Workload, conf.KubernetesConfig.ClusterName, "infra", "primary")
	require.Len(t, configsForGateway, 2)
	assert.Empty(t, gatewayWaypointSplitCacheFromContext(ctx).services, "release full Service snapshots after the gateway's compact result is built")
	assert.Equal(t, int64(21), reader.serviceItemsRead.Load())
	// A fresh request must not reuse a previous request's Service metadata.
	fresh := ContextWithGatewayWaypointSplitCache(context.Background())
	configs := layer.Svc.GatewayTrafficSplitConfigsFromEnrolledServices(fresh, "primary", "infra", conf.KubernetesConfig.ClusterName)
	require.Len(t, configs, 1)
	assert.Equal(t, int64(42), reader.serviceItemsRead.Load())
}
