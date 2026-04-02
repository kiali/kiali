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
		rootNamespaces,
		kubernetes.MTLSDetails{PeerAuthentications: []*security_v1.PeerAuthentication{pa}},
		[]*security_v1.PeerAuthentication{pa},
		map[string]models.Workloads{},
	)

	validations := checker.Check()
	assert.NotNil(validations)
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
		rootNamespaces,
		kubernetes.MTLSDetails{PeerAuthentications: allPAs},
		allPAs,
		map[string]models.Workloads{},
	)

	validations := checker.Check()
	assert.NotNil(validations)

	// All three PAs should produce validation entries
	assert.Len(validations, 3)
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
		map[string]string{"istio-system": "istio-system"},
		kubernetes.MTLSDetails{PeerAuthentications: []*security_v1.PeerAuthentication{pa}},
		[]*security_v1.PeerAuthentication{pa},
		map[string]models.Workloads{},
	)

	validations := checker.Check()
	assert.NotNil(validations)

	// Should still produce a validation (namespace-wide path, not mesh-wide)
	assert.Len(validations, 1)
}
