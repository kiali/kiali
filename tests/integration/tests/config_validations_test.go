package tests

import (
	"path"
	"testing"

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

	config, _, err := utils.IstioConfigDetails(utils.BOOKINFO, name, kubernetes.AuthorizationPolicies)

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
