package common

import (
	"testing"

	"github.com/stretchr/testify/assert"
	networking_v1 "istio.io/client-go/pkg/apis/networking/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/tests/data"
)

func TestImportScopeUnrestrictedWhenNoSidecar(t *testing.T) {
	scope := NewImportScope("istio-test1", "istio-system", nil, []string{"istio-test1"}, "svc.cluster.local")
	assert.False(t, scope.IsLimited())
	assert.True(t, scope.ImportsHost("reviews.bookinfo.svc.cluster.local", "istio-test1"))
}

func TestImportScopeUnrestrictedWhenEmptyEgress(t *testing.T) {
	sc := data.CreateSidecar("default", "istio-test1")
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, []string{"istio-test1"}, "svc.cluster.local")
	assert.False(t, scope.IsLimited())
}

func TestImportScopeIgnoresSelectorOnlySidecar(t *testing.T) {
	sc := data.AddHostsToSidecar([]string{"./*"}, data.AddSelectorToSidecar(map[string]string{
		"app": "productpage",
	}, data.CreateSidecar("selected", "istio-test1")))
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, []string{"istio-test1"}, "svc.cluster.local")
	assert.False(t, scope.IsLimited(), "selector-only Sidecar must not limit namespace-wide import scope")
}

func TestImportScopeDotSlashStar(t *testing.T) {
	sc := data.AddHostsToSidecar([]string{"./*", "istio-system/*"}, data.CreateSidecar("default", "istio-test1"))
	ns := []string{"istio-test1", "bookinfo", "istio-system", "vault"}
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, ns, "svc.cluster.local")

	assert.True(t, scope.IsLimited())
	assert.True(t, scope.ImportsHost("productpage.istio-test1.svc.cluster.local", "istio-test1"))
	assert.True(t, scope.ImportsHost("productpage", "istio-test1"))
	assert.True(t, scope.ImportsHost("istiod.istio-system.svc.cluster.local", "istio-system"))
	assert.False(t, scope.ImportsHost("reviews.bookinfo.svc.cluster.local", "istio-test1"))
	assert.False(t, scope.ImportsHost("*.vault.svc.cluster.local", "istio-test1"))
	assert.False(t, scope.ImportsHost("*.istio-test3.svc.cluster.local", "istio-test1"))
}

func TestImportScopeRootNamespaceFallback(t *testing.T) {
	rootSC := data.AddHostsToSidecar([]string{"./*"}, data.CreateSidecar("default", "istio-system"))
	ns := []string{"istio-test1", "istio-system", "bookinfo"}
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{rootSC}, ns, "svc.cluster.local")

	assert.True(t, scope.IsLimited())
	// "." expands to the workload namespace (istio-test1), not the Sidecar's namespace.
	assert.True(t, scope.ImportsHost("productpage.istio-test1.svc.cluster.local", "istio-test1"))
	assert.False(t, scope.ImportsHost("reviews.bookinfo.svc.cluster.local", "istio-test1"))
}

func TestImportScopePrefersNamespaceSidecarOverRoot(t *testing.T) {
	nsSC := data.AddHostsToSidecar([]string{"bookinfo/*"}, data.CreateSidecar("default", "istio-test1"))
	rootSC := data.AddHostsToSidecar([]string{"./*"}, data.CreateSidecar("default", "istio-system"))
	ns := []string{"istio-test1", "istio-system", "bookinfo"}
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{nsSC, rootSC}, ns, "svc.cluster.local")

	assert.True(t, scope.ImportsHost("reviews.bookinfo.svc.cluster.local", "istio-test1"))
	assert.False(t, scope.ImportsHost("productpage.istio-test1.svc.cluster.local", "istio-test1"))
}

func TestImportScopeSpecificHost(t *testing.T) {
	sc := data.AddHostsToSidecar([]string{
		"./*",
		"bookinfo/reviews.bookinfo.svc.cluster.local",
	}, data.CreateSidecar("default", "istio-test1"))
	ns := []string{"istio-test1", "bookinfo"}
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, ns, "svc.cluster.local")

	assert.True(t, scope.ImportsHost("reviews.bookinfo.svc.cluster.local", "istio-test1"))
	assert.False(t, scope.ImportsHost("ratings.bookinfo.svc.cluster.local", "istio-test1"))
}

func TestImportScopeStarSlashStar(t *testing.T) {
	sc := data.AddHostsToSidecar([]string{"*/*"}, data.CreateSidecar("default", "istio-test1"))
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, []string{"istio-test1", "bookinfo"}, "svc.cluster.local")
	assert.True(t, scope.ImportsHost("reviews.bookinfo.svc.cluster.local", "istio-test1"))
}

func TestImportScopeTildeSlashStarImportsNothing(t *testing.T) {
	sc := data.AddHostsToSidecar([]string{"~/*"}, data.CreateSidecar("default", "istio-test1"))
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, []string{"istio-test1"}, "svc.cluster.local")
	assert.True(t, scope.IsLimited())
	assert.False(t, scope.ImportsHost("productpage.istio-test1.svc.cluster.local", "istio-test1"))
}

