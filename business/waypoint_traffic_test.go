package business

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

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

// Exercise the public enrollment path: service overrides must not inherit any namespace weight.
func TestListWaypointCapturedServicesEffectiveSplit(t *testing.T) {
	for _, tc := range []struct {
		canary        string
		canaryWeight  int
		name          string
		primary       string
		primaryWeight *int
		weight        string
	}{
		{canary: "canary", canaryWeight: 15, name: "service override", primary: "primary", primaryWeight: ptr.To(85), weight: "15"},
		{canary: "canary", canaryWeight: 0, name: "zero", primary: "primary", primaryWeight: ptr.To(100), weight: "0"},
		{canary: "canary", canaryWeight: 100, name: "promotion", primary: "primary", primaryWeight: ptr.To(0), weight: "100"},
		{canary: "canary", canaryWeight: 0, name: "unset weight", primary: "primary", primaryWeight: ptr.To(100)},
		{canary: "canary", name: "invalid weight", primary: "primary", weight: "101"},
		{name: "primary only", primary: "primary"},
		{canary: "canary", name: "opt out with stale canary", primary: config.WaypointNone, weight: "40"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "cluster-default"
			conf.ExternalServices.Istio.IstioAPIEnabled = false
			config.Set(conf)
			ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
				Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "65"},
				Labels:      map[string]string{config.WaypointUseLabel: "primary", config.WaypointCanaryUseLabel: "canary"},
				Name:        "bookinfo",
			}}
			service := &core_v1.Service{ObjectMeta: metav1.ObjectMeta{
				Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: tc.weight},
				Labels:      map[string]string{config.WaypointUseLabel: tc.primary, config.WaypointCanaryUseLabel: tc.canary},
				Name:        "reviews",
				Namespace:   "bookinfo",
			}}
			layer := NewLayerBuilder(t, conf).WithClient(kubetest.NewFakeK8sClient(ns, service)).Build()
			primary := layer.Svc.ListWaypointCapturedServices(context.Background(), "primary", "bookinfo", conf.KubernetesConfig.ClusterName)
			canary := layer.Svc.ListWaypointCapturedServices(context.Background(), "canary", "bookinfo", conf.KubernetesConfig.ClusterName)
			if tc.primary == config.WaypointNone {
				assert.Empty(t, primary)
				assert.Empty(t, canary)
				return
			}
			require.Len(t, primary, 1)
			assert.Equal(t, "service", primary[0].LabelType)
			assert.Equal(t, models.WaypointRolePrimary, primary[0].WaypointRole)
			assert.Equal(t, tc.primaryWeight, primary[0].RoleWeight)
			if tc.primaryWeight == nil {
				assert.Empty(t, canary)
				return
			}
			require.Len(t, canary, 1)
			assert.Equal(t, models.WaypointRoleCanary, canary[0].WaypointRole)
			assert.Equal(t, tc.canaryWeight, canary[0].CanaryWeight)
			require.NotNil(t, canary[0].RoleWeight)
			assert.Equal(t, tc.canaryWeight, *canary[0].RoleWeight)
			// The frontend must receive explicit zeroes at both rollout endpoints.
			for _, ref := range []models.ServiceReferenceInfo{primary[0], canary[0]} {
				data, err := json.Marshal(ref)
				require.NoError(t, err)
				var decoded map[string]any
				require.NoError(t, json.Unmarshal(data, &decoded))
				assert.Equal(t, float64(*ref.RoleWeight), decoded["roleWeight"])
			}
		})
	}
}

