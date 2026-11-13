package business

import (
	"context"
	"fmt"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

func TestContextWithGatewayWaypointSplitCacheIdempotent(t *testing.T) {
	ctx := ContextWithGatewayWaypointSplitCache(context.Background())
	c1 := gatewayWaypointSplitCacheFromContext(ctx)
	ctx2 := ContextWithGatewayWaypointSplitCache(ctx)
	assert.Same(t, c1, gatewayWaypointSplitCacheFromContext(ctx2))
}

func TestWaypointTrafficSplitForServiceNoneOptOut(t *testing.T) {
	ns := &models.Namespace{
		Annotations: map[string]string{
			config.WaypointCanaryWeightAnnotation: "30",
		},
		Labels: map[string]string{
			config.WaypointCanaryUseLabel: "waypoint-v2",
			config.WaypointUseLabel:       "waypoint",
		},
		Name: "bookinfo",
	}
	svc := &models.Service{
		Labels: map[string]string{
			config.WaypointUseLabel: config.WaypointNone,
		},
		Namespace: "bookinfo",
	}
	assert.Nil(t, waypointTrafficSplitForService(svc, ns))
}

func TestWaypointTrafficSplitForServiceOverride(t *testing.T) {
	ns := &models.Namespace{
		Name: "bookinfo",
		Labels: map[string]string{
			config.WaypointUseLabel:       "waypoint",
			config.WaypointCanaryUseLabel: "waypoint-v2",
		},
		Annotations: map[string]string{
			config.WaypointCanaryWeightAnnotation: "30",
		},
	}
	svc := &models.Service{
		Namespace: "bookinfo",
		Labels: map[string]string{
			config.WaypointUseLabel:       "waypoint",
			config.WaypointCanaryUseLabel: "waypoint-v2",
		},
		Annotations: map[string]string{
			config.WaypointCanaryWeightAnnotation: "10",
		},
	}
	split := waypointTrafficSplitForService(svc, ns)
	assert.NotNil(t, split)
	assert.Equal(t, "service", split.ConfigLevel)
	assert.Equal(t, 10, split.CanaryWeight)
}

func TestMergeWaypointServiceRefsPrefersCanaryWithWeight(t *testing.T) {
	weight := 30
	primary := []models.ServiceReferenceInfo{{
		Cluster: "c", Name: "reviews", Namespace: "bookinfo", WaypointRole: models.WaypointRolePrimary, RoleWeight: nil,
	}}
	canary := []models.ServiceReferenceInfo{{
		Cluster: "c", Name: "reviews", Namespace: "bookinfo", WaypointRole: models.WaypointRoleCanary, RoleWeight: &weight, CanaryWeight: 30,
	}}
	merged := mergeWaypointServiceRefs(primary, canary)
	assert.Len(t, merged, 1)
	assert.Equal(t, models.WaypointRoleCanary, merged[0].WaypointRole)
	assert.Equal(t, 30, *merged[0].RoleWeight)
}

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
			ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "30"}, Labels: map[string]string{config.WaypointUseLabel: "primary", config.WaypointCanaryUseLabel: "canary", config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue}, Name: "bookinfo"}}
			if tc.namespacePrimaryOnly {
				delete(ns.Labels, config.WaypointCanaryUseLabel)
				ns.Annotations = nil
			}
			svc := &core_v1.Service{ObjectMeta: metav1.ObjectMeta{Annotations: tc.annotations, Labels: tc.labels, Name: "reviews", Namespace: ns.Name}}
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
			workloadSplit, serviceName := waypointTrafficSplitForWorkload(ctx, &layer.Workload, workload)
			assert.Equal(t, split, workloadSplit, "attached Services retain partial overrides on workload details")
			assert.Equal(t, svc.Name, serviceName)
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
	ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
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
			objects = append(objects, &core_v1.Service{ObjectMeta: metav1.ObjectMeta{Name: fmt.Sprintf("svc-%d", i), Namespace: namespace}})
		}
		objects = append(objects, &core_v1.Service{ObjectMeta: metav1.ObjectMeta{Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "80"}, Name: "override", Namespace: namespace}})
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

