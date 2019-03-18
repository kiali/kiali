package authorization

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

func TestServiceRoleMatchingValid(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	sbc := BindingChecker{
		ServiceRoles:       []kubernetes.IstioObject{data.AddServicesToServiceRole([]string{"service1"}, data.CreateEmptyServiceRole("sr1", "test"))},
		ServiceRoleBinding: data.AddRoleRefToServiceBindingRole("sr1", data.CreateEmptyServiceBindingRole("testBind", "test")),
	}

	checks, valid := sbc.Check()
	assert.True(valid)
	assert.Empty(checks)
}

func TestServiceRoleMisMatch(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	sbc := BindingChecker{
		ServiceRoles:       []kubernetes.IstioObject{data.AddServicesToServiceRole([]string{"service1"}, data.CreateEmptyServiceRole("sr1", "test"))},
		ServiceRoleBinding: data.AddRoleRefToServiceBindingRole("sr2", data.CreateEmptyServiceBindingRole("testBind", "test")),
	}

	checks, valid := sbc.Check()
	assert.False(valid)
	assert.NotEmpty(checks)
	assert.Equal(models.CheckMessage("servicerolebinding.invalid.role"), checks[0].Message)
}