func TestListWaypointWorkloadsWorkloadNamespacePrimaryEnrollment(t *testing.T) {
	for name, gatewayNamespace := range map[string]string{
		"same namespace":  "bookinfo",
		"cross namespace": "infra",
	} {
		t.Run(name, func(t *testing.T) {
			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "cluster-default"
			conf.ExternalServices.Istio.IstioAPIEnabled = false
			config.Set(conf)

			ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
				Labels: map[string]string{
					config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
					config.WaypointUseLabel:           "bwaypoint",
				},
				Name: "bookinfo",
			}}
			if gatewayNamespace != ns.Name {
				ns.Labels[config.WaypointUseNamespaceLabel] = gatewayNamespace
			}
			deployment := FakeDeploymentWithPort("ratings", 9080)
			layer := NewLayerBuilder(t, conf).WithClient(kubetest.NewFakeK8sClient(ns, deployment)).Build()
			waypoints := models.Workloads{&models.Workload{
				WorkloadListItem: models.WorkloadListItem{
					Cluster: conf.KubernetesConfig.ClusterName,
					Labels: map[string]string{
						config.WaypointFor:   config.WaypointForWorkload,
						config.WaypointLabel: config.WaypointLabelValue,
					},
					Name:      "bwaypoint",
					Namespace: gatewayNamespace,
				},
			}}

			workloads, services := layer.Workload.listWaypointWorkloads(context.Background(), conf.KubernetesConfig.ClusterName, gatewayNamespace, "bwaypoint", config.WaypointForWorkload, waypoints)
			require.Len(t, workloads, 1)
			assert.Equal(t, deployment.Name, workloads[0].Name)
			assert.Equal(t, ns.Name, workloads[0].Namespace)
			assert.Equal(t, "namespace", workloads[0].LabelType)
			assert.Equal(t, models.WaypointRolePrimary, workloads[0].WaypointRole)
			assert.Nil(t, workloads[0].RoleWeight)
			assert.Empty(t, services)
		})
	}
}

func TestListWaypointWorkloadsWorkloadSkipsNamespaceCanaryEnrollment(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "cluster-default"
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)

	const gwNamespace = "waypoint-forworkload-canary"
	ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
		Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "25"},
		Labels: map[string]string{
			config.WaypointCanaryUseLabel: "bwaypoint-canary",
		},
		Name: gwNamespace,
	}}
	// Workload enrolled only via namespace canary label (no pod canary labels); must not appear on workload-for waypoint proxies.
	echoDeploy := &apps_v1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Labels:    map[string]string{"app": "echo-server"},
			Name:      "echo-server",
			Namespace: gwNamespace,
		},
		Spec: apps_v1.DeploymentSpec{
			Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "echo-server"}},
			Template: core_v1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "echo-server"}},
				Spec: core_v1.PodSpec{
					Containers: []core_v1.Container{{Image: "test", Name: "echo-server"}},
				},
			},
		},
	}
	layer := NewLayerBuilder(t, conf).WithClient(kubetest.NewFakeK8sClient(ns, echoDeploy)).Build()
	waypoints := models.Workloads{
		&models.Workload{
			WorkloadListItem: models.WorkloadListItem{
				Cluster:   conf.KubernetesConfig.ClusterName,
				Labels:    map[string]string{config.GatewayLabel: "bwaypoint", config.WaypointFor: config.WaypointForWorkload},
				Name:      "bwaypoint",
				Namespace: gwNamespace,
			},
		},
		&models.Workload{
			WorkloadListItem: models.WorkloadListItem{
				Cluster:   conf.KubernetesConfig.ClusterName,
				Labels:    map[string]string{config.GatewayLabel: "bwaypoint-canary", config.WaypointFor: config.WaypointForWorkload},
				Name:      "bwaypoint-canary",
				Namespace: gwNamespace,
			},
		},
	}
	ctx := context.Background()
	canaryWaypointWorkloads, _ := layer.Workload.listWaypointWorkloads(ctx, conf.KubernetesConfig.ClusterName, gwNamespace, "bwaypoint-canary", config.WaypointForWorkload, waypoints)
	assert.Empty(t, canaryWaypointWorkloads)
}

