package business

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	istiov1alpha1 "istio.io/api/mesh/v1alpha1"
	apinetworkingv1 "istio.io/api/networking/v1"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/cache"
	"github.com/kiali/kiali/config"
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

func TestValidateSkipsUnmanagedNamespaces(t *testing.T) {
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

	// orphan-ns is NOT managed: nothing should appear for it
	for key := range validations {
		assert.NotEqual(orphan, key.Namespace, "unmanaged namespace %q should have no validations", orphan)
	}
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
