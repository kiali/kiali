package gateways

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestValidInternalSelector(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	ingress := data.CreateEmptyGateway("gwingress", "test", map[string]string{"istio": "ingressgateway"})
	egress := data.CreateEmptyGateway("gwegress", "test", map[string]string{"istio": "egressgateway"})

	vals, valid := SelectorChecker{
		Gateway: ingress,
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {
				data.CreateWorkload("istio-ingressgateway", map[string]string{"istio": "ingressgateway"}),
			}},
		IsGatewayToNamespace: false,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)

	vals, valid = SelectorChecker{
		Gateway: egress,
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {
				data.CreateWorkload("istio-egressgateway", map[string]string{"istio": "egressgateway"}),
			}},
		IsGatewayToNamespace: false,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestValidNamespaceSelector(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gw := data.CreateEmptyGateway("gwone", "test", map[string]string{"app": "proxy"})

	vals, valid := SelectorChecker{
		Gateway: gw,
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {
				data.CreateWorkload("testproxy", map[string]string{"app": "proxy"}),
			}},
		IsGatewayToNamespace: false,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestLocalNamespaceSelector(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	// gateway and workload in same namespace, IsGatewayToNamespace: true, valid
	gw := data.CreateEmptyGateway("gwone", "test", map[string]string{"app": "proxy"})

	vals, valid := SelectorChecker{
		Gateway: gw,
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {
				data.CreateWorkload("testproxy", map[string]string{"app": "proxy"}),
			}},
		IsGatewayToNamespace: true,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)

	// gateway and workload in same namespace, IsGatewayToNamespace: false, valid
	gw = data.CreateEmptyGateway("gwone", "test", map[string]string{"app": "proxy"})

	vals, valid = SelectorChecker{
		Gateway: gw,
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {
				data.CreateWorkload("testproxy", map[string]string{"app": "proxy"}),
			}},
		IsGatewayToNamespace: false,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)

	// gateway and workload in different namespace, IsGatewayToNamespace: true, invalid
	gw = data.CreateEmptyGateway("gwone", "other", map[string]string{"app": "proxy"})

	vals, valid = SelectorChecker{
		Gateway: gw,
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {
				data.CreateWorkload("testproxy", map[string]string{"app": "proxy"}),
			}},
		IsGatewayToNamespace: true,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)

	// gateway and workload in different namespace, IsGatewayToNamespace: false, valid
	gw = data.CreateEmptyGateway("gwone", "other", map[string]string{"app": "proxy"})

	vals, valid = SelectorChecker{
		Gateway: gw,
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {
				data.CreateWorkload("testproxy", map[string]string{"app": "proxy"}),
			}},
		IsGatewayToNamespace: false,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestValidIstioNamespaceSelector(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gw := data.CreateEmptyGateway("gwone", "test", map[string]string{"app": "proxy"})

	vals, valid := SelectorChecker{
		Gateway: gw,
		WorkloadsPerNamespace: map[string]models.Workloads{
			"testproxy": {
				data.CreateWorkload("testproxy", map[string]string{"app": "proxy"}),
			}},
		IsGatewayToNamespace: false,
	}.Check()

	assert.True(valid)
	assert.Empty(vals)

	vals, valid = SelectorChecker{
		Gateway: gw,
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {},
		},
		IsGatewayToNamespace: false,
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
}

func TestMissingSelectorTarget(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gw := data.CreateEmptyGateway("gwone", "test", map[string]string{"app": "proxy"})

	vals, valid := SelectorChecker{
		Gateway: gw,
		WorkloadsPerNamespace: map[string]models.Workloads{
			"test": {},
		},
		IsGatewayToNamespace: false,
	}.Check()

	assert.False(valid)
	assert.Equal(1, len(vals))
	assert.NoError(validations.ConfirmIstioCheckMessage("gateways.selector", vals[0]))
	assert.Equal(models.WarningSeverity, vals[0].Severity)
}
