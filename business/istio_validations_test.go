package business

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/wrapperspb"
	istiov1alpha1 "istio.io/api/mesh/v1alpha1"
	apinetworkingv1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	kubefake "k8s.io/client-go/kubernetes/fake"
	kubeclienttesting "k8s.io/client-go/testing"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/business/checkers"
	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/grafana"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
	"github.com/kiali/kiali/util/certtest"
)

func TestGetNamespaceValidations(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(t, conf, fakeIstioConfigList(),
		[]string{"details", "product", "product2", "customer"})

	changeMap := map[string]string{}
	vInfo, err := vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, changeMap)
	require.NoError(err)
	validationPerformed, validations, err := vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	assert.True(validationPerformed)
	vs.kialiCache.Validations().Replace(validations)

	validations, err = vs.GetValidations(context.TODO(), conf.KubernetesConfig.ClusterName)
	require.NoError(err)
	require.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "test", Name: "product-vs"}].Valid)

	// simulate a reconcile w/o a config change should skip running the checkers (new vInfo but re-use the changemap)
	vInfo, err = vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, changeMap)
	require.NoError(err)
	validationPerformed, validations, err = vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	assert.False(validationPerformed)
	assert.Nil(validations)

	// refresh the config but keep the changeMap, and we should see new validations. (note PeerAuthentication config updates its ResourceVersion)
	vs = mockCombinedValidationService(t, conf, fakeIstioConfigList(),
		[]string{"details", "product", "product2", "customer"})
	vInfo, err = vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, changeMap)
	require.NoError(err)
	validationPerformed, validations, err = vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	assert.True(validationPerformed)
	assert.NotNil(validations)
}

func TestNamespaceLabelChangeTriggersValidation(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(t, conf, fakeIstioConfigList(),
		[]string{"details", "product", "product2", "customer"})

	// Initial validation run
	changeMap := map[string]string{}
	vInfo, err := vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, changeMap)
	require.NoError(err)
	validationPerformed, validations, err := vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	assert.True(validationPerformed)
	vs.kialiCache.Validations().Replace(validations)

	// Verify namespace keys are tracked in changeMap
	assert.Contains(changeMap, "NS::test")
	assert.Contains(changeMap, "NS::test2")
	assert.Contains(changeMap, "validation-num-namespaces")

	// Second run without changes should skip validation
	vInfo, err = vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, changeMap)
	require.NoError(err)
	validationPerformed, validations, err = vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	assert.False(validationPerformed)
	assert.Nil(validations)

	// Simulate a namespace label change by modifying the changeMap entry
	// This simulates what would happen if a namespace's labels changed
	changeMap["NS::test"] = "modified-labels"

	// Third run should detect the change and perform validation
	vInfo, err = vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, changeMap)
	require.NoError(err)
	assert.True(vInfo.hasBaseChange, "Namespace label change should set hasBaseChange to true")
}

func TestValidateIncludesConfigsFromUnmanagedNamespaces(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	bookinfo := "bookinfo"
	orphan := "orphan-ns"

	vsBookinfo := data.AddHttpRoutesToVirtualService(
		data.CreateHttpRouteDestination("reviews", "v1", -1),
		data.CreateEmptyVirtualService("reviews-vs", bookinfo, []string{"reviews"}),
	)
	vsOrphan := data.AddHttpRoutesToVirtualService(
		data.CreateHttpRouteDestination("ratings", "v1", -1),
		data.CreateEmptyVirtualService("ratings-vs", orphan, []string{"ratings"}),
	)

	objects := []runtime.Object{
		kubetest.FakeNamespace(bookinfo),
		kubetest.FakeNamespace(orphan),
		kubetest.FakeNamespace("istio-system"),
		&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
		vsBookinfo, vsOrphan,
	}

	mesh := models.Mesh{
		ControlPlanes: []models.ControlPlane{{
			Cluster:         &models.KubeCluster{IsKialiHome: true},
			IstiodNamespace: "istio-system",
			MeshConfig:      models.NewMeshConfig(),
			RootNamespace:   "istio-system",
			ManagedNamespaces: []models.Namespace{
				{Name: bookinfo},
				{Name: "istio-system"},
			},
		}},
	}

	vs := fakeValidationMeshServiceWithMesh(t, *conf, mesh, objects...)

	vInfo, err := vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, nil)
	require.NoError(err)
	validationPerformed, validations, err := vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	assert.True(validationPerformed)

	// bookinfo is managed: its VS should produce a validation entry
	bookinfoKey := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: bookinfo, Name: "reviews-vs"}
	assert.Contains(validations, bookinfoKey, "managed namespace should have validations")

	// orphan-ns VS should also be validated because Istio processes configs from all
	// namespaces (unless discovery selectors restrict this). Configs from unmanaged
	// namespaces are included in the validation pool and validated alongside managed ones.
	orphanKey := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: orphan, Name: "ratings-vs"}
	assert.Contains(validations, orphanKey, "configs from unmanaged namespaces should be validated")
}

func TestAmbientNamespaceWaypointDoesNotTriggerWaypointNotFound(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	namespaceLabels := map[string]string{
		config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
		config.WaypointUseLabel:           "waypoint",
	}

	objects := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "Namespace", Labels: namespaceLabels}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
	}

	for _, pod := range FakeWaypointPod() {
		p := pod
		objects = append(objects, &p)
	}
	for _, pod := range FakeWaypointNamespaceEnrolledPods(conf, false) {
		p := pod
		objects = append(objects, &p)
	}
	objects = append(objects, &apps_v1.Deployment{
		TypeMeta: v1.TypeMeta{
			APIVersion: kubernetes.Deployments.GroupVersion().String(),
			Kind:       kubernetes.Deployments.Kind,
		},
		ObjectMeta: v1.ObjectMeta{
			Name:      "waypoint",
			Namespace: "Namespace",
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				ObjectMeta: v1.ObjectMeta{
					Labels: map[string]string{
						"gateway.istio.io/managed":               "istio.io-mesh-controller",
						"gateway.networking.k8s.io/gateway-name": "waypoint",
					},
				},
			},
		},
	})

	mesh := models.Mesh{
		ControlPlanes: []models.ControlPlane{{
			Cluster:    &models.KubeCluster{IsKialiHome: true},
			MeshConfig: models.NewMeshConfig(),
			ManagedNamespaces: []models.Namespace{
				{Name: "Namespace"},
				{Name: "istio-system"},
			},
		}},
	}

	vs := fakeValidationMeshServiceWithMesh(t, *conf, mesh, objects...)

	vInfo, err := vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, nil)
	require.NoError(err)

	var detailsWorkload *models.Workload
	for _, workload := range vInfo.wlMap[conf.KubernetesConfig.ClusterName]["Namespace"] {
		if workload.Name == "details" {
			detailsWorkload = workload
			break
		}
	}
	require.NotNil(detailsWorkload)
	require.Len(detailsWorkload.WaypointWorkloads, 1)
	assert.Equal("waypoint", detailsWorkload.WaypointWorkloads[0].Name)

	validationPerformed, allValidations, err := vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	assert.True(validationPerformed)

	key := models.IstioValidationKey{
		ObjectGVK: schema.GroupVersionKind{Group: "", Version: "", Kind: "workload"},
		Namespace: "Namespace",
		Name:      "details",
		Cluster:   conf.KubernetesConfig.ClusterName,
	}
	require.Contains(allValidations, key)

	hasWaypointNotFound := false
	for _, check := range allValidations[key].Checks {
		if validations.ConfirmIstioCheckMessage("workload.ambient.waypointnotfound", check) == nil {
			hasWaypointNotFound = true
			break
		}
	}
	assert.False(hasWaypointNotFound, "namespace waypoint should resolve without KIA1313")
}

func TestStaleEmptyWaypointCacheDoesNotStickKIA1313(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	namespaceLabels := map[string]string{
		config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
		config.WaypointUseLabel:           "waypoint",
	}

	objects := []runtime.Object{
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "Namespace", Labels: namespaceLabels}},
		&core_v1.Namespace{ObjectMeta: v1.ObjectMeta{Name: "istio-system"}},
		&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
	}

	for _, pod := range FakeWaypointPod() {
		p := pod
		objects = append(objects, &p)
	}
	for _, pod := range FakeWaypointNamespaceEnrolledPods(conf, false) {
		p := pod
		objects = append(objects, &p)
	}
	objects = append(objects, &apps_v1.Deployment{
		TypeMeta: v1.TypeMeta{
			APIVersion: kubernetes.Deployments.GroupVersion().String(),
			Kind:       kubernetes.Deployments.Kind,
		},
		ObjectMeta: v1.ObjectMeta{
			Name:      "waypoint",
			Namespace: "Namespace",
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				ObjectMeta: v1.ObjectMeta{
					Labels: map[string]string{
						"gateway.istio.io/managed":               "istio.io-mesh-controller",
						"gateway.networking.k8s.io/gateway-name": "waypoint",
					},
				},
			},
		},
	})

	mesh := models.Mesh{
		ControlPlanes: []models.ControlPlane{{
			Cluster:    &models.KubeCluster{IsKialiHome: true},
			MeshConfig: models.NewMeshConfig(),
			ManagedNamespaces: []models.Namespace{
				{Name: "Namespace"},
				{Name: "istio-system"},
			},
		}},
	}

	vs := fakeValidationMeshServiceWithMesh(t, *conf, mesh, objects...)

	// Simulate Kiali having cached an empty waypoint list before the waypoint existed.
	vs.kialiCache.SetWaypoints(models.Workloads{})

	changeMap := ValidationChangeMap{}
	vInfo, err := vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, changeMap)
	require.NoError(err)
	assert.Contains(changeMap, "validation-waypoints")
	assert.NotEmpty(changeMap["validation-waypoints"], "fresh waypoint discovery should populate the tracked digest")

	var detailsWorkload *models.Workload
	for _, workload := range vInfo.wlMap[conf.KubernetesConfig.ClusterName]["Namespace"] {
		if workload.Name == "details" {
			detailsWorkload = workload
			break
		}
	}
	require.NotNil(detailsWorkload)
	require.Len(detailsWorkload.WaypointWorkloads, 1)

	validationPerformed, allValidations, err := vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	assert.True(validationPerformed)

	key := models.IstioValidationKey{
		ObjectGVK: schema.GroupVersionKind{Group: "", Version: "", Kind: "workload"},
		Namespace: "Namespace",
		Name:      "details",
		Cluster:   conf.KubernetesConfig.ClusterName,
	}
	require.Contains(allValidations, key)

	for _, check := range allValidations[key].Checks {
		assert.NotEqual("KIA1313", check.Code, "stale empty waypoint cache must not produce KIA1313")
	}

	// A second pass with no cluster changes should skip checkers (change detection still works).
	vInfo, err = vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, changeMap)
	require.NoError(err)
	assert.False(vInfo.hasBaseChange)
	validationPerformed, _, err = vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	assert.False(validationPerformed)
}

func TestWaypointRefsValidationDigest(t *testing.T) {
	assert := assert.New(t)

	assert.Empty(waypointRefsValidationDigest(nil))

	a := waypointRefsValidationDigest([]models.WorkloadReferenceInfo{
		{Cluster: "c", Namespace: "ns", Name: "wp-b", Type: "service"},
		{Cluster: "c", Namespace: "ns", Name: "wp-a", Type: "service"},
	})
	b := waypointRefsValidationDigest([]models.WorkloadReferenceInfo{
		{Cluster: "c", Namespace: "ns", Name: "wp-a", Type: "service"},
		{Cluster: "c", Namespace: "ns", Name: "wp-b", Type: "service"},
	})
	assert.Equal(a, b, "digest must be order-independent")
	assert.NotEmpty(a)
	assert.NotEqual(
		waypointRefsValidationDigest([]models.WorkloadReferenceInfo{{Name: "wp-a"}}),
		waypointRefsValidationDigest([]models.WorkloadReferenceInfo{{Name: "wp-b"}}),
	)
}

func TestGetIstioObjectValidations(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(t, conf, fakeIstioConfigList(),
		[]string{"details", "product", "customer"})

	validations, _, _ := vs.ValidateIstioObject(context.TODO(), conf.KubernetesConfig.ClusterName, "test", kubernetes.VirtualServices, "product-vs")

	assert.NotEmpty(validations)
}

func TestGatewayValidation(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	objs := mockMultiNamespaceGateways(conf)
	v := fakeValidationMeshServiceWithDiscovery(t, *conf, objs...)
	validations, _, _ := v.ValidateIstioObject(context.TODO(), conf.KubernetesConfig.ClusterName, "test", kubernetes.Gateways, "first")
	assert.NotEmpty(validations)
}

// TestGatewayValidationScopesToNamespaceWhenGatewayToNamespaceSet this test ensures that gateway validation
// scopes the gateway workload checker to the namespace of the gateway when PILOT_SCOPE_GATEWAY_TO_NAMESPACE
// is set to true on the istiod deployment.
func TestGatewayValidationScopesToNamespaceWhenGatewayToNamespaceSet(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// The gateway workload is in a different namespace than the Gateway object.
	gatewayDeployment := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio-ingressgateway",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app": "real",
			},
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				ObjectMeta: v1.ObjectMeta{
					Labels: map[string]string{
						"app": "real",
					},
				},
			},
		},
	}

	objs := []runtime.Object{gatewayDeployment}
	objs = append(objs, mockMultiNamespaceGateways(conf)...)

	v := fakeValidationMeshServiceWithMesh(t, *conf, models.Mesh{
		ControlPlanes: []models.ControlPlane{{
			Cluster:              &models.KubeCluster{IsKialiHome: true},
			MeshConfig:           models.NewMeshConfig(),
			IsGatewayToNamespace: true,
			ManagedNamespaces: []models.Namespace{
				{Name: "test"},
				{Name: "test2"},
				{Name: "istio-system"},
			},
		}},
	}, objs...)
	validations, _, err := v.ValidateIstioObject(context.TODO(), conf.KubernetesConfig.ClusterName, "test", kubernetes.Gateways, "first")
	require.NoError(err)
	require.Len(validations, 1)
	key := models.IstioValidationKey{
		ObjectGVK: kubernetes.Gateways,
		Name:      "first",
		Namespace: "test",
	}
	// Even though the workload is referenced properly, because of the PILOT_SCOPE_GATEWAY_TO_NAMESPACE
	// the gateway should be marked as invalid.
	assert.False(validations[key].Valid)
}

func testMesh(conf *config.Config) *models.Mesh {
	return &models.Mesh{
		ControlPlanes: []models.ControlPlane{{
			Cluster: &models.KubeCluster{Name: conf.KubernetesConfig.ClusterName, IsKialiHome: true},
			ManagedNamespaces: []models.Namespace{
				{Name: "bookinfo"},
				{Name: "bookinfo2"},
				{Name: "bookinfo3"},
				{Name: "default"},
			},
			MeshConfig: models.NewMeshConfig(),
		}},
	}
}

