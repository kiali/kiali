package k8sreferencegrants

import (
	"github.com/kiali/kiali/tests/data"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestFromNamespaceExists(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vals, valid := NamespaceChecker{
		ReferenceGrant: *data.CreateReferenceGrant("test", "bookinfo", "default"),
		Namespaces: models.Namespaces{
			models.Namespace{Name: "bookinfo"},
			models.Namespace{Name: "bookinfo2"},
			models.Namespace{Name: "default"},
		},
	}.Check()

	assert.True(valid)
	assert.Empty(vals)
}

func TestFromNamespaceNotFound(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	vals, valid := NamespaceChecker{
		ReferenceGrant: *data.CreateReferenceGrant("test", "bookinfo", "bookinfo3"),
		Namespaces: models.Namespaces{
			models.Namespace{Name: "bookinfo"},
			models.Namespace{Name: "bookinfo2"},
			models.Namespace{Name: "default"},
		},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("k8sreferencegrants.from.namespacenotfound", vals[0]))
}
