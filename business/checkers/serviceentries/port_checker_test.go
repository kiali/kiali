package serviceentries

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestValidPortDefinition(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	se := data.AddPortDefinitionToServiceEntry(
		data.CreateEmptyServicePortDefinition(80, "http", "HTTP"),
		data.CreateEmptyMeshExternalServiceEntry("valid-se", "test", []string{"localhost"}),
	)

	pc := PortChecker{ServiceEntry: se}
	vals, valid := pc.Check()
	assert.True(valid)
	assert.Empty(vals)
}

func TestInvalidPortDefinition(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	se := data.AddPortDefinitionToServiceEntry(
		data.CreateEmptyServicePortDefinition(80, "example-http", "HTTP"),
		data.CreateEmptyMeshExternalServiceEntry("notvalid-se", "test", []string{"localhost"}),
	)

	pc := PortChecker{ServiceEntry: se}
	vals, valid := pc.Check()
	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("port.name.mismatch", vals[0]))
	assert.Equal("spec/ports[0]/name", vals[0].Path)
}