func meshWithDefaultExportTo(conf *config.Config, exportTo string) *models.Mesh {
	m := testMesh(conf)
	m.ControlPlanes[0].MeshConfig = &models.MeshConfig{
		MeshConfig: &istiov1alpha1.MeshConfig{
			DefaultDestinationRuleExportTo: []string{exportTo},
			DefaultServiceExportTo:         []string{exportTo},
			DefaultVirtualServiceExportTo:  []string{exportTo},
		},
	}
	return m
}

func TestSetNonLocalMTLSConfigDefaultsAutoMtlsTrue(t *testing.T) {
	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName
	svc := IstioValidationsService{}

	t.Run("nil EnableAutoMtls defaults to true", func(t *testing.T) {
		require := require.New(t)
		vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false}, "bookinfo")
		vInfo.nsInfo.mtlsDetails = &kubernetes.MTLSDetails{EnabledAutoMtls: false}
		vInfo.mesh = &models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: true},
				IstiodNamespace:   "istio-system",
				ManagedNamespaces: []models.Namespace{{Name: "bookinfo", Cluster: cluster}},
				MeshConfig: &models.MeshConfig{
					MeshConfig: &istiov1alpha1.MeshConfig{EnableAutoMtls: nil},
				},
				RootNamespace: "istio-system",
			}},
		}

		require.NoError(svc.setNonLocalMTLSConfig(&vInfo))
		require.True(vInfo.nsInfo.mtlsDetails.EnabledAutoMtls)
	})

	t.Run("unmanaged namespace defaults to true", func(t *testing.T) {
		require := require.New(t)
		vInfo := mockValidationInfo(conf, map[string]bool{"unmanaged": false}, "unmanaged")
		vInfo.nsInfo.mtlsDetails = &kubernetes.MTLSDetails{EnabledAutoMtls: false}
		vInfo.mesh = &models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: true},
				IstiodNamespace:   "istio-system",
				ManagedNamespaces: []models.Namespace{{Name: "bookinfo", Cluster: cluster}},
				MeshConfig:        models.NewMeshConfig(),
				RootNamespace:     "istio-system",
			}},
		}

		require.NoError(svc.setNonLocalMTLSConfig(&vInfo))
		require.True(vInfo.nsInfo.mtlsDetails.EnabledAutoMtls)
	})

	t.Run("explicit false is preserved", func(t *testing.T) {
		require := require.New(t)
		vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false}, "bookinfo")
		vInfo.nsInfo.mtlsDetails = &kubernetes.MTLSDetails{EnabledAutoMtls: true}
		vInfo.mesh = &models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: true},
				IstiodNamespace:   "istio-system",
				ManagedNamespaces: []models.Namespace{{Name: "bookinfo", Cluster: cluster}},
				MeshConfig: &models.MeshConfig{
					MeshConfig: &istiov1alpha1.MeshConfig{
						EnableAutoMtls: &wrapperspb.BoolValue{Value: false},
					},
				},
				RootNamespace: "istio-system",
			}},
		}

		require.NoError(svc.setNonLocalMTLSConfig(&vInfo))
		require.False(vInfo.nsInfo.mtlsDetails.EnabledAutoMtls)
	})
}

func mockValidationInfo(conf *config.Config, namespaces map[string]bool, namespace string) validationInfo {
	ns := []models.Namespace{}
	for k, v := range namespaces {
		ns = append(ns, models.Namespace{
			Name:      k,
			IsAmbient: v,
		})
	}
	vInfo := validationInfo{
		nsMap: map[string][]models.Namespace{conf.KubernetesConfig.ClusterName: ns},
		clusterInfo: &validationClusterInfo{
			cluster: conf.KubernetesConfig.ClusterName,
		},
		nsInfo: &validationNamespaceInfo{
			namespace: &models.Namespace{
				Name: namespace,
			},
		},
	}
	return vInfo
}

func TestMultiPrimaryFilterExportToNamespacesVS(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName

	// Mesh with two control planes: CP1 manages bookinfo with DefaultVSExportTo ["."],
	// CP2 manages bookinfo2 with DefaultVSExportTo ["*"].
	mesh := models.Mesh{
		ControlPlanes: []models.ControlPlane{
			{
				Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: true},
				ManagedClusters:   []*models.KubeCluster{{Name: cluster}},
				ManagedNamespaces: []models.Namespace{{Name: "bookinfo", Cluster: ""}},
				MeshConfig: &models.MeshConfig{
					MeshConfig: &istiov1alpha1.MeshConfig{
						DefaultVirtualServiceExportTo: []string{"."},
					},
				},
			},
			{
				Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: false},
				ManagedClusters:   []*models.KubeCluster{{Name: cluster}},
				ManagedNamespaces: []models.Namespace{{Name: "bookinfo2", Cluster: ""}},
				MeshConfig: &models.MeshConfig{
					MeshConfig: &istiov1alpha1.MeshConfig{
						DefaultVirtualServiceExportTo: []string{"*"},
					},
				},
			},
		},
	}

	vsBookinfo := &networking_v1.VirtualService{
		ObjectMeta: v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"},
		Spec:       apinetworkingv1.VirtualService{Hosts: []string{"reviews"}},
	}
	vsBookinfo2 := &networking_v1.VirtualService{
		ObjectMeta: v1.ObjectMeta{Name: "ratings", Namespace: "bookinfo2"},
		Spec:       apinetworkingv1.VirtualService{Hosts: []string{"ratings"}},
	}
	vsList := []*networking_v1.VirtualService{vsBookinfo, vsBookinfo2}

	objs := mockEmpty(t, conf)
	v := fakeValidationMeshServiceWithMesh(t, *conf, mesh, objs...)

	// Viewing bookinfo: vsBookinfo has . (visible in bookinfo), vsBookinfo2 has * (visible everywhere)
	vInfoBookinfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "bookinfo2": false, "default": false}, "bookinfo")
	vInfoBookinfo.mesh = &mesh
	filteredBookinfo := v.filterVSExportToNamespaces(vsList, &vInfoBookinfo)
	assert.Len(filteredBookinfo, 2, "viewing bookinfo: both VSs should be included")

	// Viewing bookinfo2: vsBookinfo has . (not visible in bookinfo2), vsBookinfo2 has * (visible everywhere)
	vInfoBookinfo2 := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "bookinfo2": false, "default": false}, "bookinfo2")
	vInfoBookinfo2.mesh = &mesh
	filteredBookinfo2 := v.filterVSExportToNamespaces(vsList, &vInfoBookinfo2)
	assert.Len(filteredBookinfo2, 1, "viewing bookinfo2: only bookinfo2 VS should be included")
	assert.Equal("ratings", filteredBookinfo2[0].Name)
	assert.Equal("bookinfo2", filteredBookinfo2[0].Namespace)
}

func TestMultiPrimaryWithUnmanagedNamespace(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName

	// Multi-primary: CP1 manages mesh1-ns (exportTo "."), CP2 manages mesh2-ns (exportTo "*").
	// "ingress-ns" is unmanaged by either CP but has a VirtualService.
	mesh := models.Mesh{
		ControlPlanes: []models.ControlPlane{
			{
				Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: true},
				ManagedClusters:   []*models.KubeCluster{{Name: cluster}},
				ManagedNamespaces: []models.Namespace{{Name: "mesh1-ns"}},
				MeshConfig: &models.MeshConfig{
					MeshConfig: &istiov1alpha1.MeshConfig{
						DefaultVirtualServiceExportTo: []string{"."},
					},
				},
			},
			{
				Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: false},
				ManagedClusters:   []*models.KubeCluster{{Name: cluster}},
				ManagedNamespaces: []models.Namespace{{Name: "mesh2-ns"}},
				MeshConfig: &models.MeshConfig{
					MeshConfig: &istiov1alpha1.MeshConfig{
						DefaultVirtualServiceExportTo: []string{"."},
					},
				},
			},
		},
	}

	vsMesh1 := &networking_v1.VirtualService{
		ObjectMeta: v1.ObjectMeta{Name: "vs-mesh1", Namespace: "mesh1-ns"},
		Spec:       apinetworkingv1.VirtualService{Hosts: []string{"svc1"}},
	}
	vsMesh2 := &networking_v1.VirtualService{
		ObjectMeta: v1.ObjectMeta{Name: "vs-mesh2", Namespace: "mesh2-ns"},
		Spec:       apinetworkingv1.VirtualService{Hosts: []string{"svc2"}},
	}
	// VS from unmanaged namespace, no explicit exportTo
	vsIngress := &networking_v1.VirtualService{
		ObjectMeta: v1.ObjectMeta{Name: "vs-ingress", Namespace: "ingress-ns"},
		Spec:       apinetworkingv1.VirtualService{Hosts: []string{"ingress-svc"}},
	}
	vsList := []*networking_v1.VirtualService{vsMesh1, vsMesh2, vsIngress}

	// 1) filterIstioConfigByManagedNamespaces should preserve all three VS
	configList := &models.IstioConfigList{VirtualServices: vsList}
	filterIstioConfigByManagedNamespaces(configList, &mesh, cluster, []string{"mesh1-ns", "mesh2-ns", "ingress-ns"})
	assert.Len(configList.VirtualServices, 3, "all VS should be preserved (managed + unmanaged)")

	// 2) Export-to filtering from mesh1-ns perspective:
	//    - vsMesh1 (mesh1-ns, "."): visible in own namespace -> included
	//    - vsMesh2 (mesh2-ns, "."): only visible in mesh2-ns -> excluded
	//    - vsIngress (ingress-ns, unmanaged, no exportTo): no mesh default -> exported to all -> included
	objs := mockEmpty(t, conf)
	v := fakeValidationMeshServiceWithMesh(t, *conf, mesh, objs...)
	vInfoMesh1 := mockValidationInfo(conf, map[string]bool{"mesh1-ns": false, "mesh2-ns": false, "ingress-ns": false}, "mesh1-ns")
	vInfoMesh1.mesh = &mesh
	filteredMesh1 := v.filterVSExportToNamespaces(configList.VirtualServices, &vInfoMesh1)
	assert.Len(filteredMesh1, 2, "viewing mesh1-ns: mesh1 VS + unmanaged VS should be included, mesh2 VS excluded")

	filteredNames := make([]string, 0, len(filteredMesh1))
	for _, vs := range filteredMesh1 {
		filteredNames = append(filteredNames, vs.Name)
	}
	assert.Contains(filteredNames, "vs-mesh1", "mesh1 VS visible in own namespace")
	assert.Contains(filteredNames, "vs-ingress", "unmanaged VS exported to all")
	assert.NotContains(filteredNames, "vs-mesh2", "mesh2 VS should not leak into mesh1")
}

// Regression test for https://github.com/kiali/kiali/issues/9937
// Validates the full pipeline for HTTPRoutes referencing K8s Gateways across
// managed, Ambient, and unmanaged namespaces.
func TestHTTPRouteWithGatewayInUnmanagedNamespace(t *testing.T) {
	ambientNS := "app-ambient"
	nonAmbientNS := "app-non-ambient"
	unmanagedGWNS := "istio-ingress"

	// An HTTPRoute in an Ambient namespace referencing a Gateway in an unmanaged
	// namespace with allowedRoutes.namespaces.from: All must NOT produce KIA1401.
	t.Run("ambient ns with existing gateway no KIA1401", func(t *testing.T) {
		assert := assert.New(t)
		require := require.New(t)
		conf := config.NewConfig()
		config.Set(conf)

		gateway := data.AddListenerToK8sGateway(
			data.CreateSharedToAllListener("default", "*.example.com", 80, "HTTP"),
			data.CreateEmptyK8sGateway("gateway-internal", unmanagedGWNS),
		)
		httpRoute := data.AddGatewayParentRefToHTTPRoute("gateway-internal", unmanagedGWNS,
			data.CreateEmptyHTTPRoute("app", ambientNS, []string{"app.example.com"}),
		)

		objects := []runtime.Object{
			kubetest.FakeNamespaceWithLabels(ambientNS, map[string]string{
				config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
			}),
			kubetest.FakeNamespace(unmanagedGWNS),
			kubetest.FakeNamespace("istio-system"),
			&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
			gateway, httpRoute,
		}

		mesh := models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster:         &models.KubeCluster{IsKialiHome: true},
				IstiodNamespace: "istio-system",
				MeshConfig:      models.NewMeshConfig(),
				RootNamespace:   "istio-system",
				ManagedNamespaces: []models.Namespace{
					{Name: ambientNS, IsAmbient: true},
					{Name: "istio-system"},
				},
			}},
		}

		k8s := kubetest.NewFakeK8sClient(objects...)
		k8s.GatewayAPIEnabled = true
		kialiCache := cache.NewTestingCache(t, k8s, *conf)
		discovery := &istiotest.FakeDiscovery{MeshReturn: mesh}
		vs := NewLayerBuilder(t, conf).WithClient(k8s).WithCache(kialiCache).WithDiscovery(discovery).Build().Validations

		vInfo, err := vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, nil)
		require.NoError(err)
		validationPerformed, vals, err := vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
		require.NoError(err)
		assert.True(validationPerformed)

		routeKey := models.IstioValidationKey{ObjectGVK: kubernetes.K8sHTTPRoutes, Namespace: ambientNS, Name: "app"}
		assert.Contains(vals, routeKey, "HTTPRoute should be validated")

		for _, chk := range vals[routeKey].Checks {
			assert.NotEqual("k8sroutes.nok8sgateway", chk.Code,
				"KIA1401 must not be reported for an Ambient HTTPRoute referencing a Gateway in an unmanaged namespace with allowedRoutes from: All")
		}
	})

	// An HTTPRoute in a non-Ambient, non-managed namespace referencing the same
	// Gateway must also be validated without a false-positive KIA1401.
	t.Run("non-ambient unmanaged ns with existing gateway no KIA1401", func(t *testing.T) {
		assert := assert.New(t)
		require := require.New(t)
		conf := config.NewConfig()
		config.Set(conf)

		gateway := data.AddListenerToK8sGateway(
			data.CreateSharedToAllListener("default", "*.example.com", 80, "HTTP"),
			data.CreateEmptyK8sGateway("gateway-internal", unmanagedGWNS),
		)
		httpRoute := data.AddGatewayParentRefToHTTPRoute("gateway-internal", unmanagedGWNS,
			data.CreateEmptyHTTPRoute("app", nonAmbientNS, []string{"app.example.com"}),
		)

		objects := []runtime.Object{
			kubetest.FakeNamespaceWithLabels(ambientNS, map[string]string{
				config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
			}),
			kubetest.FakeNamespace(nonAmbientNS),
			kubetest.FakeNamespace(unmanagedGWNS),
			kubetest.FakeNamespace("istio-system"),
			&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
			gateway, httpRoute,
		}

		mesh := models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster:         &models.KubeCluster{IsKialiHome: true},
				IstiodNamespace: "istio-system",
				MeshConfig:      models.NewMeshConfig(),
				RootNamespace:   "istio-system",
				ManagedNamespaces: []models.Namespace{
					{Name: ambientNS, IsAmbient: true},
					{Name: nonAmbientNS},
					{Name: "istio-system"},
				},
			}},
		}

		k8s := kubetest.NewFakeK8sClient(objects...)
		k8s.GatewayAPIEnabled = true
		kialiCache := cache.NewTestingCache(t, k8s, *conf)
		discovery := &istiotest.FakeDiscovery{MeshReturn: mesh}
		vs := NewLayerBuilder(t, conf).WithClient(k8s).WithCache(kialiCache).WithDiscovery(discovery).Build().Validations

		vInfo, err := vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, nil)
		require.NoError(err)
		validationPerformed, vals, err := vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
		require.NoError(err)
		assert.True(validationPerformed)

		routeKey := models.IstioValidationKey{ObjectGVK: kubernetes.K8sHTTPRoutes, Namespace: nonAmbientNS, Name: "app"}
		assert.Contains(vals, routeKey, "HTTPRoute in non-Ambient namespace should be validated")

		for _, chk := range vals[routeKey].Checks {
			assert.NotEqual("k8sroutes.nok8sgateway", chk.Code,
				"KIA1401 must not be reported for a non-Ambient HTTPRoute referencing a Gateway in an unmanaged namespace with allowedRoutes from: All")
		}
	})

	// When the referenced Gateway truly does not exist, KIA1401 must be reported.
	t.Run("non-existent gateway produces KIA1401", func(t *testing.T) {
		assert := assert.New(t)
		require := require.New(t)
		conf := config.NewConfig()
		config.Set(conf)

		httpRouteAmbient := data.AddGatewayParentRefToHTTPRoute("does-not-exist", unmanagedGWNS,
			data.CreateEmptyHTTPRoute("app-ambient", ambientNS, []string{"app.example.com"}),
		)
		httpRouteNonAmbient := data.AddGatewayParentRefToHTTPRoute("does-not-exist", unmanagedGWNS,
			data.CreateEmptyHTTPRoute("app-non-ambient", nonAmbientNS, []string{"app2.example.com"}),
		)

		objects := []runtime.Object{
			kubetest.FakeNamespaceWithLabels(ambientNS, map[string]string{
				config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
			}),
			kubetest.FakeNamespace(nonAmbientNS),
			kubetest.FakeNamespace(unmanagedGWNS),
			kubetest.FakeNamespace("istio-system"),
			&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
			httpRouteAmbient, httpRouteNonAmbient,
		}

		mesh := models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster:         &models.KubeCluster{IsKialiHome: true},
				IstiodNamespace: "istio-system",
				MeshConfig:      models.NewMeshConfig(),
				RootNamespace:   "istio-system",
				ManagedNamespaces: []models.Namespace{
					{Name: ambientNS, IsAmbient: true},
					{Name: nonAmbientNS},
					{Name: "istio-system"},
				},
			}},
		}

		k8s := kubetest.NewFakeK8sClient(objects...)
		k8s.GatewayAPIEnabled = true
		kialiCache := cache.NewTestingCache(t, k8s, *conf)
		discovery := &istiotest.FakeDiscovery{MeshReturn: mesh}
		vs := NewLayerBuilder(t, conf).WithClient(k8s).WithCache(kialiCache).WithDiscovery(discovery).Build().Validations

		vInfo, err := vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, nil)
		require.NoError(err)
		validationPerformed, vals, err := vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
		require.NoError(err)
		assert.True(validationPerformed)

		ambientKey := models.IstioValidationKey{ObjectGVK: kubernetes.K8sHTTPRoutes, Namespace: ambientNS, Name: "app-ambient"}
		assert.Contains(vals, ambientKey, "Ambient HTTPRoute should be validated")
		assert.False(vals[ambientKey].Valid, "HTTPRoute referencing non-existent Gateway should be invalid")
		assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nok8sgateway", vals[ambientKey].Checks[0]))

		nonAmbientKey := models.IstioValidationKey{ObjectGVK: kubernetes.K8sHTTPRoutes, Namespace: nonAmbientNS, Name: "app-non-ambient"}
		assert.Contains(vals, nonAmbientKey, "Non-Ambient HTTPRoute should be validated")
		assert.False(vals[nonAmbientKey].Valid, "HTTPRoute referencing non-existent Gateway should be invalid")
		assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nok8sgateway", vals[nonAmbientKey].Checks[0]))
	})
}

