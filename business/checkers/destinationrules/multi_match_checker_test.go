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
		Conf:             config.Get(),
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "rule2"}]
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
		Conf:             config.Get(),
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
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: drName}]
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
				Namespace: "test",
				Name:      refName,
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
		Conf:             config.Get(),
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "rule2"}]
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
		Conf:             config.Get(),
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "rule2"}]
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
		Conf:             config.Get(),
		Namespaces:       []string{"bookinfo", "test"},
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
		Conf:             config.Get(),
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "rule2"}]
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
		Conf:             config.Get(),
		DestinationRules: destinationRules,
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

// OSSM-15084: disjoint namespace-scoped wildcards must not trigger KIA0201.
func TestMultiHostMatchDisjointNamespaceWildcards(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("istio-test1", "vault-no-tls", "*.vault.svc.cluster.local"),
		data.CreateTestDestinationRule("istio-test1", "test3-no-tls", "*.istio-test3.svc.cluster.local"),
	}

	vals := MultiMatchChecker{
		Conf:             config.Get(),
		Namespaces:       []string{"istio-test1", "vault", "istio-test3"},
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(vals, "wildcard hosts targeting different namespaces must not overlap")
}

func TestMultiHostMatchSameNamespaceWildcardsStillConflict(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("istio-test1", "rule1", "*.vault.svc.cluster.local"),
		data.CreateTestDestinationRule("istio-test1", "rule2", "*.vault.svc.cluster.local"),
	}

	vals := MultiMatchChecker{
		Conf:             config.Get(),
		Namespaces:       []string{"istio-test1", "vault"},
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
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
		Conf:             config.Get(),
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "rule2"}]
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
		Conf:             config.Get(),
		DestinationRules: destinationRules,
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
		Conf:             config.Get(),
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "rule2"}]
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
		Conf:             config.Get(),
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(vals)
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "rule2"}]
	assert.False(ok)
	assert.Nil(validation)
}

// Service-scoped wildcard mTLS (e.g. *.vault) must still participate in multi-match;
// only mesh-wide / namespace-wide mTLS DRs are skipped.
func TestMultiHostMatchingServiceScopedMTLSWildcardStillConflicts(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	destinationRules := []*networking_v1.DestinationRule{
		data.AddTrafficPolicyToDestinationRule(data.CreateMTLSTrafficPolicyForDestinationRules(),
			data.CreateTestDestinationRule("istio-test1", "vault-mtls", "*.vault.svc.cluster.local")),
		data.CreateTestDestinationRule("istio-test1", "vault-no-tls", "*.vault.svc.cluster.local"),
	}

	vals := MultiMatchChecker{
		Conf:             config.Get(),
		Namespaces:       []string{"istio-test1", "vault"},
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
}

func TestHostsOverlap(t *testing.T) {
	cases := []struct {
		a, b     string
		expected bool
		reason   string
	}{
		{"*.svc.cluster.local", "*.test.svc.cluster.local", true, "broader wildcard contains narrower"},
		{"*.test.svc.cluster.local", "*.svc.cluster.local", true, "reverse of above"},
		{"*.wikipedia.org", "en.wikipedia.org", true, "non-cluster wildcard containing concrete"},
		{"*.foo.com", "*.bar.com", false, "disjoint external wildcards"},
		{"foo", "foo", true, "identity"},
		{"*", "anything", true, "bare wildcard"},
		{"anything", "*", true, "bare wildcard (reversed)"},
		{"*.vault.svc.cluster.local", "*.istio-test3.svc.cluster.local", false, "disjoint namespace-scoped wildcards (OSSM-15084)"},
		{"host1.test.svc.cluster.local", "*.test.svc.cluster.local", true, "concrete host within namespace wildcard"},
		{"*.test.svc.cluster.local", "host1.test.svc.cluster.local", true, "reversed"},
		{"host1.test.svc.cluster.local", "host1.test.svc.cluster.local", true, "exact match"},
		{"host1.test.svc.cluster.local", "host2.test.svc.cluster.local", false, "different concrete hosts"},
		{"*", "*", true, "bare wildcard identity"},
		{"*.test.svc.cluster.local", "*.test.svc.cluster.local", true, "identical wildcards"},
	}

	for _, tc := range cases {
		t.Run(tc.reason, func(t *testing.T) {
			assert.Equal(t, tc.expected, hostsOverlap(tc.a, tc.b), "%s vs %s", tc.a, tc.b)
		})
	}
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
		Conf:             config.Get(),
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(vals)

	destinationRules = append(destinationRules,
		data.AddSubsetToDestinationRule(data.CreateSubset("v1", "v1"),
			data.AddSubsetToDestinationRule(data.CreateSubset("v5", "v5"), data.CreateEmptyDestinationRule("test", "rule5", "*.test.svc.cluster.local"))),
	)

	vals = MultiMatchChecker{
		Conf:             config.Get(),
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
		Conf:             config.Get(),
		DestinationRules: destinationRules,
	}.Check()

	assert.Empty(vals)

	allMatch := data.CreateEmptyDestinationRule("bookinfo", "reviews3", "reviews")
	destinationRules = append(destinationRules, allMatch)

	vals = MultiMatchChecker{
		Conf:             config.Get(),
		DestinationRules: destinationRules,
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(3, len(vals))
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "bookinfo", Name: "reviews3"}]
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

	drA := data.CreateEmptyDestinationRule("test", "service-a", "api.service_a.com")
	drB := data.CreateEmptyDestinationRule("test", "service-b", "api.service_b.com")

	vals := MultiMatchChecker{
		Conf:             config.Get(),
		DestinationRules: []*networking_v1.DestinationRule{drA, drB},
	}.Check()

	assert.Empty(vals)
}

func TestMultiServiceEntryInvalid(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	drA := data.CreateEmptyDestinationRule("test", "service-a", "api.service_a.com")
	drB := data.CreateEmptyDestinationRule("test", "service-a2", "api.service_a.com")

	vals := MultiMatchChecker{
		Conf:             config.Get(),
		DestinationRules: []*networking_v1.DestinationRule{drA, drB},
	}.Check()

	assert.NotEmpty(vals)
	assert.Equal(2, len(vals))
	validation, ok := vals[models.IstioValidationKey{ObjectGVK: kubernetes.DestinationRules, Namespace: "test", Name: "service-a2"}]
	assert.True(ok)
	assert.True(validation.Valid)
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.WarningSeverity, validation.Checks[0].Severity)
	assert.Equal(1, len(validation.Checks))

	assert.Equal(1, len(validation.References)) // Both reviews and reviews2 is faulty
}
