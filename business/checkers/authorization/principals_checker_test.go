package authorization

import (
	"testing"

	"github.com/stretchr/testify/assert"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestPresentServiceAccount(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	validations, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}),
		Cluster:             config.DefaultClusterID,
		KnownTrustDomains:   []string{"cluster.local"},
		ServiceAccounts:     map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestRegexPrincipalFound(t *testing.T) {
	assert := assert.New(t)

	validations, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"*local/ns/bookinfo/sa/default*", "*.local/ns/bookinfo/sa/test*"}),
		Cluster:             config.DefaultClusterID,
		KnownTrustDomains:   []string{"cluster.local"},
		ServiceAccounts:     map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default-a", "cluster.local/ns/bookinfo/sa/test-1"}},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestRegexPrincipalNotFound(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"*wronglocal/ns/bookinfo/sa/default*", "*.local/ns/bookinfo/sa/test1*"}),
		Cluster:             config.DefaultClusterID,
		KnownTrustDomains:   []string{"cluster.local"},
		ServiceAccounts:     map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default-a", "cluster.local/ns/bookinfo/sa/test-1"}},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[0]", vals[0].Path)
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[1]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[1]", vals[1].Path)
}

func TestEmptyPrincipals(t *testing.T) {
	assert := assert.New(t)

	validations, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{}),
		Cluster:             config.DefaultClusterID,
		KnownTrustDomains:   []string{"cluster.local"},
		ServiceAccounts:     map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestNotPresentServiceAccount(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"cluster.local/ns/bookinfo/sa/wrong", "test"}),
		Cluster:             config.DefaultClusterID,
		KnownTrustDomains:   []string{"cluster.local"},
		ServiceAccounts:     map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[0]", vals[0].Path)
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[1]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[1]", vals[1].Path)
}

func TestRemoteClusterServiceAccount(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"cluster.local/ns/bookinfo/sa/default", "cluster.local/ns/bookinfo/sa/test"}),
		Cluster:             "east",
		KnownTrustDomains:   []string{"cluster.local"},
		ServiceAccounts:     map[string][]string{"west": {"cluster.local/ns/bookinfo/sa/default"}, "east": {"cluster.local/ns/bookinfo/sa/test"}},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.Unknown, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalremote", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[0]", vals[0].Path)
}

func TestEmptyServiceAccount(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"cluster.local/ns/bookinfo/sa/wrong"}),
		KnownTrustDomains:   []string{"cluster.local"},
		ServiceAccounts:     map[string][]string{},
	}.Check()

	assert.False(valid)
	assert.NotEmpty(vals)
	assert.Len(vals, 1)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[0]", vals[0].Path)
}

func TestWildcardPrincipal(t *testing.T) {
	assert := assert.New(t)

	validations, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"*"}),
		Cluster:             config.DefaultClusterID,
		KnownTrustDomains:   []string{"cluster.local"},
		ServiceAccounts:     map[string][]string{config.DefaultClusterID: {"cluster.local/ns/bookinfo/sa/default"}},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestPrincipalWithTrustDomainAlias(t *testing.T) {
	assert := assert.New(t)

	validations, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{
			"central.example.com/ns/pokemon-trainers/sa/ash",
			"north.example.com/ns/pokemon-trainers/sa/red",
		}),
		Cluster:           config.DefaultClusterID,
		KnownTrustDomains: []string{"central.example.com", "north.example.com"},
		ServiceAccounts: map[string][]string{config.DefaultClusterID: {
			"central.example.com/ns/pokemon-trainers/sa/ash",
			"north.example.com/ns/pokemon-trainers/sa/ash",
			"central.example.com/ns/pokemon-trainers/sa/red",
			"north.example.com/ns/pokemon-trainers/sa/red",
		}},
	}.Check()

	assert.True(valid)
	assert.Empty(validations)
}

func TestPrincipalWithForeignTrustDomain(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"unknown.example.com/ns/bookinfo/sa/default"}),
		Cluster:             config.DefaultClusterID,
		KnownTrustDomains:   []string{"cluster.local", "central.example.com"},
		ServiceAccounts: map[string][]string{config.DefaultClusterID: {
			"cluster.local/ns/bookinfo/sa/default",
			"central.example.com/ns/bookinfo/sa/default",
		}},
	}.Check()

	assert.False(valid)
	assert.Len(vals, 1)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalforeign", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[0]", vals[0].Path)
}