// Validates that ValidateIstioObject (the details-page path) produces validations
// for objects in unmanaged namespaces. ControlPlaneForNamespace returns an error
// for unmanaged namespaces, and the helper functions setNonLocalMTLSConfig,
// isGatewayToNamespace, and isPolicyAllowAny must ignore that error. If they
// propagate it, ValidateIstioObject aborts early and returns nil validations
// with nil error, making it appear as if the object has no issues.
func TestValidateIstioObjectInUnmanagedNamespace(t *testing.T) {
	ambientNS := "app-ambient"
	nonAmbientNS := "app-non-ambient"
	unmanagedGWNS := "istio-ingress"

	buildTestEnv := func(t *testing.T, routeNS string, managedNamespaces []models.Namespace) IstioValidationsService {
		t.Helper()
		conf := config.NewConfig()
		config.Set(conf)

		gateway := data.AddListenerToK8sGateway(
			data.CreateSharedToAllListener("default", "*.example.com", 80, "HTTP"),
			data.CreateEmptyK8sGateway("gateway-internal", unmanagedGWNS),
		)
		httpRoute := data.AddBackendRefToHTTPRoute("non-existent-svc", routeNS,
			data.AddGatewayParentRefToHTTPRoute("gateway-internal", unmanagedGWNS,
				data.CreateEmptyHTTPRoute("app", routeNS, []string{"app.example.com"}),
			),
		)

		objects := []runtime.Object{
			kubetest.FakeNamespaceWithLabels(ambientNS, map[string]string{
				config.IstioAmbientNamespaceLabel: config.IstioAmbientNamespaceLabelValue,
			}),
			kubetest.FakeNamespace(nonAmbientNS),
			kubetest.FakeNamespace(unmanagedGWNS),
			kubetest.FakeNamespace("istio-system"),
			&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
			gateway, httpRoute,
		}

		mesh := models.Mesh{
			ControlPlanes: []models.ControlPlane{{
				Cluster:           &models.KubeCluster{IsKialiHome: true},
				IstiodNamespace:   "istio-system",
				MeshConfig:        models.NewMeshConfig(),
				RootNamespace:     "istio-system",
				ManagedNamespaces: managedNamespaces,
			}},
		}

		k8s := kubetest.NewFakeK8sClient(objects...)
		k8s.GatewayAPIEnabled = true
		kialiCache := cache.NewTestingCache(t, k8s, *conf)
		discovery := &istiotest.FakeDiscovery{MeshReturn: mesh}
		return NewLayerBuilder(t, conf).WithClient(k8s).WithCache(kialiCache).WithDiscovery(discovery).Build().Validations
	}

	// HTTPRoute in Ambient namespace (managed) — setNonLocalMTLSConfig, isPolicyAllowAny,
	// and isGatewayToNamespace must not block validation.
	t.Run("ambient namespace produces KIA1402 for missing service", func(t *testing.T) {
		assert := assert.New(t)
		conf := config.NewConfig()
		vs := buildTestEnv(t, ambientNS, []models.Namespace{
			{Name: ambientNS, IsAmbient: true},
			{Name: "istio-system"},
		})

		vals, _, err := vs.ValidateIstioObject(context.Background(), conf.KubernetesConfig.ClusterName, ambientNS, kubernetes.K8sHTTPRoutes, "app")
		assert.NoError(err)

		routeKey := models.IstioValidationKey{ObjectGVK: kubernetes.K8sHTTPRoutes, Namespace: ambientNS, Name: "app"}
		assert.Contains(vals, routeKey, "ValidateIstioObject should return validations for Ambient namespace")
		assert.False(vals[routeKey].Valid)
		assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[routeKey].Checks[0]))
	})

	// HTTPRoute in a non-Ambient managed namespace — same assertion.
	t.Run("non-ambient managed namespace produces KIA1402 for missing service", func(t *testing.T) {
		assert := assert.New(t)
		conf := config.NewConfig()
		vs := buildTestEnv(t, nonAmbientNS, []models.Namespace{
			{Name: ambientNS, IsAmbient: true},
			{Name: nonAmbientNS},
			{Name: "istio-system"},
		})

		vals, _, err := vs.ValidateIstioObject(context.Background(), conf.KubernetesConfig.ClusterName, nonAmbientNS, kubernetes.K8sHTTPRoutes, "app")
		assert.NoError(err)

		routeKey := models.IstioValidationKey{ObjectGVK: kubernetes.K8sHTTPRoutes, Namespace: nonAmbientNS, Name: "app"}
		assert.Contains(vals, routeKey, "ValidateIstioObject should return validations for managed namespace")
		assert.False(vals[routeKey].Valid)
		assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[routeKey].Checks[0]))
	})

	// HTTPRoute in an unmanaged namespace — the critical case. If setNonLocalMTLSConfig,
	// isGatewayToNamespace, or isPolicyAllowAny propagate the ControlPlaneForNamespace
	// error instead of ignoring it, ValidateIstioObject returns nil validations with nil error,
	// making it appear as if the object has no issues.
	t.Run("unmanaged namespace produces KIA1402 for missing service", func(t *testing.T) {
		assert := assert.New(t)
		conf := config.NewConfig()
		vs := buildTestEnv(t, unmanagedGWNS, []models.Namespace{
			{Name: ambientNS, IsAmbient: true},
			{Name: "istio-system"},
		})

		vals, _, err := vs.ValidateIstioObject(context.Background(), conf.KubernetesConfig.ClusterName, unmanagedGWNS, kubernetes.K8sHTTPRoutes, "app")
		assert.NoError(err)

		routeKey := models.IstioValidationKey{ObjectGVK: kubernetes.K8sHTTPRoutes, Namespace: unmanagedGWNS, Name: "app"}
		assert.Contains(vals, routeKey,
			"ValidateIstioObject must return validations even for objects in unmanaged namespaces; "+
				"if this fails, setNonLocalMTLSConfig/isGatewayToNamespace/isPolicyAllowAny likely "+
				"propagate the ControlPlaneForNamespace error instead of ignoring it")
		assert.False(vals[routeKey].Valid)
		assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nohost.namenotfound", vals[routeKey].Checks[0]))
	})
}