func TestGatewaySplitConfigsRespectNamespaceIdentity(t *testing.T) {
	for _, primaryNamespace := range []string{"source", "infra"} {
		for _, canaryNamespace := range []string{"source", "infra"} {
			for _, weight := range []string{"", "0", "25", "100"} {
				for _, serviceOverride := range []bool{false, true} {
					name := fmt.Sprintf("primary=%s/canary=%s/weight=%s/service=%t", primaryNamespace, canaryNamespace, weight, serviceOverride)
					t.Run(name, func(t *testing.T) {
						conf := config.NewConfig()
						conf.KubernetesConfig.ClusterName = "cluster-default"
						conf.ExternalServices.CustomDashboards.Enabled = false
						conf.ExternalServices.Istio.IstioAPIEnabled = false
						config.Set(conf)
						cluster := conf.KubernetesConfig.ClusterName
						source := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
							Annotations: map[string]string{},
							Labels:      map[string]string{config.WaypointUseLabel: "waypoint"},
							Name:        "source",
						}}
						if primaryNamespace != source.Name {
							source.Labels[config.WaypointUseNamespaceLabel] = primaryNamespace
						}
						if weight != "" {
							source.Labels[config.WaypointCanaryUseLabel] = "waypoint-canary"
							if canaryNamespace != source.Name {
								source.Labels[config.WaypointCanaryNamespaceLabel] = canaryNamespace
							}
							source.Annotations[config.WaypointCanaryWeightAnnotation] = weight
						}
						objects := []runtime.Object{source, kubetest.FakeNamespace("infra")}
						if serviceOverride {
							serviceLabels := map[string]string{}
							if weight == "" {
								serviceLabels[config.WaypointCanaryUseLabel] = "waypoint-canary"
								serviceLabels[config.WaypointCanaryNamespaceLabel] = canaryNamespace
							}
							objects = append(objects, &core_v1.Service{ObjectMeta: metav1.ObjectMeta{
								Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "80"},
								Labels:      serviceLabels,
								Name:        "reviews",
								Namespace:   source.Name,
							}})
						}
						waypoints := models.Workloads{}
						// Both namespaces contain identically named gateways. Only the
						// gateway identities in the bindings may receive split configs.
						for _, namespace := range []string{source.Name, "infra"} {
							for _, gateway := range []string{"waypoint", "waypoint-canary"} {
								labels := map[string]string{"app": gateway, config.WaypointFor: config.WaypointForAll, config.WaypointLabel: config.WaypointLabelValue}
								objects = append(objects, &apps_v1.Deployment{
									ObjectMeta: metav1.ObjectMeta{Name: gateway, Namespace: namespace},
									Spec: apps_v1.DeploymentSpec{
										Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": gateway}},
										Template: core_v1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: labels}},
									},
								})
								waypoints = append(waypoints, &models.Workload{WorkloadListItem: models.WorkloadListItem{Cluster: cluster, Labels: labels, Name: gateway, Namespace: namespace}})
							}
						}
						layer := NewLayerBuilder(t, conf).WithClient(kubetest.NewFakeK8sClient(objects...)).Build()
						layer.Workload.cache.SetWaypoints(waypoints)
						for _, gateway := range waypoints {
							detail, err := layer.Workload.GetWorkload(context.Background(), WorkloadCriteria{Cluster: cluster, Namespace: gateway.Namespace, WorkloadGVK: kubernetes.Deployments, WorkloadName: gateway.Name})
							require.NoError(t, err)
							require.True(t, detail.IsWaypoint)
							expectedCount := 0
							matches := gateway.Name == "waypoint" && gateway.Namespace == primaryNamespace || gateway.Name == "waypoint-canary" && gateway.Namespace == canaryNamespace
							if matches {
								if weight != "" {
									expectedCount++
								}
								if serviceOverride {
									expectedCount++
								}
							}
							require.Len(t, detail.WaypointTrafficSplitConfigs, expectedCount, "%s/%s", gateway.Namespace, gateway.Name)
							for _, cfg := range detail.WaypointTrafficSplitConfigs {
								require.NotNil(t, cfg.Split)
								require.NotNil(t, cfg.Split.Canary)
								assert.Equal(t, source.Name, cfg.Namespace)
								assert.Equal(t, models.WaypointBinding{Cluster: cluster, Name: "waypoint", Namespace: primaryNamespace, Role: models.WaypointRolePrimary}, cfg.Split.Primary)
								assert.Equal(t, models.WaypointBinding{Cluster: cluster, Name: "waypoint-canary", Namespace: canaryNamespace, Role: models.WaypointRoleCanary}, *cfg.Split.Canary)
								expectedWeight := 80
								if cfg.ConfigLevel == "namespace" {
									expectedWeight, err = strconv.Atoi(weight)
									require.NoError(t, err)
									assert.Empty(t, cfg.ServiceName)
								} else {
									assert.Equal(t, "service", cfg.ConfigLevel)
									assert.Equal(t, "reviews", cfg.ServiceName)
								}
								assert.Equal(t, expectedWeight, cfg.Split.CanaryWeight)
								assert.Equal(t, 100-expectedWeight, cfg.Split.PrimaryWeight)
							}
						}
					})
				}
			}
		}
	}
}

