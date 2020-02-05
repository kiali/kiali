package authorization

import (
	"github.com/kiali/kiali/models"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/tests/data"
)

func TestSourceNamespaceExisting(t *testing.T) {
	assert := assert.New(t)

	validations, valid := FromNamespaceChecker{
		AuthorizationPolicy: sourceNamespaceAuthPolicy([]interface{} {"bookinfo", "bookinfo2"}),
		Namespaces:          []string{"bookinfo", "bookinfo2"},
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestSourceNamespaceNotFound(t *testing.T) {
	assert := assert.New(t)

	validations, valid := FromNamespaceChecker{
		AuthorizationPolicy: sourceNamespaceAuthPolicy([]interface{} {"wrong1", "wrong2"}),
		Namespaces:          []string{"bookinfo"},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 2)
	assert.Equal(validations[0].Message, models.CheckMessage("authorizationpolicy.source.namespacenotfound"))
	assert.Equal(validations[0].Severity, models.ErrorSeverity)
	assert.Equal(validations[0].Path, "spec/rules[0]/from[0]/source/namespaces[0]")
	assert.Equal(validations[1].Message, models.CheckMessage("authorizationpolicy.source.namespacenotfound"))
	assert.Equal(validations[1].Severity, models.ErrorSeverity)
	assert.Equal(validations[1].Path, "spec/rules[0]/from[0]/source/namespaces[1]")
}

func sourceNamespaceAuthPolicy(nss []interface{}) kubernetes.IstioObject {
	return data.CreateAuthorizationPolicy(nss)
}
