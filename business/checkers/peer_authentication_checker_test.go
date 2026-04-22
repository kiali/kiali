package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	api_security_v1 "istio.io/api/security/v1"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestPeerAuthInRootNamespaceUsesMeshWideCheckers(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	pa := data.CreateEmptyPeerAuthentication("default", "istio-system",
		data.CreateMTLS("STRICT"))

	rootNamespaces := map[string]string{
		"istio-system": "istio-system",
		"bookinfo":     "istio-system",
	}

	checker := NewPeerAuthenticationChecker(
		config.DefaultClusterID,
		conf,
		"cluster.local",
		rootNamespaces,
		kubernetes.MTLSDetails{PeerAuthentications: []*security_v1.PeerAuthentication{pa}},
		[]*security_v1.PeerAuthentication{pa},
		map[string]models.Workloads{},
	)

	vals := checker.Check()
	key := models.BuildKey(kubernetes.PeerAuthentications, "default", "istio-system", config.DefaultClusterID)
	assert.NotNil(vals[key])

	foundMeshWide := false
	for _, check := range vals[key].Checks {
		if err := validations.ConfirmIstioCheckMessage("peerauthentication.mtls.destinationrulemissing", check); err == nil {
			foundMeshWide = true
		}
		assert.Error(validations.ConfirmIstioCheckMessage("peerauthentications.mtls.destinationrulemissing", check),
			"root namespace PA should NOT trigger namespace-wide checker")
	}
	assert.True(foundMeshWide, "root namespace PA should trigger mesh-wide checker")
}

func TestPeerAuthMultiCPCorrectRootResolution(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// PA in istio-system-1 (root of CP1)
	paCP1 := data.CreateEmptyPeerAuthentication("default", "istio-system-1",
		data.CreateMTLS("STRICT"))
	// PA in istio-system-2 (root of CP2)
	paCP2 := data.CreateEmptyPeerAuthentication("default", "istio-system-2",
		data.CreateMTLS("STRICT"))
	// PA in app namespace (not a root namespace)
	paApp := data.CreateEmptyPeerAuthentication("app-pa", "app-ns",
		data.CreateMTLS("STRICT"))

	rootNamespaces := map[string]string{
		"istio-system-1": "istio-system-1",
		"istio-system-2": "istio-system-2",
		"app-ns":         "istio-system-1",
	}

	allPAs := []*security_v1.PeerAuthentication{paCP1, paCP2, paApp}

	checker := NewPeerAuthenticationChecker(
		config.DefaultClusterID,
		conf,
		"cluster.local",
		rootNamespaces,
		kubernetes.MTLSDetails{PeerAuthentications: allPAs},
		allPAs,
		map[string]models.Workloads{},
	)

	vals := checker.Check()
	assert.Len(vals, 3)

	// Both root-namespace PAs should trigger mesh-wide checks
	for _, ns := range []string{"istio-system-1", "istio-system-2"} {
		key := models.BuildKey(kubernetes.PeerAuthentications, "default", ns, config.DefaultClusterID)
		assert.NotNil(vals[key])
		foundMeshWide := false
		for _, check := range vals[key].Checks {
			if err := validations.ConfirmIstioCheckMessage("peerauthentication.mtls.destinationrulemissing", check); err == nil {
				foundMeshWide = true
			}
		}
		assert.True(foundMeshWide, "PA in root namespace %s should trigger mesh-wide checker", ns)
	}

	// App namespace PA should trigger namespace-wide checks, not mesh-wide
	appKey := models.BuildKey(kubernetes.PeerAuthentications, "app-pa", "app-ns", config.DefaultClusterID)
	assert.NotNil(vals[appKey])
	foundNsWide := false
	for _, check := range vals[appKey].Checks {
		if err := validations.ConfirmIstioCheckMessage("peerauthentications.mtls.destinationrulemissing", check); err == nil {
			foundNsWide = true
		}
		assert.Error(validations.ConfirmIstioCheckMessage("peerauthentication.mtls.destinationrulemissing", check),
			"app namespace PA should NOT trigger mesh-wide checker")
	}
	assert.True(foundNsWide, "app namespace PA should trigger namespace-wide checker")
}

func TestPeerAuthUnknownNamespaceNotTreatedAsRoot(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// PA from a namespace not in the rootNamespaces map
	pa := data.CreateEmptyPeerAuthentication("pa", "unknown-ns",
		&api_security_v1.PeerAuthentication_MutualTLS{Mode: api_security_v1.PeerAuthentication_MutualTLS_DISABLE})

	checker := NewPeerAuthenticationChecker(
		config.DefaultClusterID,
		conf,
		"cluster.local",
		map[string]string{"istio-system": "istio-system"},
		kubernetes.MTLSDetails{PeerAuthentications: []*security_v1.PeerAuthentication{pa}},
		[]*security_v1.PeerAuthentication{pa},
		map[string]models.Workloads{},
	)

	vals := checker.Check()
	key := models.BuildKey(kubernetes.PeerAuthentications, "pa", "unknown-ns", config.DefaultClusterID)
	assert.NotNil(vals[key])

	// Unknown namespace should not be treated as root, so no mesh-wide checks
	for _, check := range vals[key].Checks {
		assert.Error(validations.ConfirmIstioCheckMessage("peerauthentication.mtls.destinationrulemissing", check),
			"unknown namespace PA should NOT trigger mesh-wide checker")
		assert.Error(validations.ConfirmIstioCheckMessage("peerauthentications.mtls.disablemeshdestinationrulemissing", check),
			"unknown namespace PA should NOT trigger mesh-wide disabled checker")
	}
}
