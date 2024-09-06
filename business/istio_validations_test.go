package business

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	apps_v1 "k8s.io/api/apps/v1"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestGetNamespaceValidations(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(t, fakeIstioConfigList(),
		[]string{"details.test.svc.cluster.local", "product.test.svc.cluster.local", "product2.test.svc.cluster.local", "customer.test.svc.cluster.local"})

	validations, err := vs.GetValidations(context.TODO(), conf.KubernetesConfig.ClusterName, "test", "", "")
	require.NoError(err)
	require.NotEmpty(validations)
	assert.True(validations[models.IstioValidationKey{ObjectType: "virtualservice", Namespace: "test", Name: "product-vs"}].Valid)
}

func TestGetIstioObjectValidations(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(t, fakeIstioConfigList(),
		[]string{"details.test.svc.cluster.local", "product.test.svc.cluster.local", "customer.test.svc.cluster.local"})

	validations, _, _ := vs.GetIstioObjectValidations(context.TODO(), conf.KubernetesConfig.ClusterName, "test", "virtualservices", "product-vs")

	assert.NotEmpty(validations)
}

func TestGatewayValidation(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	v := mockMultiNamespaceGatewaysValidationService(t, *conf)
	validations, _, _ := v.GetIstioObjectValidations(context.TODO(), conf.KubernetesConfig.ClusterName, "test", "gateways", "first")
	assert.NotEmpty(validations)
}

