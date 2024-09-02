package tests

import (
	"context"
	"fmt"
	"path"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/log"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/integration/utils"
	"github.com/kiali/kiali/tests/integration/utils/kiali"
	"github.com/kiali/kiali/tools/cmd"
)

func TestDestinationRuleMultimatch(t *testing.T) {
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-destination-rule-multimatch.yaml")
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))

	config, err := getConfigDetails(kiali.BOOKINFO, "all.googleapis.com", kubernetes.DestinationRules, false, require)
	require.NoError(err)
	require.NotNil(config)
	assertConfigDetailsValidations(*config, kiali.BOOKINFO, "destinationrule", "all.googleapis.com", "KIA0201", true, require)

	configList, err := kiali.IstioConfigsList(kiali.BOOKINFO)

	require.NoError(err)
	assertConfigListValidations(*configList, kiali.BOOKINFO, "destinationrule", "all.googleapis.com", "KIA0201", true, require)
	assertConfigListValidations(*configList, kiali.BOOKINFO, "destinationrule", "all.googleapis.com2", "KIA0201", true, require)
}

func TestAuthPolicyPrincipalsError(t *testing.T) {
	name := "ratings-policy"
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-auth-policy-principals.yaml")
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))

	config, err := getConfigDetails(kiali.BOOKINFO, name, kubernetes.AuthorizationPolicies, false, require)

	require.NoError(err)
	require.NotNil(config)
	require.Equal(kubernetes.AuthorizationPolicies, config.ObjectType)
	require.Equal(kiali.BOOKINFO, config.Namespace.Name)
	require.NotNil(config.AuthorizationPolicy)
	require.Equal(name, config.AuthorizationPolicy.Name)
	require.Equal(kiali.BOOKINFO, config.AuthorizationPolicy.Namespace)
	require.NotNil(config.IstioReferences)
	require.NotNil(config.IstioValidation)
	require.Equal(name, config.IstioValidation.Name)
	require.Equal("authorizationpolicy", config.IstioValidation.ObjectType)
	require.False(config.IstioValidation.Valid)
	require.Empty(config.IstioValidation.References)
	require.NotEmpty(config.IstioValidation.Checks)
	require.Len(config.IstioValidation.Checks, 1)
	require.Equal(models.ErrorSeverity, config.IstioValidation.Checks[0].Severity)
	require.Equal("Service Account not found for this principal", config.IstioValidation.Checks[0].Message)
}

func TestServiceEntryLabels(t *testing.T) {
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-service-entry-labels.yaml")
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))

	// the DR with matching labels with SE
	name := "dest-rule-labels"
	config, err := getConfigDetails(kiali.BOOKINFO, name, kubernetes.DestinationRules, false, require)
	require.NoError(err)
	require.NotNil(config)
	require.True(config.IstioValidation.Valid)
	require.Empty(config.IstioValidation.Checks)
}

func TestServiceEntryLabelsNotMatch(t *testing.T) {
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-service-entry-wrong-labels.yaml")
	require.True(utils.ApplyFileWithCleanup(t, filePath, kiali.BOOKINFO))

	// There's multiple objects in the file, so we need to ensure that Kiali has seen both the destination rules
	// and the service entries get created before we can check the validation. There's some delay between when
	// the object gets created with Apply here in the tests and when the Kiali API's kubernetes cache is updated to have the
	// object in it.
	_, err := getConfigDetails(kiali.BOOKINFO, "service-entry-labels", kubernetes.ServiceEntries, false, require)
	require.NoError(err)

	// the DR with error, labels not match with SE
	name := "dest-rule-labels-wrong"
	config, err := getConfigDetails(kiali.BOOKINFO, name, kubernetes.DestinationRules, false, require)
	require.NoError(err)
	require.NotNil(config)
	require.False(config.IstioValidation.Valid)
	require.NotEmpty(config.IstioValidation.Checks)
	require.Len(config.IstioValidation.Checks, 1)
	require.Equal("This subset's labels are not found in any matching host", config.IstioValidation.Checks[0].Message)
}

