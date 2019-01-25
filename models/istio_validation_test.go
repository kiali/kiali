package models

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIstioValidationsMarshal(t *testing.T) {
	assert := assert.New(t)

	validations := IstioValidations{
		IstioValidationKey{"virtualservice", "foo"}: &IstioValidation{
			Name:       "foo",
			ObjectType: "virtualservice",
			Valid:      true,
		},
		IstioValidationKey{"virtualservice", "bar"}: &IstioValidation{
			Name:       "bar",
			ObjectType: "virtualservice",
			Valid:      false,
		},
	}
	b, err := json.Marshal(validations)
	assert.Empty(err)
	assert.Equal(string(b), `{"virtualservice":{"bar":{"name":"bar","objectType":"virtualservice","valid":false,"checks":null},"foo":{"name":"foo","objectType":"virtualservice","valid":true,"checks":null}}}`)
}
