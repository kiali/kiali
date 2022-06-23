package tests

import (
	"path"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
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

	config, err := getConfigDetails(utils.BOOKINFO, name, kubernetes.AuthorizationPolicies, assert)

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
	config, err := getConfigDetails(utils.BOOKINFO, name, kubernetes.DestinationRules, assert)
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
	config, err := getConfigDetails(utils.BOOKINFO, name, kubernetes.DestinationRules, assert)
	assert.Nil(err)
	assert.NotNil(config)
	assert.False(config.IstioValidation.Valid)
	assert.NotEmpty(config.IstioValidation.Checks)
	assert.Len(config.IstioValidation.Checks, 1)
	assert.Equal("This subset's labels are not found in any matching host", config.IstioValidation.Checks[0].Message)
}

func getConfigDetails(namespace, name, configType string, assert *assert.Assertions) (*models.IstioConfigDetails, error) {
	config, _, err := utils.IstioConfigDetails(namespace, name, configType)
	if err == nil && config != nil && config.IstioValidation != nil && config.IstioReferences != nil {
		return config, nil
	}
	pollErr := wait.Poll(time.Second, time.Minute, func() (bool, error) {
		config, _, err = utils.IstioConfigDetails(namespace, name, configType)
		if err == nil && config != nil && config.IstioValidation != nil && config.IstioReferences != nil {
			return true, nil
		}
		return false, nil
	})
	assert.Nil(pollErr)
	return config, nil
}