func TestK8sGatewaysAddressesError(t *testing.T) {
	name := "gatewayapiaddr"
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-k8sgateways-addresses.yaml")
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))

	// flaky test fix, make sure that K8sGateway is created and available
	config, err := getConfigDetails(kiali.BOOKINFO, "gatewayapiaddr2", kubernetes.K8sGateways, true, require)
	require.NoError(err)
	require.NotNil(config)

	config, err = getConfigDetails(kiali.BOOKINFO, name, kubernetes.K8sGateways, true, require)

	require.NoError(err)
	require.NotNil(config)
	require.Equal(kubernetes.K8sGateways, config.ObjectType)
	require.Equal(kiali.BOOKINFO, config.Namespace.Name)
	require.NotNil(config.K8sGateway)
	require.Equal(name, config.K8sGateway.Name)
	require.Equal(kiali.BOOKINFO, config.K8sGateway.Namespace)
	require.NotNil(config.IstioValidation)
	require.Equal(name, config.IstioValidation.Name)
	require.Equal("k8sgateway", config.IstioValidation.ObjectType)
	require.NotEmpty(config.IstioValidation.Checks)
	require.Equal(models.WarningSeverity, config.IstioValidation.Checks[0].Severity)
	require.Equal("More than one K8s Gateway for the same address and type combination", config.IstioValidation.Checks[0].Message)
}

func TestK8sGatewaysListenersError(t *testing.T) {
	name := "gatewayapilnr"
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-k8sgateways-listeners.yaml")
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))

	// flaky test fix, make sure that K8sGateway is created and available
	config, err := getConfigDetails(kiali.BOOKINFO, "gatewayapilnr2", kubernetes.K8sGateways, true, require)
	require.NoError(err)
	require.NotNil(config)

	config, err = getConfigDetails(kiali.BOOKINFO, name, kubernetes.K8sGateways, true, require)

	require.NoError(err)
	require.NotNil(config)
	require.Equal(kubernetes.K8sGateways, config.ObjectType)
	require.Equal(kiali.BOOKINFO, config.Namespace.Name)
	require.NotNil(config.K8sGateway)
	require.Equal(name, config.K8sGateway.Name)
	require.Equal(kiali.BOOKINFO, config.K8sGateway.Namespace)
	require.NotNil(config.IstioValidation)
	require.Equal(name, config.IstioValidation.Name)
	require.Equal("k8sgateway", config.IstioValidation.ObjectType)
	require.NotEmpty(config.IstioValidation.Checks)
	require.Equal(models.WarningSeverity, config.IstioValidation.Checks[0].Severity)
	require.Equal("More than one K8s Gateway for the same host port combination", config.IstioValidation.Checks[0].Message)
}

func TestK8sHTTPRoutesGatewaysError(t *testing.T) {
	name := "httproute"
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-k8shttproutes-gateways.yaml")
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))

	config, err := getConfigDetails(kiali.BOOKINFO, name, kubernetes.K8sHTTPRoutes, true, require)

	require.NoError(err)
	require.NotNil(config)
	require.Equal(kubernetes.K8sHTTPRoutes, config.ObjectType)
	require.Equal(kiali.BOOKINFO, config.Namespace.Name)
	require.NotNil(config.K8sHTTPRoute)
	require.Equal(name, config.K8sHTTPRoute.Name)
	require.Equal(kiali.BOOKINFO, config.K8sHTTPRoute.Namespace)
	require.NotNil(config.IstioValidation)
	require.False(config.IstioValidation.Valid)
	require.Equal(name, config.IstioValidation.Name)
	require.Equal("k8shttproute", config.IstioValidation.ObjectType)
	require.NotEmpty(config.IstioValidation.Checks)
	require.Equal(models.ErrorSeverity, config.IstioValidation.Checks[0].Severity)
	require.Equal("Route is pointing to a non-existent or inaccessible K8s gateway", config.IstioValidation.Checks[0].Message)
}