// Standalone Pods have no service-addressed path. A namespace canary cannot capture them.
func TestDirectWorkloadDoesNotInheritCanary(t *testing.T) {
	for _, podOverride := range []bool{false, true} {
		for _, weight := range []string{"", "0", "25", "100"} {
			t.Run(fmt.Sprintf("override=%t/weight=%s", podOverride, weight), func(t *testing.T) {
				conf := config.NewConfig()
				conf.KubernetesConfig.ClusterName = "cluster-default"
				conf.ExternalServices.Istio.IstioAPIEnabled = false
				conf.ExternalServices.CustomDashboards.Enabled = false
				config.Set(conf)
				ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
					Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: weight},
					Labels: map[string]string{
						config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
						config.WaypointCanaryUseLabel:     "canary",
						config.WaypointUseLabel:           "primary",
					},
					Name: "bookinfo",
				}}
				if weight == "" {
					delete(ns.Labels, config.WaypointCanaryUseLabel)
					ns.Annotations = nil
				}
				pod := &core_v1.Pod{ObjectMeta: metav1.ObjectMeta{Annotations: kubetest.FakeIstioAmbientAnnotations(), Labels: map[string]string{"app": "direct"}, Name: "direct-pod", Namespace: ns.Name}, Spec: core_v1.PodSpec{Containers: []core_v1.Container{{Image: "test", Name: "app"}}}}
				want := "primary"
				if podOverride {
					pod.Labels[config.WaypointUseLabel] = "own"
					want = "own"
				}
				ztunnel := &apps_v1.DaemonSet{ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{config.KubernetesAppLabel: config.Ztunnel}, Name: "ztunnel", Namespace: ns.Name}}
				layer := NewLayerBuilder(t, conf).WithClient(kubetest.NewFakeK8sClient(ns, pod, ztunnel)).Build()
				waypoints := models.Workloads{}
				for _, name := range []string{"primary", "canary", "own"} {
					waypoints = append(waypoints, &models.Workload{WorkloadListItem: models.WorkloadListItem{
						Cluster: conf.KubernetesConfig.ClusterName, Labels: map[string]string{config.WaypointFor: config.WaypointForAll, config.WaypointLabel: config.WaypointLabelValue}, Name: name, Namespace: ns.Name,
					}})
				}
				layer.Workload.cache.SetWaypoints(waypoints)
				detail, err := layer.Workload.GetWorkload(context.Background(), WorkloadCriteria{Cluster: conf.KubernetesConfig.ClusterName, IncludeServices: true, Namespace: ns.Name, WorkloadGVK: kubernetes.Pods, WorkloadName: pod.Name})
				require.NoError(t, err)
				require.Empty(t, detail.Services)
				got := []string{}
				for _, ref := range detail.WaypointWorkloads {
					got = append(got, ref.Name)
				}
				t.Logf("pod=%s selected services=%d waypoint refs=%v; direct primary=%s", pod.Name, len(detail.Services), got, want)
				assert.Equal(t, []string{want}, got)
				assert.Empty(t, detail.WaypointTrafficSplitConfigs, "direct workload traffic has no Service canary split")
			})
		}
	}
}

