package authorization

import (
	"testing"

	"github.com/stretchr/testify/assert"
	security_v1beta "istio.io/client-go/pkg/apis/security/v1beta1"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestPresentServiceAccount(t *testing.T) {
	assert := assert.New(t)

	validations, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}),
		ServiceAccounts:     []string{"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"},
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestEmptyPrincipals(t *testing.T) {
	assert := assert.New(t)

	validations, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{}),
		ServiceAccounts:     []string{"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"},
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestNotPresentServiceAccount(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"cluster.local/ns/bookinfo/sa/wrong", "test"}),
		ServiceAccounts:     []string{"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"},
	}.Check()

	// Wrong host is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.Error(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.principalnotfound", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[0]", vals[0].Path)
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.Error(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.principalnotfound", vals[1]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[1]", vals[1].Path)
}

func TestEmptyServiceAccount(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"cluster.local/ns/bookinfo/sa/wrong"}),
		ServiceAccounts:     []string{},
	}.Check()

	// Wrong host is not present
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.Error(validations.ConfirmIstioCheckMessage("authorizationpolicy.nodest.principalnotfound", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[0]", vals[0].Path)
}

func authPolicyWithPrincipals(principalsList []string) *security_v1beta.AuthorizationPolicy {
	return data.CreateAuthorizationPolicyWithPrincipals("auth-policy", "bookinfo", principalsList)
}
