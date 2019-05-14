package destinationrules

import (
	"testing"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/stretchr/testify/assert"
)

func TestMultiHostMatchCorrect(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
		data.CreateTestDestinationRule("test", "rule2", "host2.test.svc.cluster.local"),
	}

	validations := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(validations)
	validation, ok := validations[models.IstioValidationKey{ObjectType: "destinationrule", Name: "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func TestMultiHostMatchInvalid(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
		data.CreateTestDestinationRule("test", "rule2", "host1.test.svc.cluster.local"),
	}

	validations := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(validations)
	assert.Equal(2, len(validations))
	validation, ok := validations[models.IstioValidationKey{ObjectType: "destinationrule", Name: "rule2"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.Equal(models.CheckMessage("destinationrules.multimatch"), validation.Checks[0].Message)
}

func TestMultiHostMatchWildcardInvalid(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
		data.CreateTestDestinationRule("test", "rule2", "*.test.svc.cluster.local"),
	}

	validations := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(validations)
	validation, ok := validations[models.IstioValidationKey{ObjectType: "destinationrule", Name: "rule2"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

	destinationRules = []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "rule2", "*.test.svc.cluster.local"),
		data.CreateTestDestinationRule("test", "rule1", "host1"),
	}

	validations = MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(validations)
	validation, ok = validations[models.IstioValidationKey{ObjectType: "destinationrule", Name: "rule1"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

}

func TestMultiHostMatchingMeshWideMTLSDestinationRule(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateTestDestinationRule("test", "rule2", "*.local")),
	}

	validations := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(validations)
	validation, ok := validations[models.IstioValidationKey{ObjectType: "destinationrule", Name: "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func TestMultiHostMatchingNamespaceWideMTLSDestinationRule(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateTestDestinationRule("test", "rule2", "*.test.svc.cluster.local")),
	}

	validations := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(validations)
	validation, ok := validations[models.IstioValidationKey{ObjectType: "destinationrule", Name: "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func TestMultiHostMatchDifferentSubsets(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"),
			data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"), data.CreateEmptyDestinationRule("test", "rule1", "host1"))),
		data.AddSubsetToDestinationRule(data.CreateSubset("v3", "v3"),
			data.AddSubsetToDestinationRule(data.CreateSubset("v4", "v4"), data.CreateEmptyDestinationRule("test", "rule2", "host1"))),
	}

	validations := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(validations)

	destinationRules = append(destinationRules,
		data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"),
			data.AddSubsetToDestinationRule(data.CreateSubset("v5", "v5"), data.CreateEmptyDestinationRule("test", "rule5", "*.test.svc.cluster.local"))),
	)

	validations = MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(validations)
}

func TestReviewsExample(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []kubernetes.IstioObject{
		data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"),
			data.AddSubsetToDestinationRule(data.CreateSubset("v3", "v3"), data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews"))),
		data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"), data.CreateEmptyDestinationRule("bookinfo", "reviews2", "reviews")),
	}

	validations := MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(validations)

	allMatch := data.CreateEmptyDestinationRule("bookinfo", "reviews3", "reviews")
	allMatch.GetSpec()["subsets"] = "~"
	destinationRules = append(destinationRules, allMatch)

	validations = MultiMatchChecker{
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(validations)
	validation, ok := validations[models.IstioValidationKey{ObjectType: "destinationrule", Name: "reviews3"}]
	assert.True(ok)
	assert.True(validation.Valid)
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.Equal(1, len(validation.Checks))
}

func TestMultiServiceEntry(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	seA := data.AddPortDefinitionToServiceEntry(data.CreateEmptyPortDefinition(443, "https", "TLS"), data.CreateEmptyMeshExternalServiceEntry("service-a", "test", []string{"api.service_a.com"}))
	seB := data.AddPortDefinitionToServiceEntry(data.CreateEmptyPortDefinition(443, "https", "TLS"), data.CreateEmptyMeshExternalServiceEntry("service-b", "test", []string{"api.service_b.com"}))

	drA := data.CreateEmptyDestinationRule("test", "service-a", "api.service_a.com")
	drB := data.CreateEmptyDestinationRule("test", "service-b", "api.service_b.com")

	validations := MultiMatchChecker{
		DestinationRules: []kubernetes.IstioObject{drA, drB},
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]kubernetes.IstioObject{seA, seB}),
	}.Check()

	assert.Empty(validations)
}
