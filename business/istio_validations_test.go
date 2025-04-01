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
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/kubernetes/kubetest"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func FakeCertificateConfigMap(namespace string) *core_v1.ConfigMap {
	return &core_v1.ConfigMap{
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio-ca-root-cert",
			Namespace: namespace,
		},
		Data: map[string]string{
			"root-cert.pem": `-----BEGIN CERTIFICATE-----
MIIC/DCCAeSgAwIBAgIQVv6mINjF1kQJS2O98zkkNzANBgkqhkiG9w0BAQsFADAY
MRYwFAYDVQQKEw1jbHVzdGVyLmxvY2FsMB4XDTIxMDcyNzE0MzcwMFoXDTMxMDcy
NTE0MzcwMFowGDEWMBQGA1UEChMNY2x1c3Rlci5sb2NhbDCCASIwDQYJKoZIhvcN
AQEBBQADggEPADCCAQoCggEBAMwHN+LAkWbC9qyAlXQ4Zwn+Yhgc4eCPuw9LQVjW
b9al44H5sV/1QIog8wOjDHx32k2lTXvdxRgOJd+ENXMQ9DmU6C9oeWhMZAmAvp4M
NBaYnY4BRcWAPqIhEb/26zRA9pXjPVJX+aN45R1EJWsJxP6ZPkmZZKILnYY6VwqU
wbbB3lp34HQruvkpePUo4Bux+N+DfQsu1g/C6UMbQlY/kl1d1KaTS4bYQAP1d4eT
sPxw5Rf9WRSQcGaAWiPbUxVBtA0LYCbHzOacAAwvYhJgvbinr73RiqKUMR5BV/p3
lyKyVDyrVXXbVNsQhsT/lM5e55DaQEJKyldgklSGseVYHy0CAwEAAaNCMEAwDgYD
VR0PAQH/BAQDAgIEMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFK7ZOPXlxd78
xUpOGYDaqgC/sdevMA0GCSqGSIb3DQEBCwUAA4IBAQACLa2gNuIxQWf4qiCxsbIj
qddqbjHBGOWVAcyFRk/k7ydmellkI5BcMJEhlPT7TBUutcjvX8lCsup+xGy47NpH
hRp4hxUYodGXLXQ2HfI+3CgAARBEIBXjh/73UDFcMtH/G6EtGfFEw8ZgbyaDQ9Ft
c10h5QnbMUBFWdmvwSFvbJwZoTlFM+skogwv+d55sujZS83jbZHs7lZlDy0hDYIm
tMAWt4FEJnLPrfFtCFJgddiXDYGtX/Apvqac2riSAFg8mQB5WRtxKH7TK9Qhvca7
V/InYncUvcXt0M4JJSUJi/u6VBKSYYDIHt3mk9Le2qlMQuHkOQ1ZcuEOM2CU/KtO
-----END CERTIFICATE-----`,
		},
	}
}

func TestGetNamespaceValidations(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(t, conf, fakeIstioConfigList(),
		[]string{"details.test.svc.cluster.local", "product.test.svc.cluster.local", "product2.test.svc.cluster.local", "customer.test.svc.cluster.local"})

	var changeMap = map[string]string{}
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
		[]string{"details.test.svc.cluster.local", "product.test.svc.cluster.local", "product2.test.svc.cluster.local", "customer.test.svc.cluster.local"})
	vInfo, err = vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, changeMap)
	require.NoError(err)
	validationPerformed, validations, err = vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	assert.True(validationPerformed)
	assert.NotNil(validations)
}

func TestGetIstioObjectValidations(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(t, conf, fakeIstioConfigList(),
		[]string{"details.test.svc.cluster.local", "product.test.svc.cluster.local", "customer.test.svc.cluster.local"})

	validations, _, _ := vs.ValidateIstioObject(context.TODO(), conf.KubernetesConfig.ClusterName, "test", kubernetes.VirtualServices, "product-vs")

	assert.NotEmpty(validations)
}

