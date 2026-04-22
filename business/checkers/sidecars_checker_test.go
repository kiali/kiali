package checkers

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

func TestSidecarWithSelectorInRootNamespaceMultiCP(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Sidecar with selector in root namespace of CP1 should trigger global.selector warning
	sidecarCP1 := data.AddSelectorToSidecar(
		map[string]string{"app": "reviews"},
		data.CreateSidecar("sidecar1", "istio-system-1"),
	)
	// Sidecar with selector in root namespace of CP2 should also trigger global.selector warning
	sidecarCP2 := data.AddSelectorToSidecar(
		map[string]string{"app": "details"},
		data.CreateSidecar("sidecar2", "istio-system-2"),
	)

	rootNamespaces := map[string]string{
		"istio-system-1": "istio-system-1",
		"istio-system-2": "istio-system-2",
	}

	checker := NewSidecarChecker(
		config.DefaultClusterID,
		conf,
		"cluster.local",
		rootNamespaces,
		models.Namespaces{},
		kubernetes.KubeServiceFQDNs(nil, "svc.cluster.local"),
		[]*networking_v1.ServiceEntry{},
		[]*networking_v1.Sidecar{sidecarCP1, sidecarCP2},
		map[string]models.Workloads{},
	)

	vals := checker.Check()

	// Both sidecars are in their respective root namespaces and have selectors -> global.selector warning
	sc1Key := models.BuildKey(kubernetes.Sidecars, "sidecar1", "istio-system-1", config.DefaultClusterID)
	sc2Key := models.BuildKey(kubernetes.Sidecars, "sidecar2", "istio-system-2", config.DefaultClusterID)

	assert.NotNil(vals[sc1Key])
	assert.NotNil(vals[sc2Key])

	for _, v := range []models.IstioValidationKey{sc1Key, sc2Key} {
		found := false
		for _, check := range vals[v].Checks {
			if err := validations.ConfirmIstioCheckMessage("sidecar.global.selector", check); err == nil {
				found = true
			}
		}
		assert.True(found, "expected sidecar.global.selector for %s", v.Name)
	}
}

func TestSidecarInAppNamespaceNotTreatedAsRoot(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Sidecar with selector in app namespace should NOT trigger global.selector warning
	sidecar := data.AddSelectorToSidecar(
		map[string]string{"app": "reviews"},
		data.CreateSidecar("sidecar1", "bookinfo"),
	)

	rootNamespaces := map[string]string{
		"istio-system": "istio-system",
		"bookinfo":     "istio-system",
	}

	checker := NewSidecarChecker(
		config.DefaultClusterID,
		conf,
		"cluster.local",
		rootNamespaces,
		models.Namespaces{},
		kubernetes.KubeServiceFQDNs(nil, "svc.cluster.local"),
		[]*networking_v1.ServiceEntry{},
		[]*networking_v1.Sidecar{sidecar},
		map[string]models.Workloads{},
	)

	vals := checker.Check()
	key := models.BuildKey(kubernetes.Sidecars, "sidecar1", "bookinfo", config.DefaultClusterID)
	assert.NotNil(vals[key])

	for _, check := range vals[key].Checks {
		assert.Error(validations.ConfirmIstioCheckMessage("sidecar.global.selector", check),
			"should NOT get sidecar.global.selector for app namespace")
	}
}

func TestSidecarUnknownNamespaceNotTreatedAsRoot(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Sidecar with selector in unknown namespace (not in map) should not trigger global.selector
	sidecar := data.AddSelectorToSidecar(
		map[string]string{"app": "reviews"},
		data.CreateSidecar("sidecar1", "unknown-ns"),
	)

	checker := NewSidecarChecker(
		config.DefaultClusterID,
		conf,
		"cluster.local",
		map[string]string{"istio-system": "istio-system"},
		models.Namespaces{},
		kubernetes.KubeServiceFQDNs(nil, "svc.cluster.local"),
		[]*networking_v1.ServiceEntry{},
		[]*networking_v1.Sidecar{sidecar},
		map[string]models.Workloads{},
	)

	vals := checker.Check()
	key := models.BuildKey(kubernetes.Sidecars, "sidecar1", "unknown-ns", config.DefaultClusterID)
	assert.NotNil(vals[key])

	for _, check := range vals[key].Checks {
		assert.Error(validations.ConfirmIstioCheckMessage("sidecar.global.selector", check),
			"should NOT get sidecar.global.selector for unknown namespace")
	}
}