// TestGatewayValidationScopesToNamespaceWhenGatewayToNamespaceSet this test ensures that gateway validation
// scopes the gateway workload checker to the namespace of the gateway when PILOT_SCOPE_GATEWAY_TO_NAMESPACE
// is set to true on the istiod deployment.
func TestGatewayValidationScopesToNamespaceWhenGatewayToNamespaceSet(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	const (
		istioConfigMapName                = "istio-1-19-0"
		istioSidecarInjectorConfigMapName = "istio-sidecar-injector-1-19-0"
		istiodDeploymentName              = "istiod-1-19-0"
	)
	conf := config.NewConfig()
	// conf.ExternalServices.Istio.ConfigMapName = istioConfigMapName
	conf.ExternalServices.Istio.IstioSidecarInjectorConfigMapName = istioSidecarInjectorConfigMapName
	conf.ExternalServices.Istio.IstiodDeploymentName = istiodDeploymentName
	config.Set(conf)
	revConfigMap := &core_v1.ConfigMap{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      istioConfigMapName,
			Namespace: "istio-system",
			Labels: map[string]string{
				models.IstioRevisionLabel: "1-19-0",
			},
		},
		Data: map[string]string{"mesh": ""},
	}
	injectorConfigMap := &core_v1.ConfigMap{ObjectMeta: meta_v1.ObjectMeta{Name: istioSidecarInjectorConfigMapName, Namespace: "istio-system"}}
	istioSystemNamespace := kubetest.FakeNamespace("istio-system")

	istiod_1_19_0 := &apps_v1.Deployment{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      istiodDeploymentName,
			Namespace: "istio-system",
			Labels: map[string]string{
				models.IstioRevisionLabel: "1-19-0",
				"app":                     "istiod",
			},
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				Spec: core_v1.PodSpec{
					Containers: []core_v1.Container{
						{
							Env: []core_v1.EnvVar{
								{
									Name:  "PILOT_SCOPE_GATEWAY_TO_NAMESPACE",
									Value: "true",
								},
							},
						},
					},
				},
			},
		},
	}

	// The gateway workload is in a different namespace than the Gateway object.
	gatewayDeployment := &apps_v1.Deployment{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "istio-ingressgateway",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app": "real", // Matches the gateway label selector
			},
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				ObjectMeta: meta_v1.ObjectMeta{
					Labels: map[string]string{
						"app": "real", // Matches the gateway label selector
					},
				},
			},
		},
	}

	v := mockMultiNamespaceGatewaysValidationService(t, *conf, revConfigMap, injectorConfigMap, istioSystemNamespace, istiod_1_19_0, gatewayDeployment)
	validations, _, err := v.GetIstioObjectValidations(context.TODO(), conf.KubernetesConfig.ClusterName, "test", "gateways", "first")
	require.NoError(err)
	require.Len(validations, 1)
	key := models.IstioValidationKey{
		ObjectType: "gateway",
		Name:       "first",
		Namespace:  "test",
	}
	// Even though the workload is reference properly, because of the PILOT_SCOPE_GATEWAY_TO_NAMESPACE
	// the gateway should be marked as invalid.
	assert.False(validations[key].Valid)
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
	v := mockEmptyValidationService(t)
	filteredVSs := v.filterVSExportToNamespaces(map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo", "", currentIstioObjects)
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
	v := mockAmbientValidationService(t)
	filteredVSs := v.filterVSExportToNamespaces(map[string]bool{"bookinfo": true, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo2", "", currentIstioObjects)
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
	v := mockEmptyValidationService(t, ".")
	filteredVSs := v.filterVSExportToNamespaces(map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo", "", currentIstioObjects)
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
	v := mockEmptyValidationService(t, "*")
	filteredVSs := v.filterVSExportToNamespaces(map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo2", "", currentIstioObjects)
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
	v := mockEmptyValidationService(t)
	filteredDRs := v.filterDRExportToNamespaces(map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo", "", currentIstioObjects)
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
	v := mockAmbientValidationService(t)
	filteredDRs := v.filterDRExportToNamespaces(map[string]bool{"bookinfo": true, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo2", "", currentIstioObjects)
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
	v := mockEmptyValidationService(t, ".")
	filteredDRs := v.filterDRExportToNamespaces(map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo", "", currentIstioObjects)
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
	v := mockEmptyValidationService(t, "*")
	filteredDRs := v.filterDRExportToNamespaces(map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo2", "", currentIstioObjects)
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
	v := mockEmptyValidationService(t)
	filteredSEs := v.filterSEExportToNamespaces(map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo", "", currentIstioObjects)
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
	v := mockAmbientValidationService(t)
	filteredSEs := v.filterSEExportToNamespaces(map[string]bool{"bookinfo": true, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo2", "", currentIstioObjects)
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
	v := mockEmptyValidationService(t, ".")
	filteredSEs := v.filterSEExportToNamespaces(map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo", "", currentIstioObjects)
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
	v := mockEmptyValidationService(t, "*")
	filteredSEs := v.filterSEExportToNamespaces(map[string]bool{"bookinfo": false, "bookinfo2": false, "bookinfo3": false, "default": false}, "bookinfo2", "", currentIstioObjects)
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

	vs := mockCombinedValidationService(t, fakeIstioConfigList(), []string{})

	_, referencesMap, err := vs.GetIstioObjectValidations(context.TODO(), conf.KubernetesConfig.ClusterName, "test", kubernetes.VirtualServices, "product-vs")
	references := referencesMap[models.IstioReferenceKey{ObjectType: "virtualservice", Namespace: "test", Name: "product-vs"}]

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

	vs := mockCombinedValidationService(t, fakeEmptyIstioConfigList(), []string{})

	_, referencesMap, err := vs.GetIstioObjectValidations(context.TODO(), conf.KubernetesConfig.ClusterName, "wrong", "virtualservices", "wrong")
	references := referencesMap[models.IstioReferenceKey{ObjectType: "wrong", Namespace: "wrong", Name: "product-vs"}]

	assert.Nil(err)
	assert.Nil(references)
}

func mockMultiNamespaceGatewaysValidationService(t *testing.T, cfg config.Config, objects ...runtime.Object) IstioValidationsService {
	fakeIstioObjects := []runtime.Object{
		&core_v1.ConfigMap{ObjectMeta: meta_v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
	}
	for _, p := range fakeNamespaces() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakePolicies() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range FakeDepSyncedWithRS() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range FakeRSSyncedWithPods() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakePods().Items {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakeMeshPolicies() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}

	fakeIstioObjects = append(fakeIstioObjects, objects...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(getGateway("first", "test"))...)
	fakeIstioObjects = append(fakeIstioObjects, kubernetes.ToRuntimeObjects(getGateway("second", "test2"))...)

	k8s := kubetest.NewFakeK8sClient(fakeIstioObjects...)
	SetupBusinessLayer(t, k8s, cfg)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[cfg.KubernetesConfig.ClusterName] = k8s
	return IstioValidationsService{discovery: discovery, userClients: k8sclients, businessLayer: NewWithBackends(k8sclients, k8sclients, nil, nil)}
}

func mockCombinedValidationService(t *testing.T, istioConfigList *models.IstioConfigList, services []string) IstioValidationsService {
	fakeIstioObjects := []runtime.Object{
		&core_v1.ConfigMap{ObjectMeta: meta_v1.ObjectMeta{Name: "istio", Namespace: "istio-system"}},
		kubetest.FakeNamespace("wrong"),
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
	for _, p := range FakeDepSyncedWithRS() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range fakeNamespaces() {
		fakeIstioObjects = append(fakeIstioObjects, p.DeepCopyObject())
	}
	for _, p := range FakeRSSyncedWithPods() {
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

	k8s := kubetest.NewFakeK8sClient(fakeIstioObjects...)

	conf := config.NewConfig()
	cache := SetupBusinessLayer(t, k8s, *conf)
	cache.SetRegistryStatus(map[string]*kubernetes.RegistryStatus{
		conf.KubernetesConfig.ClusterName: {
			Services: data.CreateFakeMultiRegistryServices(services, "test", "*"),
		},
	})

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	return IstioValidationsService{discovery: discovery, userClients: k8sclients, businessLayer: NewWithBackends(k8sclients, k8sclients, nil, nil)}
}

func mockAmbientValidationService(t *testing.T) IstioValidationsService {
	objects := []runtime.Object{
		fakeDaemonSetWithStatus("istio-ingressgateway", map[string]string{"app": "istio-ingressgateway", "istio": "ingressgateway"}, unhealthyDaemonSetStatus),
		fakeDaemonSetWithStatus("ztunnel", map[string]string{"app": "ztunnel"}, unhealthyDaemonSetStatus),
		fakeDeploymentWithStatus("istio-egressgateway", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, unhealthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
	}

	k8s, _, _ := mockAddOnsCalls(t, objects, true, false)

	conf := config.Get()
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

	// Set global cache var
	SetupBusinessLayer(t, k8s, *conf)

	clients := make(map[string]kubernetes.ClientInterface)
	clients[conf.KubernetesConfig.ClusterName] = k8s
	return IstioValidationsService{userClients: clients, businessLayer: NewWithBackends(clients, clients, nil, nil)}
}

func mockEmptyValidationService(t *testing.T, exportToValue ...string) IstioValidationsService {
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
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "istio",
			Namespace: "istio-system",
			Labels: map[string]string{
				models.IstioRevisionLabel: "default",
			},
		},
		Data: map[string]string{"mesh": configMapData},
	}

	objects := []runtime.Object{
		fakeDaemonSetWithStatus("istio-ingressgateway", map[string]string{"app": "istio-ingressgateway", "istio": "ingressgateway"}, unhealthyDaemonSetStatus),
		fakeDeploymentWithStatus("istio-egressgateway", map[string]string{"app": "istio-egressgateway", "istio": "egressgateway"}, unhealthyStatus),
		fakeDeploymentWithStatus("istiod", map[string]string{"app": "istiod", "istio": "pilot"}, healthyStatus),
		&istioConfigMap,
	}

	k8s, _, _ := mockAddOnsCalls(t, objects, true, false)

	conf := config.Get()
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

	// Set global cache var
	SetupBusinessLayer(t, k8s, *conf)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[config.Get().KubernetesConfig.ClusterName] = k8s
	return IstioValidationsService{userClients: k8sclients, businessLayer: NewWithBackends(k8sclients, k8sclients, nil, nil)}
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
			ObjectMeta: meta_v1.ObjectMeta{
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
				ObjectMeta: meta_v1.ObjectMeta{
					Name: "reviews-12345-hello",
					Labels: map[string]string{
						"app":     "reviews",
						"version": "v2",
					},
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
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
