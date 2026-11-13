package business

import (
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	networkingapi "istio.io/api/networking/v1"
	networking "istio.io/client-go/pkg/apis/networking/v1"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/utils/ptr"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
)

type waypointEnrollmentReader struct {
	client.Reader
	failExplicit     bool
	failInherited    bool
	serviceItemsRead atomic.Int64
}

func (r *waypointEnrollmentReader) List(ctx context.Context, list client.ObjectList, opts ...client.ListOption) error {
	if _, pods := list.(*core_v1.PodList); pods {
		options := &client.ListOptions{}
		for _, opt := range opts {
			opt.ApplyToList(options)
		}
		explicit := options.LabelSelector != nil && !options.LabelSelector.Empty()
		if explicit && r.failExplicit || !explicit && r.failInherited {
			return fmt.Errorf("injected workload query failure")
		}
	}
	if err := r.Reader.List(ctx, list, opts...); err != nil {
		return err
	}
	if services, ok := list.(*core_v1.ServiceList); ok {
		r.serviceItemsRead.Add(int64(len(services.Items)))
	}
	return nil
}

type waypointEnrollmentCache struct {
	cache.KialiCache
	reader client.Reader
}

func (c *waypointEnrollmentCache) GetKubeCache(cluster string) (client.Reader, error) {
	return c.reader, nil
}

func newWaypointEnrollmentTestLayer(t *testing.T, conf *config.Config, objects ...runtime.Object) (*Layer, *waypointEnrollmentReader) {
	t.Helper()
	k8s := kubetest.NewFakeK8sClient(objects...)
	kialiCache := cache.NewTestingCache(t, k8s, *conf)
	reader, err := kialiCache.GetKubeCache(conf.KubernetesConfig.ClusterName)
	require.NoError(t, err)
	failingReader := &waypointEnrollmentReader{Reader: reader}
	layer := NewLayerBuilder(t, conf).WithClient(k8s).WithCache(&waypointEnrollmentCache{KialiCache: kialiCache, reader: failingReader}).Build()
	_, err = layer.Namespace.GetClusterNamespacesForCluster(context.Background(), conf.KubernetesConfig.ClusterName)
	require.NoError(t, err)
	return layer, failingReader
}

func TestWaypointWorkloadDiscoveryRetainsSuccessfulQueries(t *testing.T) {
	for name, tc := range map[string]struct {
		failExplicit  bool
		failInherited bool
		wantNames     []string
	}{
		"both queries succeed":  {wantNames: []string{"ratings-v1-3618568057-dnkjp", "reviews-v1-3618568057-dnkjp"}},
		"explicit query fails":  {failExplicit: true, wantNames: []string{"ratings-v1-3618568057-dnkjp"}},
		"inherited query fails": {failInherited: true, wantNames: []string{"reviews-v1-3618568057-dnkjp"}},
		"both queries fail":     {failExplicit: true, failInherited: true},
	} {
		t.Run(name, func(t *testing.T) {
			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "cluster-default"
			conf.ExternalServices.Istio.IstioAPIEnabled = false
			config.Set(conf)
			ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
				Labels: map[string]string{config.WaypointUseLabel: "primary"}, Name: "bookinfo",
			}}
			other := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{Name: "other"}}
			inherited := FakeDeploymentWithPort("ratings", 9080)
			explicit := FakeDeploymentWithPort("reviews", 9080)
			explicit.Namespace = other.Name
			explicit.Spec.Template.Labels[config.WaypointUseLabel] = "primary"
			explicit.Spec.Template.Labels[config.WaypointUseNamespaceLabel] = ns.Name
			layer, reader := newWaypointEnrollmentTestLayer(t, conf, ns, other, inherited, explicit)
			reader.failExplicit = tc.failExplicit
			reader.failInherited = tc.failInherited

			refs := layer.Workload.listWaypointCapturedWorkloads(context.Background(), conf.KubernetesConfig.ClusterName, ns.Name, "primary", nil)
			require.NotNil(t, refs)
			names := []string{}
			for _, ref := range refs {
				names = append(names, ref.Name)
			}
			assert.ElementsMatch(t, tc.wantNames, names)
		})
	}
}