func TestWaypointServicesRespectNamespaceOverrides(t *testing.T) {
	for _, tc := range []struct {
		canary    string
		inherited bool
		name      string
		primary   string
	}{
		{inherited: true, name: "inherit namespace"},
		{name: "service primary only", primary: "own-waypoint"},
		{canary: "own-canary", name: "service canary", primary: "own-waypoint"},
		{canary: "canary", name: "disabled with stale canary", primary: config.WaypointNone},
	} {
		t.Run(tc.name, func(t *testing.T) {
			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "cluster-default"
			conf.ExternalServices.Istio.IstioAPIEnabled = false
			config.Set(conf)
			ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
				Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "25"},
				Labels:      map[string]string{config.WaypointUseLabel: "primary", config.WaypointCanaryUseLabel: "canary"},
				Name:        "bookinfo",
			}}
			service := &core_v1.Service{
				ObjectMeta: metav1.ObjectMeta{
					Labels:    map[string]string{},
					Name:      "ratings",
					Namespace: "bookinfo",
				},
				Spec: core_v1.ServiceSpec{Selector: map[string]string{"app": "ratings"}},
			}
			if tc.primary != "" {
				service.Labels[config.WaypointUseLabel] = tc.primary
			}
			if tc.canary != "" {
				service.Labels[config.WaypointCanaryUseLabel] = tc.canary
			}
			layer := NewLayerBuilder(t, conf).WithClient(kubetest.NewFakeK8sClient(ns, service, FakeDeploymentWithPort("ratings", 9080))).Build()
			for _, gateway := range []string{"primary", "canary"} {
				_, refs := layer.Workload.listWaypointWorkloads(context.Background(), conf.KubernetesConfig.ClusterName, "bookinfo", gateway, config.WaypointForService, nil)
				if !tc.inherited {
					assert.Empty(t, refs, gateway)
					continue
				}
				require.Len(t, refs, 1)
				assert.Equal(t, "namespace", refs[0].LabelType)
				assert.Equal(t, gateway, refs[0].WaypointRole)
				weight := 75
				if gateway == "canary" {
					weight = 25
				}
				require.NotNil(t, refs[0].RoleWeight)
				assert.Equal(t, weight, *refs[0].RoleWeight)
			}
		})
	}
}

