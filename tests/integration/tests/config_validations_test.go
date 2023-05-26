package tests

import (
	"path"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tools/cmd"
)

func TestAuthPolicyPrincipalsError(t *testing.T) {
	name := "ratings-policy"
	assert := assert.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, utils.ASSETS+"/bookinfo-auth-policy-principals.yaml")
	defer utils.DeleteFile(filePath, utils.BOOKINFO)
	assert.True(utils.ApplyFile(filePath, utils.BOOKINFO))

	config, err := getConfigDetails(utils.BOOKINFO, name, kubernetes.AuthorizationPolicies, false, assert)

	assert.Nil(err)
	assert.NotNil(config)
	assert.Equal(kubernetes.AuthorizationPolicies, config.ObjectType)
	assert.Equal(utils.BOOKINFO, config.Namespace.Name)
	assert.NotNil(config.AuthorizationPolicy)
	assert.Equal(name, config.AuthorizationPolicy.Name)
	assert.Equal(utils.BOOKINFO, config.AuthorizationPolicy.Namespace)
	assert.NotNil(config.IstioReferences)
	assert.NotNil(config.IstioValidation)
	assert.Equal(name, config.IstioValidation.Name)
	assert.Equal("authorizationpolicy", config.IstioValidation.ObjectType)
	assert.False(config.IstioValidation.Valid)
	assert.Empty(config.IstioValidation.References)
	assert.NotEmpty(config.IstioValidation.Checks)
	assert.Len(config.IstioValidation.Checks, 1)
	assert.Equal(models.ErrorSeverity, config.IstioValidation.Checks[0].Severity)
	assert.Equal("Service Account not found for this principal", config.IstioValidation.Checks[0].Message)
}

func TestServiceEntryLabels(t *testing.T) {
	assert := assert.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, utils.ASSETS+"/bookinfo-service-entry-labels.yaml")
	defer utils.DeleteFile(filePath, utils.BOOKINFO)
	assert.True(utils.ApplyFile(filePath, utils.BOOKINFO))

	// the DR with matching labels with SE
	name := "dest-rule-labels"
	config, err := getConfigDetails(utils.BOOKINFO, name, kubernetes.DestinationRules, false, assert)
	assert.Nil(err)
	assert.NotNil(config)
	assert.True(config.IstioValidation.Valid)
	assert.Empty(config.IstioValidation.Checks)
}

func TestServiceEntryLabelsNotMatch(t *testing.T) {
	assert := assert.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, utils.ASSETS+"/bookinfo-service-entry-wrong-labels.yaml")
	defer utils.DeleteFile(filePath, utils.BOOKINFO)
	assert.True(utils.ApplyFile(filePath, utils.BOOKINFO))

	// the DR with error, labels not match with SE
	name := "dest-rule-labels-wrong"
	config, err := getConfigDetails(utils.BOOKINFO, name, kubernetes.DestinationRules, false, assert)
	assert.Nil(err)
	assert.NotNil(config)
	assert.False(config.IstioValidation.Valid)
	assert.NotEmpty(config.IstioValidation.Checks)
	assert.Len(config.IstioValidation.Checks, 1)
	assert.Equal("This subset's labels are not found in any matching host", config.IstioValidation.Checks[0].Message)
}

func TestK8sGatewaysAddressesError(t *testing.T) {
	name := "gatewayapi"
	assert := assert.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, utils.ASSETS+"/bookinfo-k8sgateways-addresses.yaml")
	defer utils.DeleteFile(filePath, utils.BOOKINFO)
	assert.True(utils.ApplyFile(filePath, utils.BOOKINFO))

	config, err := getConfigDetails(utils.BOOKINFO, name, kubernetes.K8sGateways, true, assert)

	assert.Nil(err)
	assert.NotNil(config)
	assert.Equal(kubernetes.K8sGateways, config.ObjectType)
	assert.Equal(utils.BOOKINFO, config.Namespace.Name)
	assert.NotNil(config.K8sGateway)
	assert.Equal(name, config.K8sGateway.Name)
	assert.Equal(utils.BOOKINFO, config.K8sGateway.Namespace)
	assert.NotNil(config.IstioValidation)
	assert.Equal(name, config.IstioValidation.Name)
	assert.Equal("k8sgateway", config.IstioValidation.ObjectType)
	assert.NotEmpty(config.IstioValidation.Checks)
	assert.Equal(models.WarningSeverity, config.IstioValidation.Checks[0].Severity)
	assert.Equal("More than one K8s Gateway for the same address and type combination", config.IstioValidation.Checks[0].Message)
}

