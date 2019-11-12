package models

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIstioValidationsMarshal(t *testing.T) {
	assert := assert.New(t)

	validations := IstioValidations{
		IstioValidationKey{ObjectType: "virtualservice", Name: "foo"}: &IstioValidation{
			Name:       "foo",
			ObjectType: "virtualservice",
			Valid:      true,
		},
		IstioValidationKey{ObjectType: "virtualservice", Name: "bar"}: &IstioValidation{
			Name:       "bar",
			ObjectType: "virtualservice",
			Valid:      false,
		},
	}
	b, err := json.Marshal(validations)
	assert.NoError(err)
	assert.Equal(string(b), `{"virtualservice":{"bar":{"name":"bar","objectType":"virtualservice","valid":false,"checks":null,"references":null},"foo":{"name":"foo","objectType":"virtualservice","valid":true,"checks":null,"references":null}}}`)
}

func TestIstioValidationKeyMarshal(t *testing.T) {
	assert := assert.New(t)

	validationKey := IstioValidationKey{
		ObjectType: "virtualservice",
		Name:       "foo",
	}
	b, err := json.Marshal(validationKey)
	assert.NoError(err)
	assert.Equal(string(b), `{"objectType":"virtualservice","name":"foo","namespace":""}`)
}

func TestSummarizeValidations(t *testing.T) {
	assert := assert.New(t)

	validations := IstioValidations{
		IstioValidationKey{ObjectType: "virtualservice", Name: "foo"}: &IstioValidation{
			Name:       "foo",
			ObjectType: "virtualservice",
			Valid:      true,
			Checks: []*IstioCheck{
				{Severity: ErrorSeverity, Message: "Message 1"},
				{Severity: WarningSeverity, Message: "Message 2"},
			},
		},
		IstioValidationKey{ObjectType: "virtualservice", Name: "bar"}: &IstioValidation{
			Name:       "bar",
			ObjectType: "virtualservice",
			Valid:      false,
			Checks: []*IstioCheck{
				{Severity: ErrorSeverity, Message: "Message 3"},
				{Severity: WarningSeverity, Message: "Message 4"},
			},
		},
	}

	summary := validations.SummarizeValidation()

	assert.Equal(2, summary.Warnings)
	assert.Equal(2, summary.Errors)
}
