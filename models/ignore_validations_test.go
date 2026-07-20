package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
	security_v1 "istio.io/client-go/pkg/apis/security/v1"
	meta_v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

func TestParseIgnoreValidationsAnnotation(t *testing.T) {
	cases := []struct {
		name        string
		annotations map[string]string
		found       bool
		ignoreAll   bool
		codes       []string
	}{
		{
			name:        "annotation not present",
			annotations: map[string]string{},
			found:       false,
		},
		{
			name:        "ignore all validations",
			annotations: map[string]string{IgnoreValidationsAnnotation: ""},
			found:       true,
			ignoreAll:   true,
		},
		{
			name:        "ignore specific validations",
			annotations: map[string]string{IgnoreValidationsAnnotation: "KIA0101,KIA0102"},
			found:       true,
			codes:       []string{"KIA0101", "KIA0102"},
		},
		{
			name:        "ignore specific validations with spaces",
			annotations: map[string]string{IgnoreValidationsAnnotation: " KIA0101 , KIA0102 "},
			found:       true,
			codes:       []string{"KIA0101", "KIA0102"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rule, found := ParseIgnoreValidationsAnnotation(tc.annotations)
			assert.Equal(t, tc.found, found)
			if !tc.found {
				return
			}
			assert.Equal(t, tc.ignoreAll, rule.IgnoreAll)
			assert.Equal(t, tc.codes, rule.Codes)
		})
	}
}

func TestIstioConfigListObjectIgnoreValidations(t *testing.T) {
	configList := IstioConfigList{
		AuthorizationPolicies: []*security_v1.AuthorizationPolicy{
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:        "ignore-all",
					Namespace:   "bookinfo",
					Annotations: map[string]string{IgnoreValidationsAnnotation: ""},
				},
			},
			{
				ObjectMeta: meta_v1.ObjectMeta{
					Name:        "ignore-specific",
					Namespace:   "bookinfo",
					Annotations: map[string]string{IgnoreValidationsAnnotation: "KIA0101,KIA0102"},
				},
			},
		},
	}

	rules := configList.ObjectIgnoreValidations("east")

	ignoreAllKey := BuildKey(kubernetes.AuthorizationPolicies, "ignore-all", "bookinfo", "east")
	ignoreSpecificKey := BuildKey(kubernetes.AuthorizationPolicies, "ignore-specific", "bookinfo", "east")

	assert.True(t, rules[ignoreAllKey].IgnoreAll)
	assert.Equal(t, []string{"KIA0101", "KIA0102"}, rules[ignoreSpecificKey].Codes)
}

func TestBuildWorkloadIgnoreValidationsUsesControllerAnnotations(t *testing.T) {
	workloads := map[string]Workloads{
		"bookinfo": {
			{
				WorkloadListItem: WorkloadListItem{
					Name:        "reviews-v1",
					Annotations: map[string]string{IgnoreValidationsAnnotation: "KIA1301"},
				},
			},
		},
	}

	rules := BuildWorkloadIgnoreValidations(workloads, "east")
	key := BuildKey(schema.GroupVersionKind{Group: "", Version: "", Kind: "workload"}, "reviews-v1", "bookinfo", "east")

	assert.Equal(t, []string{"KIA1301"}, rules[key].Codes)
}

func TestStripIgnoredChecksPerObject(t *testing.T) {
	key := IstioValidationKey{ObjectGVK: kubernetes.AuthorizationPolicies, Name: "policy", Namespace: "bookinfo", Cluster: "east"}
	otherKey := IstioValidationKey{ObjectGVK: kubernetes.AuthorizationPolicies, Name: "other", Namespace: "bookinfo", Cluster: "east"}

	validations := IstioValidations{
		key: &IstioValidation{
			Checks: []*IstioCheck{
				{Code: "KIA0101", Severity: WarningSeverity},
				{Code: "KIA0102", Severity: WarningSeverity},
				{Code: "KIA0106", Severity: ErrorSeverity},
			},
		},
		otherKey: &IstioValidation{
			Checks: []*IstioCheck{
				{Code: "KIA0101", Severity: WarningSeverity},
			},
		},
	}

	conf := config.NewConfig()
	config.Set(conf)

	t.Run("ignore all validations for one object", func(t *testing.T) {
		current := cloneValidations(validations)
		current.StripIgnoredChecks(conf, ObjectIgnoreValidations{
			key: {IgnoreAll: true},
		})
		assert.Empty(t, current[key].Checks)
		assert.Len(t, current[otherKey].Checks, 1)
	})

	t.Run("ignore specific validations for one object", func(t *testing.T) {
		current := cloneValidations(validations)
		current.StripIgnoredChecks(conf, ObjectIgnoreValidations{
			key: {Codes: []string{"KIA0101", "KIA0102"}},
		})
		assert.Len(t, current[key].Checks, 1)
		assert.Equal(t, "KIA0106", current[key].Checks[0].Code)
		assert.Len(t, current[otherKey].Checks, 1)
	})

	t.Run("global and per-object ignores combine", func(t *testing.T) {
		current := cloneValidations(validations)
		confWithGlobal := config.NewConfig()
		confWithGlobal.KialiFeatureFlags.Validations.Ignore = []string{"KIA0106"}
		current.StripIgnoredChecks(confWithGlobal, ObjectIgnoreValidations{
			key: {Codes: []string{"KIA0101"}},
		})
		assert.Len(t, current[key].Checks, 1)
		assert.Equal(t, "KIA0102", current[key].Checks[0].Code)
	})
}

func cloneValidations(source IstioValidations) IstioValidations {
	clone := IstioValidations{}
	for key, validation := range source {
		checks := make([]*IstioCheck, len(validation.Checks))
		copy(checks, validation.Checks)
		clone[key] = &IstioValidation{Checks: checks}
	}
	return clone
}
