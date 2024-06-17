package destinationrules

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestMultiHostMatchCorrect(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
		data.CreateTestDestinationRule("test", "rule2", "host2.test.svc.cluster.local"),
	}

	vals := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func TestMultiHostMatchInvalid(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
		data.CreateTestDestinationRule("test", "rule2", "host1.test.svc.cluster.local"),
		data.CreateTestDestinationRule("test", "rule3", "host1"),
	}

	vals := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(3, len(vals))

	// Rule1 assertions
	validationAssertion(assert, vals, "rule1", []string{"rule2", "rule3"})
	validationAssertion(assert, vals, "rule2", []string{"rule1", "rule3"})
	validationAssertion(assert, vals, "rule3", []string{"rule1", "rule2"})
}

func validationAssertion(assert *assert.Assertions, vals models.IstioValidations, drName string, refNames []string) {
	validation, ok := vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: drName}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.multimatch", validation.Checks[0]))

	assert.NotEmpty(validation.References)
	for _, refName := range refNames {
		assert.Contains(validation.References,
			models.IstioValidationKey{
				ObjectType: "destinationrule",
				Namespace:  "test",
				Name:       refName,
			},
		)
	}
}

func TestMultiHostMatchInvalidShortFormat(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
		data.CreateTestDestinationRule("test", "rule2", "host1.test"),
	}

	vals := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
	validation, ok := vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "rule2"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.multimatch", validation.Checks[0]))

	assert.NotEmpty(validation.References)
	assert.Equal("rule1", validation.References[0].Name)
}

func TestMultiHostMatchValidShortFormat(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
		data.CreateTestDestinationRule("test", "rule2", "host2.test"),
	}

	vals := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func TestMultiHostMatchValidShortFormatDiffNamespace(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
		data.CreateTestDestinationRule("test", "rule2", "host2.bookinfo"),
	}

	vals := MultiMatchChecker{
		Namespaces: models.Namespaces{
			models.Namespace{Name: "bookinfo"},
			models.Namespace{Name: "test"},
		},
		DestinationRules: destinationRules,
	}.Check()

	// MultiMatchChecker shouldn't fail if a host is in a different namespace
	assert.Empty(vals)
}

func TestMultiHostMatchWildcardInvalid(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
		data.CreateTestDestinationRule("test", "rule2", "*.test.svc.cluster.local"),
	}

	vals := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "rule2"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

	assert.NotEmpty(validation.References)
	assert.Equal("rule1", validation.References[0].Name)

	destinationRules = []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule2", "*.test.svc.cluster.local"),
		data.CreateTestDestinationRule("test", "rule1", "host1"),
	}

	vals = MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
	validation, ok = vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "rule1"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

	assert.NotEmpty(validation.References)
	assert.Equal("rule2", validation.References[0].Name)
}

func TestMultiHostMatchBothWildcardInvalid(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "*"),
		data.CreateTestDestinationRule("test", "rule2", "*.test.svc.cluster.local"),
	}

	vals := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "rule2"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

	assert.NotEmpty(validation.References)
	assert.Equal("rule1", validation.References[0].Name)

	destinationRules = []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule2", "*.test.svc.cluster.local"),
		data.CreateTestDestinationRule("test", "rule1", "*"),
	}

	vals = MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
	validation, ok = vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "rule1"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

	assert.NotEmpty(validation.References)
	assert.Equal("rule2", validation.References[0].Name)
}

func TestMultiHostMatchingMeshWideMTLSDestinationRule(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateTestDestinationRule("test", "rule2", "*.local")),
	}

	vals := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func TestMultiHostMatchingNamespaceWideMTLSDestinationRule(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateTestDestinationRule("test", "rule2", "*.test.svc.cluster.local")),
	}

	vals := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func TestMultiHostMatchDifferentSubsets(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"),
			data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"), data.CreateEmptyDestinationRule("test", "rule1", "host1"))),
		data.AddSubsetToDestinationRule(data.CreateSubset("v3", "v3"),
			data.AddSubsetToDestinationRule(data.CreateSubset("v4", "v4"), data.CreateEmptyDestinationRule("test", "rule2", "host1"))),
	}

	vals := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(vals)

	destinationRules = append(destinationRules,
		data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"),
			data.AddSubsetToDestinationRule(data.CreateSubset("v5", "v5"), data.CreateEmptyDestinationRule("test", "rule5", "*.test.svc.cluster.local"))),
	)

	vals = MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
}

func TestReviewsExample(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"),
			data.AddSubsetToDestinationRule(data.CreateSubset("v3", "v3"), data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews"))),
		data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"), data.CreateEmptyDestinationRule("bookinfo", "reviews2", "reviews")),
	}

	vals := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(vals)

	allMatch := data.CreateEmptyDestinationRule("bookinfo", "reviews3", "reviews")
	destinationRules = append(destinationRules, allMatch)

	vals = MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(3, len(vals))
	validation, ok := vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "bookinfo", Name: "reviews3"}]
	assert.True(ok)
	assert.True(validation.Valid)
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.Equal(1, len(validation.Checks))

	assert.Equal(2, len(validation.References)) // Both reviews and reviews2 is faulty
}

func TestMultiServiceEntry(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	seA := data.AddPortDefinitionToServiceEntry(data.CreateEmptyServicePortDefinition(443, "https", "TLS"), data.CreateEmptyMeshExternalServiceEntry("service-a", "test", []string{"api.service_a.com"}))
	seB := data.AddPortDefinitionToServiceEntry(data.CreateEmptyServicePortDefinition(443, "https", "TLS"), data.CreateEmptyMeshExternalServiceEntry("service-b", "test", []string{"api.service_b.com"}))

	drA := data.CreateEmptyDestinationRule("test", "service-a", "api.service_a.com")
	drB := data.CreateEmptyDestinationRule("test", "service-b", "api.service_b.com")

	vals := MultiMatchChecker{
		DestinationRules: []*networking_v1.DestinationRule{drA, drB},
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{seA, seB}),
	}.Check()

	assert.Empty(vals)
}

func TestMultiServiceEntryInvalid(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	seA := data.AddPortDefinitionToServiceEntry(data.CreateEmptyServicePortDefinition(443, "https", "TLS"), data.CreateEmptyMeshExternalServiceEntry("service-a", "test", []string{"api.service_a.com"}))

	drA := data.CreateEmptyDestinationRule("test", "service-a", "api.service_a.com")
	drB := data.CreateEmptyDestinationRule("test", "service-a2", "api.service_a.com")

	vals := MultiMatchChecker{
		DestinationRules: []*networking_v1.DestinationRule{drA, drB},
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{seA}),
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
	validation, ok := vals[models.IstioValidationKey{ObjectType: "destinationrule", Namespace: "test", Name: "service-a2"}]
	assert.True(ok)
	assert.True(validation.Valid)
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.Equal(1, len(validation.Checks))

	assert.Equal(1, len(validation.References)) // Both reviews and reviews2 is faulty
}
