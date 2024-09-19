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

func TestExportMultiHostMatchCorrect(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
	}

	edr := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "host2.test2.svc.cluster.local"),
	}

	vals := MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test2", Name: "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func TestExportMultiHostMatchInvalid(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1.test.svc.cluster.local"),
	}

	edr := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "host1.test.svc.cluster.local"),
		data.CreateTestDestinationRule("test3", "rule3", "host1.test.svc.cluster.local"),
	}

	vals := MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
		Namespaces: models.Namespaces{
			models.Namespace{Name: "test"},
			models.Namespace{Name: "test2"},
			models.Namespace{Name: "test3"},
			models.Namespace{Name: "default"},
		},
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(3, len(vals))

	// Rule1 assertions
	validationExportAssertion(assert, vals, "test", "test2", "rule1", []string{"rule2"})
	validationExportAssertion(assert, vals, "test", "test3", "rule1", []string{"rule3"})
	validationExportAssertion(assert, vals, "test2", "test", "rule2", []string{"rule1"})
	validationExportAssertion(assert, vals, "test2", "test3", "rule2", []string{"rule3"})
	validationExportAssertion(assert, vals, "test3", "test", "rule3", []string{"rule1"})
	validationExportAssertion(assert, vals, "test3", "test2", "rule3", []string{"rule2"})
}

func TestExportMultiHostMatchInvalid2(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1.test.svc.cluster.local"),
	}

	edr := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "host1.test.svc.cluster.local"),
		data.CreateTestDestinationRule("test3", "rule3", "host1.test2.svc.cluster.local"),
	}

	vals := MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
		Namespaces: models.Namespaces{
			models.Namespace{Name: "test"},
			models.Namespace{Name: "test2"},
			models.Namespace{Name: "test3"},
			models.Namespace{Name: "default"},
		},
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))

	// Rule1 assertions
	validationExportAssertion(assert, vals, "test", "test2", "rule1", []string{"rule2"})
	validationExportAssertion(assert, vals, "test2", "test", "rule2", []string{"rule1"})
}

func validationExportAssertion(assert *assert.Assertions, vals models.IstioValidations, namespace, refNamespace, drName string, refNames []string) {
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: namespace, Name: drName}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("destinationrules.multimatch", validation.Checks[0]))

	assert.NotEmpty(validation.References)
	for _, refName := range refNames {
		assert.Contains(validation.References,
			models.IstioValidationKey{
				ObjectGVK: kubernetes.DestinationRules,
				Namespace: refNamespace,
				Name:      refName,
			},
		)
	}
}

func TestExportMultiHostMatchValidShortFormat(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
	}

	edr := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "host1.test"),
	}

	vals := MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test2", Name: "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func TestExportMultiHostMatchValidShortFormat2(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
	}

	edr := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "host2.test"),
	}

	vals := MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test2", Name: "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func TestExportMultiHostMatchValidShortFormatDiffNamespace(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
	}

	edr := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "host2.bookinfo"),
	}

	vals := MultiMatchChecker{
		Namespaces: models.Namespaces{
			models.Namespace{Name: "bookinfo"},
			models.Namespace{Name: "test"},
			models.Namespace{Name: "test2"},
		},
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	// MultiMatchChecker shouldn't fail if a host is in a different namespace
	assert.Empty(vals)
}

func TestExportMultiHostMatchWildcardInvalid(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1.test.svc.cluster.local"),
	}

	edr := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "*.test.svc.cluster.local"),
	}

	vals := MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.NotEmpty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test2", Name: "rule2"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

	assert.NotEmpty(validation.References)
	assert.Equal("rule1", validation.References[0].Name)

	destinationRules = []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "*.test2.svc.cluster.local"),
	}

	edr = []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1.test2.svc.cluster.local"),
	}

	vals = MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.NotEmpty(vals)
	validation, ok = vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "rule1"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

	assert.NotEmpty(validation.References)
	assert.Equal("rule2", validation.References[0].Name)
}

func TestExportMultiHostMatchBothWildcardInvalid(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "*"),
	}

	edr := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "*.test.svc.cluster.local"),
	}

	vals := MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.NotEmpty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test2", Name: "rule2"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

	assert.NotEmpty(validation.References)
	assert.Equal("rule1", validation.References[0].Name)

	destinationRules = []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "*.test.svc.cluster.local"),
	}

	edr = []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "*"),
	}

	vals = MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.NotEmpty(vals)
	validation, ok = vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "rule1"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

	assert.NotEmpty(validation.References)
	assert.Equal("rule2", validation.References[0].Name)
}

func TestExportMultiHostMatchBothWildcardInvalid2(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "*.test.svc.cluster.local"),
	}

	edr := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "*.test.svc.cluster.local"),
	}

	vals := MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.NotEmpty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test2", Name: "rule2"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

	assert.NotEmpty(validation.References)
	assert.Equal("rule1", validation.References[0].Name)

	destinationRules = []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "*.test2.svc.cluster.local"),
	}

	edr = []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "*.test2.svc.cluster.local"),
	}

	vals = MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.NotEmpty(vals)
	validation, ok = vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "rule1"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

	assert.NotEmpty(validation.References)
	assert.Equal("rule2", validation.References[0].Name)
}

