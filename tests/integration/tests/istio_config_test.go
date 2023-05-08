package tests

import (
	"path"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tools/cmd"
)

func TestIstioConfigList(t *testing.T) {
	assert := assert.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, utils.ASSETS+"/bookinfo-k8sgateways.yaml")
	defer utils.DeleteFile(filePath, utils.BOOKINFO)
	assert.True(utils.ApplyFile(filePath, utils.BOOKINFO))

	configList, err := utils.IstioConfigsList(utils.BOOKINFO)

	assert.Nil(err)
	assertConfigs(*configList, assert)
}

/*
func TestIstioConfigs(t *testing.T) {
	assert := assert.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, utils.ASSETS+"/bookinfo-k8sgateways.yaml")
	defer utils.DeleteFile(filePath, utils.BOOKINFO)
	assert.True(utils.ApplyFile(filePath, utils.BOOKINFO))
	configMap, err := utils.IstioConfigs()

	assert.Nil(err)
	assert.NotEmpty(configMap)
	assertConfigs(*configMap["bookinfo"], assert)
}
*/

func assertConfigs(configList utils.IstioConfigListJson, assert *assert.Assertions) {
	assert.NotEmpty(configList)
	assert.NotNil(configList.IstioValidations)
	assert.Equal(utils.BOOKINFO, configList.Namespace.Name)

	assert.NotNil(configList.DestinationRules)
	for _, dr := range configList.DestinationRules {
		assert.True(dr.Namespace == configList.Namespace.Name)
		assert.NotNil(dr.Name)
	}
	assert.NotNil(configList.VirtualServices)
	for _, vs := range configList.VirtualServices {
		assert.True(vs.Namespace == configList.Namespace.Name)
		assert.NotNil(vs.Name)
	}
	assert.NotNil(configList.PeerAuthentications)
	for _, pa := range configList.PeerAuthentications {
		assert.True(pa.Namespace == configList.Namespace.Name)
		assert.NotNil(pa.Name)
	}
	assert.NotNil(configList.ServiceEntries)
	for _, se := range configList.ServiceEntries {
		assert.True(se.Namespace == configList.Namespace.Name)
		assert.NotNil(se.Name)
	}
	assert.NotNil(configList.Sidecars)
	for _, sc := range configList.Sidecars {
		assert.True(sc.Namespace == configList.Namespace.Name)
		assert.NotNil(sc.Name)
	}
	assert.NotNil(configList.AuthorizationPolicies)
	for _, ap := range configList.AuthorizationPolicies {
		assert.True(ap.Namespace == configList.Namespace.Name)
		assert.NotNil(ap.Name)
	}
	assert.NotNil(configList.Gateways)
	for _, gw := range configList.Gateways {
		assert.True(gw.Namespace == configList.Namespace.Name)
		assert.NotNil(gw.Name)
	}
	assert.NotNil(configList.K8sGateways)
	for _, gw := range configList.K8sGateways {
		assert.True(gw.Namespace == configList.Namespace.Name)
		assert.NotNil(gw.Name)
	}
	assert.NotNil(configList.K8sHTTPRoutes)
	for _, gw := range configList.K8sHTTPRoutes {
		assert.True(gw.Namespace == configList.Namespace.Name)
		assert.NotNil(gw.Name)
	}
	assert.NotNil(configList.RequestAuthentications)
	for _, ra := range configList.RequestAuthentications {
		assert.True(ra.Namespace == configList.Namespace.Name)
		assert.NotNil(ra.Name)
	}
	assert.NotNil(configList.WorkloadEntries)
	for _, we := range configList.WorkloadEntries {
		assert.True(we.Namespace == configList.Namespace.Name)
		assert.NotNil(we.Name)
	}
	assert.NotNil(configList.WorkloadGroups)
	for _, wg := range configList.WorkloadGroups {
		assert.True(wg.Namespace == configList.Namespace.Name)
		assert.NotNil(wg.Name)
	}
	assert.NotNil(configList.EnvoyFilters)
	for _, ef := range configList.EnvoyFilters {
		assert.True(ef.Namespace == configList.Namespace.Name)
		assert.NotNil(ef.Name)
	}
}

func TestIstioConfigDetails(t *testing.T) {
	name := "bookinfo"
	assert := assert.New(t)
	config, _, err := utils.IstioConfigDetails(utils.BOOKINFO, name, kubernetes.VirtualServices)

	assert.Nil(err)
	assert.NotNil(config)
	assert.Equal(kubernetes.VirtualServices, config.ObjectType)
	assert.Equal(utils.BOOKINFO, config.Namespace.Name)
	assert.NotNil(config.VirtualService)
	assert.Equal(name, config.VirtualService.Name)
	assert.Equal(utils.BOOKINFO, config.VirtualService.Namespace)
	assert.NotNil(config.IstioReferences)
	assert.NotNil(config.IstioValidation)
	assert.Equal(name, config.IstioValidation.Name)
	assert.Equal("virtualservice", config.IstioValidation.ObjectType)
	if !config.IstioValidation.Valid {
		assert.NotEmpty(config.IstioValidation.References)
	}
}

func TestIstioConfigInvalidName(t *testing.T) {
	name := "invalid"
	assert := assert.New(t)
	config, code, _ := utils.IstioConfigDetails(utils.BOOKINFO, name, kubernetes.VirtualServices)
	assert.NotEqual(200, code)
	assert.Empty(config)
}

func TestIstioConfigPermissions(t *testing.T) {
	assert := assert.New(t)
	perms, err := utils.IstioConfigPermissions(utils.BOOKINFO)

	assert.Nil(err)
	assert.NotEmpty(perms)
	assert.NotEmpty((*perms)[utils.BOOKINFO])
	assert.NotEmpty((*(*perms)[utils.BOOKINFO])["authorizationpolicies"])
}
