package authorization

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"

	"github.com/stretchr/testify/assert"
	core_v1 "k8s.io/api/core/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestMatching(t *testing.T) {
	assert := assert.New(t)

	sc := ServiceChecker{
		Services: getFourServices(),
	}

	assert.True(sc.hasMatchingService("service1"))
	assert.True(sc.hasMatchingService("*"))
	assert.True(sc.hasMatchingService("service2*"))

	assert.False(sc.hasMatchingService("service3"))
}

func TestServiceRoleValid(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Short format
	sr := data.AddServicesToServiceRole([]string{"service1"}, data.CreateEmptyServiceRole("sr1", "test"))
	sc := ServiceChecker{
		ServiceRole: sr,
		Services:    getFourServices(),
	}

	_, valid := sc.Check()
	assert.True(valid)

	// FQDN format
	sr = data.AddServicesToServiceRole([]string{"service*.test.svc.cluster.local"}, data.CreateEmptyServiceRole("sr2", "test"))
	sc = ServiceChecker{
		ServiceRole: sr,
		Services:    getFourServices(),
	}

	_, valid = sc.Check()
	assert.True(valid)
}

func TestServiceRoleInvalid(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	sr := data.AddServicesToServiceRole([]string{"service3"}, data.CreateEmptyServiceRole("sr1", "test"))
	sc := ServiceChecker{
		ServiceRole: sr,
		Services:    getFourServices(),
	}

	checks, valid := sc.Check()
	assert.False(valid)
	assert.NotEmpty(checks)
	assert.Equal(models.CheckMessage("servicerole.invalid.services"), checks[0].Message)
}

func TestServiceRoleOnlyLocalNamespace(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	sr := data.AddServicesToServiceRole([]string{"service21.testoops.svc.cluster.local"}, data.CreateEmptyServiceRole("sr1", "test"))
	sc := ServiceChecker{
		ServiceRole: sr,
		Services:    getFourServices(),
	}

	checks, valid := sc.Check()
	assert.False(valid)
	assert.NotEmpty(checks)
	assert.Equal(models.CheckMessage("servicerole.invalid.namespace"), checks[0].Message)
}

func getFourServices() []core_v1.Service {
	return []core_v1.Service{
		core_v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "service1",
			},
		},
		core_v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "service2",
			},
		},
		core_v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "service21",
			},
		},
		core_v1.Service{
			ObjectMeta: meta_v1.ObjectMeta{
				Name: "service22",
			},
		},
	}
}
