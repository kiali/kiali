package authorization

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils"
)

func TestSourceNamespaceExisting(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NamespaceMethodChecker{
		AuthorizationPolicy: sourceNamespaceAuthPolicy([]interface{}{"bookinfo", "bookinfo2"}),
		Namespaces:          []string{"bookinfo", "bookinfo2"},
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestSourceNamespaceNotFound(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NamespaceMethodChecker{
		AuthorizationPolicy: sourceNamespaceAuthPolicy([]interface{}{"wrong1", "wrong2"}),
		Namespaces:          []string{"bookinfo"},
	}.Check()

	assert.True(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 2)
	assert.NoError(testutils.ConfirmIstioCheckMessage("authorizationpolicy.source.namespacenotfound", validations[0]))
	assert.Equal(validations[0].Severity, models.WarningSeverity)
	assert.Equal(validations[0].Path, "spec/rules[0]/from[0]/source/namespaces[0]")
	assert.NoError(testutils.ConfirmIstioCheckMessage("authorizationpolicy.source.namespacenotfound", validations[1]))
	assert.Equal(validations[1].Severity, models.WarningSeverity)
	assert.Equal(validations[1].Path, "spec/rules[0]/from[0]/source/namespaces[1]")
}

func TestToMethodWrongHTTP(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NamespaceMethodChecker{
		AuthorizationPolicy: toMethodsAuthPolicy([]interface{}{
			"GET", "/grpc.package/method", "/grpc.package/subpackage/subpackage/method",
			"GOT", "WRONG", "/grpc.pkg/hello.method", "grpc.pkg/noinitialslash",
		}),
		Namespaces: []string{"bookinfo"},
	}.Check()

	assert.True(valid)
	assert.NotEmpty(validations)
	assert.Len(validations, 4)
	for i, m := range []int{3, 4, 5} {
		assert.NoError(testutils.ConfirmIstioCheckMessage("authorizationpolicy.to.wrongmethod", validations[i]))
		assert.Equal(validations[i].Severity, models.WarningSeverity)
		assert.Equal(validations[i].Path, fmt.Sprintf("spec/rules[0]/to[0]/operation/methods[%d]", m))
	}
}

func sourceNamespaceAuthPolicy(nss []interface{}) kubernetes.IstioObject {
	methods := []interface{}{"GET", "PUT", "PATCH"}
	selector := map[string]interface{}{"app": "details"}
	hosts := []interface{}{"details"}
	return data.CreateAuthorizationPolicy(nss, methods, hosts, selector)
}

func toMethodsAuthPolicy(methods []interface{}) kubernetes.IstioObject {
	nss := []interface{}{"bookinfo"}
	selector := map[string]interface{}{"app": "details"}
	hosts := []interface{}{"details"}
	return data.CreateAuthorizationPolicy(nss, methods, hosts, selector)
}
