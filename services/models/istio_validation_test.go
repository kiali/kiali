package models

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIstioValidationsMarshal(t *testing.T) {
	assert := assert.New(t)

	validations := IstioValidations{
		IstioValidationKey{"routerule", "foo"}: &IstioValidation{
			Name:       "foo",
			ObjectType: "routerule",
			Valid:      true,
		},
		IstioValidationKey{"routerule", "bar"}: &IstioValidation{
			Name:       "bar",
			ObjectType: "routerule",
			Valid:      false,
		},
	}
	b, err := json.Marshal(validations)
	assert.Empty(err)
	assert.Equal(string(b), `{"routerule":{"bar":{"name":"bar","objectType":"routerule","valid":false,"checks":null},"foo":{"name":"foo","objectType":"routerule","valid":true,"checks":null}}}`)
}
