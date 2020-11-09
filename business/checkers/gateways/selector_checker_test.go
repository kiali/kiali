package gateways

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestValidInternalSelector(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	ingress := data.CreateEmptyGateway("gwingress", "test", map[string]string{"istio": "ingressgateway"})
	egress := data.CreateEmptyGateway("gwegress", "test", map[string]string{"istio": "egressgateway"})

	validations, valid := SelectorChecker{
		Gateway: ingress,
		WorkloadsPerNamespace: map[string]models.WorkloadList{
			"test": data.CreateWorkloadList("istio-system",
				data.CreateWorkloadListItem("istio-ingressgateway", map[string]string{"istio": "ingressgateway"})),
		},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)

	validations, valid = SelectorChecker{
		Gateway: egress,
		WorkloadsPerNamespace: map[string]models.WorkloadList{
			"test": data.CreateWorkloadList("istio-system",
				data.CreateWorkloadListItem("istio-egressgateway", map[string]string{"istio": "egressgateway"})),
		},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestValidNamespaceSelector(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gw := data.CreateEmptyGateway("gwone", "test", map[string]string{"app": "proxy"})

	validations, valid := SelectorChecker{
		Gateway: gw,
		WorkloadsPerNamespace: map[string]models.WorkloadList{
			"test": data.CreateWorkloadList("test",
				data.CreateWorkloadListItem("testproxy", map[string]string{"app": "proxy"})),
		},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestValidIstioNamespaceSelector(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gw := data.CreateEmptyGateway("gwone", "test", map[string]string{"app": "proxy"})

	validations, valid := SelectorChecker{
		Gateway: gw,
		WorkloadsPerNamespace: map[string]models.WorkloadList{
			"testproxy": data.CreateWorkloadList(conf.IstioNamespace,
				data.CreateWorkloadListItem("testproxy", map[string]string{"app": "proxy"})),
		},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)

	validations, valid = SelectorChecker{
		Gateway: gw,
		WorkloadsPerNamespace: map[string]models.WorkloadList{
			"test": {
				Namespace: models.Namespace{
					Name: "test",
				},
				Workloads: []models.WorkloadListItem{},
			},
		},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
}

func TestMissingSelectorTarget(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	gw := data.CreateEmptyGateway("gwone", "test", map[string]string{"app": "proxy"})

	validations, valid := SelectorChecker{
		Gateway: gw,
		WorkloadsPerNamespace: map[string]models.WorkloadList{
			"test": data.CreateWorkloadList("test"),
		},
	}.Check()

	assert.False(valid)
	assert.Equal(1, len(validations))
	assert.Equal(models.CheckMessage("gateways.selector"), validations[0].Message)
	assert.Equal(models.WarningSeverity, validations[0].Severity)
}
