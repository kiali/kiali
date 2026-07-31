package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/business/checkers/common"
	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
)

// Issue #10124: foreign-host DR multi-match must not warn under ./* Sidecar.
func TestDestinationRulesCheckerSidecarImportSkipsForeignMultiMatch(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	assert := assert.New(t)

	sc := data.AddHostsToSidecar([]string{"./*", "istio-system/*"}, data.CreateSidecar("default", "istio-test1"))
	nsNames := []string{"istio-test1", "vault", "istio-test3", "istio-system"}
	scope := common.NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, nsNames, "svc.cluster.local")

	drs := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("istio-test1", "vault-no-tls", "*.vault.svc.cluster.local"),
		data.CreateTestDestinationRule("istio-test1", "test3-no-tls", "*.istio-test3.svc.cluster.local"),
		data.CreateTestDestinationRule("istio-test1", "local-a", "productpage.istio-test1.svc.cluster.local"),
		data.CreateTestDestinationRule("istio-test1", "local-b", "productpage.istio-test1.svc.cluster.local"),
	}

	vals := DestinationRulesChecker{
		Cluster:          config.DefaultClusterID,
		Conf:             conf,
		DestinationRules: drs,
		IdentityDomain:   "svc.cluster.local",
		ImportScope:      scope,
		MTLSDetails:      kubernetes.MTLSDetails{},
		Namespaces: models.Namespaces{
			{Name: "istio-test1"},
			{Name: "vault"},
			{Name: "istio-test3"},
			{Name: "istio-system"},
		},
	}.Check()

	vaultKey := models.BuildKey(kubernetes.DestinationRules, "vault-no-tls", "istio-test1", config.DefaultClusterID)
	test3Key := models.BuildKey(kubernetes.DestinationRules, "test3-no-tls", "istio-test1", config.DefaultClusterID)
	localAKey := models.BuildKey(kubernetes.DestinationRules, "local-a", "istio-test1", config.DefaultClusterID)
	localBKey := models.BuildKey(kubernetes.DestinationRules, "local-b", "istio-test1", config.DefaultClusterID)

	// Foreign hosts are outside Sidecar egress — no KIA0201 between them.
	if v, ok := vals[vaultKey]; ok {
		assert.False(hasCheckCode(v, "KIA0201"), "foreign DR should not get multi-match")
	}
	if v, ok := vals[test3Key]; ok {
		assert.False(hasCheckCode(v, "KIA0201"), "foreign DR should not get multi-match")
	}

	// Local same-host DRs are imported — multi-match still applies.
	assert.Contains(vals, localAKey)
	assert.Contains(vals, localBKey)
	assert.True(hasCheckCode(vals[localAKey], "KIA0201"))
	assert.True(hasCheckCode(vals[localBKey], "KIA0201"))
}

// Same foreign host twice still must not multi-match when Sidecar does not import that host.
func TestDestinationRulesCheckerSidecarImportSkipsSameForeignHostMultiMatch(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	assert := assert.New(t)

	sc := data.AddHostsToSidecar([]string{"./*"}, data.CreateSidecar("default", "istio-test1"))
	nsNames := []string{"istio-test1", "vault"}
	scope := common.NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, nsNames, "svc.cluster.local")

	drs := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("istio-test1", "vault-a", "echo.vault.svc.cluster.local"),
		data.CreateTestDestinationRule("istio-test1", "vault-b", "echo.vault.svc.cluster.local"),
	}

	vals := DestinationRulesChecker{
		Cluster:          config.DefaultClusterID,
		Conf:             conf,
		DestinationRules: drs,
		IdentityDomain:   "svc.cluster.local",
		ImportScope:      scope,
		MTLSDetails:      kubernetes.MTLSDetails{},
		Namespaces:       models.Namespaces{{Name: "istio-test1"}, {Name: "vault"}},
	}.Check()

	for _, name := range []string{"vault-a", "vault-b"} {
		key := models.BuildKey(kubernetes.DestinationRules, name, "istio-test1", config.DefaultClusterID)
		if v, ok := vals[key]; ok {
			assert.False(hasCheckCode(v, "KIA0201"), "%s should not get KIA0201 under ./* Sidecar", name)
		}
	}
}