func TestK8sHTTPRoutesServicesError(t *testing.T) {
	name := "httprouteservices"
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-k8shttproutes-services.yaml")
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))

	// flaky test fix, make sure that K8sGateway is created and available
	config, err := getConfigDetails(kiali.BOOKINFO, "gatewayapiservices", kubernetes.K8sGateways, true, require)
	require.NoError(err)
	require.NotNil(config)

	config, err = getConfigDetails(kiali.BOOKINFO, name, kubernetes.K8sHTTPRoutes, true, require)

	require.NoError(err)
	require.NotNil(config)
	require.Equal(kubernetes.K8sHTTPRoutes, config.ObjectType)
	require.Equal(kiali.BOOKINFO, config.Namespace.Name)
	require.NotNil(config.K8sHTTPRoute)
	require.Equal(name, config.K8sHTTPRoute.Name)
	require.Equal(kiali.BOOKINFO, config.K8sHTTPRoute.Namespace)
	require.NotNil(config.IstioValidation)
	require.False(config.IstioValidation.Valid)
	require.Equal(name, config.IstioValidation.Name)
	require.Equal("k8shttproute", config.IstioValidation.ObjectType)
	require.NotEmpty(config.IstioValidation.Checks)
	require.Equal(models.ErrorSeverity, config.IstioValidation.Checks[0].Severity)
	require.Equal("Reference doesn't have a valid service (Service name not found)", config.IstioValidation.Checks[0].Message)
}

func TestK8sGRPCRoutesGatewaysError(t *testing.T) {
	name := "grpcroute"
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-k8sgrpcroutes-gateways.yaml")
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))

	config, err := getConfigDetails(kiali.BOOKINFO, name, kubernetes.K8sGRPCRoutes, true, require)

	require.NoError(err)
	require.NotNil(config)
	require.Equal(kubernetes.K8sGRPCRoutes, config.ObjectType)
	require.Equal(kiali.BOOKINFO, config.Namespace.Name)
	require.NotNil(config.K8sGRPCRoute)
	require.Equal(name, config.K8sGRPCRoute.Name)
	require.Equal(kiali.BOOKINFO, config.K8sGRPCRoute.Namespace)
	require.NotNil(config.IstioValidation)
	require.False(config.IstioValidation.Valid)
	require.Equal(name, config.IstioValidation.Name)
	require.Equal("k8sgrpcroute", config.IstioValidation.ObjectType)
	require.NotEmpty(config.IstioValidation.Checks)
	require.Equal(models.ErrorSeverity, config.IstioValidation.Checks[0].Severity)
	require.Equal("Route is pointing to a non-existent or inaccessible K8s gateway", config.IstioValidation.Checks[0].Message)
}

func TestK8sGRPCRoutesServicesError(t *testing.T) {
	name := "grpcrouteservices"
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-k8sgrpcroutes-services.yaml")
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))

	// flaky test fix, make sure that K8sGateway is created and available
	config, err := getConfigDetails(kiali.BOOKINFO, "gatewayapiservices", kubernetes.K8sGateways, true, require)
	require.NoError(err)
	require.NotNil(config)

	config, err = getConfigDetails(kiali.BOOKINFO, name, kubernetes.K8sGRPCRoutes, true, require)

	require.NoError(err)
	require.NotNil(config)
	require.Equal(kubernetes.K8sGRPCRoutes, config.ObjectType)
	require.Equal(kiali.BOOKINFO, config.Namespace.Name)
	require.NotNil(config.K8sGRPCRoute)
	require.Equal(name, config.K8sGRPCRoute.Name)
	require.Equal(kiali.BOOKINFO, config.K8sGRPCRoute.Namespace)
	require.NotNil(config.IstioValidation)
	require.False(config.IstioValidation.Valid)
	require.Equal(name, config.IstioValidation.Name)
	require.Equal("k8sgrpcroute", config.IstioValidation.ObjectType)
	require.NotEmpty(config.IstioValidation.Checks)
	require.Equal(models.ErrorSeverity, config.IstioValidation.Checks[0].Severity)
	require.Equal("Reference doesn't have a valid service (Service name not found)", config.IstioValidation.Checks[0].Message)
}