func TestWaypointEnrollmentUsesFreshDetailType(t *testing.T) {
	for name, tc := range map[string]struct {
		cachedType    string
		freshType     string
		wantServices  int
		wantWorkloads int
	}{
		"service changed to all":         {cachedType: config.WaypointForService, freshType: config.WaypointForAll, wantServices: 1, wantWorkloads: 1},
		"service changed to workload":    {cachedType: config.WaypointForService, freshType: config.WaypointForWorkload, wantWorkloads: 1},
		"all changed to service":         {cachedType: config.WaypointForAll, freshType: config.WaypointForService, wantServices: 1},
		"gateway absent from cached set": {freshType: config.WaypointForAll, wantServices: 1, wantWorkloads: 1},
	} {
		t.Run(name, func(t *testing.T) {
			conf := config.NewConfig()
			conf.KubernetesConfig.ClusterName = "cluster-default"
			conf.ExternalServices.Istio.IstioAPIEnabled = false
			config.Set(conf)
			ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
				Labels: map[string]string{config.WaypointUseLabel: "primary"}, Name: "bookinfo",
			}}
			backend := FakeDeploymentWithPort("ratings", 9080)
			gateway := &apps_v1.Deployment{
				ObjectMeta: metav1.ObjectMeta{Name: "primary", Namespace: ns.Name},
				Spec: apps_v1.DeploymentSpec{
					Selector: &metav1.LabelSelector{MatchLabels: map[string]string{"app": "primary"}},
					Template: core_v1.PodTemplateSpec{ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{
						"app": "primary", config.WaypointFor: tc.freshType, config.WaypointLabel: config.WaypointLabelValue,
					}}},
				},
			}
			service := &core_v1.Service{ObjectMeta: metav1.ObjectMeta{Name: "ratings", Namespace: ns.Name}}
			layer := NewLayerBuilder(t, conf).WithClient(kubetest.NewFakeK8sClient(ns, backend, gateway, service)).Build()
			cached := models.Workloads{}
			if tc.cachedType != "" {
				cached = append(cached, &models.Workload{WorkloadListItem: models.WorkloadListItem{
					Cluster: conf.KubernetesConfig.ClusterName,
					Labels:  map[string]string{config.WaypointFor: tc.cachedType, config.WaypointLabel: config.WaypointLabelValue},
					Name:    gateway.Name, Namespace: ns.Name,
				}})
			}
			detail, err := layer.Workload.fetchWorkload(context.Background(), WorkloadCriteria{
				Cluster: conf.KubernetesConfig.ClusterName, IncludeWaypoints: true,
				Namespace: ns.Name, WorkloadGVK: kubernetes.Deployments, WorkloadName: gateway.Name,
			}, cached)
			require.NoError(t, err)
			assert.Equal(t, tc.freshType, detail.WaypointFor())
			assert.Len(t, detail.WaypointWorkloads, tc.wantWorkloads)
			assert.Len(t, detail.WaypointServices, tc.wantServices)
		})
	}
}

func TestWaypointVMEnrollmentRespectsEffectiveLabels(t *testing.T) {
	for name, tc := range map[string]struct {
		namespaceBinding string
		wantCount        int
		workloadBinding  string
	}{
		"explicit VM binding":              {wantCount: 1, workloadBinding: "primary"},
		"VM opts out of namespace binding": {namespaceBinding: "primary", workloadBinding: config.WaypointNone},
		"VM inherits namespace binding":    {namespaceBinding: "primary", wantCount: 1},
	} {
		for _, withEntry := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/withEntry=%t", name, withEntry), func(t *testing.T) {
				conf := config.NewConfig()
				conf.KubernetesConfig.ClusterName = "cluster-default"
				conf.ExternalServices.Istio.IstioAPIEnabled = false
				config.Set(conf)
				ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{config.WaypointUseLabel: tc.namespaceBinding}, Name: "bookinfo",
				}}
				workloadLabels := map[string]string{"app": "ratings"}
				if tc.workloadBinding != "" {
					workloadLabels[config.WaypointUseLabel] = tc.workloadBinding
				}
				vm := &networking.WorkloadGroup{
					ObjectMeta: metav1.ObjectMeta{Labels: map[string]string{"app": "ratings"}, Name: "ratings-vm", Namespace: ns.Name},
					Spec: networkingapi.WorkloadGroup{
						Metadata: &networkingapi.WorkloadGroup_ObjectMeta{Labels: workloadLabels},
						Template: &networkingapi.WorkloadEntry{Address: "192.0.2.1"},
					},
				}
				objects := []runtime.Object{ns, vm}
				if withEntry {
					objects = append(objects, &networking.WorkloadEntry{
						ObjectMeta: metav1.ObjectMeta{Name: "ratings-vm-entry", Namespace: ns.Name},
						Spec:       networkingapi.WorkloadEntry{Address: "192.0.2.1", Labels: workloadLabels},
					})
				}
				layer := NewLayerBuilder(t, conf).WithClient(kubetest.NewFakeK8sClient(objects...)).Build()
				refs := layer.Workload.listWaypointCapturedWorkloads(context.Background(), conf.KubernetesConfig.ClusterName, ns.Name, "primary", nil)
				require.Len(t, refs, tc.wantCount)
				if tc.wantCount > 0 {
					assert.Equal(t, vm.Name, refs[0].Name)
					assert.Equal(t, models.WaypointRolePrimary, refs[0].WaypointRole)
					assert.Nil(t, refs[0].RoleWeight)
				}
			})
		}
	}
}