func TestServiceBackedWorkloadRetainsCanary(t *testing.T) {
	for _, tc := range []struct {
		annotations     map[string]string
		canary          string
		canaryNamespace string
		labels          map[string]string
		name            string
		weight          int
	}{
		{canary: "canary", canaryNamespace: "bookinfo", name: "namespace inheritance", weight: 25},
		{annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "0"}, canary: "canary", canaryNamespace: "bookinfo", name: "zero override", weight: 0},
		{annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "100"}, canary: "canary", canaryNamespace: "bookinfo", name: "full override", weight: 100},
		{annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "80"}, canary: "service-canary", canaryNamespace: "infra", labels: map[string]string{config.WaypointCanaryUseLabel: "service-canary", config.WaypointCanaryNamespaceLabel: "infra"}, name: "cross namespace override", weight: 80},
		{labels: map[string]string{config.WaypointCanaryUseLabel: config.WaypointNone}, name: "canary optout"},
		{labels: map[string]string{config.WaypointUseLabel: "primary"}, name: "explicit Service primary stops inheritance"},
	} {
		for _, includeServices := range []bool{false, true} {
			for _, podOverride := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/includeServices=%t/podOverride=%t", tc.name, includeServices, podOverride), func(t *testing.T) {
					conf := config.NewConfig()
					conf.KubernetesConfig.ClusterName = "cluster-default"
					conf.ExternalServices.Istio.IstioAPIEnabled = false
					conf.ExternalServices.CustomDashboards.Enabled = false
					config.Set(conf)
					cluster := conf.KubernetesConfig.ClusterName
					ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
						Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "25"},
						Labels:      map[string]string{config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue, config.WaypointUseLabel: "primary", config.WaypointCanaryUseLabel: "canary"},
						Name:        "bookinfo",
					}}
					pod := &core_v1.Pod{
						ObjectMeta: metav1.ObjectMeta{Annotations: kubetest.FakeIstioAmbientAnnotations(), Labels: map[string]string{"app": "reviews"}, Name: "reviews", Namespace: ns.Name},
						Spec:       core_v1.PodSpec{Containers: []core_v1.Container{{Image: "test", Name: "app"}}},
					}
					primary := "primary"
					if podOverride {
						pod.Labels[config.WaypointUseLabel] = "own"
						primary = "own"
					}
					svc := &core_v1.Service{
						ObjectMeta: metav1.ObjectMeta{Annotations: tc.annotations, Labels: tc.labels, Name: "reviews", Namespace: ns.Name},
						Spec:       core_v1.ServiceSpec{Selector: map[string]string{"app": "reviews"}},
					}
					ztunnel := &apps_v1.DaemonSet{ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{config.KubernetesAppLabel: config.Ztunnel}, Name: "ztunnel", Namespace: ns.Name}}
					layer, reader := newWaypointEnrollmentTestLayer(t, conf, ns, kubetest.FakeNamespace("infra"), pod, svc, ztunnel)
					waypoints := models.Workloads{}
					for _, name := range []string{"primary", "own", "canary", "service-canary"} {
						namespace := ns.Name
						if name == "service-canary" {
							namespace = "infra"
						}
						waypoints = append(waypoints, &models.Workload{WorkloadListItem: models.WorkloadListItem{
							Cluster:   cluster,
							Labels:    map[string]string{config.WaypointFor: config.WaypointForAll, config.WaypointLabel: config.WaypointLabelValue},
							Name:      name,
							Namespace: namespace,
						}})
					}
					layer.Workload.cache.SetWaypoints(waypoints)
					detail, err := layer.Workload.GetWorkload(context.Background(), WorkloadCriteria{Cluster: cluster, IncludeServices: includeServices, Namespace: ns.Name, WorkloadGVK: kubernetes.Pods, WorkloadName: pod.Name})
					require.NoError(t, err)
					require.NotEmpty(t, detail.WaypointWorkloads)
					assert.Equal(t, primary, detail.WaypointWorkloads[0].Name)
					if podOverride && !includeServices {
						// A direct binding alone cannot establish a Service relationship.
						// Keep its fast path; requesting Services below resolves that path.
						assert.Len(t, detail.WaypointWorkloads, 1)
						assert.Empty(t, detail.WaypointTrafficSplitConfigs)
						assert.Empty(t, detail.Services)
						assert.Zero(t, reader.serviceItemsRead.Load())
						return
					}
					require.Len(t, detail.WaypointTrafficSplitConfigs, 1)
					cfg := detail.WaypointTrafficSplitConfigs[0]
					if len(tc.labels) > 0 || len(tc.annotations) > 0 {
						assert.Equal(t, "service", cfg.ConfigLevel)
						assert.Equal(t, svc.Name, cfg.ServiceName)
					}
					if tc.canary == "" {
						assert.Len(t, detail.WaypointWorkloads, 1)
						assert.Nil(t, cfg.Split.Canary)
					} else {
						require.Len(t, detail.WaypointWorkloads, 2)
						ref := detail.WaypointWorkloads[1]
						assert.Equal(t, tc.canary, ref.Name)
						assert.Equal(t, tc.canaryNamespace, ref.Namespace)
						assert.Equal(t, models.WaypointRoleCanary, ref.WaypointRole)
						require.NotNil(t, ref.RoleWeight)
						assert.Equal(t, tc.weight, *ref.RoleWeight)
						assert.Equal(t, tc.weight, cfg.Split.CanaryWeight)
					}
					if includeServices {
						require.Len(t, detail.Services, 1)
					} else {
						assert.Empty(t, detail.Services, "resolving a split must not attach unrequested Services")
					}
				})
			}
		}
	}
}

