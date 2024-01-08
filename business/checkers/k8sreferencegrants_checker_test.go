package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	k8s_networking_v1beta1 "sigs.k8s.io/gateway-api/apis/v1beta1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestNoCrashOnEmptyGrant(t *testing.T) {
	assert := assert.New(t)

	typeValidations := K8sReferenceGrantChecker{
		K8sReferenceGrants: []*k8s_networking_v1beta1.ReferenceGrant{},
		Namespaces:         models.Namespaces{},
	}.Check()

	assert.Empty(typeValidations)
}

func TestMissingFromNamespace(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	assert := assert.New(t)

	vals := K8sReferenceGrantChecker{
		K8sReferenceGrants: []*k8s_networking_v1beta1.ReferenceGrant{
			data.CreateReferenceGrant("grant1", "bookinfo", "bookinfo3"),
			data.CreateReferenceGrant("grant2", "bookinfo3", "default")},
		Namespaces: models.Namespaces{
			models.Namespace{Name: "bookinfo"},
			models.Namespace{Name: "bookinfo2"},
		},
	}.Check()

	assert.NotEmpty(vals)

	grant1 := vals[models.IstioValidationKey{ObjectType: "k8sreferencegrant", Namespace: "bookinfo", Name: "grant1"}]
	assert.False(grant1.Valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sreferencegrants.from.namespacenotfound", grant1.Checks[0]))
	grant2 := vals[models.IstioValidationKey{ObjectType: "k8sreferencegrant", Namespace: "bookinfo3", Name: "grant2"}]
	assert.False(grant2.Valid)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sreferencegrants.from.namespacenotfound", grant2.Checks[0]))
}