func TestPrincipalWithKnownDomainButMissingSA(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"cluster.local/ns/bookinfo/sa/nonexistent"}),
		Cluster:             config.DefaultClusterID,
		KnownTrustDomains:   []string{"cluster.local", "central.example.com"},
		ServiceAccounts: map[string][]string{config.DefaultClusterID: {
			"cluster.local/ns/bookinfo/sa/default",
		}},
	}.Check()

	assert.False(valid)
	assert.Len(vals, 1)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[0]", vals[0].Path)
}

// TestMultiPrimaryFederation simulates the full multi-primary scenario from
// the OSSM-13864 reproduction: east cluster (trustDomain: east.example.com,
// aliases: south.example.com, cluster.local) and west cluster (trustDomain:
// west.example.com, aliases: north.example.com, cluster.remote).
func TestMultiPrimaryFederation(t *testing.T) {
	assert := assert.New(t)

	eastSAs := []string{
		"east.example.com/ns/bookinfo/sa/bookinfo-productpage",
		"south.example.com/ns/bookinfo/sa/bookinfo-productpage",
		"cluster.local/ns/bookinfo/sa/bookinfo-productpage",
		"east.example.com/ns/bookinfo/sa/bookinfo-reviews",
		"south.example.com/ns/bookinfo/sa/bookinfo-reviews",
		"cluster.local/ns/bookinfo/sa/bookinfo-reviews",
	}
	westSAs := []string{
		"west.example.com/ns/bookinfo/sa/bookinfo-reviews",
		"north.example.com/ns/bookinfo/sa/bookinfo-reviews",
		"cluster.remote/ns/bookinfo/sa/bookinfo-reviews",
		"west.example.com/ns/bookinfo/sa/bookinfo-productpage",
		"north.example.com/ns/bookinfo/sa/bookinfo-productpage",
		"cluster.remote/ns/bookinfo/sa/bookinfo-productpage",
	}
	knownDomains := []string{
		"east.example.com", "south.example.com", "cluster.local",
		"west.example.com", "north.example.com", "cluster.remote",
	}

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{
			"east.example.com/ns/bookinfo/sa/bookinfo-productpage",  // local match
			"cluster.local/ns/bookinfo/sa/bookinfo-productpage",     // alias match
			"south.example.com/ns/bookinfo/sa/bookinfo-productpage", // alias match
			"wrong.example.com/ns/bookinfo/sa/bookinfo-productpage", // foreign domain -> KIA0108
			"west.example.com/ns/bookinfo/sa/bookinfo-reviews",      // remote match -> KIA0107
			"cluster.remote/ns/bookinfo/sa/bookinfo-reviews",        // remote alias match -> KIA0107
			"north.example.com/ns/bookinfo/sa/bookinfo-reviews",     // remote alias match -> KIA0107
			"west.example.com/ns/bookinfo/sa/bookinfo-wrong",        // known domain, missing SA -> KIA0106
			"wrong", // no trust domain format -> KIA0106
		}),
		Cluster:           "east",
		KnownTrustDomains: knownDomains,
		ServiceAccounts:   map[string][]string{"east": eastSAs, "west": westSAs},
	}.Check()

	assert.False(valid)
	assert.Len(vals, 6)

	// wrong.example.com -> KIA0108 (foreign trust domain)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalforeign", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[3]", vals[0].Path)

	// west.example.com/ns/bookinfo/sa/bookinfo-reviews -> KIA0107 (remote)
	assert.Equal(models.Unknown, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalremote", vals[1]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[4]", vals[1].Path)

	// cluster.remote/ns/bookinfo/sa/bookinfo-reviews -> KIA0107 (remote)
	assert.Equal(models.Unknown, vals[2].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalremote", vals[2]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[5]", vals[2].Path)

	// north.example.com/ns/bookinfo/sa/bookinfo-reviews -> KIA0107 (remote)
	assert.Equal(models.Unknown, vals[3].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalremote", vals[3]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[6]", vals[3].Path)

	// west.example.com/ns/bookinfo/sa/bookinfo-wrong -> KIA0106 (known domain, SA missing)
	assert.Equal(models.ErrorSeverity, vals[4].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[4]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[7]", vals[4].Path)

	// "wrong" -> KIA0106 (no trust domain format, not found)
	assert.Equal(models.ErrorSeverity, vals[5].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[5]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[8]", vals[5].Path)
}

// TestMultipleForeignDomains validates that multiple principals with different
// unknown trust domains each produce KIA0108 warnings.
func TestMultipleForeignDomains(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{
			"alpha.unknown.org/ns/default/sa/svc1",
			"beta.unknown.org/ns/default/sa/svc2",
		}),
		Cluster:           config.DefaultClusterID,
		KnownTrustDomains: []string{"cluster.local"},
		ServiceAccounts: map[string][]string{config.DefaultClusterID: {
			"cluster.local/ns/default/sa/default",
		}},
	}.Check()

	assert.False(valid)
	assert.Len(vals, 2)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalforeign", vals[0]))
	assert.Equal(models.WarningSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalforeign", vals[1]))
}

