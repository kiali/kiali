package models

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

func TestIstioValidationsMarshal(t *testing.T) {
	assert := assert.New(t)

	validations := IstioValidations{
		IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Name: "foo", Namespace: "test"}: &IstioValidation{
			Name:      "foo",
			ObjectGVK: kubernetes.VirtualServices,
			Valid:     true,
		},
		IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Name: "bar", Namespace: "test2"}: &IstioValidation{
			Name:      "bar",
			ObjectGVK: kubernetes.VirtualServices,
			Valid:     false,
		},
	}
	b, err := json.Marshal(validations)
	assert.NoError(err)
	assert.Equal(string(b), `{"networking.istio.io/v1, Kind=VirtualService":{"bar.test2":{"name":"bar","namespace":"","cluster":"","objectGVK":{"Group":"networking.istio.io","Version":"v1","Kind":"VirtualService"},"valid":false,"checks":null,"references":null},"foo.test":{"name":"foo","namespace":"","cluster":"","objectGVK":{"Group":"networking.istio.io","Version":"v1","Kind":"VirtualService"},"valid":true,"checks":null,"references":null}}}`)
}

func TestIstioValidationKeyMarshal(t *testing.T) {
	assert := assert.New(t)

	validationKey := IstioValidationKey{
		ObjectGVK: kubernetes.VirtualServices,
		Name:      "foo",
	}
	b, err := json.Marshal(validationKey)
	assert.NoError(err)
	assert.Equal(string(b), `{"objectGVK":{"Group":"networking.istio.io","Version":"v1","Kind":"VirtualService"},"name":"foo","namespace":"","cluster":""}`)
}

func TestSummarizeValidations(t *testing.T) {
	assert := assert.New(t)

	key1 := IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Name: "foo", Namespace: "bookinfo", Cluster: "east"}
	key2 := IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Name: "bar", Namespace: "bookinfo", Cluster: "east"}

	validations := IstioValidations{
		key1: &IstioValidation{
			Name:      "foo",
			ObjectGVK: kubernetes.VirtualServices,
			Valid:     true,
			Checks: []*IstioCheck{
				{Code: "FOO1", Severity: ErrorSeverity, Message: "Message 1"},
				{Code: "FOO2", Severity: WarningSeverity, Message: "Message 2"},
			},
		},
		key2: &IstioValidation{
			Name:      "bar",
			ObjectGVK: kubernetes.VirtualServices,
			Valid:     false,
			Checks: []*IstioCheck{
				{Code: "FOO3", Severity: ErrorSeverity, Message: "Message 3"},
				{Code: "FOO4", Severity: WarningSeverity, Message: "Message 4"},
			},
		},
	}

	summary := validations.SummarizeValidation("bookinfo", "east")

	assert.Equal(2, summary.ObjectCount)
	assert.Equal(2, summary.Warnings)
	assert.Equal(2, summary.Errors)

	// ignore some checks
	conf := config.NewConfig()
	conf.KialiFeatureFlags.Validations.Ignore = []string{"FOO2", "FOO3"}
	config.Set(conf)
	validations.StripIgnoredChecks(conf, nil)
	assert.Equal(1, len(validations[key1].Checks))
	assert.Equal(1, len(validations[key2].Checks))
	summary = validations.SummarizeValidation("bookinfo", "east")
	assert.Equal(2, summary.ObjectCount)
	assert.Equal(1, summary.Warnings)
	assert.Equal(1, summary.Errors)
}

func TestSummarizeValidationsExcludesServiceAndWorkload(t *testing.T) {
	assert := assert.New(t)

	// Service/workload validations use empty Group (not core Kubernetes GVKs).
	serviceGVK := schema.GroupVersionKind{Group: "", Version: "", Kind: "service"}
	workloadGVK := schema.GroupVersionKind{Group: "", Version: "", Kind: "workload"}

	vsKey := IstioValidationKey{ObjectGVK: kubernetes.VirtualServices, Name: "reviews", Namespace: "istio-system", Cluster: "Kubernetes"}
	serviceKey := IstioValidationKey{ObjectGVK: serviceGVK, Name: "grafana", Namespace: "istio-system", Cluster: "Kubernetes"}
	workloadKey := IstioValidationKey{ObjectGVK: workloadGVK, Name: "grafana", Namespace: "istio-system", Cluster: "Kubernetes"}

	// Service-only namespace must report zero Istio Config objects (issue #10473).
	serviceOnly := IstioValidations{
		serviceKey: &IstioValidation{
			Name:      "grafana",
			ObjectGVK: serviceGVK,
			Valid:     true,
			Checks:    []*IstioCheck{},
		},
		workloadKey: &IstioValidation{
			Name:      "grafana",
			ObjectGVK: workloadGVK,
			Valid:     true,
			Checks: []*IstioCheck{
				{Code: "KIA0101", Severity: WarningSeverity, Message: "workload warning"},
			},
		},
	}
	summary := serviceOnly.SummarizeValidation("istio-system", "Kubernetes")
	assert.Equal(0, summary.ObjectCount)
	assert.Equal(0, summary.Warnings)
	assert.Equal(0, summary.Errors)

	mixed := IstioValidations{
		vsKey: &IstioValidation{
			Name:      "reviews",
			ObjectGVK: kubernetes.VirtualServices,
			Valid:     false,
			Checks: []*IstioCheck{
				{Code: "KIA1101", Severity: ErrorSeverity, Message: "vs error"},
			},
		},
		serviceKey:  serviceOnly[serviceKey],
		workloadKey: serviceOnly[workloadKey],
	}
	summary = mixed.SummarizeValidation("istio-system", "Kubernetes")
	assert.Equal(1, summary.ObjectCount)
	assert.Equal(0, summary.Warnings)
	assert.Equal(1, summary.Errors)
}
