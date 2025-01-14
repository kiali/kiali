package authorization

import (
	"testing"

	"github.com/stretchr/testify/assert"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestPresentServiceAccount(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	validations, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}),
		Cluster:             config.DefaultClusterID,
		ServiceAccounts:     map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}},
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestRegexPrincipalFound(t *testing.T) {
	assert := assert.New(t)

	validations, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"*local/ns/bookinfo/sa/default*", "*.local/ns/bookinfo/sa/test*"}),
		Cluster:             config.DefaultClusterID,
		ServiceAccounts:     map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default-a", "cluster.local/ns/bookinfo/sa/test-1"}},
	}.Check()

	// regex matches
	assert.True(valid)
	assert.Empty(validations)
}

func TestRegexPrincipalNotFound(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"*wronglocal/ns/bookinfo/sa/default*", "*.local/ns/bookinfo/sa/test1*"}),
		Cluster:             config.DefaultClusterID,
		ServiceAccounts:     map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default-a", "cluster.local/ns/bookinfo/sa/test-1"}},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[0]", vals[0].Path)
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[1]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[1]", vals[1].Path)
}

func TestEmptyPrincipals(t *testing.T) {
	assert := assert.New(t)

	validations, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{}),
		Cluster:             config.DefaultClusterID,
		ServiceAccounts:     map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}},
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestNotPresentServiceAccount(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"cluster.local/ns/bookinfo/sa/wrong", "test"}),
		Cluster:             config.DefaultClusterID,
		ServiceAccounts:     map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}},
	}.Check()

	// Wrong host is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[0]", vals[0].Path)
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[1]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[1]", vals[1].Path)
}

func TestRemoteClusterServiceAccount(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}),
		Cluster:             "east",
		ServiceAccounts:     map[string][]string{"west": {"cluster.local/ns/bookinfo/sa/default"}, "east": {"cluster.local/ns/bookinfo/sa/test"}},
	}.Check()

	// service account is on remote cluster
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalremote", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[0]", vals[0].Path)
}

func TestEmptyServiceAccount(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"cluster.local/ns/bookinfo/sa/wrong"}),
		ServiceAccounts:     map[string][]string{},
	}.Check()

	// Wrong host is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[0]", vals[0].Path)
}

func authPolicyWithPrincipals(principalsList []string) *security_v1.AuthorizationPolicy {
	return data.CreateAuthorizationPolicyWithPrincipals("auth-policy", "bookinfo", principalsList)
}
