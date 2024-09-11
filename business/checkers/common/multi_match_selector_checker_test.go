package common

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

func TestTwoSidecarsWithSelector(t *testing.T) {
	assert := assert.New(t)

	validations := SidecarSelectorMultiMatchChecker(
		config.Get().KubernetesConfig.ClusterName,
		"sidecar",
		[]*networking_v1.Sidecar{
			data.AddSelectorToSidecar(map[string]string{
				"app": "reviews",
			}, data.CreateSidecar("sidecar1", "bookinfo")),
			data.AddSelectorToSidecar(map[string]string{
				"app": "details",
			}, data.CreateSidecar("sidecar2", "bookinfo")),
		},
		workloadList(),
	).Check()

	assert.Empty(validations)
}

func TestTwoSidecarsWithoutSelector(t *testing.T) {
	validations := SidecarSelectorMultiMatchChecker(
		config.Get().KubernetesConfig.ClusterName,
		"sidecar",
		[]*networking_v1.Sidecar{
			data.CreateSidecar("sidecar1", "bookinfo"),
			data.CreateSidecar("sidecar2", "bookinfo"),
			data.CreateSidecar("sidecar3", "bookinfo2"),
		},
		workloadList(),
	).Check()

	assertMultimatchFailure(t, "generic.multimatch.selectorless", validations, "sidecar1", []string{"sidecar2"})
	assertMultimatchFailure(t, "generic.multimatch.selectorless", validations, "sidecar2", []string{"sidecar1"})
}

func TestTwoSidecarsWithoutSelectorDifferentNamespaces(t *testing.T) {
	assert := assert.New(t)

	validations := SidecarSelectorMultiMatchChecker(
		config.Get().KubernetesConfig.ClusterName,
		"sidecar",
		[]*networking_v1.Sidecar{
			data.CreateSidecar("sidecar1", "bookinfo"),
			data.CreateSidecar("sidecar2", "bookinfo2"),
		},
		workloadList(),
	).Check()

	assert.Empty(validations)
}

func TestTwoSidecarsTargetingOneDeployment(t *testing.T) {
	sidecars := []*networking_v1.Sidecar{
		data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar1", "bookinfo")),
		data.AddSelectorToSidecar(map[string]string{
			"app":     "reviews",
			"version": "v1",
		}, data.CreateSidecar("sidecar2", "bookinfo")),
		data.AddSelectorToSidecar(map[string]string{
			"app": "details",
		}, data.CreateSidecar("sidecar3", "bookinfo")),
		data.AddSelectorToSidecar(map[string]string{
			"version": "v1",
		}, data.CreateSidecar("sidecar4", "bookinfo")),
	}
	validations := SidecarSelectorMultiMatchChecker(
		config.Get().KubernetesConfig.ClusterName,
		"sidecar",
		sidecars,
		workloadList(),
	).Check()

	assertMultimatchFailure(t, "generic.multimatch.selector", validations, "sidecar1", []string{"sidecar3", "sidecar4"})
	assertMultimatchFailure(t, "generic.multimatch.selector", validations, "sidecar3", []string{"sidecar1", "sidecar4"})
	assertMultimatchFailure(t, "generic.multimatch.selector", validations, "sidecar4", []string{"sidecar1", "sidecar3"})
}

func TestSidecarsCrossNamespaces(t *testing.T) {
	sidecars := []*networking_v1.Sidecar{
		data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar1", "bookinfo")),
		data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar2", "bookinfo")),
		data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar3", "bookinfo2")),
		data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar4", "bookinfo2")),
	}
	validations := SidecarSelectorMultiMatchChecker(
		config.Get().KubernetesConfig.ClusterName,
		"sidecar",
		sidecars,
		workloadList(),
	).Check()

	assertMultimatchFailure(t, "generic.multimatch.selector", validations, "sidecar1", []string{"sidecar2"})
	assertMultimatchFailure(t, "generic.multimatch.selector", validations, "sidecar2", []string{"sidecar1"})
}

func TestSidecarsDifferentNamespaces(t *testing.T) {
	assert := assert.New(t)

	sidecars := []*networking_v1.Sidecar{
		data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v1",
		}, data.CreateSidecar("sidecar1", "bookinfo")),
		data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v2",
		}, data.CreateSidecar("sidecar2", "bookinfo2")),
		data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v3",
		}, data.CreateSidecar("sidecar3", "bookinfo3")),
		data.AddSelectorToSidecar(map[string]string{
			"app":     "details",
			"version": "v4",
		}, data.CreateSidecar("sidecar4", "bookinfo4")),
	}
	validations := SidecarSelectorMultiMatchChecker(
		config.Get().KubernetesConfig.ClusterName,
		"sidecar",
		sidecars,
		workloadList(),
	).Check()

	assert.Empty(validations)
}

func assertMultimatchFailure(t *testing.T, code string, vals models.IstioValidations, item string, references []string) {
	assert := assert.New(t)

	// Global assertion
	assert.NotEmpty(vals)

	// Assert specific's object validation
	validation, ok := vals[models.IstioValidationKey{ObjectType: kubernetes.Sidecars.String(), Namespace: "bookinfo", Name: item}]
	assert.True(ok)
	assert.False(validation.Valid)

	// Assert object's checks
	assert.NotEmpty(validation.Checks)
	assert.Equal(models.ErrorSeverity, validation.Checks[0].Severity)
	assert.NoError(validations.ConfirmIstioCheckMessage(code, validation.Checks[0]))

	// Assert referenced objects
	assert.Len(validation.References, len(references))
	for i, ref := range references {
		assert.Equal(ref, validation.References[i].Name)
		assert.Equal("sidecar", validation.References[i].ObjectType)
	}
}

func workloadList() map[string]models.WorkloadList {
	wli := []models.WorkloadListItem{
		data.CreateWorkloadListItem("details-v1", map[string]string{"app": "details", "version": "v1"}),
		data.CreateWorkloadListItem("details-v2", map[string]string{"app": "details", "version": "v2"}),
		data.CreateWorkloadListItem("details-v3", map[string]string{"app": "details", "version": "v3"}),
	}

	return data.CreateWorkloadsPerNamespace([]string{"bookinfo", "bookinfo2", "bookinfo3", "bookinfo4"}, wli...)
}