// When Sidecar imports the foreign namespace, same-host multi-match still applies.
func TestDestinationRulesCheckerSidecarImportKeepsImportedForeignMultiMatch(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	assert := assert.New(t)

	sc := data.AddHostsToSidecar([]string{"./*", "vault/*"}, data.CreateSidecar("default", "istio-test1"))
	nsNames := []string{"istio-test1", "vault"}
	scope := common.NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, nsNames, "svc.cluster.local")

	drs := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("istio-test1", "vault-a", "echo.vault.svc.cluster.local"),
		data.CreateTestDestinationRule("istio-test1", "vault-b", "echo.vault.svc.cluster.local"),
	}

	vals := DestinationRulesChecker{
		Cluster:          config.DefaultClusterID,
		Conf:             conf,
		DestinationRules: drs,
		IdentityDomain:   "svc.cluster.local",
		ImportScope:      scope,
		MTLSDetails:      kubernetes.MTLSDetails{},
		Namespaces:       models.Namespaces{{Name: "istio-test1"}, {Name: "vault"}},
	}.Check()

	keyA := models.BuildKey(kubernetes.DestinationRules, "vault-a", "istio-test1", config.DefaultClusterID)
	keyB := models.BuildKey(kubernetes.DestinationRules, "vault-b", "istio-test1", config.DefaultClusterID)
	assert.True(hasCheckCode(vals[keyA], "KIA0201"))
	assert.True(hasCheckCode(vals[keyB], "KIA0201"))
}

func TestDestinationRulesCheckerSidecarImportSkipsForeignTrafficPolicyOverride(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	assert := assert.New(t)

	sc := data.AddHostsToSidecar([]string{"./*"}, data.CreateSidecar("default", "bookinfo"))
	nsNames := []string{"bookinfo", "vault"}
	scope := common.NewImportScope("bookinfo", "istio-system", []*networking_v1.Sidecar{sc}, nsNames, "svc.cluster.local")

	mtlsDR := data.AddTrafficPolicyToDestinationRule(
		data.CreateMTLSTrafficPolicyForDestinationRules(),
		data.CreateEmptyDestinationRule("bookinfo", "vault-mtls", "*.vault.svc.cluster.local"),
	)
	noTLS := data.CreateEmptyDestinationRule("bookinfo", "vault-no-tls", "echo.vault.svc.cluster.local")

	vals := DestinationRulesChecker{
		Cluster:          config.DefaultClusterID,
		Conf:             conf,
		DestinationRules: []*networking_v1.DestinationRule{noTLS},
		IdentityDomain:   "svc.cluster.local",
		ImportScope:      scope,
		MTLSDetails: kubernetes.MTLSDetails{
			DestinationRules: []*networking_v1.DestinationRule{mtlsDR},
		},
		Namespaces: models.Namespaces{{Name: "bookinfo"}, {Name: "vault"}},
	}.Check()

	key := models.BuildKey(kubernetes.DestinationRules, "vault-no-tls", "bookinfo", config.DefaultClusterID)
	if v, ok := vals[key]; ok {
		assert.False(hasCheckCode(v, "KIA0204"), "foreign DR should not get traffic-policy override under ./*")
	}
}