func TestExportMultiHostMatchBothWildcardInvalid3(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "*.wikipedia.org"),
	}

	edr := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "*.wikipedia.org"),
	}

	vals := MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.NotEmpty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test2", Name: "rule2"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

	assert.NotEmpty(validation.References)
	assert.Equal("rule1", validation.References[0].Name)

	destinationRules = []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test2", "rule2", "*.wikipedia.org"),
	}

	edr = []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "*.wikipedia.org"),
	}

	vals = MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.NotEmpty(vals)
	validation, ok = vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "rule1"}]
	assert.True(ok)
	assert.True(validation.Valid) // As long as it is warning, this is true
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)

	assert.NotEmpty(validation.References)
	assert.Equal("rule2", validation.References[0].Name)
}

func TestExportMultiHostMatchingMeshWideMTLSDestinationRule(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
	}

	edr := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateTestDestinationRule("test2", "rule2", "*.local")),
	}

	vals := MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test2", Name: "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func TestExportMultiHostMatchingNamespaceWideMTLSDestinationRule(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("test", "rule1", "host1"),
	}

	edr := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateTestDestinationRule("test2", "rule2", "*.test.svc.cluster.local")),
	}

	vals := MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test2", Name: "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

func TestExportMultiHostMatchDifferentSubsets(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"),
			data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"), data.CreateEmptyDestinationRule("test", "rule1", "host1"))),
	}

	edr := []*networking_v1.DestinationRule{
		data.AddSubsetToDestinationRule(data.CreateSubset("v3", "v3"),
			data.AddSubsetToDestinationRule(data.CreateSubset("v4", "v4"), data.CreateEmptyDestinationRule("test2", "rule2", "host1"))),
	}

	vals := MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.Empty(vals)

	edr = append(edr,
		data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"),
			data.AddSubsetToDestinationRule(data.CreateSubset("v5", "v5"), data.CreateEmptyDestinationRule("test3", "rule5", "*.test.svc.cluster.local"))),
	)

	vals = MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.NotEmpty(vals)
}

func TestExportReviewsExample(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.AddSubsetToDestinationRule(data.CreateSubset("v2", "v2"),
			data.AddSubsetToDestinationRule(data.CreateSubset("v3", "v3"), data.CreateEmptyDestinationRule("bookinfo", "reviews", "reviews.bookinfo.svc.cluster.local"))),
	}

	edr := []*networking_v1.DestinationRule{
		data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"), data.CreateEmptyDestinationRule("bookinfo2", "reviews2", "reviews.bookinfo.svc.cluster.local")),
	}

	vals := MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.Empty(vals)

	allMatch := data.CreateEmptyDestinationRule("bookinfo3", "reviews3", "reviews.bookinfo.svc.cluster.local")
	edr = append(edr, allMatch)

	vals = MultiMatchChecker{
		DestinationRules: append(destinationRules, edr...),
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(3, len(vals))
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "bookinfo3", Name: "reviews3"}]
	assert.True(ok)
	assert.True(validation.Valid)
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.Equal(1, len(validation.Checks))

	assert.Equal(2, len(validation.References)) // Both reviews and reviews2 is faulty
}

func TestExportMultiServiceEntry(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	seA := data.AddPortDefinitionToServiceEntry(data.CreateEmptyServicePortDefinition(443, "https", "TLS"), data.CreateEmptyMeshExternalServiceEntry("service-a", "test", []string{"api.service_a.com"}))
	seB := data.AddPortDefinitionToServiceEntry(data.CreateEmptyServicePortDefinition(443, "https", "TLS"), data.CreateEmptyMeshExternalServiceEntry("service-b", "test2", []string{"api.service_b.com"}))

	drA := data.CreateEmptyDestinationRule("test", "service-a", "api.service_a.com")
	drB := data.CreateEmptyDestinationRule("test2", "service-b", "api.service_b.com")

	vals := MultiMatchChecker{
		DestinationRules: []*networking_v1.DestinationRule{drA, drB},
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{seA, seB}),
	}.Check()

	assert.Empty(vals)
}

func TestExportMultiServiceEntryInvalid(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	seA := data.AddPortDefinitionToServiceEntry(data.CreateEmptyServicePortDefinition(443, "https", "TLS"), data.CreateEmptyMeshExternalServiceEntry("service-a", "test", []string{"api.service_a.com"}))

	drA := data.CreateEmptyDestinationRule("test", "service-a", "api.service_a.com")
	drB := data.CreateEmptyDestinationRule("test2", "service-a2", "api.service_a.com")

	vals := MultiMatchChecker{
		DestinationRules: []*networking_v1.DestinationRule{drA, drB},
		ServiceEntries:   kubernetes.ServiceEntryHostnames([]*networking_v1.ServiceEntry{seA}),
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test2", Name: "service-a2"}]
	assert.True(ok)
	assert.True(validation.Valid)
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.Equal(1, len(validation.Checks))

	assert.Equal(1, len(validation.References)) // Both reviews and reviews2 is faulty
}