func TestFilterExportToNamespacesVS(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var currentIstioObjects []*networking_v1.VirtualService
	vs1to3 := loadVirtualService("vs_bookinfo1_to_2_3.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs1to3)
	vs1tothis := loadVirtualService("vs_bookinfo1_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs1tothis)
	vs2to1 := loadVirtualService("vs_bookinfo2_to_1.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs2to1)
	vs2tothis := loadVirtualService("vs_bookinfo2_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs2tothis)
	vs3to2 := loadVirtualService("vs_bookinfo3_to_2.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs3to2)
	vs3toall := loadVirtualService("vs_bookinfo3_to_all.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs3toall)
	vs3towrong := loadVirtualService("vs_bookinfo3_to_wrong.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs3towrong)
	objs := mockEmpty(t, conf)
	v := fakeValidationMeshService(t, *conf, objs...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo")
	vInfo.mesh = testMesh(conf)
	filteredVSs := v.filterVSExportToNamespaces(currentIstioObjects, &vInfo)
	var expectedVS []*networking_v1.VirtualService
	expectedVS = append(expectedVS, vs1tothis)
	expectedVS = append(expectedVS, vs2to1)
	expectedVS = append(expectedVS, vs3toall)
	expectedVS = append(expectedVS, vs3towrong)
	filteredKeys := []string{}
	for _, vs := range filteredVSs {
		filteredKeys = append(filteredKeys, fmt.Sprintf("%s/%s", vs.Name, vs.Namespace))
	}
	expectedKeys := []string{}
	for _, vs := range expectedVS {
		expectedKeys = append(expectedKeys, fmt.Sprintf("%s/%s", vs.Name, vs.Namespace))
	}
	assert.EqualValues(filteredKeys, expectedKeys)
}

func TestAmbientFilterExportToNamespacesVS(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var currentIstioObjects []*networking_v1.VirtualService
	vs1to3 := loadVirtualService("vs_bookinfo1_to_2_3.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs1to3)
	vs1tothis := loadVirtualService("vs_bookinfo1_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs1tothis)
	vs2to1 := loadVirtualService("vs_bookinfo2_to_1.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs2to1)
	vs2tothis := loadVirtualService("vs_bookinfo2_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs2tothis)
	vs3to2 := loadVirtualService("vs_bookinfo3_to_2.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs3to2)
	vs3toall := loadVirtualService("vs_bookinfo3_to_all.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs3toall)
	vs3towrong := loadVirtualService("vs_bookinfo3_to_wrong.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs3towrong)
	objects := mockAmbient(t, conf)
	v := fakeValidationMeshService(t, *conf, objects...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": true, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo2")
	vInfo.mesh = testMesh(conf)
	filteredVSs := v.filterVSExportToNamespaces(currentIstioObjects, &vInfo)
	var expectedVS []*networking_v1.VirtualService
	expectedVS = append(expectedVS, vs2tothis)
	expectedVS = append(expectedVS, vs3to2)
	expectedVS = append(expectedVS, vs3toall)
	expectedVS = append(expectedVS, vs3towrong)
	filteredKeys := []string{}
	for _, vs := range filteredVSs {
		filteredKeys = append(filteredKeys, fmt.Sprintf("%s/%s", vs.Name, vs.Namespace))
	}
	expectedKeys := []string{}
	for _, vs := range expectedVS {
		expectedKeys = append(expectedKeys, fmt.Sprintf("%s/%s", vs.Name, vs.Namespace))
	}
	assert.EqualValues(expectedKeys, filteredKeys)
}

func TestFilterVSMeshExportToThis(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var currentIstioObjects []*networking_v1.VirtualService
	vs1tothis := loadVirtualService("vs_bookinfo1_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs1tothis)
	vs1not := loadVirtualService("vs_bookinfo1_not_exported.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs1not)
	vs2not := loadVirtualService("vs_bookinfo2_not_exported.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs2not)
	vs3toall := loadVirtualService("vs_bookinfo3_to_all.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs3toall)
	objs := mockEmpty(t, conf, ".")
	v := fakeValidationMeshService(t, *conf, objs...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo")
	vInfo.mesh = meshWithDefaultExportTo(conf, ".")
	filteredVSs := v.filterVSExportToNamespaces(currentIstioObjects, &vInfo)
	var expectedVS []*networking_v1.VirtualService
	expectedVS = append(expectedVS, vs1tothis)
	expectedVS = append(expectedVS, vs1not)
	expectedVS = append(expectedVS, vs3toall)
	filteredKeys := []string{}
	for _, vs := range filteredVSs {
		filteredKeys = append(filteredKeys, fmt.Sprintf("%s/%s", vs.Name, vs.Namespace))
	}
	expectedKeys := []string{}
	for _, vs := range expectedVS {
		expectedKeys = append(expectedKeys, fmt.Sprintf("%s/%s", vs.Name, vs.Namespace))
	}
	assert.EqualValues(filteredKeys, expectedKeys)
}

func TestFilterVSMeshExportToAll(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var currentIstioObjects []*networking_v1.VirtualService
	vs1tothis := loadVirtualService("vs_bookinfo1_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs1tothis)
	vs1not := loadVirtualService("vs_bookinfo1_not_exported.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs1not)
	vs2not := loadVirtualService("vs_bookinfo2_not_exported.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs2not)
	vs3toall := loadVirtualService("vs_bookinfo3_to_all.yaml", t)
	currentIstioObjects = append(currentIstioObjects, vs3toall)
	objs := mockEmpty(t, conf, "*")
	v := fakeValidationMeshService(t, *conf, objs...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo2")
	vInfo.mesh = meshWithDefaultExportTo(conf, "*")
	filteredVSs := v.filterVSExportToNamespaces(currentIstioObjects, &vInfo)
	var expectedVS []*networking_v1.VirtualService
	expectedVS = append(expectedVS, vs1not)
	expectedVS = append(expectedVS, vs2not)
	expectedVS = append(expectedVS, vs3toall)
	filteredKeys := []string{}
	for _, vs := range filteredVSs {
		filteredKeys = append(filteredKeys, fmt.Sprintf("%s/%s", vs.Name, vs.Namespace))
	}
	expectedKeys := []string{}
	for _, vs := range expectedVS {
		expectedKeys = append(expectedKeys, fmt.Sprintf("%s/%s", vs.Name, vs.Namespace))
	}
	assert.EqualValues(filteredKeys, expectedKeys)
}

func TestFilterExportToNamespacesDR(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var currentIstioObjects []*networking_v1.DestinationRule
	dr1to3 := loadDestinationRule("dr_bookinfo1_to_2_3.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr1to3)
	dr1tothis := loadDestinationRule("dr_bookinfo1_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr1tothis)
	dr2to1 := loadDestinationRule("dr_bookinfo2_to_1.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr2to1)
	dr2tothis := loadDestinationRule("dr_bookinfo2_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr2tothis)
	dr3to2 := loadDestinationRule("dr_bookinfo3_to_2.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr3to2)
	dr3toall := loadDestinationRule("dr_bookinfo3_to_all.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr3toall)
	dr3towrong := loadDestinationRule("dr_bookinfo3_to_wrong.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr3towrong)
	objs := mockEmpty(t, conf)
	v := fakeValidationMeshService(t, *conf, objs...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo")
	vInfo.mesh = testMesh(conf)
	filteredDRs := v.filterDRExportToNamespaces(currentIstioObjects, &vInfo)
	var expectedDR []*networking_v1.DestinationRule
	expectedDR = append(expectedDR, dr1tothis)
	expectedDR = append(expectedDR, dr2to1)
	expectedDR = append(expectedDR, dr3toall)
	expectedDR = append(expectedDR, dr3towrong)
	filteredKeys := []string{}
	for _, dr := range filteredDRs {
		filteredKeys = append(filteredKeys, fmt.Sprintf("%s/%s", dr.Name, dr.Namespace))
	}
	expectedKeys := []string{}
	for _, dr := range expectedDR {
		expectedKeys = append(expectedKeys, fmt.Sprintf("%s/%s", dr.Name, dr.Namespace))
	}
	assert.EqualValues(expectedKeys, filteredKeys)
}

func TestAmbientFilterExportToNamespacesDR(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var currentIstioObjects []*networking_v1.DestinationRule
	dr1to3 := loadDestinationRule("dr_bookinfo1_to_2_3.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr1to3)
	dr1tothis := loadDestinationRule("dr_bookinfo1_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr1tothis)
	dr2to1 := loadDestinationRule("dr_bookinfo2_to_1.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr2to1)
	dr2tothis := loadDestinationRule("dr_bookinfo2_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr2tothis)
	dr3to2 := loadDestinationRule("dr_bookinfo3_to_2.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr3to2)
	dr3toall := loadDestinationRule("dr_bookinfo3_to_all.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr3toall)
	dr3towrong := loadDestinationRule("dr_bookinfo3_to_wrong.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr3towrong)
	objects := mockAmbient(t, conf)
	v := fakeValidationMeshService(t, *conf, objects...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": true, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo2")
	vInfo.mesh = testMesh(conf)
	filteredDRs := v.filterDRExportToNamespaces(currentIstioObjects, &vInfo)
	var expectedDR []*networking_v1.DestinationRule
	expectedDR = append(expectedDR, dr2tothis)
	expectedDR = append(expectedDR, dr3to2)
	expectedDR = append(expectedDR, dr3toall)
	expectedDR = append(expectedDR, dr3towrong)
	filteredKeys := []string{}
	for _, dr := range filteredDRs {
		filteredKeys = append(filteredKeys, fmt.Sprintf("%s/%s", dr.Name, dr.Namespace))
	}
	expectedKeys := []string{}
	for _, dr := range expectedDR {
		expectedKeys = append(expectedKeys, fmt.Sprintf("%s/%s", dr.Name, dr.Namespace))
	}
	assert.EqualValues(expectedKeys, filteredKeys)
}

func TestFilterDRMeshExportToThis(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var currentIstioObjects []*networking_v1.DestinationRule
	dr1tothis := loadDestinationRule("dr_bookinfo1_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr1tothis)
	dr1not := loadDestinationRule("dr_bookinfo1_not_exported.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr1not)
	dr2not := loadDestinationRule("dr_bookinfo2_not_exported.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr2not)
	dr3toall := loadDestinationRule("dr_bookinfo3_to_all.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr3toall)
	objs := mockEmpty(t, conf, ".")
	v := fakeValidationMeshService(t, *conf, objs...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo")
	vInfo.mesh = meshWithDefaultExportTo(conf, ".")
	filteredDRs := v.filterDRExportToNamespaces(currentIstioObjects, &vInfo)
	var expectedDR []*networking_v1.DestinationRule
	expectedDR = append(expectedDR, dr1tothis)
	expectedDR = append(expectedDR, dr1not)
	expectedDR = append(expectedDR, dr3toall)
	filteredKeys := []string{}
	for _, dr := range filteredDRs {
		filteredKeys = append(filteredKeys, fmt.Sprintf("%s/%s", dr.Name, dr.Namespace))
	}
	expectedKeys := []string{}
	for _, dr := range expectedDR {
		expectedKeys = append(expectedKeys, fmt.Sprintf("%s/%s", dr.Name, dr.Namespace))
	}
	assert.EqualValues(expectedKeys, filteredKeys)
}

func TestFilterDRMeshExportToAll(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var currentIstioObjects []*networking_v1.DestinationRule
	dr1tothis := loadDestinationRule("dr_bookinfo1_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr1tothis)
	dr1not := loadDestinationRule("dr_bookinfo1_not_exported.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr1not)
	dr2not := loadDestinationRule("dr_bookinfo2_not_exported.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr2not)
	dr3toall := loadDestinationRule("dr_bookinfo3_to_all.yaml", t)
	currentIstioObjects = append(currentIstioObjects, dr3toall)
	objs := mockEmpty(t, conf, "*")
	v := fakeValidationMeshService(t, *conf, objs...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo2")
	vInfo.mesh = meshWithDefaultExportTo(conf, "*")
	filteredDRs := v.filterDRExportToNamespaces(currentIstioObjects, &vInfo)
	var expectedDR []*networking_v1.DestinationRule
	expectedDR = append(expectedDR, dr1not)
	expectedDR = append(expectedDR, dr2not)
	expectedDR = append(expectedDR, dr3toall)
	filteredKeys := []string{}
	for _, dr := range filteredDRs {
		filteredKeys = append(filteredKeys, fmt.Sprintf("%s/%s", dr.Name, dr.Namespace))
	}
	expectedKeys := []string{}
	for _, dr := range expectedDR {
		expectedKeys = append(expectedKeys, fmt.Sprintf("%s/%s", dr.Name, dr.Namespace))
	}
	assert.EqualValues(expectedKeys, filteredKeys)
}

func TestFilterExportToNamespacesSE(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var currentIstioObjects []*networking_v1.ServiceEntry
	se1to3 := loadServiceEntry("se_bookinfo1_to_2_3.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se1to3)
	se1tothis := loadServiceEntry("se_bookinfo1_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se1tothis)
	se2to1 := loadServiceEntry("se_bookinfo2_to_1.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se2to1)
	se2tothis := loadServiceEntry("se_bookinfo2_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se2tothis)
	se3to2 := loadServiceEntry("se_bookinfo3_to_2.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se3to2)
	se3toall := loadServiceEntry("se_bookinfo3_to_all.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se3toall)
	se3towrong := loadServiceEntry("se_bookinfo3_to_wrong.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se3towrong)
	objs := mockEmpty(t, conf)
	v := fakeValidationMeshService(t, *conf, objs...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo")
	vInfo.mesh = testMesh(conf)
	filteredSEs := v.filterSEExportToNamespaces(currentIstioObjects, &vInfo)
	var expectedSE []*networking_v1.ServiceEntry
	expectedSE = append(expectedSE, se1tothis)
	expectedSE = append(expectedSE, se2to1)
	expectedSE = append(expectedSE, se3toall)
	expectedSE = append(expectedSE, se3towrong)
	filteredKeys := []string{}
	for _, se := range filteredSEs {
		filteredKeys = append(filteredKeys, fmt.Sprintf("%s/%s", se.Name, se.Namespace))
	}
	expectedKeys := []string{}
	for _, se := range expectedSE {
		expectedKeys = append(expectedKeys, fmt.Sprintf("%s/%s", se.Name, se.Namespace))
	}
	assert.EqualValues(expectedKeys, filteredKeys)
}

func TestAmbientFilterExportToNamespacesSE(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var currentIstioObjects []*networking_v1.ServiceEntry
	se1to3 := loadServiceEntry("se_bookinfo1_to_2_3.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se1to3)
	se1tothis := loadServiceEntry("se_bookinfo1_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se1tothis)
	se2to1 := loadServiceEntry("se_bookinfo2_to_1.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se2to1)
	se2tothis := loadServiceEntry("se_bookinfo2_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se2tothis)
	se3to2 := loadServiceEntry("se_bookinfo3_to_2.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se3to2)
	se3toall := loadServiceEntry("se_bookinfo3_to_all.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se3toall)
	se3towrong := loadServiceEntry("se_bookinfo3_to_wrong.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se3towrong)
	objects := mockAmbient(t, conf)
	v := fakeValidationMeshService(t, *conf, objects...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": true, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo2")
	vInfo.mesh = testMesh(conf)
	filteredSEs := v.filterSEExportToNamespaces(currentIstioObjects, &vInfo)
	var expectedSE []*networking_v1.ServiceEntry
	expectedSE = append(expectedSE, se2tothis)
	expectedSE = append(expectedSE, se3to2)
	expectedSE = append(expectedSE, se3toall)
	expectedSE = append(expectedSE, se3towrong)
	filteredKeys := []string{}
	for _, se := range filteredSEs {
		filteredKeys = append(filteredKeys, fmt.Sprintf("%s/%s", se.Name, se.Namespace))
	}
	expectedKeys := []string{}
	for _, se := range expectedSE {
		expectedKeys = append(expectedKeys, fmt.Sprintf("%s/%s", se.Name, se.Namespace))
	}
	assert.EqualValues(expectedKeys, filteredKeys)
}

func TestFilterSEMeshExportToThis(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var currentIstioObjects []*networking_v1.ServiceEntry
	se1tothis := loadServiceEntry("se_bookinfo1_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se1tothis)
	se1not := loadServiceEntry("se_bookinfo1_not_exported.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se1not)
	se2not := loadServiceEntry("se_bookinfo2_not_exported.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se2not)
	se3toall := loadServiceEntry("se_bookinfo3_to_all.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se3toall)
	objs := mockEmpty(t, conf, ".")
	v := fakeValidationMeshService(t, *conf, objs...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo")
	vInfo.mesh = meshWithDefaultExportTo(conf, ".")
	filteredSEs := v.filterSEExportToNamespaces(currentIstioObjects, &vInfo)
	var expectedSE []*networking_v1.ServiceEntry
	expectedSE = append(expectedSE, se1tothis)
	expectedSE = append(expectedSE, se1not)
	expectedSE = append(expectedSE, se3toall)
	filteredKeys := []string{}
	for _, se := range filteredSEs {
		filteredKeys = append(filteredKeys, fmt.Sprintf("%s/%s", se.Name, se.Namespace))
	}
	expectedKeys := []string{}
	for _, se := range expectedSE {
		expectedKeys = append(expectedKeys, fmt.Sprintf("%s/%s", se.Name, se.Namespace))
	}
	assert.EqualValues(expectedKeys, filteredKeys)
}

func TestFilterSEMeshExportToAll(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	var currentIstioObjects []*networking_v1.ServiceEntry
	se1tothis := loadServiceEntry("se_bookinfo1_to_this.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se1tothis)
	se1not := loadServiceEntry("se_bookinfo1_not_exported.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se1not)
	se2not := loadServiceEntry("se_bookinfo2_not_exported.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se2not)
	se3toall := loadServiceEntry("se_bookinfo3_to_all.yaml", t)
	currentIstioObjects = append(currentIstioObjects, se3toall)
	objs := mockEmpty(t, conf, "*")
	v := fakeValidationMeshService(t, *conf, objs...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo2")
	vInfo.mesh = meshWithDefaultExportTo(conf, "*")
	filteredSEs := v.filterSEExportToNamespaces(currentIstioObjects, &vInfo)
	var expectedSE []*networking_v1.ServiceEntry
	expectedSE = append(expectedSE, se1not)
	expectedSE = append(expectedSE, se2not)
	expectedSE = append(expectedSE, se3toall)
	filteredKeys := []string{}
	for _, se := range filteredSEs {
		filteredKeys = append(filteredKeys, fmt.Sprintf("%s/%s", se.Name, se.Namespace))
	}
	expectedKeys := []string{}
	for _, se := range expectedSE {
		expectedKeys = append(expectedKeys, fmt.Sprintf("%s/%s", se.Name, se.Namespace))
	}
	assert.EqualValues(expectedKeys, filteredKeys)
}

func TestGetVSReferences(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(t, conf, fakeIstioConfigList(), []string{})

	_, referencesMap, err := vs.ValidateIstioObject(context.TODO(), conf.KubernetesConfig.ClusterName, "test", kubernetes.VirtualServices, "product-vs")
	references := referencesMap[models.IstioReferenceKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "test", Name: "product-vs"}]

	// Check Service references
	assert.Nil(err)
	assert.NotNil(references)
	assert.NotEmpty(references.ServiceReferences)
	assert.Len(references.ServiceReferences, 2)
	assert.Equal(references.ServiceReferences[0].Name, "product")
	assert.Equal(references.ServiceReferences[0].Namespace, "test")
	assert.Equal(references.ServiceReferences[1].Name, "product2")
	assert.Equal(references.ServiceReferences[1].Namespace, "test")
}

func TestGetVSReferencesNotExisting(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(t, conf, fakeEmptyIstioConfigList(), []string{})

	_, referencesMap, err := vs.ValidateIstioObject(context.TODO(), conf.KubernetesConfig.ClusterName, "wrong", kubernetes.VirtualServices, "wrong")
	references := referencesMap[models.IstioReferenceKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "wrong", Name: "product-vs"}]

	assert.Nil(err)
	assert.Nil(references)
}

// TODO: This test is currently broken because the testing cache uses a different
// fake client and object trackers are different. Add this test back in once both
// clients are the same.
// func TestValidatingSingleObjectUpdatesList(t *testing.T) {
// 	assert := assert.New(t)
// 	require := require.New(t)
// 	conf := config.NewConfig()
// 	config.Set(conf)

// 	vs := mockCombinedValidationService(t, conf, fakeIstioConfigList(),
// 		[]string{"details", "product", "product2", "customer"})

// 	v, err := vs.userClients[conf.KubernetesConfig.ClusterName].Istio().NetworkingV1().VirtualServices("test").Get(context.Background(), "product-vs", v1.GetOptions{})
// 	require.NoError(err)

// 	vInfo, err := vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, nil)
// 	require.NoError(err)
// 	validationPerformed, validations, err := vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
// 	require.NoError(err)
// 	assert.True(validationPerformed)
// 	vs.kialiCache.Validations().Replace(validations)

// 	currentValidations, err := vs.GetValidations(context.Background(), conf.KubernetesConfig.ClusterName)
// 	require.NoError(err)

// 	key := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "test", Name: "product-vs"}
// 	require.True(currentValidations[key].Valid)

// 	v.Spec.Gateways = []string{"nonexistant"}
// 	_, err = vs.userClients[conf.KubernetesConfig.ClusterName].Istio().NetworkingV1().VirtualServices("test").Update(context.Background(), v, v1.UpdateOptions{})
// 	require.NoError(err)

// 	// make sure validations are updated in a cache before retrieving them
// 	vInfo, err = vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, nil)
// 	require.NoError(err)
// 	validationPerformed, validations, err = vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
// 	require.NoError(err)
// 	assert.True(validationPerformed)
// 	vs.kialiCache.Validations().Replace(validations)

// 	updatedValidations, _, err := vs.ValidateIstioObject(context.Background(), conf.KubernetesConfig.ClusterName, "test", kubernetes.VirtualServices, "product-vs")
// 	require.NoError(err)
// 	require.False(updatedValidations[key].Valid)

// 	validations, err = vs.GetValidations(context.Background(), conf.KubernetesConfig.ClusterName)
// 	require.NoError(err)
// 	require.NotEmpty(validations)
// 	assert.False(validations[key].Valid)
// }

func fakeValidationMeshService(t *testing.T, conf config.Config, objects ...runtime.Object) IstioValidationsService {
	k8s := kubetest.NewFakeK8sClient(objects...)
	return NewLayerBuilder(t, &conf).WithClient(k8s).Build().Validations
}

func fakeValidationMeshServiceWithDiscovery(t *testing.T, cfg config.Config, objects ...runtime.Object) IstioValidationsService {
	return fakeValidationMeshServiceWithMesh(t, cfg, models.Mesh{
		ControlPlanes: []models.ControlPlane{{
			Cluster:    &models.KubeCluster{IsKialiHome: true},
			MeshConfig: models.NewMeshConfig(),
			ManagedNamespaces: []models.Namespace{
				{Name: "test"},
				{Name: "test2"},
				{Name: "wrong"},
				{Name: "istio-system"},
			},
		}},
	}, objects...)
}

func fakeValidationMeshServiceWithMesh(t *testing.T, cfg config.Config, mesh models.Mesh, objects ...runtime.Object) IstioValidationsService {
	k8s := kubetest.NewFakeK8sClient(objects...)
	cache := cache.NewTestingCache(t, k8s, cfg)

	discovery := &istiotest.FakeDiscovery{MeshReturn: mesh}

	return NewLayerBuilder(t, &cfg).WithClient(k8s).WithCache(cache).WithDiscovery(discovery).Build().Validations
}

func mockMultiNamespaceGateways(conf *config.Config) []runtime.Object {
	fakeIstioObjects := []runtime.Object{
		&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
	}
	for _, p := range fakeNamespaces() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakePolicies() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range FakeDepSyncedWithRS(conf) {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range FakeRSSyncedWithPods(conf) {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakePods().Items {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakeMeshPolicies() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}

	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(getGateway("first", "test"))...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(getGateway("second", "test2"))...)

	return fakeIstioObjects
}

func mockCombinedValidationService(t *testing.T, conf *config.Config, istioConfigList *models.IstioConfigList, services []string) IstioValidationsService {
	fakeIstioObjects := []runtime.Object{
		&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
		kubetest.FakeNamespace("wrong"),
		kubetest.FakeNamespace("istio-system"),
	}
	for _, p := range fakeMeshPolicies() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakePolicies() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakeCombinedServices(services, "test") {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range FakeDepSyncedWithRS(conf) {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakeNamespaces() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range FakeRSSyncedWithPods(conf) {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakePods().Items {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.Gateways)...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.DestinationRules)...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.VirtualServices)...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.ServiceEntries)...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.Sidecars)...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.WorkloadEntries)...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(istioConfigList.RequestAuthentications)...)

	return fakeValidationMeshServiceWithDiscovery(t, *config.NewConfig(), fakeIstioObjects...)
}

func mockAmbient(t *testing.T, conf *config.Config) []runtime.Object {
	objects := []runtime.Object{
		fakeDaemonSetWithStatus("istio-ingressgateway", map[string]string{"app": "istio-ingressgateway", "istio": "ingressgateway"}, unhealthyDaemonSetStatus),
		fakeDaemonSetWithStatus("ztunnel", map[string]string{"app": "ztunnel"}, unhealthyDaemonSetStatus),
		fakeDeploymentWithStatus("istio-egressgateway", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, unhealthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
	}

	mockAddOnsCalls(t, objects, true, false)

	conf.IstioLabels.AppLabelName = "app.kubernetes.io/name"
	conf.ExternalServices.Istio.ComponentStatuses = config.ComponentStatuses{
		Enabled: true,
		Components: []config.ComponentStatus{
			{AppLabel: "istiod", IsCore: false},
			{AppLabel: "istio-egressgateway", IsCore: false},
			{AppLabel: "istio-ingressgateway", IsCore: false},
		},
	}

	return objects
}

func mockEmpty(t *testing.T, conf *config.Config, exportToValue ...string) []runtime.Object {
	configMapData := `accessLogFile: /dev/stdout
enableAutoMtls: true
rootNamespace: istio-system
trustDomain: cluster.local
`
	if len(exportToValue) != 0 {
		configMapData += `
defaultDestinationRuleExportTo:
- '` + exportToValue[0] + `'
defaultServiceExportTo:
- '` + exportToValue[0] + `'
defaultVirtualServiceExportTo:
- '` + exportToValue[0] + `'
`
	}
	istioConfigMap := core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels: map[string]string{
				config.IstioRevisionLabel: "default",
			},
		},
		Data: map[string]string{"mesh": configMapData},
	}
	objects := []runtime.Object{
		fakeDaemonSetWithStatus("istio-ingressgateway", map[string]string{"app": "istio-ingressgateway", "istio": "ingressgateway"}, unhealthyDaemonSetStatus),
		fakeDeploymentWithStatus("istio-egressgateway", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, unhealthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
		&istioConfigMap,
		certtest.FakeIstioCertificateConfigMap("istio-system"),
	}

	mockAddOnsCalls(t, objects, true, false)

	conf.IstioLabels.AppLabelName = "app.kubernetes.io/name"
	conf.ExternalServices.Istio.ComponentStatuses = config.ComponentStatuses{
		Enabled: true,
		Components: []config.ComponentStatus{
			{AppLabel: "istiod", IsCore: false},
			{AppLabel: "istio-egressgateway", IsCore: false},
			{AppLabel: "istio-ingressgateway", IsCore: false},
		},
	}
	config.Set(conf)

	return objects
}

func fakeEmptyIstioConfigList() *models.IstioConfigList {
	return &models.IstioConfigList{}
}

func fakeIstioConfigList() *models.IstioConfigList {
	istioConfigList := models.IstioConfigList{}

	istioConfigList.VirtualServices = []*networking_v1.VirtualService{
		data.AddHttpRoutesToVirtualService(data.CreateHttpRouteDestination("product", "v1", -1),
			data.AddTcpRoutesToVirtualService(data.CreateTcpRoute("product2", "v1", -1),
				data.CreateEmptyVirtualService("product-vs", "test", []string{"product"}))),
	}

	istioConfigList.DestinationRules = []*networking_v1.DestinationRule{
		data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"), data.CreateEmptyDestinationRule("test", "product-dr", "product")),
		data.CreateEmptyDestinationRule("test", "customer-dr", "customer"),
	}

	istioConfigList.Gateways = append(getGateway("first", "test"), getGateway("second", "test2")...)

	return &istioConfigList
}

func fakeMeshPolicies() []*security_v1.PeerAuthentication {
	return []*security_v1.PeerAuthentication{
		data.CreateEmptyMeshPeerAuthentication("default", nil),
		data.CreateEmptyMeshPeerAuthentication("test", nil),
	}
}

func fakePolicies() []*security_v1.PeerAuthentication {
	return []*security_v1.PeerAuthentication{
		data.CreateEmptyPeerAuthentication("default", "bookinfo", nil),
		data.CreateEmptyPeerAuthentication("test", "foo", nil),
	}
}

func fakeNamespaces() []core_v1.Namespace {
	return []core_v1.Namespace{
		*kubetest.FakeNamespace("test"),
		*kubetest.FakeNamespace("test2"),
	}
}

func fakeCombinedServices(services []string, namespace string) []core_v1.Service {
	items := []core_v1.Service{}

	for _, service := range services {
		items = append(items, core_v1.Service{
			ObjectMeta: v1.ObjectMeta{
				Name:      service,
				Namespace: namespace,
				Labels: map[string]string{
					"app":     service,
					"version": "v1",
				},
			},
		})
	}
	return items
}

func fakePods() *core_v1.PodList {
	return &core_v1.PodList{
		Items: []core_v1.Pod{
			{
				ObjectMeta: v1.ObjectMeta{
					Name: "reviews-12345-hello",
					Labels: map[string]string{
						"app":     "reviews",
						"version": "v2",
					},
				},
			},
			{
				ObjectMeta: v1.ObjectMeta{
					Name: "reviews-54321-hello",
					Labels: map[string]string{
						"app":     "reviews",
						"version": "v1",
					},
				},
			},
		},
	}
}

func getGateway(name, namespace string) []*networking_v1.Gateway {
	return []*networking_v1.Gateway{
		data.AddServerToGateway(data.CreateServer([]string{"valid"}, 80, "http", "http"),
			data.CreateEmptyGateway(name, namespace, map[string]string{
				"app": "real",
			})),
	}
}

func TestFilterIstioConfigByManagedNamespacesIncludesUnmanaged(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName

	mesh := &models.Mesh{
		ControlPlanes: []models.ControlPlane{{
			Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: true},
			ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}},
			MeshConfig:        models.NewMeshConfig(),
		}},
	}

	configList := &models.IstioConfigList{
		VirtualServices: []*networking_v1.VirtualService{
			{ObjectMeta: v1.ObjectMeta{Name: "vs-managed", Namespace: "bookinfo"}},
			{ObjectMeta: v1.ObjectMeta{Name: "vs-unmanaged", Namespace: "unmanaged-ns"}},
		},
		DestinationRules: []*networking_v1.DestinationRule{
			{ObjectMeta: v1.ObjectMeta{Name: "dr-unmanaged", Namespace: "another-unmanaged"}},
		},
		ServiceEntries: []*networking_v1.ServiceEntry{
			{ObjectMeta: v1.ObjectMeta{Name: "se-managed", Namespace: "bookinfo"}},
		},
	}

	filterIstioConfigByManagedNamespaces(configList, mesh, cluster, []string{"bookinfo", "unmanaged-ns", "another-unmanaged"})

	assert.Len(configList.VirtualServices, 2, "VS in unmanaged namespace should be preserved")
	assert.Len(configList.DestinationRules, 1, "DR in unmanaged namespace should be preserved")
	assert.Len(configList.ServiceEntries, 1, "SE in managed namespace should be preserved")
}

func TestFilterVSExportToNamespacesIncludesUnmanagedNamespace(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName

	mesh := &models.Mesh{
		ControlPlanes: []models.ControlPlane{{
			Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: true},
			ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}},
			MeshConfig:        models.NewMeshConfig(),
		}},
	}

	// VS in an unmanaged namespace with no explicit exportTo should be exported to all (Istio default)
	vsUnmanaged := &networking_v1.VirtualService{
		ObjectMeta: v1.ObjectMeta{Name: "reviews", Namespace: "unmanaged-ns"},
		Spec:       apinetworkingv1.VirtualService{Hosts: []string{"reviews"}},
	}
	vsManaged := &networking_v1.VirtualService{
		ObjectMeta: v1.ObjectMeta{Name: "ratings", Namespace: "bookinfo"},
		Spec:       apinetworkingv1.VirtualService{Hosts: []string{"ratings"}},
	}
	vsList := []*networking_v1.VirtualService{vsUnmanaged, vsManaged}

	objs := mockEmpty(t, conf)
	v := fakeValidationMeshService(t, *conf, objs...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "unmanaged-ns": false}, "bookinfo")
	vInfo.mesh = mesh

	filtered := v.filterVSExportToNamespaces(vsList, &vInfo)
	assert.Len(filtered, 2, "VS from unmanaged namespace should be included (exported to all by default)")
}

func TestFilterDRExportToNamespacesIncludesUnmanagedNamespace(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName

	mesh := &models.Mesh{
		ControlPlanes: []models.ControlPlane{{
			Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: true},
			ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}},
			MeshConfig:        models.NewMeshConfig(),
		}},
	}

	drUnmanaged := &networking_v1.DestinationRule{
		ObjectMeta: v1.ObjectMeta{Name: "reviews", Namespace: "unmanaged-ns"},
	}
	drManaged := &networking_v1.DestinationRule{
		ObjectMeta: v1.ObjectMeta{Name: "ratings", Namespace: "bookinfo"},
	}
	drList := []*networking_v1.DestinationRule{drUnmanaged, drManaged}

	objs := mockEmpty(t, conf)
	v := fakeValidationMeshService(t, *conf, objs...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "unmanaged-ns": false}, "bookinfo")
	vInfo.mesh = mesh

	filtered := v.filterDRExportToNamespaces(drList, &vInfo)
	assert.Len(filtered, 2, "DR from unmanaged namespace should be included (exported to all by default)")
}

func TestFilterSEExportToNamespacesIncludesUnmanagedNamespace(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName

	mesh := &models.Mesh{
		ControlPlanes: []models.ControlPlane{{
			Cluster:           &models.KubeCluster{Name: cluster, IsKialiHome: true},
			ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}},
			MeshConfig:        models.NewMeshConfig(),
		}},
	}

	seUnmanaged := &networking_v1.ServiceEntry{
		ObjectMeta: v1.ObjectMeta{Name: "external-api", Namespace: "unmanaged-ns"},
	}
	seManaged := &networking_v1.ServiceEntry{
		ObjectMeta: v1.ObjectMeta{Name: "internal-svc", Namespace: "bookinfo"},
	}
	seList := []*networking_v1.ServiceEntry{seUnmanaged, seManaged}

	objs := mockEmpty(t, conf)
	v := fakeValidationMeshService(t, *conf, objs...)
	vInfo := mockValidationInfo(conf, map[string]bool{"bookinfo": false, "unmanaged-ns": false}, "bookinfo")
	vInfo.mesh = mesh

	filtered := v.filterSEExportToNamespaces(seList, &vInfo)
	assert.Len(filtered, 2, "SE from unmanaged namespace should be included (exported to all by default)")
}

func loadVirtualService(file string, t *testing.T) *networking_v1.VirtualService {
	loader := yamlFixtureLoaderFor(file)
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}
	return loader.GetResources().VirtualServices[0]
}

func loadDestinationRule(file string, t *testing.T) *networking_v1.DestinationRule {
	loader := yamlFixtureLoaderFor(file)
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}
	return loader.GetResources().DestinationRules[0]
}

func loadServiceEntry(file string, t *testing.T) *networking_v1.ServiceEntry {
	loader := yamlFixtureLoaderFor(file)
	err := loader.Load()
	if err != nil {
		t.Error("Error loading test data.")
	}
	return loader.GetResources().ServiceEntries[0]
}

func yamlFixtureLoaderFor(file string) *validations.YamlFixtureLoader {
	path := fmt.Sprintf("../tests/data/validations/exportto/cns/%s", file)
	return &validations.YamlFixtureLoader{Filename: path}
}

// TestGetValidationsFiltersByAccessibleNamespaces pins the fix for the
// cluster-wide validations leak: GetValidations serves the SA-populated
// validations cache, so it must filter the entries (and their references) to
// the namespaces in the user's accessible set for the cluster.
func TestGetValidationsFiltersByAccessibleNamespaces(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName

	// The SA can see both namespaces; the user can only see bookinfo.
	sa, user := newAccessibleSetClients([]string{"bookinfo", "victim-ns"}, []string{"bookinfo"})
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	namespaceService := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	// The cluster-scoped read needs the user's clients: it returns the empty
	// set for a cluster the user has no client on.
	vs := IstioValidationsService{kialiCache: kialiCache, namespace: &namespaceService, userClients: userClients}

	allowedKey := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "bookinfo", Name: "vs-allowed", Cluster: cluster}
	victimKey := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "victim-ns", Name: "vs-victim", Cluster: cluster}
	allowedRef := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "bookinfo", Name: "ref-allowed", Cluster: cluster}
	victimRef := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "victim-ns", Name: "ref-victim", Cluster: cluster}

	cacheContent := map[models.IstioValidationKey]*models.IstioValidation{
		allowedKey: {
			Cluster:    cluster,
			Name:       "vs-allowed",
			Namespace:  "bookinfo",
			ObjectGVK:  kubernetes.VirtualServices,
			References: []models.IstioValidationKey{allowedRef, victimRef},
			Valid:      true,
		},
		victimKey: {
			Cluster:   cluster,
			Name:      "vs-victim",
			Namespace: "victim-ns",
			ObjectGVK: kubernetes.VirtualServices,
			Valid:     true,
		},
	}
	kialiCache.Validations().Replace(cacheContent)

	validations, err := vs.GetValidations(context.TODO(), cluster)
	require.NoError(err)

	// The victim namespace's validation is filtered out entirely.
	_, ok := validations[victimKey]
	assert.False(ok, "validations for a denied namespace must not be returned")
	victimEntry, ok := validations[allowedKey]
	require.True(ok, "validations for an accessible namespace must be returned")

	// References into the denied namespace are pruned.
	require.Len(victimEntry.References, 1)
	assert.Equal(allowedRef, victimEntry.References[0])

	// The cached entries are shared with other callers and must not be
	// mutated by the filter.
	assert.Len(cacheContent[allowedKey].References, 2)
}

// TestGetValidationsSetComputationErrorFailsClosed pins the fail-closed
// contract: when the accessible set cannot be computed, GetValidations
// errors rather than returning the unfiltered SA cache.
func TestGetValidationsSetComputationErrorFailsClosed(t *testing.T) {
	require := require.New(t)
	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName

	sa, user := newAccessibleSetClients([]string{"bookinfo"}, []string{"bookinfo"})
	// The user's namespace LIST fails with a non-Forbidden error, so the
	// accessible set cannot be computed.
	if cs, ok := user.FakeClient().KubeClientset.(*kubefake.Clientset); ok {
		cs.PrependReactor("list", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
			return true, nil, errors.NewInternalError(fmt.Errorf("apiserver down"))
		})
	}

	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	namespaceService := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	vs := IstioValidationsService{kialiCache: kialiCache, namespace: &namespaceService, userClients: userClients}
	kialiCache.Validations().Replace(map[models.IstioValidationKey]*models.IstioValidation{
		{ObjectGVK: kubernetes.VirtualServices, Namespace: "bookinfo", Name: "vs", Cluster: cluster}: {
			Cluster: cluster, Name: "vs", Namespace: "bookinfo", ObjectGVK: kubernetes.VirtualServices, Valid: true,
		},
	})

	_, err := vs.GetValidations(context.TODO(), cluster)
	require.Error(err)
}

// TestGetValidationsKeepsGatewayMultimatchValidations reproduces the PR #10448
// CI failures: the Istio Config list page serves validations from the
// cluster-wide GetValidations, and every gateway flagged by the KIA0301
// multimatch checker lost its validation there. The gateway multimatch
// checkers (and GatewayChecker's group-checks-before-single-checks merge
// order) used to produce validation values whose Namespace field was empty
// even though the key carried it, so the accessible-set filter dropped them.
// This test feeds the real GatewayChecker output for the exact CI scenario —
// the Istio 1.31 bookinfo sample gateway (port 8080, wildcard host,
// istio=ingressgateway selector) colliding with a wizard-created gateway —
// through GetValidations as a user that can see bookinfo.
func TestGetValidationsKeepsGatewayMultimatchValidations(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName

	// The SA and the user can both see bookinfo; the collision is what
	// triggers the multimatch validation, not a denial.
	sa, user := newAccessibleSetClients([]string{"bookinfo"}, []string{"bookinfo"})
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	namespaceService := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	demoGateway := data.AddServerToGateway(data.CreateServer([]string{"*"}, 8080, "http", "HTTP"),
		data.CreateEmptyGateway("bookinfo-gateway", "bookinfo", map[string]string{
			"istio": "ingressgateway",
		}))
	wizardGateway := data.AddServerToGateway(data.CreateServer([]string{"website.com"}, 8080, "foobar", "HTTP"),
		data.CreateEmptyGateway("mygateway", "bookinfo", map[string]string{
			"istio": "ingressgateway",
		}))

	gatewayValidations := checkers.GatewayChecker{
		Cluster:  cluster,
		Conf:     conf,
		Gateways: []*networking_v1.Gateway{demoGateway, wizardGateway},
		WorkloadsPerNamespace: map[string]models.Workloads{
			"bookinfo": {{WorkloadListItem: models.WorkloadListItem{Labels: map[string]string{"app": "productpage"}}}},
		},
	}.Check()
	require.NotEmpty(gatewayValidations, "the colliding gateways must produce multimatch validations")

	// A latent checker may still build a validation value without its
	// Namespace field while the key carries it; the filter must key off the
	// map key, which is authoritative.
	gatewayValidations.MergeValidations(models.IstioValidations{
		{ObjectGVK: kubernetes.K8sGateways, Namespace: "bookinfo", Name: "latent-empty-namespace", Cluster: cluster}: {
			Cluster: cluster, Name: "latent-empty-namespace", ObjectGVK: kubernetes.K8sGateways, Valid: true,
		},
	})
	kialiCache.Validations().Replace(gatewayValidations)

	vs := IstioValidationsService{kialiCache: kialiCache, namespace: &namespaceService, userClients: userClients}
	validations, err := vs.GetValidations(context.TODO(), cluster)
	require.NoError(err)

	for _, name := range []string{"bookinfo-gateway", "mygateway", "latent-empty-namespace"} {
		key := models.IstioValidationKey{ObjectGVK: kubernetes.Gateways, Namespace: "bookinfo", Name: name, Cluster: cluster}
		isSynthetic := name == "latent-empty-namespace"
		if isSynthetic {
			key.ObjectGVK = kubernetes.K8sGateways
		}
		entry, ok := validations[key]
		require.True(ok, "validation for the accessible gateway %s must be returned", name)
		if !isSynthetic {
			assert.NotEmpty(entry.Checks, "gateway %s must keep its multimatch checks", name)
		}
	}
}

// TestGetValidationsForNamespacePrunesReferences pins the fix for the third
// review finding on PR #10448: the namespace-scoped validations read path
// (/api/namespaces/{ns}/istio?validate=true) must prune references into
// denied namespaces exactly like the cluster-wide GetValidations, or
// cross-namespace object names leak through the references of otherwise
// accessible entries.
func TestGetValidationsForNamespacePrunesReferences(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName

	// The SA can see both namespaces; the user can only see bookinfo.
	sa, user := newAccessibleSetClients([]string{"bookinfo", "victim-ns"}, []string{"bookinfo"})
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	namespaceService := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	allowedKey := models.IstioValidationKey{ObjectGVK: kubernetes.Gateways, Namespace: "bookinfo", Name: "gw-allowed", Cluster: cluster}
	victimKey := models.IstioValidationKey{ObjectGVK: kubernetes.Gateways, Namespace: "victim-ns", Name: "gw-victim", Cluster: cluster}
	allowedRef := models.IstioValidationKey{ObjectGVK: kubernetes.Gateways, Namespace: "bookinfo", Name: "ref-allowed", Cluster: cluster}
	victimRef := models.IstioValidationKey{ObjectGVK: kubernetes.Gateways, Namespace: "victim-ns", Name: "ref-victim", Cluster: cluster}

	cacheContent := map[models.IstioValidationKey]*models.IstioValidation{
		allowedKey: {
			Cluster:    cluster,
			Name:       "gw-allowed",
			Namespace:  "bookinfo",
			ObjectGVK:  kubernetes.Gateways,
			References: []models.IstioValidationKey{allowedRef, victimRef},
			Valid:      true,
		},
		victimKey: {
			Cluster:   cluster,
			Name:      "gw-victim",
			Namespace: "victim-ns",
			ObjectGVK: kubernetes.Gateways,
			Valid:     true,
		},
	}
	kialiCache.Validations().Replace(cacheContent)

	vs := IstioValidationsService{kialiCache: kialiCache, namespace: &namespaceService}
	validations, err := vs.GetValidationsForNamespace(context.TODO(), cluster, "bookinfo")
	require.NoError(err)

	// The denied namespace's entry is not returned (namespace-scoped).
	_, ok := validations[victimKey]
	assert.False(ok, "validations for a namespace other than the requested one must not be returned")
	entry, ok := validations[allowedKey]
	require.True(ok, "validations for the requested accessible namespace must be returned")

	// References into the denied namespace are pruned.
	require.Len(entry.References, 1)
	assert.Equal(allowedRef, entry.References[0])

	// The cached entries are shared with other callers and must not be
	// mutated by the pruning.
	assert.Len(cacheContent[allowedKey].References, 2)
}

// TestGetValidationsForWorkloadPrunesReferences covers the Service/Workload
// single-object read paths (they share prunedValidationsFor): references into
// denied namespaces must be pruned there too, not only on the cluster-wide
// and namespace-scoped list paths. FilterBySingleType retains every entry of
// every other resource type, so the fixture also carries a denied-namespace
// VirtualService entry: it must not be returned (entries are filtered on the
// accessible set, the same way GetValidations does), while an entry of the
// same type in the accessible namespace is kept.
func TestGetValidationsForWorkloadPrunesReferences(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	cluster := conf.KubernetesConfig.ClusterName

	sa, user := newAccessibleSetClients([]string{"bookinfo", "victim-ns"}, []string{"bookinfo"})
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := istio.NewDiscovery(saClients, kialiCache, conf)
	namespaceService := NewNamespaceService(kialiCache, conf, discovery, saClients, userClients)

	workloadGVK := schema.GroupVersionKind{Group: "", Version: "", Kind: "workload"}
	workloadKey := models.IstioValidationKey{ObjectGVK: workloadGVK, Namespace: "bookinfo", Name: "reviews-v1", Cluster: cluster}
	allowedRef := models.IstioValidationKey{ObjectGVK: workloadGVK, Namespace: "bookinfo", Name: "ref-allowed", Cluster: cluster}
	victimRef := models.IstioValidationKey{ObjectGVK: workloadGVK, Namespace: "victim-ns", Name: "ref-victim", Cluster: cluster}

	// A VirtualService in the denied namespace: FilterBySingleType retains
	// other types regardless of name, so without the accessible-set filter on
	// the entry keys this entry would be returned to the user.
	virtualServiceGVK := kubernetes.VirtualServices
	victimEntryKey := models.IstioValidationKey{ObjectGVK: virtualServiceGVK, Namespace: "victim-ns", Name: "victim-vs", Cluster: cluster}
	allowedEntryKey := models.IstioValidationKey{ObjectGVK: virtualServiceGVK, Namespace: "bookinfo", Name: "allowed-vs", Cluster: cluster}

	cacheContent := map[models.IstioValidationKey]*models.IstioValidation{
		workloadKey: {
			Cluster:    cluster,
			Name:       "reviews-v1",
			Namespace:  "bookinfo",
			ObjectGVK:  workloadGVK,
			References: []models.IstioValidationKey{allowedRef, victimRef},
			Valid:      true,
		},
		victimEntryKey: {
			Cluster:   cluster,
			Name:      "victim-vs",
			Namespace: "victim-ns",
			ObjectGVK: virtualServiceGVK,
			Valid:     true,
		},
		allowedEntryKey: {
			Cluster:   cluster,
			Name:      "allowed-vs",
			Namespace: "bookinfo",
			ObjectGVK: virtualServiceGVK,
			Valid:     true,
		},
	}
	kialiCache.Validations().Replace(cacheContent)

	vs := IstioValidationsService{kialiCache: kialiCache, namespace: &namespaceService}
	validations, err := vs.GetValidationsForWorkload(context.TODO(), cluster, "bookinfo", "reviews-v1")
	require.NoError(err)

	entry, ok := validations[workloadKey]
	require.True(ok, "the workload validation must be returned for the accessible namespace")
	require.Len(entry.References, 1)
	assert.Equal(allowedRef, entry.References[0])

	// Entries outside the accessible set are dropped, other-type entries in
	// the accessible namespace are kept.
	assert.NotContains(validations, victimEntryKey, "a denied-namespace entry of another type must not be returned")
	assert.Contains(validations, allowedEntryKey, "an accessible-namespace entry of another type must be returned")

	// The cached entry is shared with other callers and must not be mutated.
	assert.Len(cacheContent[workloadKey].References, 2)
}

// TestValidateIstioObjectPrunesReferences covers the on-demand single-object
// validation that backs the config details response (validate=true): the
// freshly computed validations and references map are served directly to the
// requesting user, so references into denied namespaces must be pruned there
// too — the same protection the cache read paths apply. The shared cache must
// keep the unpruned entry (it serves every user). Both a positive control
// (an accessible reference survives) and negatives (denied-namespace
// references are dropped) are asserted, so an over-pruning regression cannot
// pass vacuously.
func TestValidateIstioObjectPrunesReferences(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName

	// Two DestinationRules in bookinfo: one resolving a service in the
	// accessible namespace (positive control), one resolving a service in the
	// denied namespace (the on-demand reference checker resolves hosts
	// against the SA-side service list, which spans every namespace). A
	// VirtualService whose gateways span both namespaces and the reserved
	// non-namespaced "mesh" gateway covers the object references.
	objects := []runtime.Object{
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("sleep"),
		kubetest.FakeNamespace("istio-system"),
		&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
		&core_v1.Service{
			ObjectMeta: v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"},
			Spec: core_v1.ServiceSpec{
				Ports:    []core_v1.ServicePort{{Name: "http", Port: 9080, Protocol: "TCP"}},
				Selector: map[string]string{"app": "reviews"},
			},
		},
		&core_v1.Service{
			ObjectMeta: v1.ObjectMeta{Name: "sleep-svc", Namespace: "sleep"},
			Spec: core_v1.ServiceSpec{
				Ports:    []core_v1.ServicePort{{Name: "http", Port: 80, Protocol: "TCP"}},
				Selector: map[string]string{"app": "sleep"},
			},
		},
		&networking_v1.DestinationRule{
			ObjectMeta: v1.ObjectMeta{Name: "reviews-dr", Namespace: "bookinfo"},
			Spec:       apinetworkingv1.DestinationRule{Host: "reviews.bookinfo.svc.cluster.local"},
		},
		&networking_v1.DestinationRule{
			ObjectMeta: v1.ObjectMeta{Name: "sleep-dr", Namespace: "bookinfo"},
			Spec:       apinetworkingv1.DestinationRule{Host: "sleep-svc.sleep.svc.cluster.local"},
		},
		&networking_v1.VirtualService{
			ObjectMeta: v1.ObjectMeta{Name: "gateway-vs", Namespace: "bookinfo"},
			Spec: apinetworkingv1.VirtualService{
				Hosts:    []string{"reviews"},
				Gateways: []string{"bookinfo/gw-allowed", "sleep/gw-denied", "mesh"},
				Http: []*apinetworkingv1.HTTPRoute{{Route: []*apinetworkingv1.HTTPRouteDestination{{
					Destination: &apinetworkingv1.Destination{Host: "reviews.bookinfo.svc.cluster.local"},
				}}}},
			},
		},
	}

	// The SA can see both namespaces; the user can only see bookinfo.
	sa := kubetest.NewFakeK8sClient(objects...)
	sa.Token = "sa-token"
	userFake := kubetest.NewFakeK8sClient(objects...)
	user := kubetest.NewNamespaceRestrictedClient(userFake, "user-token", []string{"bookinfo"})

	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := &istiotest.FakeDiscovery{MeshReturn: models.Mesh{ControlPlanes: []models.ControlPlane{{
		Cluster:           &models.KubeCluster{IsKialiHome: true},
		IstiodNamespace:   "istio-system",
		ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}, {Name: "sleep"}, {Name: "istio-system"}},
		MeshConfig:        models.NewMeshConfig(),
		RootNamespace:     "istio-system",
	}}}}
	grafanaSvc, err := grafana.NewService(conf, userClients[cluster])
	require.NoError(err)
	svc := newLayer(userClients, saClients, nil, nil, kialiCache, conf, grafanaSvc, discovery, &FakeControlPlaneMonitor{}).Validations

	serviceReferenceNamespaces := func(gvk schema.GroupVersionKind, name string) []string {
		validations, references, err := svc.ValidateIstioObject(context.TODO(), cluster, "bookinfo", gvk, name)
		require.NoError(err)

		objectKey := models.IstioValidationKey{ObjectGVK: gvk, Namespace: "bookinfo", Name: name, Cluster: cluster}
		_, ok := validations[objectKey]
		require.True(ok, "the requested object's validation must be returned")
		_, ok = svc.kialiCache.Validations().Items()[objectKey]
		require.True(ok, "the validation must be written to the shared cache")

		referenceKey := models.IstioReferenceKey{ObjectGVK: gvk, Namespace: "bookinfo", Name: name}
		objectReferences, ok := references[referenceKey]
		require.True(ok, "the requested object's references must be returned")
		namespaces := make([]string, 0, len(objectReferences.ServiceReferences))
		for _, ref := range objectReferences.ServiceReferences {
			namespaces = append(namespaces, ref.Namespace)
		}
		return namespaces
	}

	// Service references: the accessible one survives (positive control),
	// the denied one is pruned.
	assert.Contains(serviceReferenceNamespaces(kubernetes.DestinationRules, "reviews-dr"), "bookinfo",
		"the accessible service reference must survive the pruning")
	assert.NotContains(serviceReferenceNamespaces(kubernetes.DestinationRules, "sleep-dr"), "sleep",
		"service references into the denied namespace must not be returned")

	// Object references: the accessible gateway and the non-namespaced
	// reserved "mesh" gateway survive; the denied-namespace gateway is
	// pruned.
	_, references, err := svc.ValidateIstioObject(context.TODO(), cluster, "bookinfo", kubernetes.VirtualServices, "gateway-vs")
	require.NoError(err)
	vsReferences, ok := references[models.IstioReferenceKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "bookinfo", Name: "gateway-vs"}]
	require.True(ok, "the requested object's references must be returned")
	objectRefNamespaces := make(map[string]string, len(vsReferences.ObjectReferences))
	for _, ref := range vsReferences.ObjectReferences {
		objectRefNamespaces[ref.Name] = ref.Namespace
	}
	assert.Equal("bookinfo", objectRefNamespaces["gw-allowed"], "the accessible gateway reference must survive the pruning")
	require.Contains(objectRefNamespaces, "mesh", "the non-namespaced mesh gateway reference must be kept")
	assert.Equal("", objectRefNamespaces["mesh"], "the mesh gateway reference is non-namespaced")
	assert.NotContains(objectRefNamespaces, "gw-denied", "gateway references into the denied namespace must not be returned")
}

// TestValidateIstioObjectKeepsMeshGatewayReference pins the fix for the
// reference-pruning regression: a VirtualService bound to the reserved
// "mesh" gateway produces a non-namespaced reference (Namespace == ""), and
// pruning must keep it — a reference with no namespace discloses no
// namespace, so there is nothing to protect. Dropping it removed legitimate
// information from the config details page.
func TestValidateIstioObjectKeepsMeshGatewayReference(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName

	objects := []runtime.Object{
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("sleep"),
		kubetest.FakeNamespace("istio-system"),
		&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
		&core_v1.Service{
			ObjectMeta: v1.ObjectMeta{Name: "reviews", Namespace: "bookinfo"},
			Spec: core_v1.ServiceSpec{
				Ports:    []core_v1.ServicePort{{Name: "http", Port: 9080, Protocol: "TCP"}},
				Selector: map[string]string{"app": "reviews"},
			},
		},
		&networking_v1.VirtualService{
			ObjectMeta: v1.ObjectMeta{Name: "mesh-vs", Namespace: "bookinfo"},
			Spec: apinetworkingv1.VirtualService{
				Hosts:    []string{"reviews"},
				Gateways: []string{"mesh"},
				Http: []*apinetworkingv1.HTTPRoute{{Route: []*apinetworkingv1.HTTPRouteDestination{{
					Destination: &apinetworkingv1.Destination{Host: "reviews.bookinfo.svc.cluster.local"},
				}}}},
			},
		},
	}

	sa := kubetest.NewFakeK8sClient(objects...)
	sa.Token = "sa-token"
	userFake := kubetest.NewFakeK8sClient(objects...)
	user := kubetest.NewNamespaceRestrictedClient(userFake, "user-token", []string{"bookinfo"})

	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := &istiotest.FakeDiscovery{MeshReturn: models.Mesh{ControlPlanes: []models.ControlPlane{{
		Cluster:           &models.KubeCluster{IsKialiHome: true},
		IstiodNamespace:   "istio-system",
		ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}, {Name: "sleep"}, {Name: "istio-system"}},
		MeshConfig:        models.NewMeshConfig(),
		RootNamespace:     "istio-system",
	}}}}
	grafanaSvc, err := grafana.NewService(conf, userClients[cluster])
	require.NoError(err)
	svc := newLayer(userClients, saClients, nil, nil, kialiCache, conf, grafanaSvc, discovery, &FakeControlPlaneMonitor{}).Validations

	_, references, err := svc.ValidateIstioObject(context.TODO(), cluster, "bookinfo", kubernetes.VirtualServices, "mesh-vs")
	require.NoError(err)
	vsReferences, ok := references[models.IstioReferenceKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "bookinfo", Name: "mesh-vs"}]
	require.True(ok, "the requested object's references must be returned")

	var meshFound bool
	for _, ref := range vsReferences.ObjectReferences {
		if ref.Name == "mesh" {
			meshFound = true
			assert.Equal("", ref.Namespace, "the mesh gateway reference is non-namespaced")
			assert.Equal(kubernetes.Gateways, ref.ObjectGVK, "the mesh gateway reference points at a Gateway")
		}
	}
	assert.True(meshFound, "the reserved mesh gateway reference must be kept by the pruning")
}

// TestReferencePruningHelpers unit-tests the reference pruning helpers
// directly: references into accessible namespaces and non-namespaced
// references are kept, references into denied namespaces are dropped, and
// the input is never mutated (the values may be shared with other callers).
// The on-demand path cannot produce cross-namespace workload references for
// a restricted user (workload fetching is scoped to the user's accessible
// namespaces), so the WorkloadReferences pruning is covered here rather
// than through ValidateIstioObject.
func TestReferencePruningHelpers(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)

	accessible := map[string]struct{}{"bookinfo": {}}

	// The validation-key slice helper.
	validationRefs := []models.IstioValidationKey{
		{Name: "allowed", Namespace: "bookinfo"},
		{Name: "mesh", Namespace: ""},
		{Name: "denied", Namespace: "sleep"},
	}
	kept := accessibleReferences(validationRefs, accessible)
	require.Len(kept, 2)
	assert.Equal("allowed", kept[0].Name)
	assert.Equal("mesh", kept[1].Name)
	// Nil input stays nil.
	assert.Nil(accessibleReferences(nil, accessible))
	// The input is not mutated.
	require.Len(validationRefs, 3)

	// The on-demand references-map helper, all three reference kinds.
	objectRefs := &models.IstioReferences{
		ObjectReferences: []models.IstioReference{
			{Name: "gw-allowed", Namespace: "bookinfo", ObjectGVK: kubernetes.Gateways},
			{Name: "mesh", Namespace: "", ObjectGVK: kubernetes.Gateways},
			{Name: "gw-denied", Namespace: "sleep", ObjectGVK: kubernetes.Gateways},
		},
		ServiceReferences: []models.ServiceReference{
			{Name: "reviews", Namespace: "bookinfo"},
			{Name: "sleep-svc", Namespace: "sleep"},
		},
		WorkloadReferences: []models.WorkloadReference{
			{Name: "reviews-v1", Namespace: "bookinfo"},
			{Name: "sleep-v1", Namespace: "sleep"},
		},
	}
	pruned := pruneInaccessibleObjectReferences(objectRefs, accessible)
	require.Len(pruned.ObjectReferences, 2)
	assert.Equal("gw-allowed", pruned.ObjectReferences[0].Name)
	assert.Equal("mesh", pruned.ObjectReferences[1].Name)
	require.Len(pruned.ServiceReferences, 1)
	assert.Equal("reviews", pruned.ServiceReferences[0].Name)
	require.Len(pruned.WorkloadReferences, 1)
	assert.Equal("reviews-v1", pruned.WorkloadReferences[0].Name)

	// The input is not mutated (copy before prune).
	require.Len(objectRefs.ObjectReferences, 3)
	require.Len(objectRefs.ServiceReferences, 2)
	require.Len(objectRefs.WorkloadReferences, 2)

	// Nil input stays nil.
	assert.Nil(pruneInaccessibleObjectReferences(nil, accessible))
}

// TestValidateIstioObjectSAVisibilityKeepsCrossNamespaceChecks pins the
// on-demand validation's SA visibility: the validation info is built from
// the Kiali ServiceAccount's namespace set (the same inputs the background
// reconciler uses), so a cross-namespace check that fires in the list view
// also fires in the details view for a restricted user. Before the fix, the
// detail path built its inputs from the user's accessible set, the
// multimatch checker could not see the denied namespace's gateway, and the
// warning visible in the list vanished in the details. The reference into
// the denied namespace is still pruned from the user's response, and the
// shared cache keeps the unpruned SA-computed entry.
func TestValidateIstioObjectSAVisibilityKeepsCrossNamespaceChecks(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName

	// The reported repro: two K8s Gateways with the same listener hostname,
	// one in the accessible namespace, one in the denied namespace.
	gwAllowed := data.CreateEmptyK8sGateway("multitest-a", "bookinfo")
	gwAllowed.Spec.Listeners = []k8s_networking_v1.Listener{data.CreateListener("http", "multitest.example.com", 80, "HTTP")}
	gwDenied := data.CreateEmptyK8sGateway("multitest-b", "ambient-demo")
	gwDenied.Spec.Listeners = []k8s_networking_v1.Listener{data.CreateListener("http", "multitest.example.com", 80, "HTTP")}

	objects := []runtime.Object{
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("ambient-demo"),
		kubetest.FakeNamespace("istio-system"),
		&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
		gwAllowed,
		gwDenied,
	}

	// The SA can see both namespaces; the user can only see bookinfo. The
	// user client must report the Gateway API as available (the config
	// listing gates the K8s Gateway fetch on it).
	sa := kubetest.NewFakeK8sClient(objects...)
	sa.Token = "sa-token"
	sa.GatewayAPIEnabled = true
	userFake := kubetest.NewFakeK8sClient(objects...)
	userFake.GatewayAPIEnabled = true
	user := kubetest.NewNamespaceRestrictedClient(userFake, "user-token", []string{"bookinfo"})

	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := &istiotest.FakeDiscovery{MeshReturn: models.Mesh{ControlPlanes: []models.ControlPlane{{
		Cluster:           &models.KubeCluster{IsKialiHome: true},
		IstiodNamespace:   "istio-system",
		ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}, {Name: "ambient-demo"}, {Name: "istio-system"}},
		MeshConfig:        models.NewMeshConfig(),
		RootNamespace:     "istio-system",
	}}}}
	grafanaSvc, err := grafana.NewService(conf, userClients[cluster])
	require.NoError(err)
	svc := newLayer(userClients, saClients, nil, nil, kialiCache, conf, grafanaSvc, discovery, &FakeControlPlaneMonitor{}).Validations

	validations, _, err := svc.ValidateIstioObject(context.TODO(), cluster, "bookinfo", kubernetes.K8sGateways, "multitest-a")
	require.NoError(err)

	objectKey := models.IstioValidationKey{ObjectGVK: kubernetes.K8sGateways, Namespace: "bookinfo", Name: "multitest-a", Cluster: cluster}
	validation, ok := validations[objectKey]
	require.True(ok, "the requested object's validation must be returned")

	// The cross-namespace multimatch check fires: the computation saw the
	// denied namespace's gateway through the SA's visibility.
	checkCodes := make([]string, 0, len(validation.Checks))
	for _, check := range validation.Checks {
		checkCodes = append(checkCodes, check.Code)
	}
	assert.Contains(checkCodes, "KIA1501", "the cross-namespace listener conflict must be detected with SA visibility")

	// The reference into the denied namespace is pruned from the user's
	// response, but the shared cache keeps the unpruned SA-computed entry.
	for _, ref := range validation.References {
		assert.NotEqual("ambient-demo", ref.Namespace, "references into the denied namespace must not be returned")
	}
	cached, ok := svc.kialiCache.Validations().Items()[objectKey]
	require.True(ok, "the validation must be written to the shared cache")
	cachedRefNamespaces := make([]string, 0, len(cached.References))
	for _, ref := range cached.References {
		cachedRefNamespaces = append(cachedRefNamespaces, ref.Namespace)
	}
	assert.Contains(cachedRefNamespaces, "ambient-demo", "the shared cache keeps the unpruned SA-computed reference")
}

// TestGetValidationsNoUserClientReturnsEmpty ensures the cluster-scoped
// validations read degrades to the empty set (not an error) for a cluster the
// requesting user has no client for, matching the cluster-scoped istio config
// list it is attached to. The SA clients still cover the cluster.
func TestGetValidationsNoUserClientReturnsEmpty(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	home := conf.KubernetesConfig.ClusterName
	remote := "remote-cluster"
	layer := NewLayerBuilder(t, conf).
		WithClients(map[string]kubernetes.UserClientInterface{
			home:   kubetest.NewFakeK8sClient(kubetest.FakeNamespace("test")),
			remote: kubetest.NewFakeK8sClient(kubetest.FakeNamespace("test")),
		}).
		Build()
	// Drop the user's remote session (the services share the clients map).
	delete(layer.IstioConfig.userClients, remote)

	validations, err := layer.Validations.GetValidations(context.TODO(), remote)
	assert.Nil(err)
	assert.Empty(validations)
}

// TestValidateIstioObjectFallsBackToCachedValidationOnRemoteFailure pins the
// robustness contract of the on-demand single-object validation: building the
// SA-wide validation info reads every SA-visible cluster, so an unrelated
// remote-cluster failure (here, its namespace LIST erroring) must not fail the
// details view of an object on a healthy cluster. The shared cache's
// last-known-good entry is served instead, pruned to the user's accessible
// namespaces, and the shared cache itself is left untouched.
func TestValidateIstioObjectFallsBackToCachedValidationOnRemoteFailure(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	remote := "remote-cluster"

	objects := []runtime.Object{
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("victim-ns"),
		kubetest.FakeNamespace("istio-system"),
		&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
	}

	// The remote cluster's namespace API fails with a non-Forbidden error, so
	// the SA set computation — and with it the validation info build — errors.
	remoteClient := kubetest.NewFakeK8sClient(objects...)
	if cs, ok := remoteClient.KubeClientset.(*kubefake.Clientset); ok {
		cs.PrependReactor("list", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
			return true, nil, errors.NewInternalError(fmt.Errorf("remote apiserver down"))
		})
	}

	// The SA can see both namespaces on the healthy home cluster; the user
	// can only see bookinfo.
	sa := kubetest.NewFakeK8sClient(objects...)
	sa.Token = "sa-token"
	userFake := kubetest.NewFakeK8sClient(objects...)
	user := kubetest.NewNamespaceRestrictedClient(userFake, "user-token", []string{"bookinfo"})

	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	saClients := map[string]kubernetes.ClientInterface{cluster: sa, remote: remoteClient}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := &istiotest.FakeDiscovery{MeshReturn: models.Mesh{ControlPlanes: []models.ControlPlane{{
		Cluster:           &models.KubeCluster{IsKialiHome: true},
		IstiodNamespace:   "istio-system",
		ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}, {Name: "victim-ns"}, {Name: "istio-system"}},
		MeshConfig:        models.NewMeshConfig(),
		RootNamespace:     "istio-system",
	}}}}
	grafanaSvc, err := grafana.NewService(conf, userClients[cluster])
	require.NoError(err)
	svc := newLayer(userClients, saClients, nil, nil, kialiCache, conf, grafanaSvc, discovery, &FakeControlPlaneMonitor{}).Validations

	// The shared cache holds the background reconciler's last-known-good
	// entry for the object, with references into both an accessible and a
	// denied namespace.
	objectKey := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "bookinfo", Name: "vs", Cluster: cluster}
	kialiCache.Validations().Replace(map[models.IstioValidationKey]*models.IstioValidation{
		objectKey: {
			Checks:    []*models.IstioCheck{{Code: "KIA0501", Message: "cached check", Severity: models.ErrorSeverity}},
			Cluster:   cluster,
			Name:      "vs",
			Namespace: "bookinfo",
			ObjectGVK: kubernetes.VirtualServices,
			References: []models.IstioValidationKey{
				{ObjectGVK: kubernetes.VirtualServices, Namespace: "bookinfo", Name: "ref-allowed", Cluster: cluster},
				{ObjectGVK: kubernetes.VirtualServices, Namespace: "victim-ns", Name: "ref-denied", Cluster: cluster},
			},
			Valid: false,
		},
	})

	// The remote failure must not fail the home object's validation.
	validations, references, err := svc.ValidateIstioObject(context.TODO(), cluster, "bookinfo", kubernetes.VirtualServices, "vs")
	require.NoError(err, "an unrelated remote-cluster failure must not fail the details view")

	// The cached entry is served, pruned to the user's accessible namespaces.
	validation, ok := validations[objectKey]
	require.True(ok, "the cached validation must be served on the remote failure")
	assert.False(validation.Valid)
	assert.Len(validation.Checks, 1)
	refNames := make([]string, 0, len(validation.References))
	for _, ref := range validation.References {
		refNames = append(refNames, ref.Namespace)
	}
	assert.Contains(refNames, "bookinfo")
	assert.NotContains(refNames, "victim-ns", "the fallback must prune references into denied namespaces")
	assert.Empty(references, "object references are not cached and come back empty on the fallback")

	// The shared cache is untouched: still the unpruned entry.
	cached, ok := kialiCache.Validations().Items()[objectKey]
	require.True(ok)
	assert.Len(cached.References, 2, "the fallback must not rewrite the shared cache entry")
}

// TestValidateIstioObjectSkipsInputPrepForNoCheckerTypes pins the no-checker
// skip: types without an object checker or reference checker (EnvoyFilters,
// TrafficExtensions, the TCP/TLS/UDP route types) must not pay the SA-wide
// validation-input build at all, so an unrelated remote-cluster failure
// cannot fail their details view — the remote is never contacted. The
// reactor counts the remote's namespace lists; the skip keeps the count
// unchanged.
func TestValidateIstioObjectSkipsInputPrepForNoCheckerTypes(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	remote := "remote-cluster"

	objects := []runtime.Object{
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("istio-system"),
		&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
	}

	remoteLists := 0
	remoteClient := kubetest.NewFakeK8sClient(objects...)
	if cs, ok := remoteClient.KubeClientset.(*kubefake.Clientset); ok {
		cs.PrependReactor("list", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
			remoteLists++
			return true, nil, errors.NewInternalError(fmt.Errorf("remote apiserver down"))
		})
	}

	sa := kubetest.NewFakeK8sClient(objects...)
	sa.Token = "sa-token"
	userFake := kubetest.NewFakeK8sClient(objects...)
	user := kubetest.NewNamespaceRestrictedClient(userFake, "user-token", []string{"bookinfo"})

	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	saClients := map[string]kubernetes.ClientInterface{cluster: sa, remote: remoteClient}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := &istiotest.FakeDiscovery{MeshReturn: models.Mesh{ControlPlanes: []models.ControlPlane{{
		Cluster:           &models.KubeCluster{IsKialiHome: true},
		IstiodNamespace:   "istio-system",
		ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}, {Name: "istio-system"}},
		MeshConfig:        models.NewMeshConfig(),
		RootNamespace:     "istio-system",
	}}}}
	grafanaSvc, err := grafana.NewService(conf, userClients[cluster])
	require.NoError(err)
	svc := newLayer(userClients, saClients, nil, nil, kialiCache, conf, grafanaSvc, discovery, &FakeControlPlaneMonitor{}).Validations

	// Snapshot after the cache construction (its informer warmup may list).
	remoteLists = 0
	for _, gvk := range []schema.GroupVersionKind{
		kubernetes.EnvoyFilters,
		kubernetes.TrafficExtensions,
		kubernetes.K8sTCPRoutes,
		kubernetes.K8sTLSRoutes,
		kubernetes.K8sUDPRoutes,
	} {
		validations, references, err := svc.ValidateIstioObject(context.TODO(), cluster, "bookinfo", gvk, "obj")
		require.NoError(err, "a no-checker type (%s) must not fail on a remote outage", gvk.String())
		require.Empty(validations, "a no-checker type (%s) has no validation to return", gvk.String())
		require.Empty(references, "a no-checker type (%s) has no references to return", gvk.String())
	}
	require.Zero(remoteLists, "the SA-wide input build must be skipped for no-checker types: the remote cluster is never contacted")
}

// TestValidateIstioObjectDegradesToNoValidationWhenNothingCached pins the
// no-cache branch of the remote-failure fallback: a supported type whose
// validation entry is not in the shared cache (a newly created object, or
// anything before the reconciler's first successful cycle) must not fail the
// details view when an unrelated remote cluster errors — the details are
// served without a validation. Missing validation means unknown, not valid.
func TestValidateIstioObjectDegradesToNoValidationWhenNothingCached(t *testing.T) {
	require := require.New(t)

	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName
	remote := "remote-cluster"

	objects := []runtime.Object{
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("istio-system"),
		&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
	}

	remoteClient := kubetest.NewFakeK8sClient(objects...)
	if cs, ok := remoteClient.KubeClientset.(*kubefake.Clientset); ok {
		cs.PrependReactor("list", "namespaces", func(action kubeclienttesting.Action) (bool, runtime.Object, error) {
			return true, nil, errors.NewInternalError(fmt.Errorf("remote apiserver down"))
		})
	}

	sa := kubetest.NewFakeK8sClient(objects...)
	sa.Token = "sa-token"
	userFake := kubetest.NewFakeK8sClient(objects...)
	user := kubetest.NewNamespaceRestrictedClient(userFake, "user-token", []string{"bookinfo"})

	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	saClients := map[string]kubernetes.ClientInterface{cluster: sa, remote: remoteClient}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := &istiotest.FakeDiscovery{MeshReturn: models.Mesh{ControlPlanes: []models.ControlPlane{{
		Cluster:           &models.KubeCluster{IsKialiHome: true},
		IstiodNamespace:   "istio-system",
		ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}, {Name: "istio-system"}},
		MeshConfig:        models.NewMeshConfig(),
		RootNamespace:     "istio-system",
	}}}}
	grafanaSvc, err := grafana.NewService(conf, userClients[cluster])
	require.NoError(err)
	svc := newLayer(userClients, saClients, nil, nil, kialiCache, conf, grafanaSvc, discovery, &FakeControlPlaneMonitor{}).Validations

	// Nothing seeded into the shared cache: a freshly created object.
	validations, references, err := svc.ValidateIstioObject(context.TODO(), cluster, "bookinfo", kubernetes.VirtualServices, "fresh-vs")
	require.NoError(err, "an unrelated remote-cluster failure must not fail the details view")
	require.Empty(validations, "with no cached entry the details are served without a validation")
	require.Empty(references)
}

// TestValidateIstioObjectSAVisibilityWarmsWaypointCacheSAWide pins the
// waypoint half of the SA visibility: the SA branch of newValidationInfo
// must fetch waypoints with the Kiali SA's namespace visibility (mirroring
// GetGateways), not the requesting user's. The shared waypoint cache and the
// validations computed from it feed the shared validation cache — a
// restricted user's on-demand validation must not truncate the waypoint set
// to their accessible namespaces.
func TestValidateIstioObjectSAVisibilityWarmsWaypointCacheSAWide(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)
	cluster := conf.KubernetesConfig.ClusterName

	// A waypoint workload in the denied namespace: the user cannot see it,
	// the SA can. The GatewayLabel selector fetches it and the managed
	// label makes IsWaypointWorkload true; the labels are on the metadata,
	// the selector and the pod template, matching a real Istio waypoint
	// deployment.
	waypointLabels := map[string]string{
		config.GatewayLabel:  "waypoint",
		config.WaypointLabel: config.WaypointLabelValue,
	}
	waypoint := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{Name: "waypoint", Namespace: "victim-ns", Labels: waypointLabels},
		Spec: apps_v1.DeploymentSpec{
			Selector: &v1.LabelSelector{MatchLabels: waypointLabels},
			Template: core_v1.PodTemplateSpec{ObjectMeta: v1.ObjectMeta{Labels: waypointLabels}},
		},
	}

	objects := []runtime.Object{
		kubetest.FakeNamespace("bookinfo"),
		kubetest.FakeNamespace("victim-ns"),
		kubetest.FakeNamespace("istio-system"),
		&core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
		waypoint,
	}

	sa := kubetest.NewFakeK8sClient(objects...)
	sa.Token = "sa-token"
	userFake := kubetest.NewFakeK8sClient(objects...)
	user := kubetest.NewNamespaceRestrictedClient(userFake, "user-token", []string{"bookinfo"})

	userClients := map[string]kubernetes.UserClientInterface{cluster: user}
	saClients := map[string]kubernetes.ClientInterface{cluster: sa}
	kialiCache := cache.NewTestingCacheWithClients(t, saClients, *conf)
	discovery := &istiotest.FakeDiscovery{MeshReturn: models.Mesh{ControlPlanes: []models.ControlPlane{{
		Cluster:           &models.KubeCluster{IsKialiHome: true},
		IstiodNamespace:   "istio-system",
		ManagedNamespaces: []models.Namespace{{Name: "bookinfo"}, {Name: "victim-ns"}, {Name: "istio-system"}},
		MeshConfig:        models.NewMeshConfig(),
		RootNamespace:     "istio-system",
	}}}}
	grafanaSvc, err := grafana.NewService(conf, userClients[cluster])
	require.NoError(err)
	svc := newLayer(userClients, saClients, nil, nil, kialiCache, conf, grafanaSvc, discovery, &FakeControlPlaneMonitor{}).Validations

	// Any supported type triggers the validation-input build; the requested
	// object itself is irrelevant to the waypoint side effect.
	_, _, err = svc.ValidateIstioObject(context.TODO(), cluster, "bookinfo", kubernetes.VirtualServices, "vs")
	require.NoError(err)

	waypoints, ok := kialiCache.GetWaypoints()
	require.True(ok, "the validation-input build must warm the shared waypoint cache")
	waypointNamespaces := make([]string, 0, len(waypoints))
	for _, wp := range waypoints {
		waypointNamespaces = append(waypointNamespaces, wp.Namespace)
	}
	assert.Contains(waypointNamespaces, "victim-ns",
		"the waypoint set must be SA-scoped: the denied namespace's waypoint is included")
}