func TestWaypointServicesLimitCandidatesToExactNamespaceBinding(t *testing.T) {
	for _, weight := range []string{"primary-only", "0", "25", "100"} {
		for _, role := range []string{models.WaypointRolePrimary, models.WaypointRoleCanary} {
			if weight == "primary-only" && role == models.WaypointRoleCanary {
				continue
			}
			for _, redirectLocal := range []bool{false, true} {
				t.Run(fmt.Sprintf("%s/%s/redirectLocal=%t", weight, role, redirectLocal), func(t *testing.T) {
					conf := config.NewConfig()
					conf.KubernetesConfig.ClusterName = "cluster-default"
					conf.ExternalServices.Istio.IstioAPIEnabled = false
					config.Set(conf)
					objects := []runtime.Object{}
					for _, namespace := range []string{"bookinfo", "other", "shared", "away"} {
						ns := &core_v1.Namespace{ObjectMeta: metav1.ObjectMeta{
							Annotations: map[string]string{},
							Labels:      map[string]string{config.WaypointUseLabel: "waypoint"},
							Name:        namespace,
						}}
						if weight != "primary-only" {
							ns.Labels[config.WaypointCanaryUseLabel] = "waypoint-canary"
							ns.Annotations[config.WaypointCanaryWeightAnnotation] = weight
						}
						bindingNamespace := ""
						switch namespace {
						case "shared":
							bindingNamespace = "bookinfo"
						case "away":
							bindingNamespace = "elsewhere"
						}
						if bindingNamespace != "" {
							ns.Labels[config.WaypointUseNamespaceLabel] = bindingNamespace
							ns.Labels[config.WaypointCanaryNamespaceLabel] = bindingNamespace
						}
						if namespace == "bookinfo" && redirectLocal {
							namespaceLabel := config.WaypointUseNamespaceLabel
							if role == models.WaypointRoleCanary {
								namespaceLabel = config.WaypointCanaryNamespaceLabel
							}
							ns.Labels[namespaceLabel] = "elsewhere"
						}
						objects = append(objects, ns, &core_v1.Service{ObjectMeta: metav1.ObjectMeta{
							Name: "inherited-" + namespace, Namespace: namespace,
						}})
						if namespace == "other" || namespace == "away" {
							svc := &core_v1.Service{ObjectMeta: metav1.ObjectMeta{
								Annotations: map[string]string{},
								Labels: map[string]string{
									config.WaypointUseLabel:          "waypoint",
									config.WaypointUseNamespaceLabel: "bookinfo",
								},
								Name: "explicit-" + namespace, Namespace: namespace,
							}}
							if weight != "primary-only" {
								svc.Labels[config.WaypointCanaryUseLabel] = "waypoint-canary"
								svc.Labels[config.WaypointCanaryNamespaceLabel] = "bookinfo"
								svc.Annotations[config.WaypointCanaryWeightAnnotation] = "10"
							}
							objects = append(objects, svc)
						}
					}
					layer, reader := newWaypointEnrollmentTestLayer(t, conf, objects...)
					reader.serviceItemsRead.Store(0)
					gateway := "waypoint"
					if role == models.WaypointRoleCanary {
						gateway = "waypoint-canary"
					}
					refs := layer.Svc.ListWaypointServices(context.Background(), gateway, "bookinfo", conf.KubernetesConfig.ClusterName, role)
					wantNames := []string{"inherited-shared", "explicit-other", "explicit-away"}
					if !redirectLocal {
						wantNames = append(wantNames, "inherited-bookinfo")
					}
					names := []string{}
					for _, ref := range refs {
						names = append(names, ref.Name)
						assert.Equal(t, role, ref.WaypointRole)
						if weight == "primary-only" {
							assert.Nil(t, ref.RoleWeight)
							continue
						}
						wantWeight := map[string]int{"0": 0, "25": 25, "100": 100}[weight]
						if ref.LabelType == "service" {
							wantWeight = 10
						}
						if role == models.WaypointRolePrimary {
							wantWeight = 100 - wantWeight
						}
						require.NotNil(t, ref.RoleWeight)
						assert.Equal(t, wantWeight, *ref.RoleWeight)
					}
					assert.ElementsMatch(t, wantNames, names)
					assert.Equal(t, int64(len(wantNames)), reader.serviceItemsRead.Load(), "unrelated namespace Services should not be copied into the candidate list")
				})
			}
		}
	}
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
					Annotations: map[string]string{},
					Labels:      map[string]string{},
					Name:        "ratings",
					Namespace:   ns.Name,
				},
				Spec: core_v1.ServiceSpec{
					Ports:    []core_v1.ServicePort{{Name: "http", Port: 9080}},
					Selector: map[string]string{"app": "ratings"},
				},
			}
			if tc.serviceWeight != "" {
				service.Annotations[config.WaypointCanaryWeightAnnotation] = tc.serviceWeight
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