func TestDirectWaypointBindingDoesNotScanServices(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "cluster-default"
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)
	ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
		Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "25"},
		Labels:      map[string]string{config.WaypointUseLabel: "primary", config.WaypointCanaryUseLabel: "canary"}, Name: "bookinfo",
	}}
	svc := &core_v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "unrelated", Namespace: ns.Name}}
	layer, reader := newWaypointEnrollmentTestLayer(t, conf, ns, svc)
	for _, gvk := range []schema.GroupVersionKind{kubernetes.Pods, kubernetes.Deployments, kubernetes.WorkloadGroups} {
		workload := models.Workload{
			WorkloadListItem: models.WorkloadListItem{Cluster: conf.KubernetesConfig.ClusterName, Labels: map[string]string{"app": "direct", config.WaypointUseLabel: "own"}, Namespace: ns.Name, TemplateLabels: map[string]string{config.WaypointUseLabel: "own"}, WorkloadGVK: gvk},
		}
		split, serviceName := waypointTrafficSplitForWorkload(context.Background(), &layer.Workload, workload)
		assert.Nil(t, split)
		assert.Empty(t, serviceName)
	}
	assert.Zero(t, reader.serviceItemsRead.Load(), "direct bindings must retain their no-Service-scan fast path")
}

func TestWorkloadListWaypointServiceLookupReuse(t *testing.T) {
	for _, weight := range []string{"", "0", "25", "100"} {
		t.Run("canaryWeight="+weight, func(t *testing.T) {
			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "cluster-default"
			conf.ExternalServices.Istio.IstioAPIEnabled = false
			config.Set(conf)
			cluster := conf.KubernetesConfig.ClusterName
			ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
				Labels: map[string]string{config.WaypointUseLabel: "primary"},
				Name:   "bookinfo",
			}}
			if weight != "" {
				ns.Labels[config.WaypointCanaryUseLabel] = "canary"
				ns.Annotations = map[string]string{config.WaypointCanaryWeightAnnotation: weight}
			}
			const count = 6
			objects := []runtime.Object{ns}
			for i := 0; i < count; i++ {
				name := fmt.Sprintf("app-%d", i)
				objects = append(objects,
					&core_v1.Pod{
						ObjectMeta: metav1.ObjectMeta{Annotations: kubetest.FakeIstioAmbientAnnotations(), Labels: map[string]string{"app": name}, Name: name, Namespace: ns.Name},
						Spec:       core_v1.PodSpec{Containers: []core_v1.Container{{Image: "example", Name: name}}},
					},
					&core_v1.Service{
						ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: ns.Name},
						Spec:       core_v1.ServiceSpec{Selector: map[string]string{"app": name}},
					},
				)
			}
			layer, reader := newWaypointEnrollmentTestLayer(t, conf, objects...)
			waypoints := models.Workloads{}
			for _, name := range []string{"primary", "canary"} {
				waypoints = append(waypoints, &models.Workload{WorkloadListItem: models.WorkloadListItem{
					Cluster:   cluster,
					Labels:    map[string]string{config.WaypointLabel: config.WaypointLabelValue, config.WaypointFor: config.WaypointForService},
					Name:      name,
					Namespace: ns.Name,
				}})
			}
			layer.Workload.cache.SetWaypoints(waypoints)
			list, err := layer.Workload.GetWorkloadList(context.Background(), WorkloadCriteria{Cluster: cluster, Namespace: ns.Name})
			require.NoError(t, err)
			require.Len(t, list.Workloads, count)
			// Each workload's Service selector requires one namespace scan. Resolving
			// its canary must not perform a second scan after capture is established.
			assert.Equal(t, int64(count*count), reader.serviceItemsRead.Load())
			expected := []models.WorkloadReferenceInfo{{Cluster: cluster, Name: "primary", Namespace: ns.Name, Type: config.WaypointForService, WaypointRole: models.WaypointRolePrimary}}
			if weight != "" {
				parsed, err := strconv.Atoi(weight)
				require.NoError(t, err)
				expected = append(expected, models.WorkloadReferenceInfo{CanaryWeight: parsed, Cluster: cluster, Name: "canary", Namespace: ns.Name, RoleWeight: &parsed, Type: config.WaypointForService, WaypointRole: models.WaypointRoleCanary})
			}
			for _, workload := range list.Workloads {
				assert.True(t, workload.IsAmbient, workload.Name)
				refs := layer.Workload.getWaypointsForWorkload(context.Background(), models.Workload{WorkloadListItem: workload}, false, waypoints)
				assert.Equal(t, expected, refs, workload.Name)
			}
		})
	}
}