func TestWaypointEnrollmentSetsAreIndependent(t *testing.T) {
	for name, tc := range map[string]struct {
		podPrimary          string
		serviceCanary       string
		servicePrimary      string
		serviceWeight       string
		wantServices        map[string]*int
		wantWorkloadGateway string
		waypointFor         string
		withoutBackend      bool
	}{
		"service-only gateway": {
			wantServices: map[string]*int{"primary": ptr.To(75), "canary": ptr.To(25)},
			waypointFor:  config.WaypointForService,
		},
		"workload-only gateway": {
			wantWorkloadGateway: "primary",
			waypointFor:         config.WaypointForWorkload,
		},
		"disabled gateway": {
			waypointFor: config.WaypointForNone,
		},
		"namespace inheritance": {
			wantServices:        map[string]*int{"primary": ptr.To(75), "canary": ptr.To(25)},
			wantWorkloadGateway: "primary",
		},
		"service override preserves direct namespace primary": {
			servicePrimary:      "own-waypoint",
			wantServices:        map[string]*int{"own-waypoint": nil},
			wantWorkloadGateway: "primary",
		},
		"service opt out preserves direct namespace primary": {
			servicePrimary:      config.WaypointNone,
			wantWorkloadGateway: "primary",
		},
		"pod override does not move the service": {
			podPrimary:          "own-waypoint",
			wantServices:        map[string]*int{"primary": ptr.To(75), "canary": ptr.To(25)},
			wantWorkloadGateway: "own-waypoint",
		},
		"pod opt out does not remove the service": {
			podPrimary:   config.WaypointNone,
			wantServices: map[string]*int{"primary": ptr.To(75), "canary": ptr.To(25)},
		},
		"service enrollment does not require a backend": {
			wantServices:   map[string]*int{"primary": ptr.To(75), "canary": ptr.To(25)},
			withoutBackend: true,
		},
		"service weights do not become workload weights": {
			serviceCanary:       "canary",
			servicePrimary:      "primary",
			serviceWeight:       "10",
			wantServices:        map[string]*int{"primary": ptr.To(90), "canary": ptr.To(10)},
			wantWorkloadGateway: "primary",
		},
	} {
		t.Run(name, func(t *testing.T) {
			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "cluster-default"
			conf.ExternalServices.Istio.IstioAPIEnabled = false
			config.Set(conf)
			ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
				Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "25"},
				Labels: map[string]string{
					config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
					config.WaypointCanaryUseLabel:     "canary",
					config.WaypointUseLabel:           "primary",
				},
				Name: "bookinfo",
			}}
			service := &core_v1.Service{
				ObjectMeta: metav1.ObjectMeta{
					Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: tc.serviceWeight},
					Labels:      map[string]string{},
					Name:        "ratings",
					Namespace:   ns.Name,
				},
				Spec: core_v1.ServiceSpec{
					Ports:    []core_v1.ServicePort{{Name: "http", Port: 9080}},
					Selector: map[string]string{"app": "ratings"},
				},
			}
			if tc.servicePrimary != "" {
				service.Labels[config.WaypointUseLabel] = tc.servicePrimary
			}
			if tc.serviceCanary != "" {
				service.Labels[config.WaypointCanaryUseLabel] = tc.serviceCanary
			}
			client := kubetest.NewFakeK8sClient(ns, service)
			deployment := FakeDeploymentWithPort("ratings", 9080)
			if tc.podPrimary != "" {
				deployment.Spec.Template.Labels[config.WaypointUseLabel] = tc.podPrimary
			}
			if !tc.withoutBackend {
				client = kubetest.NewFakeK8sClient(ns, service, deployment)
			}
			layer := NewLayerBuilder(t, conf).WithClient(client).Build()
			waypointFor := tc.waypointFor
			if waypointFor == "" {
				waypointFor = config.WaypointForAll
			}
			waypoints := models.Workloads{}
			for _, gateway := range []string{"primary", "canary", "own-waypoint"} {
				waypoints = append(waypoints, &models.Workload{WorkloadListItem: models.WorkloadListItem{
					Cluster: conf.KubernetesConfig.ClusterName,
					Labels: map[string]string{
						config.WaypointFor:   waypointFor,
						config.WaypointLabel: config.WaypointLabelValue,
					},
					Name:      gateway,
					Namespace: ns.Name,
				}})
			}
			for _, gateway := range waypoints {
				workloads, services := layer.Workload.listWaypointWorkloads(context.Background(), gateway.Cluster, gateway.Namespace, gateway.Name, gateway.WaypointFor(), waypoints)
				if gateway.Name == tc.wantWorkloadGateway {
					require.Len(t, workloads, 1, gateway.Name)
					assert.Equal(t, deployment.Name, workloads[0].Name)
					assert.Equal(t, ns.Name, workloads[0].Namespace)
					assert.Equal(t, models.WaypointRolePrimary, workloads[0].WaypointRole)
					assert.Nil(t, workloads[0].RoleWeight)
				} else {
					assert.Empty(t, workloads, gateway.Name)
				}
				weight, enrolled := tc.wantServices[gateway.Name]
				if !enrolled {
					assert.Empty(t, services, gateway.Name)
					continue
				}
				require.Len(t, services, 1, gateway.Name)
				assert.Equal(t, service.Name, services[0].Name)
				assert.Equal(t, ns.Name, services[0].Namespace)
				assert.Equal(t, weight, services[0].RoleWeight)
				role := models.WaypointRolePrimary
				if gateway.Name == "canary" {
					role = models.WaypointRoleCanary
				}
				assert.Equal(t, role, services[0].WaypointRole)
			}
		})
	}
}

