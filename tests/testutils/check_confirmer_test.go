package testutils

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/kiali/kiali/models"
)

func TestAssertCheckMessageTestFunction(t *testing.T) {
	check := models.IstioCheck{
		Code:     "KIA0003",
		Message:  "More than one object applied to the same workload",
		Severity: models.ErrorSeverity,
	}
	assert.NoError(t, ConfirmIstioCheckMessage("generic.multimatch.selector", &check))
}