func TestGatewayValidation(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	conf.Deployment.ClusterWideAccess = true
	kubernetes.SetConfig(t, *conf)

	objs := mockMultiNamespaceGateways(conf)
	v := fakeValidationMeshService(t, *conf, objs...)
	validations, _, _ := v.ValidateIstioObject(context.TODO(), conf.KubernetesConfig.ClusterName, "test", kubernetes.Gateways, "first")
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
		ObjectMeta: v1.ObjectMeta{
			Name:      istioConfigMapName,
			Namespace: "istio-system",
			Labels: map[string]string{
				config.IstioRevisionLabel: "1-19-0",
			},
		},
		Data: map[string]string{"mesh": ""},
	}
	injectorConfigMap := &core_v1.ConfigMap{ObjectMeta: v1.ObjectMeta{Name: istioSidecarInjectorConfigMapName, Namespace: "istio-system"}}
	istioSystemNamespace := kubetest.FakeNamespace("istio-system")

	istiod_1_19_0 := &apps_v1.Deployment{
		ObjectMeta: v1.ObjectMeta{
			Name:      istiodDeploymentName,
			Namespace: "istio-system",
			Labels: map[string]string{
				config.IstioRevisionLabel: "1-19-0",
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
		ObjectMeta: v1.ObjectMeta{
			Name:      "istio-ingressgateway",
			Namespace: "istio-system",
			Labels: map[string]string{
				"app": "real", // Matches the gateway label selector
			},
		},
		Spec: apps_v1.DeploymentSpec{
			Template: core_v1.PodTemplateSpec{
				ObjectMeta: v1.ObjectMeta{
					Labels: map[string]string{
						"app": "real", // Matches the gateway label selector
					},
				},
			},
		},
	}

	objs := []runtime.Object{
		revConfigMap,
		injectorConfigMap,
		istioSystemNamespace,
		istiod_1_19_0,
		gatewayDeployment,
	}
	objs = append(objs, mockMultiNamespaceGateways(conf)...)
	v := fakeValidationMeshService(t, *conf, objs...)
	validations, _, err := v.ValidateIstioObject(context.TODO(), conf.KubernetesConfig.ClusterName, "test", kubernetes.Gateways, "first")
	require.NoError(err)
	require.Len(validations, 1)
	key := models.IstioValidationKey{
		ObjectGVK: kubernetes.Gateways,
		Name:      "first",
		Namespace: "test",
	}
	// Even though the workload is reference properly, because of the PILOT_SCOPE_GATEWAY_TO_NAMESPACE
	// the gateway should be marked as invalid.
	assert.False(validations[key].Valid)
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

func TestValidatingSingleObjectUpdatesList(t *testing.T) {
	assert := assert.New(t)
	require := require.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vs := mockCombinedValidationService(t, conf, fakeIstioConfigList(),
		[]string{"details.test.svc.cluster.local", "product.test.svc.cluster.local", "product2.test.svc.cluster.local", "customer.test.svc.cluster.local"})

	v, err := vs.userClients[conf.KubernetesConfig.ClusterName].Istio().NetworkingV1().VirtualServices("test").Get(context.Background(), "product-vs", v1.GetOptions{})
	require.NoError(err)

	vInfo, err := vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, nil)
	require.NoError(err)
	validationPerformed, validations, err := vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	assert.True(validationPerformed)
	vs.kialiCache.Validations().Replace(validations)

	currentValidations, err := vs.GetValidations(context.Background(), conf.KubernetesConfig.ClusterName)
	require.NoError(err)

	key := models.IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Namespace: "test", Name: "product-vs"}
	require.True(currentValidations[key].Valid)

	v.Spec.Gateways = []string{"nonexistant"}
	_, err = vs.userClients[conf.KubernetesConfig.ClusterName].Istio().NetworkingV1().VirtualServices("test").Update(context.Background(), v, v1.UpdateOptions{})
	require.NoError(err)

	// make sure validations are updated in a cache before retrieving them
	vInfo, err = vs.NewValidationInfo(context.Background(), []string{conf.KubernetesConfig.ClusterName}, nil)
	require.NoError(err)
	validationPerformed, validations, err = vs.Validate(context.Background(), conf.KubernetesConfig.ClusterName, vInfo)
	require.NoError(err)
	assert.True(validationPerformed)
	vs.kialiCache.Validations().Replace(validations)

	updatedValidations, _, err := vs.ValidateIstioObject(context.Background(), conf.KubernetesConfig.ClusterName, "test", kubernetes.VirtualServices, "product-vs")
	require.NoError(err)
	require.False(updatedValidations[key].Valid)

	validations, err = vs.GetValidations(context.Background(), conf.KubernetesConfig.ClusterName)
	require.NoError(err)
	require.NotEmpty(validations)
	assert.False(validations[key].Valid)
}

func fakeValidationMeshService(t *testing.T, conf config.Config, objects ...runtime.Object) IstioValidationsService {
	k8s := kubetest.NewFakeK8sClient(objects...)
	cache := SetupBusinessLayer(t, k8s, conf)

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[conf.KubernetesConfig.ClusterName] = k8s
	discovery := istio.NewDiscovery(k8sclients, cache, &conf)
	namespace := NewNamespaceService(cache, &conf, discovery, k8sclients, k8sclients)
	mesh := NewMeshService(&conf, discovery, k8sclients)
	layer := NewWithBackends(k8sclients, k8sclients, nil, nil)
	return NewValidationsService(&conf, &layer.IstioConfig, cache, &mesh, &namespace, &layer.Svc, k8sclients, &layer.Workload)
}

func fakeValidationMeshServiceWithRegistryStatus(t *testing.T, cfg config.Config, services []string, objects ...runtime.Object) IstioValidationsService {
	k8s := kubetest.NewFakeK8sClient(objects...)
	cache := SetupBusinessLayer(t, k8s, cfg)
	conf := config.NewConfig()
	cache.SetRegistryStatus(map[string]*kubernetes.RegistryStatus{
		conf.KubernetesConfig.ClusterName: {
			Services: data.CreateFakeMultiRegistryServices(services, "test", "*"),
		},
	})

	k8sclients := make(map[string]kubernetes.ClientInterface)
	k8sclients[cfg.KubernetesConfig.ClusterName] = k8s
	discovery := &istiotest.FakeDiscovery{
		MeshReturn: models.Mesh{ControlPlanes: []models.ControlPlane{{Cluster: &models.KubeCluster{IsKialiHome: true}, Config: models.ControlPlaneConfiguration{}}}},
	}
	namespace := NewNamespaceService(cache, conf, discovery, k8sclients, k8sclients)
	mesh := NewMeshService(conf, discovery, k8sclients)
	layer := NewWithBackends(k8sclients, k8sclients, nil, nil)
	return NewValidationsService(conf, &layer.IstioConfig, cache, &mesh, &namespace, &layer.Svc, k8sclients, &layer.Workload)
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

	return fakeValidationMeshServiceWithRegistryStatus(t, *config.NewConfig(), services, fakeIstioObjects...)
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
		FakeCertificateConfigMap("istio-system"),
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