func TestK8sReferenceGrantsFromNamespaceError(t *testing.T) {
	name := "referencegrantfromns"
	require := require.New(t)
	filePath := path.Join(cmd.KialiProjectRoot, kiali.ASSETS+"/bookinfo-k8sreferencegrants-from-namespaces.yaml")
	defer utils.DeleteFile(filePath, kiali.BOOKINFO)
	require.True(utils.ApplyFile(filePath, kiali.BOOKINFO))

	// potential flaky test fix, make sure that K8sReferenceGrants is created and available
	config, err := getConfigDetails(kiali.BOOKINFO, name, kubernetes.K8sReferenceGrants, true, require)
	require.NoError(err)
	require.NotNil(config)

	config, err = getConfigDetails(kiali.BOOKINFO, name, kubernetes.K8sReferenceGrants, true, require)

	require.NoError(err)
	require.NotNil(config)
	require.Equal(kubernetes.K8sReferenceGrants, config.ObjectType)
	require.Equal(kiali.BOOKINFO, config.Namespace.Name)
	require.NotNil(config.K8sReferenceGrant)
	require.Equal(name, config.K8sReferenceGrant.Name)
	require.Equal(kiali.BOOKINFO, config.K8sReferenceGrant.Namespace)
	require.NotNil(config.IstioValidation)
	require.False(config.IstioValidation.Valid)
	require.Equal(name, config.IstioValidation.Name)
	require.Equal("k8sreferencegrant", config.IstioValidation.ObjectType)
	require.NotEmpty(config.IstioValidation.Checks)
	require.Equal(models.ErrorSeverity, config.IstioValidation.Checks[0].Severity)
	require.Equal("Namespace is not found or is not accessible", config.IstioValidation.Checks[0].Message)
}

func getConfigDetails(namespace, name, configType string, skipReferences bool, require *require.Assertions) (*models.IstioConfigDetails, error) {
	ctx := context.TODO()
	config, _, err := kiali.IstioConfigDetails(namespace, name, configType)
	if err == nil && config != nil && config.IstioValidation != nil && config.IstioReferences != nil {
		return config, nil
	}

	pollErr := wait.PollUntilContextTimeout(ctx, time.Second, time.Minute*5, false, func(ctx context.Context) (bool, error) {
		config, _, err = kiali.IstioConfigDetails(namespace, name, configType)
		if err == nil && config != nil && config.IstioValidation != nil {
			if !skipReferences && config.IstioReferences != nil {
				return true, nil
			} else if skipReferences {
				return true, nil
			}
		}
		return false, nil
	})
	require.Nil(pollErr)
	return config, nil
}

func getConfigForNamespace(namespace, name, configType string) (*models.IstioConfigDetails, error) {
	config, _, err := kiali.IstioConfigDetails(namespace, name, configType)
	log.Debugf("Config response returned: %+v", config)
	return config, err
}

func assertConfigListValidations(configList kiali.IstioConfigListJson, namespace, objType, objName, code string, valid bool, require *require.Assertions) {
	require.NotEmpty(configList)
	require.NotNil(configList.IstioValidations)
	require.NotNil(configList.IstioValidations[objType])
	objKey := fmt.Sprintf("%s.%s", objName, namespace)
	require.NotNil(configList.IstioValidations[objType][objKey])
	require.Equal(valid, configList.IstioValidations[objType][objKey].Valid)
	require.NotEmpty(configList.IstioValidations[objType][objKey].Checks)
	require.Equal(code, configList.IstioValidations[objType][objKey].Checks[0].Code)
}

func assertConfigDetailsValidations(configDetails models.IstioConfigDetails, namespace, objType, objName, code string, valid bool, require *require.Assertions) {
	require.NotEmpty(configDetails)
	require.NotNil(configDetails.IstioValidation)
	require.Equal(namespace, configDetails.IstioValidation.Namespace)
	require.Equal(objType, configDetails.IstioValidation.ObjectType)
	require.Equal(objName, configDetails.IstioValidation.Name)
	require.Equal(valid, configDetails.IstioValidation.Valid)
	require.NotEmpty(configDetails.IstioValidation.Checks)
	require.Equal(code, configDetails.IstioValidation.Checks[0].Code)
}