func TestImportScopeExclusions(t *testing.T) {
	sc := data.AddHostsToSidecar([]string{"*/*", "~bookinfo/*"}, data.CreateSidecar("default", "istio-test1"))
	ns := []string{"istio-test1", "bookinfo", "vault"}
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, ns, "svc.cluster.local")

	assert.True(t, scope.ImportsHost("productpage.istio-test1.svc.cluster.local", "istio-test1"))
	assert.False(t, scope.ImportsHost("reviews.bookinfo.svc.cluster.local", "istio-test1"))
	assert.True(t, scope.ImportsHost("*.vault.svc.cluster.local", "istio-test1"))
}

// Egress is the pattern: a specific egress host must not match an unrelated broader
// config wildcard in a different namespace (unconditional reverse matching was wrong).
func TestImportScopeEgressIsPatternNotReverse(t *testing.T) {
	sc := data.AddHostsToSidecar([]string{"bookinfo/reviews.bookinfo.svc.cluster.local"}, data.CreateSidecar("default", "istio-test1"))
	ns := []string{"istio-test1", "bookinfo", "vault"}
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, ns, "svc.cluster.local")

	assert.True(t, scope.ImportsHost("reviews.bookinfo.svc.cluster.local", "istio-test1"))
	// Wildcard DR that covers the imported egress host is relevant.
	assert.True(t, scope.ImportsHost("*.bookinfo.svc.cluster.local", "istio-test1"))
	// Unrelated namespace wildcard must not match via reverse wildcard logic.
	assert.False(t, scope.ImportsHost("*.vault.svc.cluster.local", "istio-test1"))
}

// External ServiceEntry hosts associate with the SE's namespace for ns/* matching.
func TestImportScopeExternalHostUsesConfigNamespace(t *testing.T) {
	sc := data.AddHostsToSidecar([]string{"./*"}, data.CreateSidecar("default", "istio-test1"))
	ns := []string{"istio-test1", "external"}
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, ns, "svc.cluster.local")

	assert.True(t, scope.ImportsHost("example.com", "istio-test1"), "SE in workload NS is imported by ./*")
	assert.False(t, scope.ImportsHost("example.com", "external"), "SE in another NS is not imported by ./*")
}

func TestFilterDestinationRulesByImport(t *testing.T) {
	conf := config.NewConfig()
	config.Set(conf)

	sc := data.AddHostsToSidecar([]string{"./*"}, data.CreateSidecar("default", "istio-test1"))
	ns := []string{"istio-test1", "vault", "istio-test3"}
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, ns, "svc.cluster.local")

	drs := []*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("istio-test1", "local", "productpage.istio-test1.svc.cluster.local"),
		data.CreateTestDestinationRule("istio-test1", "vault-no-tls", "*.vault.svc.cluster.local"),
		data.CreateTestDestinationRule("istio-test1", "test3-no-tls", "*.istio-test3.svc.cluster.local"),
	}

	filtered := FilterDestinationRulesByImport(drs, scope)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "local", filtered[0].Name)
}

func TestFilterVirtualServicesByImport(t *testing.T) {
	sc := data.AddHostsToSidecar([]string{"./*"}, data.CreateSidecar("default", "istio-test1"))
	ns := []string{"istio-test1", "bookinfo"}
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, ns, "svc.cluster.local")

	vss := []*networking_v1.VirtualService{
		data.CreateEmptyVirtualService("local-vs", "istio-test1", []string{"productpage.istio-test1.svc.cluster.local"}),
		data.CreateEmptyVirtualService("foreign-vs", "istio-test1", []string{"reviews.bookinfo.svc.cluster.local"}),
	}

	filtered := FilterVirtualServicesByImport(vss, scope)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "local-vs", filtered[0].Name)
}

func TestFilterServiceEntriesByImport(t *testing.T) {
	sc := data.AddHostsToSidecar([]string{"external/*"}, data.CreateSidecar("default", "istio-test1"))
	ns := []string{"istio-test1", "external"}
	scope := NewImportScope("istio-test1", "istio-system", []*networking_v1.Sidecar{sc}, ns, "svc.cluster.local")

	ses := []*networking_v1.ServiceEntry{
		data.CreateEmptyMeshExternalServiceEntry("ext", "external", []string{"example.com"}),
		data.CreateEmptyMeshExternalServiceEntry("local-ext", "istio-test1", []string{"other.example.com"}),
	}

	filtered := FilterServiceEntriesByImport(ses, scope)
	assert.Len(t, filtered, 1)
	assert.Equal(t, "ext", filtered[0].Name)
}

func TestZeroValueImportScopeIsUnrestricted(t *testing.T) {
	var scope ImportScope
	assert.False(t, scope.IsLimited())
	assert.True(t, scope.ImportsHost("anything", "ns"))
	assert.Equal(t, 2, len(FilterDestinationRulesByImport([]*networking_v1.DestinationRule{
		data.CreateTestDestinationRule("a", "r1", "h1"),
		data.CreateTestDestinationRule("a", "r2", "h2"),
	}, scope)))
}