func TestK8sGatewaysListenersError(t *testing.T) {
	name := "gatewayapi"
	assert := assert.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, utils.ASSETS+"/bookinfo-k8sgateways-listeners.yaml")
	defer utils.DeleteFile(filePath, utils.BOOKINFO)
	assert.True(utils.ApplyFile(filePath, utils.BOOKINFO))

	config, err := getConfigDetails(utils.BOOKINFO, name, kubernetes.K8sGateways, true, assert)

	assert.Nil(err)
	assert.NotNil(config)
	assert.Equal(kubernetes.K8sGateways, config.ObjectType)
	assert.Equal(utils.BOOKINFO, config.Namespace.Name)
	assert.NotNil(config.K8sGateway)
	assert.Equal(name, config.K8sGateway.Name)
	assert.Equal(utils.BOOKINFO, config.K8sGateway.Namespace)
	assert.NotNil(config.IstioValidation)
	assert.Equal(name, config.IstioValidation.Name)
	assert.Equal("k8sgateway", config.IstioValidation.ObjectType)
	assert.NotEmpty(config.IstioValidation.Checks)
	assert.Equal(models.WarningSeverity, config.IstioValidation.Checks[0].Severity)
	assert.Equal("More than one K8s Gateway for the same host port combination", config.IstioValidation.Checks[0].Message)
}

func TestK8sHTTPRoutesGatewaysError(t *testing.T) {
	name := "httproute"
	assert := assert.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, utils.ASSETS+"/bookinfo-k8shttproutes-gateways.yaml")
	defer utils.DeleteFile(filePath, utils.BOOKINFO)
	assert.True(utils.ApplyFile(filePath, utils.BOOKINFO))

	config, err := getConfigDetails(utils.BOOKINFO, name, kubernetes.K8sHTTPRoutes, true, assert)

	assert.Nil(err)
	assert.NotNil(config)
	assert.Equal(kubernetes.K8sHTTPRoutes, config.ObjectType)
	assert.Equal(utils.BOOKINFO, config.Namespace.Name)
	assert.NotNil(config.K8sHTTPRoute)
	assert.Equal(name, config.K8sHTTPRoute.Name)
	assert.Equal(utils.BOOKINFO, config.K8sHTTPRoute.Namespace)
	assert.NotNil(config.IstioValidation)
	assert.False(config.IstioValidation.Valid)
	assert.Equal(name, config.IstioValidation.Name)
	assert.Equal("k8shttproute", config.IstioValidation.ObjectType)
	assert.NotEmpty(config.IstioValidation.Checks)
	assert.Equal(models.ErrorSeverity, config.IstioValidation.Checks[0].Severity)
	assert.Equal("HTTPRoute is pointing to a non-existent K8s gateway", config.IstioValidation.Checks[0].Message)
}

func TestK8sHTTPRoutesServicesError(t *testing.T) {
	name := "httprouteservices"
	assert := assert.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, utils.ASSETS+"/bookinfo-k8shttproutes-services.yaml")
	defer utils.DeleteFile(filePath, utils.BOOKINFO)
	assert.True(utils.ApplyFile(filePath, utils.BOOKINFO))

	config, err := getConfigDetails(utils.BOOKINFO, name, kubernetes.K8sHTTPRoutes, true, assert)

	assert.Nil(err)
	assert.NotNil(config)
	assert.Equal(kubernetes.K8sHTTPRoutes, config.ObjectType)
	assert.Equal(utils.BOOKINFO, config.Namespace.Name)
	assert.NotNil(config.K8sHTTPRoute)
	assert.Equal(name, config.K8sHTTPRoute.Name)
	assert.Equal(utils.BOOKINFO, config.K8sHTTPRoute.Namespace)
	assert.NotNil(config.IstioValidation)
	assert.False(config.IstioValidation.Valid)
	assert.Equal(name, config.IstioValidation.Name)
	assert.Equal("k8shttproute", config.IstioValidation.ObjectType)
	assert.NotEmpty(config.IstioValidation.Checks)
	assert.Equal(models.ErrorSeverity, config.IstioValidation.Checks[0].Severity)
	assert.Equal("BackendRef on rule doesn't have a valid service (host not found)", config.IstioValidation.Checks[0].Message)
}

func getConfigDetails(namespace, name, configType string, skipReferences bool, assert *assert.Assertions) (*models.IstioConfigDetails, error) {
	config, _, err := utils.IstioConfigDetails(namespace, name, configType)
	if err == nil && config != nil && config.IstioValidation != nil && config.IstioReferences != nil {
		return config, nil
	}
	pollErr := wait.Poll(time.Second, time.Minute*5, func() (bool, error) {
		config, _, err = utils.IstioConfigDetails(namespace, name, configType)
		if err == nil && config != nil && config.IstioValidation != nil {
			if !skipReferences && config.IstioReferences != nil {
				return true, nil
			} else if skipReferences {
				return true, nil
			}
		}
		return false, nil
	})
	assert.Nil(pollErr)
	return config, nil
}

func getConfigForNamespace(namespace, name, configType string) (*models.IstioConfigDetails, error) {
	config, _, err := utils.IstioConfigDetails(namespace, name, configType)
	log.Debugf("Config response returned: %+v", config)
	return config, err
}
