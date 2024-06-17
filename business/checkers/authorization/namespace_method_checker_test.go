package authorization

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestSourceNamespaceExisting(t *testing.T) {
	assert := assert.New(t)

	validations, valid := NamespaceMethodChecker{
		AuthorizationPolicy: sourceNamespaceAuthPolicy([]string{"bookinfo", "bookinfo2"}),
		Namespaces:          []string{"bookinfo", "bookinfo2"},
	}.Check()

	// Well configured object
	assert.True(valid)
	assert.Empty(validations)
}

func TestSourceNamespaceNotFound(t *testing.T) {
	assert := assert.New(t)

	vals, valid := NamespaceMethodChecker{
		AuthorizationPolicy: sourceNamespaceAuthPolicy([]string{"wrong1", "wrong2"}),
		Namespaces:          []string{"bookinfo"},
	}.Check()

	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.namespacenotfound", vals[0]))
	assert.Equal(vals[0].Severity, models.WarningSeverity)
	assert.Equal(vals[0].Path, "spec/rules[0]/from[0]/source/namespaces[0]")
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.namespacenotfound", vals[1]))
	assert.Equal(vals[1].Severity, models.WarningSeverity)
	assert.Equal(vals[1].Path, "spec/rules[0]/from[0]/source/namespaces[1]")
}

func TestToMethodWrongHTTP(t *testing.T) {
	assert := assert.New(t)

	vals, valid := NamespaceMethodChecker{
		AuthorizationPolicy: toMethodsAuthPolicy([]string{
			"GET", "/grpc.package/method", "/grpc.package/subpackage/subpackage/method",
			"GOT", "WRONG", "/grpc.pkg/hello.method", "grpc.pkg/noinitialslash",
		}),
		Namespaces: []string{"bookinfo"},
	}.Check()

	assert.True(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 4)
	for i, m := range []int{3, 4, 5} {
		assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.to.wrongmethod", vals[i]))
		assert.Equal(vals[i].Severity, models.WarningSeverity)
		assert.Equal(vals[i].Path, fmt.Sprintf("spec/rules[0]/to[0]/operation/methods[%d]", m))
	}
}

func sourceNamespaceAuthPolicy(nss []string) *security_v1.AuthorizationPolicy {
	methods := []string{"GET", "PUT", "PATCH"}
	selector := map[string]string{"app": "details"}
	hosts := []string{"details"}
	return data.CreateAuthorizationPolicy(nss, methods, hosts, selector)
}

func toMethodsAuthPolicy(methods []string) *security_v1.AuthorizationPolicy {
	nss := []string{"bookinfo"}
	selector := map[string]string{"app": "details"}
	hosts := []string{"details"}
	return data.CreateAuthorizationPolicy(nss, methods, hosts, selector)
}