// TestForeignDomainWithEmptyKnownDomains verifies that when KnownTrustDomains
// is empty (e.g., mesh not available), any structured principal is classified
// as foreign (KIA0108) rather than missing (KIA0106).
func TestForeignDomainWithEmptyKnownDomains(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"cluster.local/ns/bookinfo/sa/default"}),
		Cluster:             config.DefaultClusterID,
		KnownTrustDomains:   []string{},
		ServiceAccounts:     map[string][]string{},
	}.Check()

	assert.False(valid)
	assert.Len(vals, 1)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalforeign", vals[0]))
}

// TestForeignDomainWithNilKnownDomains verifies that nil KnownTrustDomains
// behaves the same as empty — all structured principals are foreign.
func TestForeignDomainWithNilKnownDomains(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"some.domain/ns/ns1/sa/sa1"}),
		Cluster:             config.DefaultClusterID,
		KnownTrustDomains:   nil,
		ServiceAccounts:     map[string][]string{},
	}.Check()

	assert.False(valid)
	assert.Len(vals, 1)
	assert.Equal(models.WarningSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalforeign", vals[0]))
}

// TestPrincipalWithNoNamespaceSegment verifies that principals without the
// "/ns/" pattern (e.g., plain strings or malformed) are not classified as
// foreign but fall through to KIA0106 (not found).
func TestPrincipalWithNoNamespaceSegment(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{"just-a-string", "another/one"}),
		Cluster:             config.DefaultClusterID,
		KnownTrustDomains:   []string{"cluster.local"},
		ServiceAccounts: map[string][]string{config.DefaultClusterID: {
			"cluster.local/ns/bookinfo/sa/default",
		}},
	}.Check()

	assert.False(valid)
	assert.Len(vals, 2)
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[0]))
	assert.Equal(models.ErrorSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[1]))
}

// TestMixedValidationsInSinglePolicy verifies correct classification when
// a single policy contains principals that trigger all three outcomes:
// KIA0106, KIA0107, and KIA0108.
func TestMixedValidationsInSinglePolicy(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{
			"cluster.local/ns/bookinfo/sa/valid",           // match -> no issue
			"cluster.local/ns/bookinfo/sa/typo",            // known domain, missing SA -> KIA0106
			"foreign.example.com/ns/bookinfo/sa/something", // foreign -> KIA0108
		}),
		Cluster:           "east",
		KnownTrustDomains: []string{"cluster.local"},
		ServiceAccounts: map[string][]string{
			"east": {"cluster.local/ns/bookinfo/sa/valid"},
			"west": {"cluster.local/ns/bookinfo/sa/other"},
		},
	}.Check()

	assert.False(valid)
	assert.Len(vals, 2)

	// cluster.local/ns/bookinfo/sa/typo -> KIA0106
	assert.Equal(models.ErrorSeverity, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalnotfound", vals[0]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[1]", vals[0].Path)

	// foreign.example.com -> KIA0108
	assert.Equal(models.WarningSeverity, vals[1].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalforeign", vals[1]))
	assert.Equal("spec/rules[0]/from[0]/source/principals[2]", vals[1].Path)
}

// TestRemoteClusterWithAlias verifies that a principal using a trust domain
// alias of a remote cluster is correctly identified as KIA0107.
func TestRemoteClusterWithAlias(t *testing.T) {
	assert := assert.New(t)

	vals, valid := PrincipalsChecker{
		AuthorizationPolicy: authPolicyWithPrincipals([]string{
			"north.example.com/ns/bookinfo/sa/reviews",
		}),
		Cluster:           "east",
		KnownTrustDomains: []string{"east.example.com", "west.example.com", "north.example.com"},
		ServiceAccounts: map[string][]string{
			"east": {"east.example.com/ns/bookinfo/sa/productpage"},
			"west": {"west.example.com/ns/bookinfo/sa/reviews", "north.example.com/ns/bookinfo/sa/reviews"},
		},
	}.Check()

	assert.False(valid)
	assert.Len(vals, 1)
	assert.Equal(models.Unknown, vals[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage("authorizationpolicy.source.principalremote", vals[0]))
}

func authPolicyWithPrincipals(principalsList []string) *security_v1.AuthorizationPolicy {
	return data.CreateAuthorizationPolicyWithPrincipals("auth-policy", "bookinfo", principalsList)
}
