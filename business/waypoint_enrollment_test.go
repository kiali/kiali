// Assisted-by: Codex
package business

import (
	"context"
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