func TestVirtualServiceCheckerSidecarImportSkipsForeignSingleHost(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	assert := assert.New(t)

	sc := data.AddHostsToSidecar([]string{"./*"}, data.CreateSidecar("default", "istio-test1"))
	nsNames := []string{"istio-test1", "bookinfo"}
	scope := common.NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, nsNames, "svc.cluster.local")

	vss := []*networking_v1.VirtualService{
		data.CreateEmptyVirtualService("vs-a", "istio-test1", []string{"reviews.bookinfo.svc.cluster.local"}),
		data.CreateEmptyVirtualService("vs-b", "istio-test1", []string{"reviews.bookinfo.svc.cluster.local"}),
		data.CreateEmptyVirtualService("vs-local-a", "istio-test1", []string{"productpage.istio-test1.svc.cluster.local"}),
		data.CreateEmptyVirtualService("vs-local-b", "istio-test1", []string{"productpage.istio-test1.svc.cluster.local"}),
	}

	vals := VirtualServiceChecker{
		Cluster:         config.DefaultClusterID,
		Conf:            conf,
		IdentityDomain:  "svc.cluster.local",
		ImportScope:     scope,
		Namespaces:      models.Namespaces{{Name: "istio-test1"}, {Name: "bookinfo"}},
		VirtualServices: vss,
	}.Check()

	foreignA := models.BuildKey(kubernetes.VirtualServices, "vs-a", "istio-test1", config.DefaultClusterID)
	foreignB := models.BuildKey(kubernetes.VirtualServices, "vs-b", "istio-test1", config.DefaultClusterID)
	localA := models.BuildKey(kubernetes.VirtualServices, "vs-local-a", "istio-test1", config.DefaultClusterID)
	localB := models.BuildKey(kubernetes.VirtualServices, "vs-local-b", "istio-test1", config.DefaultClusterID)

	if v, ok := vals[foreignA]; ok {
		assert.False(hasCheckCode(v, "KIA1106"))
	}
	if v, ok := vals[foreignB]; ok {
		assert.False(hasCheckCode(v, "KIA1106"))
	}
	assert.True(hasCheckCode(vals[localA], "KIA1106"))
	assert.True(hasCheckCode(vals[localB], "KIA1106"))
}

func TestServiceEntryCheckerSidecarImportSkipsForeignMultiMatch(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)
	assert := assert.New(t)

	sc := data.AddHostsToSidecar([]string{"./*"}, data.CreateSidecar("default", "istio-test1"))
	nsNames := []string{"istio-test1", "external"}
	scope := common.NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, nsNames, "svc.cluster.local")

	port := data.CreateEmptyServicePortDefinition(80, "http", "HTTP")
	foreignA := data.AddPortDefinitionToServiceEntry(port, data.CreateEmptyMeshExternalServiceEntry("se-a", "external", []string{"example.com"}))
	foreignB := data.AddPortDefinitionToServiceEntry(port, data.CreateEmptyMeshExternalServiceEntry("se-b", "external", []string{"example.com"}))
	localA := data.AddPortDefinitionToServiceEntry(port, data.CreateEmptyMeshExternalServiceEntry("se-local-a", "istio-test1", []string{"local.example.com"}))
	localB := data.AddPortDefinitionToServiceEntry(port, data.CreateEmptyMeshExternalServiceEntry("se-local-b", "istio-test1", []string{"local.example.com"}))

	vals := ServiceEntryChecker{
		Cluster:     config.DefaultClusterID,
		ImportScope: scope,
		Namespaces:  models.Namespaces{{Name: "istio-test1"}, {Name: "external"}},
		ServiceEntries: []*networking_v1.ServiceEntry{
			foreignA, foreignB, localA, localB,
		},
	}.Check()

	for _, name := range []string{"se-a", "se-b"} {
		key := models.BuildKey(kubernetes.ServiceEntries, name, "external", config.DefaultClusterID)
		if v, ok := vals[key]; ok {
			assert.False(hasCheckCode(v, "KIA1211"), "%s should not multi-match under ./*", name)
		}
	}

	localKeyA := models.BuildKey(kubernetes.ServiceEntries, "se-local-a", "istio-test1", config.DefaultClusterID)
	localKeyB := models.BuildKey(kubernetes.ServiceEntries, "se-local-b", "istio-test1", config.DefaultClusterID)
	assert.True(hasCheckCode(vals[localKeyA], "KIA1211"))
	assert.True(hasCheckCode(vals[localKeyB], "KIA1211"))
}

func hasCheckCode(v *models.IstioValidation, code string) bool {
	if v == nil {
		return false
	}
	for _, c := range v.Checks {
		if c.Code == code {
			return true
		}
	}
	return false
}