func TestWorkloadWaypointLookupPreservesOptOut(t *testing.T) {
	for _, level := range []string{"namespace", "service", "pod"} {
		t.Run(level, func(t *testing.T) {
			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "cluster-default"
			conf.ExternalServices.Istio.IstioAPIEnabled = false
			config.Set(conf)
			ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
				Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "25"},
				Labels:      map[string]string{config.WaypointUseLabel: "primary", config.WaypointCanaryUseLabel: "canary"},
				Name:        "bookinfo",
			}}
			svc := &core_v1.Service{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{}, Name: "reviews", Namespace: ns.Name},
				Spec:       core_v1.ServiceSpec{Selector: map[string]string{"app": "reviews"}},
			}
			workload := models.Workload{WorkloadListItem: models.WorkloadListItem{
				Cluster:     conf.KubernetesConfig.ClusterName,
				Labels:      map[string]string{"app": "reviews"},
				Name:        "reviews",
				Namespace:   ns.Name,
				WorkloadGVK: kubernetes.Pods,
			}}
			switch level {
			case "namespace":
				ns.Labels[config.WaypointUseLabel] = config.WaypointNone
			case "service":
				svc.Labels[config.WaypointUseLabel] = config.WaypointNone
			case "pod":
				workload.Labels[config.WaypointUseLabel] = config.WaypointNone
			}
			layer, _ := newWaypointEnrollmentTestLayer(t, conf, ns, svc)
			ctx := context.Background()
			waypoints := models.Workloads{&models.Workload{WorkloadListItem: models.WorkloadListItem{
				Cluster:   workload.Cluster,
				Labels:    map[string]string{config.WaypointLabel: config.WaypointLabelValue},
				Name:      "canary",
				Namespace: ns.Name,
			}}}
			assert.Empty(t, layer.Workload.getWaypointsForWorkload(ctx, workload, false, waypoints))
			split, serviceName := waypointTrafficSplitForWorkload(ctx, &layer.Workload, workload)
			assert.Nil(t, split)
			assert.Empty(t, serviceName)
		})
	}
}
