package tests

import (
	"path"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tools/cmd"
)

func TestIstioConfigList(t *testing.T) {
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-k8sgateways.yaml")
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))

	configList, err := kiali.IstioConfigsList(kiali.BOOKINFO)

	require.NoError(err)
	assertConfigs(*configList, kiali.BOOKINFO, require)
}

func TestIstioConfigs(t *testing.T) {
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-k8sgateways.yaml")
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))
	configList, err := kiali.IstioConfigs()

	require.NoError(err)
	require.NotEmpty(configList)
	assertConfigs(*configList, kiali.BOOKINFO, require)
}

func assertConfigs(configList models.IstioConfigList, namespace string, require *require.Assertions) {
	require.NotEmpty(configList)
	require.NotNil(configList.IstioValidations)
	require.Equal(kiali.BOOKINFO, namespace)

	require.NotNil(configList.DestinationRules)
	for _, dr := range configList.DestinationRules {
		require.True(dr.Namespace == namespace)
		require.NotNil(dr.Name)
	}
	require.NotNil(configList.VirtualServices)
	for _, vs := range configList.VirtualServices {
		require.True(vs.Namespace == namespace)
		require.NotNil(vs.Name)
	}
	require.NotNil(configList.PeerAuthentications)
	for _, pa := range configList.PeerAuthentications {
		require.True(pa.Namespace == namespace)
		require.NotNil(pa.Name)
	}
	require.NotNil(configList.ServiceEntries)
	for _, se := range configList.ServiceEntries {
		require.True(se.Namespace == namespace)
		require.NotNil(se.Name)
	}
	require.NotNil(configList.Sidecars)
	for _, sc := range configList.Sidecars {
		require.True(sc.Namespace == namespace)
		require.NotNil(sc.Name)
	}
	require.NotNil(configList.AuthorizationPolicies)
	for _, ap := range configList.AuthorizationPolicies {
		require.True(ap.Namespace == namespace)
		require.NotNil(ap.Name)
	}
	require.NotNil(configList.Gateways)
	for _, gw := range configList.Gateways {
		require.True(gw.Namespace == namespace)
		require.NotNil(gw.Name)
	}
	require.NotNil(configList.K8sGateways)
	for _, gw := range configList.K8sGateways {
		require.True(gw.Namespace == namespace)
		require.NotNil(gw.Name)
	}
	require.NotNil(configList.K8sGRPCRoutes)
	for _, gw := range configList.K8sGRPCRoutes {
		require.True(gw.Namespace == namespace)
		require.NotNil(gw.Name)
	}
	require.NotNil(configList.K8sHTTPRoutes)
	for _, gw := range configList.K8sHTTPRoutes {
		require.True(gw.Namespace == namespace)
		require.NotNil(gw.Name)
	}
	require.NotNil(configList.K8sReferenceGrants)
	for _, rg := range configList.K8sReferenceGrants {
		require.True(rg.Namespace == namespace)
		require.NotNil(rg.Name)
	}
	require.NotNil(configList.RequestAuthentications)
	for _, ra := range configList.RequestAuthentications {
		require.True(ra.Namespace == namespace)
		require.NotNil(ra.Name)
	}
	require.NotNil(configList.WorkloadEntries)
	for _, we := range configList.WorkloadEntries {
		require.True(we.Namespace == namespace)
		require.NotNil(we.Name)
	}
	require.NotNil(configList.WorkloadGroups)
	for _, wg := range configList.WorkloadGroups {
		require.True(wg.Namespace == namespace)
		require.NotNil(wg.Name)
	}
	require.NotNil(configList.EnvoyFilters)
	for _, ef := range configList.EnvoyFilters {
		require.True(ef.Namespace == namespace)
		require.NotNil(ef.Name)
	}
}

func TestIstioConfigDetails(t *testing.T) {
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-traffic-shifting-reviews.yaml")
	t.Cleanup(func() { utils.DeleteFile(filePath, kiali.BOOKINFO) })
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))
	name := "virtual-service-reviews"
	config, _, err := kiali.IstioConfigDetails(kiali.BOOKINFO, name, kubernetes.VirtualServices)

	require.NoError(err)
	require.NotNil(config)
	require.Equal(kubernetes.VirtualServices.String(), config.ObjectGVK.String())
	require.Equal(kiali.BOOKINFO, config.Namespace.Name)
	require.NotNil(config.VirtualService)
	require.Equal(name, config.VirtualService.Name)
	require.Equal(kiali.BOOKINFO, config.VirtualService.Namespace)
	require.NotNil(config.IstioReferences)
	require.NotNil(config.IstioValidation)
	require.Equal(name, config.IstioValidation.Name)
	require.Equal(kubernetes.VirtualServices.String(), config.IstioValidation.ObjectGVK.String())
	if !config.IstioValidation.Valid {
		require.NotEmpty(config.IstioValidation.References)
	}
}

func TestIstioConfigInvalidName(t *testing.T) {
	name := "invalid"
	require := require.New(t)
	config, code, _ := kiali.IstioConfigDetails(kiali.BOOKINFO, name, kubernetes.VirtualServices)
	require.NotEqual(200, code)
	require.Empty(config)
}

func TestIstioConfigPermissions(t *testing.T) {
	require := require.New(t)
	perms, err := kiali.IstioConfigPermissions(kiali.BOOKINFO)

	require.NoError(err)
	require.NotEmpty(perms)
	require.NotEmpty((*perms)[kiali.BOOKINFO])
	require.NotEmpty((*(*perms)[kiali.BOOKINFO])[kubernetes.AuthorizationPolicies.String()])
}
