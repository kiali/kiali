package k8sgrpcroutes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	k8s_networking_v1 "sigs.k8s.io/gateway-api/apis/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestMissingK8sGateway(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	checker := NoK8sGatewayChecker{
		Conf:         config.Get(),
		K8sGRPCRoute: data.CreateGRPCRoute("route", "bookinfo", "gatewayapi", []string{"bookinfo"}),
		GatewayNames: make(map[string]k8s_networking_v1.Gateway),
	}

	vals, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nok8sgateway", vals[0]))
}

func TestMissingK8sGateways(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	checker := NoK8sGatewayChecker{
		Conf: config.Get(),
		K8sGRPCRoute: data.AddGatewayParentRefToGRPCRoute("gateway2", "bookinfo2",
			data.CreateGRPCRoute("route", "bookinfo", "gatewayapi", []string{"bookinfo"})),
		GatewayNames: make(map[string]k8s_networking_v1.Gateway),
	}

	vals, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nok8sgateway", vals[0]))
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nok8sgateway", vals[1]))
}

func TestValidAndMissingK8sGateway(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	checker := NoK8sGatewayChecker{
		Conf: config.Get(),
		K8sGRPCRoute: data.AddGatewayParentRefToGRPCRoute("correctgw", "bookinfo2",
			data.CreateGRPCRoute("route", "bookinfo", "gatewayapi", []string{"bookinfo"})),
		GatewayNames: kubernetes.K8sGatewayNames([]*k8s_networking_v1.Gateway{
			data.CreateEmptyK8sGateway("correctgw", "bookinfo"),
		}, conf),
	}

	vals, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nok8sgateway", vals[0]))
}

func TestFoundK8sGateway(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	checker := NoK8sGatewayChecker{
		Conf:         config.Get(),
		K8sGRPCRoute: data.CreateGRPCRoute("route", "bookinfo", "my-gateway", []string{"bookinfo"}),
		GatewayNames: kubernetes.K8sGatewayNames([]*k8s_networking_v1.Gateway{
			data.CreateEmptyK8sGateway("my-gateway", "bookinfo"),
		}, conf),
	}

	vals, valid := checker.Check()
	assert.True(valid)
	assert.Empty(vals)
}

func TestFoundSharedK8sGateway(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	checker := NoK8sGatewayChecker{
		Conf: config.Get(),
		K8sGRPCRoute: data.AddGatewayParentRefToGRPCRoute("sharedgw", "gwns",
			data.CreateEmptyGRPCRoute("route", "bookinfo", []string{"bookinfo"})),
		GatewayNames: kubernetes.K8sGatewayNames([]*k8s_networking_v1.Gateway{
			data.AddListenerToK8sGateway(data.CreateSharedListener("test", "host.com", 80, "http"),
				data.CreateEmptyK8sGateway("sharedgw", "gwns")),
		}, conf),
		Namespaces: models.Namespaces{data.CreateSharedNamespace("bookinfo")},
	}

	vals, valid := checker.Check()
	assert.True(valid)
	assert.Empty(vals)
}

func TestFoundSharedToAllK8sGateway(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	checker := NoK8sGatewayChecker{
		Conf: config.Get(),
		K8sGRPCRoute: data.AddGatewayParentRefToGRPCRoute("sharedgw", "gwns",
			data.CreateEmptyGRPCRoute("route", "bookinfo", []string{"bookinfo"})),
		GatewayNames: kubernetes.K8sGatewayNames([]*k8s_networking_v1.Gateway{
			data.AddListenerToK8sGateway(data.CreateSharedToAllListener("test", "host.com", 80, "http"),
				data.CreateEmptyK8sGateway("sharedgw", "gwns")),
		}, conf),
		Namespaces: models.Namespaces{models.Namespace{Name: "bookinfo"}},
	}

	vals, valid := checker.Check()
	assert.True(valid)
	assert.Empty(vals)
}

func TestWrongNSSharedK8sGatewayError(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	checker := NoK8sGatewayChecker{
		Conf: config.Get(),
		K8sGRPCRoute: data.AddGatewayParentRefToGRPCRoute("sharedgw", "gwnswrong",
			data.CreateEmptyGRPCRoute("route", "bookinfo", []string{"bookinfo"})),
		GatewayNames: kubernetes.K8sGatewayNames([]*k8s_networking_v1.Gateway{
			data.AddListenerToK8sGateway(data.CreateSharedListener("test", "host.com", 80, "http"),
				data.CreateEmptyK8sGateway("sharedgw", "gwns")),
		}, conf),
		Namespaces: models.Namespaces{data.CreateSharedNamespace("bookinfo")},
	}

	vals, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nok8sgateway", vals[0]))
}

func TestSharedK8sGatewayWrongNSError(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	checker := NoK8sGatewayChecker{
		Conf: config.Get(),
		K8sGRPCRoute: data.AddGatewayParentRefToGRPCRoute("sharedgw", "gwns",
			data.CreateEmptyGRPCRoute("route", "bookinfo", []string{"bookinfo"})),
		GatewayNames: kubernetes.K8sGatewayNames([]*k8s_networking_v1.Gateway{
			data.AddListenerToK8sGateway(data.CreateSharedListener("test", "host.com", 80, "http"),
				data.CreateEmptyK8sGateway("sharedgw", "gwnswrong")),
		}, conf),
		Namespaces: models.Namespaces{data.CreateSharedNamespace("bookinfo")},
	}

	vals, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nok8sgateway", vals[0]))
}

func TestNotSharedNSK8sGatewayError(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	checker := NoK8sGatewayChecker{
		Conf: config.Get(),
		K8sGRPCRoute: data.AddGatewayParentRefToGRPCRoute("sharedgw", "gwns",
			data.CreateEmptyGRPCRoute("route", "bookinfo", []string{"bookinfo"})),
		GatewayNames: kubernetes.K8sGatewayNames([]*k8s_networking_v1.Gateway{
			data.AddListenerToK8sGateway(data.CreateSharedListener("test", "host.com", 80, "http"),
				data.CreateEmptyK8sGateway("sharedgw", "gwns")),
		}, conf),
		Namespaces: models.Namespaces{models.Namespace{Name: "bookinfo"}},
	}

	vals, valid := checker.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sroutes.nok8sgateway", vals[0]))
}
