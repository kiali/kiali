package checkers

import (
	"testing"

	"github.com/stretchr/testify/assert"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/models"
	"github.com/kiali/kiali/tests/data"
	"github.com/kiali/kiali/tests/testutils/validations"
)

func TestWorkloadCoveredByMeshWideAuthPolicyMultiCP(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Mesh-wide auth policy in CP1's root namespace (no selector = covers all workloads)
	meshAP := data.CreateEmptyAuthorizationPolicy("mesh-policy", "istio-system-1")

	rootNamespaces := map[string]string{
		"istio-system-1": "istio-system-1",
		"istio-system-2": "istio-system-2",
		"app-ns-1":       "istio-system-1",
		"app-ns-2":       "istio-system-2",
	}

	workloadsPerNamespace := map[string]models.Workloads{
		"app-ns-1": {
			data.CreateWorkload("app-ns-1", "wl-1", map[string]string{"app": "reviews"}),
		},
		"app-ns-2": {
			data.CreateWorkload("app-ns-2", "wl-2", map[string]string{"app": "ratings"}),
		},
	}

	checker := NewWorkloadChecker(
		[]*security_v1.AuthorizationPolicy{meshAP},
		config.DefaultClusterID,
		conf,
		rootNamespaces,
		models.Namespaces{},
		workloadsPerNamespace,
	)

	vals := checker.Check()

	// wl-1 in app-ns-1 is managed by CP1 whose root is istio-system-1.
	// The mesh-wide AP is in istio-system-1, so wl-1 should be covered.
	wl1Key := models.IstioValidationKey{
		ObjectGVK: workloadGVK(),
		Name:      "wl-1",
		Namespace: "app-ns-1",
		Cluster:   config.DefaultClusterID,
	}
	assert.NotNil(vals[wl1Key])
	for _, check := range vals[wl1Key].Checks {
		assert.Error(validations.ConfirmIstioCheckMessage("workload.authorizationpolicy.needstobecovered", check),
			"wl-1 should be covered by the mesh-wide AP from its own CP root")
	}

	// wl-2 in app-ns-2 is managed by CP2 whose root is istio-system-2.
	// The mesh-wide AP is in istio-system-1, NOT istio-system-2, so wl-2 is NOT covered.
	wl2Key := models.IstioValidationKey{
		ObjectGVK: workloadGVK(),
		Name:      "wl-2",
		Namespace: "app-ns-2",
		Cluster:   config.DefaultClusterID,
	}
	assert.NotNil(vals[wl2Key])
	foundUncovered := false
	for _, check := range vals[wl2Key].Checks {
		if err := validations.ConfirmIstioCheckMessage("workload.authorizationpolicy.needstobecovered", check); err == nil {
			foundUncovered = true
		}
	}
	assert.True(foundUncovered, "wl-2 should NOT be covered by mesh-wide AP from a different CP root")
}

func TestWorkloadCoveredBySameNamespaceAuthPolicy(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Auth policy in app-ns-2 with no selector -> covers all workloads in app-ns-2
	ap := data.CreateEmptyAuthorizationPolicy("ns-policy", "app-ns-2")

	rootNamespaces := map[string]string{
		"istio-system": "istio-system",
		"app-ns-2":     "istio-system",
	}

	workloadsPerNamespace := map[string]models.Workloads{
		"app-ns-2": {
			data.CreateWorkload("app-ns-2", "wl-1", map[string]string{"app": "reviews"}),
		},
	}

	checker := NewWorkloadChecker(
		[]*security_v1.AuthorizationPolicy{ap},
		config.DefaultClusterID,
		conf,
		rootNamespaces,
		models.Namespaces{},
		workloadsPerNamespace,
	)

	vals := checker.Check()

	wlKey := models.IstioValidationKey{
		ObjectGVK: workloadGVK(),
		Name:      "wl-1",
		Namespace: "app-ns-2",
		Cluster:   config.DefaultClusterID,
	}
	assert.NotNil(vals[wlKey])
	for _, check := range vals[wlKey].Checks {
		assert.Error(validations.ConfirmIstioCheckMessage("workload.authorizationpolicy.needstobecovered", check),
			"workload should be covered by same-namespace auth policy")
	}
}

func TestWorkloadUncoveredWhenNoMatchingAuthPolicy(t *testing.T) {
	assert := assert.New(t)
	conf := config.NewConfig()
	config.Set(conf)

	// Auth policy in different namespace, not a root namespace for the workload
	ap := data.CreateEmptyAuthorizationPolicy("other-policy", "other-ns")

	rootNamespaces := map[string]string{
		"istio-system": "istio-system",
		"app-ns":       "istio-system",
		"other-ns":     "istio-system",
	}

	workloadsPerNamespace := map[string]models.Workloads{
		"app-ns": {
			data.CreateWorkload("app-ns", "wl-1", map[string]string{"app": "reviews"}),
		},
	}

	checker := NewWorkloadChecker(
		[]*security_v1.AuthorizationPolicy{ap},
		config.DefaultClusterID,
		conf,
		rootNamespaces,
		models.Namespaces{},
		workloadsPerNamespace,
	)

	vals := checker.Check()

	wlKey := models.IstioValidationKey{
		ObjectGVK: workloadGVK(),
		Name:      "wl-1",
		Namespace: "app-ns",
		Cluster:   config.DefaultClusterID,
	}
	assert.NotNil(vals[wlKey])
	foundUncovered := false
	for _, check := range vals[wlKey].Checks {
		if err := validations.ConfirmIstioCheckMessage("workload.authorizationpolicy.needstobecovered", check); err == nil {
			foundUncovered = true
		}
	}
	assert.True(foundUncovered, "workload should be uncovered when AP is in a different non-root namespace")
}

func workloadGVK() schema.GroupVersionKind {
	return schema.GroupVersionKind{Group: "", Version: "", Kind: WorkloadCheckerType}
}
