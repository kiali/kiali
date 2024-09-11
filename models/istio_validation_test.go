package models

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/config"
	"github.com/kiali/kiali/kubernetes"
)

func TestIstioValidationsMarshal(t *testing.T) {
	assert := assert.New(t)

	validations := IstioValidations{
		IstioValidationKey{ObjectType: kubernetes.VirtualServices.String(), Name: "foo", Namespace: "test"}: &IstioValidation{
			Name:       "foo",
			ObjectType: kubernetes.VirtualServices.String(),
			Valid:      true,
		},
		IstioValidationKey{ObjectType: kubernetes.VirtualServices.String(), Name: "bar", Namespace: "test2"}: &IstioValidation{
			Name:       "bar",
			ObjectType: kubernetes.VirtualServices.String(),
			Valid:      false,
		},
	}
	b, err := json.Marshal(validations)
	assert.NoError(err)
	assert.Equal(string(b), `{"networking.istio.io/v1, Kind=VirtualService":{"bar.test2":{"name":"bar","namespace":"","cluster":"","objectType":"networking.istio.io/v1, Kind=VirtualService","valid":false,"checks":null,"references":null},"foo.test":{"name":"foo","namespace":"","cluster":"","objectType":"networking.istio.io/v1, Kind=VirtualService","valid":true,"checks":null,"references":null}}}`)
}

func TestIstioValidationKeyMarshal(t *testing.T) {
	assert := assert.New(t)

	validationKey := IstioValidationKey{
		ObjectType: kubernetes.VirtualServices.String(),
		Name:       "foo",
	}
	b, err := json.Marshal(validationKey)
	assert.NoError(err)
	assert.Equal(string(b), `{"objectType":"networking.istio.io/v1, Kind=VirtualService","name":"foo","namespace":"","cluster":""}`)
}

func TestSummarizeValidations(t *testing.T) {
	assert := assert.New(t)

	key1 := IstioValidationKey{ObjectType: kubernetes.VirtualServices.String(), Name: "foo", Namespace: "bookinfo", Cluster: "east"}
	key2 := IstioValidationKey{ObjectType: kubernetes.VirtualServices.String(), Name: "bar", Namespace: "bookinfo", Cluster: "east"}

	validations := IstioValidations{
		key1: &IstioValidation{
			Name:       "foo",
			ObjectType: kubernetes.VirtualServices.String(),
			Valid:      true,
			Checks: []*IstioCheck{
				{Code: "FOO1", Severity: ErrorSeverity, Message: "Message 1"},
				{Code: "FOO2", Severity: WarningSeverity, Message: "Message 2"},
			},
		},
		key2: &IstioValidation{
			Name:       "bar",
			ObjectType: kubernetes.VirtualServices.String(),
			Valid:      false,
			Checks: []*IstioCheck{
				{Code: "FOO3", Severity: ErrorSeverity, Message: "Message 3"},
				{Code: "FOO4", Severity: WarningSeverity, Message: "Message 4"},
			},
		},
	}

	summary := validations.SummarizeValidation("bookinfo", "east")

	assert.Equal(2, summary.Warnings)
	assert.Equal(2, summary.Errors)

	// ignore some checks
	conf := config.NewConfig()
	conf.KialiFeatureFlags.Validations.Ignore = []string{"FOO2", "FOO3"}
	config.Set(conf)
	validations.StripIgnoredChecks()
	assert.Equal(1, len(validations[key1].Checks))
	assert.Equal(1, len(validations[key2].Checks))
	summary = validations.SummarizeValidation("bookinfo", "east")
	assert.Equal(1, summary.Warnings)
	assert.Equal(1, summary.Errors)
}