func TestWaypointServiceEnrollmentRespectsGatewayNamespace(t *testing.T) {
	conf := config.NewConfig()
	conf.KubernetesConfig.ClusterName = "cluster-default"
	conf.ExternalServices.Istio.IstioAPIEnabled = false
	config.Set(conf)
	ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
		Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "30"},
		Labels: map[string]string{
			config.WaypointCanaryNamespaceLabel: "infra",
			config.WaypointCanaryUseLabel:       "waypoint-v2",
			config.WaypointUseLabel:             "waypoint",
			config.WaypointUseNamespaceLabel:    "infra",
		},
		Name: "bookinfo",
	}}
	inherited := &core_v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "inherited", Namespace: ns.Name}}
	local := &core_v1.Service{ObjectMeta: metav1.ObjectMeta{
		Annotations: map[string]string{config.WaypointCanaryWeightAnnotation: "10"},
		Labels: map[string]string{
			config.WaypointCanaryUseLabel: "waypoint-v2",
			config.WaypointUseLabel:       "waypoint",
		},
		Name:      "local",
		Namespace: ns.Name,
	}}
	layer := NewLayerBuilder(t, conf).WithClient(kubetest.NewFakeK8sClient(ns, inherited, local)).Build()
	for namespace, want := range map[string]struct {
		name   string
		weight int
	}{
		"infra":    {name: "inherited", weight: 30},
		"bookinfo": {name: "local", weight: 10},
	} {
		for gateway, canary := range map[string]bool{"waypoint": false, "waypoint-v2": true} {
			refs := layer.Svc.ListWaypointCapturedServices(context.Background(), gateway, namespace, conf.KubernetesConfig.ClusterName)
			require.Len(t, refs, 1, "%s/%s", namespace, gateway)
			assert.Equal(t, want.name, refs[0].Name)
			weight := want.weight
			if !canary {
				weight = 100 - weight
			}
			require.NotNil(t, refs[0].RoleWeight)
			assert.Equal(t, weight, *refs[0].RoleWeight)
		}
	}
}

func TestWaypointWorkloadEnrollmentUsesActualPodBindings(t *testing.T) {
	ns := &models.Namespace{
		Labels: map[string]string{config.WaypointUseLabel: "primary"},
		Name:   "bookinfo",
	}
	for name, tc := range map[string]struct {
		pods          models.Pods
		wantLabelType string
	}{
		"running pod inherits namespace despite template override": {
			pods:          models.Pods{{Labels: map[string]string{}}},
			wantLabelType: "namespace",
		},
		"running pod opts out": {
			pods: models.Pods{{Labels: map[string]string{config.WaypointUseLabel: config.WaypointNone}}},
		},
		"running pod overrides namespace": {
			pods: models.Pods{{Labels: map[string]string{config.WaypointUseLabel: "other"}}},
		},
		"running pod binds same gateway name in another namespace": {
			pods: models.Pods{{Labels: map[string]string{config.WaypointUseLabel: "primary", config.WaypointUseNamespaceLabel: "infra"}}},
		},
		"one enrolled pod keeps the workload enrolled": {
			pods: models.Pods{
				{Labels: map[string]string{config.WaypointUseLabel: config.WaypointNone}},
				{Labels: map[string]string{config.WaypointUseLabel: "primary"}},
			},
			wantLabelType: "workload",
		},
	} {
		t.Run(name, func(t *testing.T) {
			workload := &models.Workload{
				Pods: tc.pods,
				WorkloadListItem: models.WorkloadListItem{
					Name:           "ratings",
					Namespace:      ns.Name,
					TemplateLabels: map[string]string{config.WaypointUseLabel: "template-only"},
					WorkloadGVK:    kubernetes.Deployments,
				},
			}
			ref := waypointEnrolledWorkloadRef(workload, ns, "primary", ns.Name)
			if tc.wantLabelType == "" {
				assert.Nil(t, ref)
				return
			}
			require.NotNil(t, ref)
			assert.Equal(t, tc.wantLabelType, ref.LabelType)
			assert.Equal(t, models.WaypointRolePrimary, ref.WaypointRole)
			assert.Nil(t, ref.RoleWeight)
		})
	}
}
