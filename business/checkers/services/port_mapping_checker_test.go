package services

import (
	"testing"

	"github.com/stretchr/testify/assert"
	apps_v1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/intstr"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/istio/istiotest"
	"github.com/kiali/kiali/tests/testutils/validations"
)

var discovery = &istiotest.FakeDiscovery{
	IsControlPlaneReturn: false,
}
var discoveryCP = &istiotest.FakeDiscovery{
	IsControlPlaneReturn: true,
}

func TestPortMappingMatch(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	deployments := getDeployment(9080)
	pods := getPods(true)
	service := getService(9080, "http", nil, "test-namespace", "app", "labelName1")
	pmc := NewPortMappingChecker(deployments, discovery, pods, service)

	vals, valid := pmc.Check()
	assert.True(valid)
	assert.Empty(vals)
}

func TestTargetPortMappingMatch(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	service := getService(9080, "http", nil, "test-namespace", "app", "labelName1")
	service.Spec.Ports[0].TargetPort = intstr.FromInt(8080)

	/*
		// If this is a string, it will be looked up as a named port in the
		// target Pod's container ports. If this is not specified, the value
		// of the 'port' field is used (an identity map).
		// This field is ignored for services with clusterIP=None, and should be
		// omitted or set equal to the 'port' field.

	*/

	deployments := getDeployment(8080)
	pods := getPods(true)
	pmc := NewPortMappingChecker(deployments, discovery, pods, service)

	vals, valid := pmc.Check()
	assert.True(valid)
	assert.Empty(vals)

	// Now check with named port only
	service.Spec.Ports[0].TargetPort = intstr.FromString("http-container")

	vals, valid = pmc.Check()
	assert.True(valid)
	assert.Empty(vals)
}

func TestPortMappingMismatch(t *testing.T) {
	// As per KIALI-2454
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	deployments := getDeployment(8080)
	pods := getPods(true)
	service := getService(9080, "http", nil, "test-namespace", "app", "labelName1")
	pmc := NewPortMappingChecker(deployments, discovery, pods, service)

	vals, valid := pmc.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.NoError(validations.ConfirmIstioCheckMessage("service.deployment.port.mismatch", vals[0]))
	assert.Equal("spec/ports[0]", vals[0].Path)
}

func TestPortMappingSkipWaypoint(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	deployments := getDeployment(8080)
	pods := getPods(false)
	service := getService(9080, "http", nil, "test-namespace", config.WaypointLabel, config.WaypointLabelValue)
	pmc := NewPortMappingChecker(deployments, discovery, pods, service)

	vals, valid := pmc.Check()
	assert.True(valid)
	assert.Empty(vals)
}

func TestPortMappingNoMismatchIstio(t *testing.T) {
	// As per KIALI-2454
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	deployments := getDeployment(8080)
	pods := getPods(true)
	service := getService(9080, "http", nil, "istio-system", "app", "labelName1")
	pmc := NewPortMappingChecker(deployments, discoveryCP, pods, service)

	vals, valid := pmc.Check()
	assert.True(valid)
	assert.Empty(vals)
}

func TestServicePortNaming(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	deployments := getDeployment(9080)
	pods := getPods(true)
	service := getService(9080, "http2foo", nil, "test-namespace", "app", "labelName1")
	pmc := NewPortMappingChecker(deployments, discovery, pods, service)

	vals, valid := pmc.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.NoError(validations.ConfirmIstioCheckMessage("port.name.mismatch", vals[0]))
	assert.Equal("spec/ports[0]", vals[0].Path)
}

func TestServicePortNamingIstioSystem(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	deployments := getDeployment(9080)
	pods := getPods(true)
	service := getService(9080, "http2foo", nil, "istio-system", "app", "labelName1")
	pmc := NewPortMappingChecker(deployments, discoveryCP, pods, service)

	vals, valid := pmc.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.NoError(validations.ConfirmIstioCheckMessage("port.name.mismatch", vals[0]))
	assert.Equal("spec/ports[0]", vals[0].Path)
}

func TestServicePortNamingWizard(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	deployments := getDeployment(9080)
	pods := getPods(true)
	service := getService(9080, "status-port", nil, "test-namespace", "kiali_wizard", "labelName1")
	pmc := NewPortMappingChecker(deployments, discovery, pods, service)

	vals, valid := pmc.Check()
	assert.True(valid)
	assert.Empty(vals)
}

func TestServicePortAppProtocol(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	appProtocol := "mysql-wrong"
	deployments := getDeployment(9080)
	pods := getPods(true)
	service := getService(9080, "database", &appProtocol, "test-namespace", "app", "labelName1")
	pmc := NewPortMappingChecker(deployments, discovery, pods, service)

	vals, valid := pmc.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.NoError(validations.ConfirmIstioCheckMessage("port.appprotocol.mismatch", vals[0]))
	assert.Equal("spec/ports[0]", vals[0].Path)

	appProtocol = "mysql"
	service = getService(9080, "database", &appProtocol, "test-namespace", "app", "labelName1")
	pmc = NewPortMappingChecker(deployments, discovery, pods, service)

	vals, valid = pmc.Check()
	assert.True(valid)
	assert.Empty(vals)
}

func TestServicePortNamingWithoutSidecar(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	deployments := getDeployment(9080)
	pods := getPods(false)
	service := getService(9080, "http2foo", nil, "test-namespace", "app", "labelName1")
	pmc := NewPortMappingChecker(deployments, discovery, pods, service)

	vals, valid := pmc.Check()
	assert.True(valid)
	assert.Empty(vals)
}

func getService(servicePort int32, portName string, appProtocol *string, namespace string, labelKey string, labelValue string) v1.Service {
	return v1.Service{
		ObjectMeta: meta_v1.ObjectMeta{
			Name:      "service1",
			Namespace: namespace,
			Labels: map[string]string{
				labelKey: labelValue},
		},
		Spec: v1.ServiceSpec{
			Ports: []v1.ServicePort{
				{
					Port:        servicePort,
					Name:        portName,
					AppProtocol: appProtocol,
				},
			},
			Selector: map[string]string{
				"dep": "one",
			},
		},
	}
}

func getDeployment(containerPort int32) []apps_v1.Deployment {
	return []apps_v1.Deployment{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Labels: map[string]string{
					"dep": "one",
				},
			},
			Spec: apps_v1.DeploymentSpec{
				Template: v1.PodTemplateSpec{
					Spec: v1.PodSpec{
						Containers: []v1.Container{
							{
								Ports: []v1.ContainerPort{
									{
										Name:          "http-container",
										ContainerPort: containerPort,
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

func getPods(withSidecar bool) []v1.Pod {
	conf := config.NewConfig()

	annotation := "sidecarless-annotation"
	if withSidecar {
		annotation = conf.ExternalServices.Istio.IstioSidecarAnnotation
	}

	return []v1.Pod{
		{
			ObjectMeta: meta_v1.ObjectMeta{
				Labels: map[string]string{
					"dep": "one",
				},
				Annotations: map[string]string{
					annotation: "{\"version\":\"\",\"initContainers\":[\"istio-init\",\"enable-core-dump\"],\"containers\":[\"istio-proxy\"],\"volumes\":[\"istio-envoy\",\"istio-certs\"]}",
				},
			},
		},
	}
}
